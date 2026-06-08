import type { Writable } from 'svelte/store';
import type {
  CombineResult,
  GameResult,
  GameSession,
  HandPart,
  Level,
  Part,
  PersistedState,
  PlayStats,
  ZukanState,
} from '../domain/types';
import { GACHA_COUNT, HAND_CAP, HINT_COST } from '../domain/constants';
import { CombineService } from '../domain/combine/CombineService';
import { GachaService } from '../domain/gacha/GachaService';
import { ScoreService } from '../domain/score/ScoreService';
import { RescueService } from '../domain/rescue/RescueService';
import { resolveRank } from '../domain/rank/resolveRank';
import { mulberry32 } from '../domain/rng/mulberry32';
import { dailySeed, todayYmdJst } from '../domain/rng/dailySeed';
import type { Rng } from '../domain/rng/Rng';
import type { DictionaryRepository } from '../data/DictionaryRepository';
import type { StorageRepository } from '../data/StorageRepository';
import { sessionStore } from './stores/sessionStore';
import { persistedStore } from './stores/persistedStore';

/** SessionManager の依存差し替え（テスト容易性）。既定は実時刻・実乱数・モジュール store。 */
export interface SessionManagerOptions {
  /** 現在時刻（epoch ms）。デイリーシードと所要時間に使う。テストで固定する。 */
  now?: () => number;
  /** フリープレイ用の乱数源（[0,1)）。テストで決定化する。 */
  random?: () => number;
  sessionStore?: Writable<GameSession | null>;
  persistedStore?: Writable<PersistedState>;
}

/** 手札内一意IDの採番器（セッション毎に生成）。決定的（カウンタ）でデイリー再現を壊さない。 */
function makeIdFactory(): () => string {
  let n = 0;
  return () => `h${n++}`;
}

function freshStats(): PlayStats {
  return {
    combineSuccess: 0,
    combineMiss: 0,
    hintUsed: 0,
    discardUsed: 0,
    endReason: null,
    finalScore: 0,
    newDiscoveries: 0,
    durationMs: 0,
  };
}

/**
 * セッション進行のオーケストレーション（機能設計5.1・4.5 / PRD F1〜F6）。ドメイン層（ガチャ/合体/
 * スコア/救済/称号/詰み判定）とデータ層（辞書/永続化）を束ね、Svelte store を更新する。
 *
 * **RNG の生成・注入はここで行う**（ドメイン純粋性の境界・guidelines 2.1）：フリーは `Math.random`
 * ラッパ、デイリーは `mulberry32(dailySeed(todayYmdJst(now)))`。`now`/`random`/store は注入可能で、
 * デイリー再現（固定日付で同一ガチャ列）を決定的にテストできる。
 *
 * `GameSession` はその場更新し、各操作後に store へ publish する。終了判定（`checkGameEnd`）を
 * 全操作後に実施し、`end` で永続化（図鑑/ベスト/デイリーベスト）と称号確定を行う。
 */
export class SessionManager {
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly sessionStore: Writable<GameSession | null>;
  private readonly persistedStore: Writable<PersistedState>;

  // level 非依存のドメインサービス（構築時に1度だけ生成）
  private readonly combineService: CombineService;
  private readonly gacha: GachaService;
  private readonly score: ScoreService;

  // セッション毎に確定する状態
  private session: GameSession | null = null;
  private result: GameResult | null = null;
  private rng: Rng = Math.random;
  private nextId: () => string = makeIdFactory();
  private rescue: RescueService | null = null;
  private pool: Part[] = [];
  private partsById = new Map<string, Part>();
  private persisted: PersistedState;
  private baselineDiscovered = new Set<string>();
  private altChars: string[] = [];
  private startedAtMs = 0;

  constructor(
    private readonly dict: DictionaryRepository,
    private readonly storage: StorageRepository,
    opts: SessionManagerOptions = {}
  ) {
    this.now = opts.now ?? (() => Date.now());
    this.random = opts.random ?? (() => Math.random());
    this.sessionStore = opts.sessionStore ?? sessionStore;
    this.persistedStore = opts.persistedStore ?? persistedStore;

    this.combineService = new CombineService(
      dict.combineEntries,
      dict.kanjiEntries
    );
    this.gacha = new GachaService();
    this.score = new ScoreService();

    // 永続データの初期ビューを反映（起動時ロード）
    this.persisted = this.storage.loadState();
    this.persistedStore.set(this.persisted);
  }

  /** テスト用：現在のセッション（未開始は null）。 */
  getSession(): GameSession | null {
    return this.session;
  }

  /** テスト用：直近の終了結果（未終了は null）。 */
  getResult(): GameResult | null {
    return this.result;
  }

  /**
   * 手札部品の表示情報（文字・レアリティ）を解決する（UI 用）。UI が `domain`/`data` に直接触れずに
   * partId から表示を得る唯一の窓口。未知の partId（プール外）は null。
   */
  partView(partId: string): { char: string; rarity: number } | null {
    const part = this.partsById.get(partId);
    return part ? { char: part.char, rarity: part.rarity } : null;
  }

  /**
   * ガチャを引ける状態か（UI のボタン非活性判定用）。`pullGacha` の事前条件と同一規則を共有する
   * （UI が HAND_CAP 等を持たずに済む）。playing かつ 手札に空き かつ 残回数あり。
   */
  canPullGacha(s: GameSession): boolean {
    return (
      s.phase === 'playing' && s.hand.length < HAND_CAP && s.gachaRemaining > 0
    );
  }

  /**
   * ヒントを使える状態か（UI のボタン非活性判定用）。むずかしい（`HINT_COST=null`）は利用不可、
   * ふつうはガチャ残がコスト以上必要（`RescueService.useHint` の事前条件と DRY）。
   */
  canUseHint(s: GameSession): boolean {
    const cost = HINT_COST[s.level];
    return s.phase === 'playing' && cost !== null && s.gachaRemaining >= cost;
  }

  /**
   * セッションを開始する。RNG を生成（free=`Math.random` ラッパ／daily=`mulberry32(dailySeed(...))`）し、
   * level 依存の救済サービスと採番器をセッション毎に用意する。
   */
  start(level: Level, mode: 'free' | 'daily'): GameSession {
    let seed: number | null = null;
    if (mode === 'daily') {
      seed = dailySeed(todayYmdJst(this.now()));
      this.rng = mulberry32(seed);
    } else {
      this.rng = () => this.random();
    }

    this.nextId = makeIdFactory();
    // pool は level 依存。セッション毎に1度引き、pullGacha と救済の補充ガチャで共有する。
    this.pool = this.dict.getPool(level);
    // 手札の partId → 部品 を引くための索引（UI の表示解決に使う。ui→data 直接アクセスを避ける）。
    this.partsById = new Map(this.pool.map((p) => [p.id, p]));
    this.rescue = new RescueService(
      this.combineService,
      this.gacha,
      this.pool,
      this.nextId
    );

    // 永続ベースライン（新規発見判定・終了時の図鑑反映の起点）
    this.persisted = this.storage.loadState();
    this.persistedStore.set(this.persisted);
    this.baselineDiscovered = new Set(
      Object.keys(this.persisted.zukan.discovered)
    );
    this.altChars = [];
    this.startedAtMs = this.now();
    this.result = null;

    const session: GameSession = {
      level,
      mode,
      seed,
      gachaRemaining: GACHA_COUNT,
      hand: [],
      score: { score: 0, comboMultiplier: 1.0, comboCount: 0 },
      createdKanji: [],
      newlyDiscovered: [],
      stats: freshStats(),
      phase: 'playing',
    };
    this.session = session;
    this.publish();
    return session;
  }

  /**
   * ガチャを1回引く（PRD F1）。事前条件：playing かつ手札に空きがあり残回数がある。
   * 上限到達・残0は no-op（UI 側もボタン非活性・T-017）。引いた部品を手札へ追加し終了判定する。
   */
  pullGacha(s: GameSession): void {
    if (s.phase !== 'playing') return;
    if (s.hand.length >= HAND_CAP || s.gachaRemaining <= 0) {
      // 引けない事前条件（防御）。残0で呼ばれた場合は詰み/手札0の終了判定だけ走らせる
      // （「各操作後に終了判定」の一貫性。UI外から呼ばれても limbo に陥らない）。
      if (s.gachaRemaining === 0) this.checkGameEnd(s);
      this.publish();
      return;
    }

    const part = this.gacha.draw(s.level, this.pool, this.rng);
    s.hand.push({ instanceId: this.nextId(), partId: part.id });
    s.gachaRemaining -= 1;

    this.checkGameEnd(s);
    this.publish();
  }

  /**
   * 選択部品で合体を試みる（PRD F2・F4）。成立＝採点＋図鑑反映＋コンボ前進、不成立＝ミス（コンボリセット）。
   * 無効入力（手札外/2枚未満）は副作用なしの失敗を返す（UI がボタン非活性・機能設計11）。
   */
  combine(s: GameSession, sel: HandPart[]): CombineResult {
    const miss: CombineResult = {
      success: false,
      resolved: null,
      gainedScore: 0,
    };
    if (s.phase !== 'playing') return miss;

    // 防御：選択がすべて現在の手札に存在し、2枚以上であること
    const inHand = sel.every((h) =>
      s.hand.some((x) => x.instanceId === h.instanceId)
    );
    if (sel.length < 2 || !inHand) return miss;

    const resolved = this.combineService.resolve(sel, s.level);
    if (resolved === null) {
      this.score.onMiss(s.score);
      s.stats.combineMiss += 1;
      this.checkGameEnd(s);
      this.publish();
      return miss;
    }

    // 成立：選択部品を手札から除去
    const ids = new Set(sel.map((h) => h.instanceId));
    s.hand = s.hand.filter((h) => !ids.has(h.instanceId));

    // 採点（前進前倍率で加点）。差分を gainedScore として返す。
    const before = s.score.score;
    this.score.onSuccess(s.score, resolved.awarded);
    const gainedScore = s.score.score - before;

    // 作成漢字・新規発見・別解の記録
    const awardedChar = resolved.awarded.char;
    s.createdKanji.push(awardedChar);
    if (
      !this.baselineDiscovered.has(awardedChar) &&
      !s.newlyDiscovered.includes(awardedChar)
    ) {
      s.newlyDiscovered.push(awardedChar);
      s.stats.newDiscoveries += 1;
    }
    for (const alt of resolved.altInScope) this.altChars.push(alt.char);
    s.stats.combineSuccess += 1;

    this.checkGameEnd(s);
    this.publish();
    return { success: true, resolved, gainedScore };
  }

  /**
   * 捨てて引き直す（PRD F5）。RescueService に委譲（手札1枚削除＋レベル別コスト＋補充ガチャ）。
   * 実行できた場合のみ KPI を加算する（対象 instanceId が手札から消えたかで判定）。
   */
  discardAndDraw(s: GameSession, instanceId: string): void {
    if (s.phase !== 'playing' || this.rescue === null) return;
    const existed = s.hand.some((h) => h.instanceId === instanceId);
    this.rescue.discardAndDraw(s, instanceId, this.rng);
    const removed = existed && !s.hand.some((h) => h.instanceId === instanceId);
    if (removed) s.stats.discardUsed += 1;

    this.checkGameEnd(s);
    this.publish();
  }

  /**
   * ヒント（PRD F5）。RescueService に委譲し、合体可能な1組を返す。提供できた場合のみ KPI を加算。
   * むず＝利用不可・残不足・詰みは null（コスト消費なし）。
   */
  useHint(s: GameSession): HandPart[] | null {
    if (s.phase !== 'playing' || this.rescue === null) return null;
    const hint = this.rescue.useHint(s);
    if (hint !== null) s.stats.hintUsed += 1;

    this.checkGameEnd(s);
    this.publish();
    return hint;
  }

  /**
   * 終了判定（F6・機能設計4.5）。各操作後に呼ぶ。
   *  - 手札0 かつ ガチャ残0 → empty_hand
   *  - ガチャ残0 かつ 合体不能 → stuck（PRD「詰み終了」）
   *  - それ以外は継続（残0でも合体可能なら続く）
   */
  private checkGameEnd(s: GameSession): void {
    // 呼び出し元（pullGacha/combine/discardAndDraw/useHint）が phase==='playing' を確認済み。
    if (s.hand.length === 0 && s.gachaRemaining === 0) {
      this.end(s, 'empty_hand');
      return;
    }
    if (
      s.gachaRemaining === 0 &&
      !this.combineService.canCombineAny(s.hand, s.level)
    ) {
      this.end(s, 'stuck');
    }
  }

  /**
   * セッションを終了し結果を確定する（機能設計5.1）。冪等：既に終了済みなら確定済み結果を返す。
   * 図鑑・レベル別ベスト・（デイリーは）デイリーベストを**まとめて永続化**し（書込み集約・機能設計9）、
   * 称号を確定して `GameResult` を返す。
   */
  end(s: GameSession, reason: 'stuck' | 'empty_hand'): GameResult {
    if (s.phase === 'ended' && this.result !== null) return this.result;

    s.phase = 'ended';
    s.stats.endReason = reason;
    s.stats.finalScore = s.score.score;
    s.stats.durationMs = this.now() - this.startedAtMs;

    // 新記録判定は永続化の前に行う（persistResults が best を更新し this.persisted を読み直すため）。
    // daily も現状はレベルベストで比較する（T-022 で dailyBest 比較への置換を検討）。
    const isNewBest = s.score.score > this.persisted.bestScores[s.level];

    this.persistResults(s);

    const result: GameResult = {
      level: s.level,
      mode: s.mode,
      score: s.score.score,
      rank: resolveRank(s.score.score),
      createdKanji: [...s.createdKanji],
      newlyDiscovered: [...s.newlyDiscovered],
      reason,
      durationMs: s.stats.durationMs,
      isNewBest,
    };
    this.result = result;
    this.publish();
    return result;
  }

  /** 終了時の永続化：図鑑（作成漢字/別解）・ベスト・デイリーベストを集約して書き込む。 */
  private persistResults(s: GameSession): void {
    const iso = new Date(this.now()).toISOString();
    const zukan = this.cloneZukan(this.persisted.zukan);
    for (const char of s.createdKanji)
      addDiscovery(zukan.discovered, char, iso);
    for (const char of this.altChars)
      addDiscovery(zukan.altDiscovered, char, iso);

    this.storage.saveZukan(zukan);
    this.storage.saveBest(s.level, s.score.score);
    if (s.mode === 'daily') {
      this.storage.saveDailyBest(todayYmdJst(this.now()), s.score.score);
    }

    // 永続ビューを最新化（図鑑/ベストの読み取りビュー）
    this.persisted = this.storage.loadState();
    this.persistedStore.set(this.persisted);
  }

  private cloneZukan(z: ZukanState): ZukanState {
    return {
      discovered: structuredClone(z.discovered),
      altDiscovered: structuredClone(z.altDiscovered),
    };
  }

  /**
   * 現在のセッションを store へ反映する。**毎回シャローコピーを発行**して top-level 参照を変える：
   * `GameSession` をその場更新するため、同一参照を set すると Svelte 5 の store→signal 橋渡しが
   * 参照等価でデデュープし再描画されない。新しい top-level 参照にすることで再描画を発火させる。
   * （ネストの `score`/`hand`/`stats` は正本とライブ共有＝深いスナップショットではない。表示専用で
   * 読むため問題ない。コマンドは `getSession()`（正本）に対して実行する。architecture 4）。
   */
  private publish(): void {
    this.sessionStore.set(this.session === null ? null : { ...this.session });
  }
}

/** 図鑑の発見レコードに1件加算する（初回は firstAt を設定、以降は count++）。 */
function addDiscovery(
  map: Record<string, { firstAt: string; count: number }>,
  char: string,
  iso: string
): void {
  const entry = map[char];
  if (entry) entry.count += 1;
  else map[char] = { firstAt: iso, count: 1 };
}
