import type { Writable } from 'svelte/store';
import type {
  CombineResult,
  GameMode,
  GameResult,
  GameSession,
  HandPart,
  Level,
  Part,
  PersistedState,
  PlayStats,
  ZukanState,
} from '../domain/types';
import {
  DISCARD_COST,
  GACHA_COUNT,
  HAND_CAP,
  HINT_COST,
  TIME_ATTACK,
} from '../domain/constants';
import { CombineService } from '../domain/combine/CombineService';
import { GachaService } from '../domain/gacha/GachaService';
import { ScoreService } from '../domain/score/ScoreService';
import { computeExtensionMs } from '../domain/timeattack/timeAttack';
import { RescueService } from '../domain/rescue/RescueService';
import { resolveRank } from '../domain/rank/resolveRank';
import { selectReviewTargets, updateWeakKanji } from '../domain/review/srs';
import { mulberry32 } from '../domain/rng/mulberry32';
import { dailyLevel, dailySeed, todayYmdJst } from '../domain/rng/dailySeed';
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
  /** タイムアタックの初期持ち時間（ms）。既定は TIME_ATTACK.initialMs。E2E/テストで短縮する無害なレバー。 */
  timeAttackInitialMs?: number;
  /** 達成型（deck）の山札枚数の上限。E2E/テストで短縮するための無害なレバー（既定は無制限）。 */
  deckLimit?: number;
  sessionStore?: Writable<GameSession | null>;
  persistedStore?: Writable<PersistedState>;
}

/**
 * レベルから既定の出題対象学年を返す（grades 未指定時のフォールバック・T-028）。
 * 小学生モード＝小1〜小6、大人モード（juniorhigh 相当）＝中学以降の常用（grade 8）。
 */
function defaultGradesForLevel(level: Level): number[] {
  if (level === 'elementary') return [1, 2, 3, 4, 5, 6];
  if (level === 'juniorhigh') return [8];
  return [1, 2, 3, 4, 5, 6, 8]; // joyo（deck では通常未使用のフォールバック）
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
  private readonly timeAttackInitialMs: number;
  private readonly deckLimit: number | null;
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
  // deck（達成型）の対象漢字集合。収集率（completedCount）算出に使う。timeAttack では空。
  private deckTargets = new Set<string>();
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
    this.timeAttackInitialMs =
      opts.timeAttackInitialMs ?? TIME_ATTACK.initialMs;
    this.deckLimit = opts.deckLimit ?? null;
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
   * 漢字の表示情報（読み・意味）を解決する（図鑑 UI 用・T-020）。UI が `data` に直接触れずに
   * char から読み/意味を得る窓口。辞書に無い char は null（getKanji と異なり throw しない）。
   */
  kanjiView(
    char: string
  ): { char: string; readings: string[]; meanings: string[] } | null {
    const entry = this.dict.kanjiEntries.get(char);
    return entry
      ? { char: entry.char, readings: entry.readings, meanings: entry.meanings }
      : null;
  }

  /**
   * 図鑑の収集率の分母 N（到達可能 primary 漢字の総数・機能設計8.1）。joyo scope は
   * elementary⊆juniorhigh⊆joyo を内包する最大集合なので、全体の到達可能総数として使う。
   */
  reachableTotal(): number {
    return this.dict.getReachableN('joyo');
  }

  /**
   * 図鑑の学習帳表示用の詳細ビュー（T-036）。読み・意味に加えて画数・学年・構成部品（部品文字）を返す。
   * 部品は分解辞書（`partsForKanji`）から導出する。辞書に無い char は null。
   */
  kanjiStudyView(char: string): {
    char: string;
    readings: string[];
    meanings: string[];
    strokes: number;
    grade: number;
    parts: string[];
  } | null {
    const entry = this.dict.kanjiEntries.get(char);
    if (entry === undefined) return null;
    return {
      char: entry.char,
      readings: entry.readings,
      meanings: entry.meanings,
      strokes: entry.strokes,
      grade: entry.grade,
      parts: this.dict.partsForKanji(char).map((p) => p.char),
    };
  }

  /**
   * 小学校の学年別（小1〜小6）の対象漢字数（makeable）を返す（T-036 学年別収集率の分母）。
   * 図鑑が「収集済み / 総数」を学年バーで表示するために使う。
   */
  gradeTotals(): { grade: number; total: number }[] {
    return [1, 2, 3, 4, 5, 6].map((grade) => ({
      grade,
      total: this.dict.deckTargetKanji([grade]).length,
    }));
  }

  /**
   * 選択部品が作る漢字の表示情報を**副作用なし**で先読みする（段階ヒント・T-033）。
   * スコア・KPI・手札を変更しない。成立しない選択は null。現在のセッションレベルで判定する。
   */
  previewAwarded(
    sel: HandPart[]
  ): { char: string; readings: string[]; meanings: string[] } | null {
    if (this.session === null) return null;
    const resolved = this.combineService.resolve(sel, this.session.level);
    if (resolved === null) return null;
    const { char, readings, meanings } = resolved.awarded;
    return { char, readings, meanings };
  }

  /**
   * ふりがな表示設定を切り替えて永続化する（T-031）。`persistedStore` を更新して UI に反映する。
   * セッション外（Home 等）からも呼べる（設定はゲーム進行に依存しない）。
   */
  setFurigana(on: boolean): void {
    this.storage.saveSettings({ ...this.persisted.settings, furigana: on });
    this.persisted = this.storage.loadState();
    this.persistedStore.set(this.persisted);
  }

  /** 初回チュートリアルの完了/スキップを記録する（T-034）。`persistedStore` を更新する。 */
  setTutorialDone(done: boolean): void {
    this.storage.saveSettings({
      ...this.persisted.settings,
      tutorialDone: done,
    });
    this.persisted = this.storage.loadState();
    this.persistedStore.set(this.persisted);
  }

  /** 文字サイズ拡大設定を切り替えて永続化する（T-037）。`persistedStore` を更新する。 */
  setLargeText(on: boolean): void {
    this.storage.saveSettings({ ...this.persisted.settings, largeText: on });
    this.persisted = this.storage.loadState();
    this.persistedStore.set(this.persisted);
  }

  /** 読み上げ（音声）設定を切り替えて永続化する（T-032）。`persistedStore` を更新する。 */
  setTts(on: boolean): void {
    this.storage.saveSettings({ ...this.persisted.settings, tts: on });
    this.persisted = this.storage.loadState();
    this.persistedStore.set(this.persisted);
  }

  /**
   * 「今日のお題」の対象レベルと日付キー（機能設計4.6・F8・T-022）。`now`（注入時刻）から JST 日付を求め、
   * 日替わり固定のレベルを決める。Home が表示（レベル併記・デイリーベスト）と `start(level,'daily')` に使う。
   */
  dailyInfo(): { level: Level; ymd: string } {
    const ymd = todayYmdJst(this.now());
    const lvl = dailyLevel(dailySeed(ymd));
    // 達成型（deck）は elementary / juniorhigh のみ。joyo はタイムアタック専用のため
    // デイリーでは juniorhigh に丸める（むずかしい廃止に伴う調整）。
    return { level: lvl === 'joyo' ? 'juniorhigh' : lvl, ymd };
  }

  /**
   * ガチャを引ける状態か（UI のボタン非活性判定用）。`pullGacha` の事前条件と同一規則を共有する
   * （UI が HAND_CAP 等を持たずに済む）。playing かつ 手札に空き かつ 残回数あり。
   */
  canPullGacha(s: GameSession): boolean {
    if (s.phase !== 'playing' || s.hand.length >= HAND_CAP) return false;
    // タイムアタックはガチャ無制限（残回数を見ない）。じっくりは残回数が必要。
    if (s.gameMode === 'timeAttack') return true;
    return s.gachaRemaining > 0;
  }

  /**
   * ヒントを使える状態か（UI のボタン非活性判定用）。むずかしい（`HINT_COST=null`）は利用不可、
   * ふつうはガチャ残がコスト以上必要（`RescueService.useHint` の事前条件と DRY）。
   */
  canUseHint(s: GameSession): boolean {
    if (s.phase !== 'playing') return false;
    // 達成型（deck）はヒント無料・常時。タイムアタックは従来のレベル別コスト（joyo は不可）。
    if (s.gameMode === 'deck') return true;
    const cost = HINT_COST[s.level];
    return cost !== null && s.gachaRemaining >= cost;
  }

  /**
   * セッションを開始する。RNG を生成（free=`Math.random` ラッパ／daily=`mulberry32(dailySeed(...))`）し、
   * 採番器・モード別の母集合（deck は山札・timeAttack は重み付きプール）をセッション毎に用意する。
   *
   * `gameMode`（既定 `deck`）：
   *  - deck（達成型）：対象レベルの漢字を分解した有限山札をシャッフルして引く。回数制限なし。
   *  - timeAttack：常用スコープの重み付き無限プール抽選＋持ち時間制（`deadlineAtMs` 初期化）。
   */
  start(
    level: Level,
    mode: 'free' | 'daily',
    gameMode: GameMode = 'deck',
    opts: { grades?: number[]; count?: number; review?: boolean } = {}
  ): GameSession {
    let seed: number | null = null;
    if (mode === 'daily') {
      seed = dailySeed(todayYmdJst(this.now()));
      this.rng = mulberry32(seed);
    } else {
      this.rng = () => this.random();
    }

    this.nextId = makeIdFactory();

    // 永続ベースライン（新規発見判定・終了時の図鑑反映の起点）
    this.persisted = this.storage.loadState();
    this.persistedStore.set(this.persisted);
    this.baselineDiscovered = new Set(
      Object.keys(this.persisted.zukan.discovered)
    );
    this.altChars = [];
    this.startedAtMs = this.now();
    this.result = null;

    let deck: string[] = [];
    let targetTotal = 0;
    let gachaRemaining = 0;
    let deadlineAtMs: number | null = null;
    let deckGrades: number[] = [];

    if (gameMode === 'timeAttack') {
      // タイムアタック：重み付きプールを母集合に、回数無制限・時間制で引く。
      this.pool = this.dict.getPool(level);
      this.partsById = new Map(this.pool.map((p) => [p.id, p]));
      this.rescue = new RescueService(
        this.combineService,
        this.gacha,
        this.pool,
        this.nextId
      );
      this.deckTargets = new Set();
      gachaRemaining = GACHA_COUNT; // discard コスト用の残（時間制では表示しない）
      deadlineAtMs = this.startedAtMs + this.timeAttackInitialMs;
    } else {
      // 達成型（deck・T-028/T-029/T-035）：対象字を選び、その部品だけで山札を構築（重複あり）。
      // 引きはシャッフルして非復元。対象の選び方は通常（学年サンプリング）と復習（にがて優先）で分岐する。
      let chosen: string[];
      if (opts.review === true) {
        // 復習モード（T-035）：にがて漢字のうち作れる字を、重み優先で出題対象に選ぶ。
        // 学年に依存しないため deckGrades は空（Result の「もう一回」は review フラグで再現する）。
        const weak = this.persisted.weakKanji;
        const candidates = Object.keys(weak).filter(
          (char) => this.dict.partsForKanji(char).length > 0
        );
        const requested = opts.count ?? candidates.length;
        // 通常 deck（下限1）と異なり 0 を許容するのは意図的：作れるにがて字が無ければ
        // 空セッション（targetTotal=0・即 deck_empty 終了）にフォールバックする。
        // Home は weakCount>0 を事前確認するが、全字が分解エントリ非保持の場合の安全策。
        const n = Math.min(Math.max(0, requested), candidates.length);
        chosen = selectReviewTargets(weak, candidates, n, this.rng);
      } else {
        deckGrades = opts.grades ?? defaultGradesForLevel(level);
        const allTargets = this.dict.deckTargetKanji(deckGrades);
        const requested = opts.count ?? allTargets.length;
        const n = Math.min(Math.max(1, requested), allTargets.length);
        chosen = this.sampleN(allTargets, n);
      }
      this.deckTargets = new Set(chosen);

      const builtParts: Part[] = [];
      for (const char of chosen)
        builtParts.push(...this.dict.partsForKanji(char));
      this.partsById = new Map(builtParts.map((p) => [p.id, p]));
      this.pool = [];
      this.rescue = null;
      deck = this.shuffle(builtParts.map((p) => p.id));
      // E2E/テスト用に山札枚数を上限で切り詰める（無害なレバー・既定は無制限）。
      if (this.deckLimit !== null && deck.length > this.deckLimit) {
        deck = deck.slice(0, this.deckLimit);
      }
      targetTotal = this.deckTargets.size;
      gachaRemaining = deck.length; // 山札残（UI 表示・canPull 用）
    }

    const session: GameSession = {
      level,
      mode,
      gameMode,
      isReview: gameMode === 'deck' && opts.review === true,
      seed,
      deck,
      targetTotal,
      deckGrades,
      gachaRemaining,
      deadlineAtMs,
      lastSuccessAtMs: null,
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

  /** Fisher–Yates シャッフル（注入 RNG 使用＝デイリーはシードで再現可能）。 */
  private shuffle(arr: string[]): string[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** 配列から RNG で n 件を非復元サンプリングする（出題数 N 字の選出・T-029）。 */
  private sampleN(arr: readonly string[], n: number): string[] {
    return this.shuffle([...arr]).slice(0, n);
  }

  /**
   * ガチャを1回引く（PRD F1）。事前条件：playing かつ手札に空きがあり残回数がある。
   * 上限到達・残0は no-op（UI 側もボタン非活性・T-017）。引いた部品を手札へ追加し終了判定する。
   */
  pullGacha(s: GameSession): void {
    if (s.phase !== 'playing') return;
    // 手札上限は両モード共通の防御。
    if (s.hand.length >= HAND_CAP) {
      this.publish();
      return;
    }

    if (s.gameMode === 'deck') {
      // 達成型：山札末尾から非復元で1枚引く。山札が尽きていれば終了判定のみ走らせる。
      const partId = s.deck.pop();
      if (partId === undefined) {
        this.checkGameEnd(s);
        this.publish();
        return;
      }
      s.hand.push({ instanceId: this.nextId(), partId });
      s.gachaRemaining = s.deck.length; // 山札残を同期
    } else {
      // タイムアタック：重み付きプールから無制限に引く（残回数を減らさない）。
      const part = this.gacha.draw(s.level, this.pool, this.rng);
      s.hand.push({ instanceId: this.nextId(), partId: part.id });
    }

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
      // タイムアタック：ミスは持ち時間を減算（コンボリセットは onMiss 済み・T-027）。
      if (s.gameMode === 'timeAttack' && s.deadlineAtMs !== null) {
        s.deadlineAtMs -= TIME_ATTACK.missPenaltyMs;
      }
      this.checkGameEnd(s);
      this.publish();
      return miss;
    }

    // 達成型：すでに作成済みの漢字は作れない（重複禁止・T-029）。
    // 無効（ノーペナルティ）：部品消費なし・コンボ維持・KPI 不変。UI に duplicate を通知。
    if (
      s.gameMode === 'deck' &&
      s.createdKanji.includes(resolved.awarded.char)
    ) {
      this.publish();
      return {
        success: false,
        resolved: null,
        gainedScore: 0,
        duplicate: true,
      };
    }

    // 成立：選択部品を手札から除去
    const ids = new Set(sel.map((h) => h.instanceId));
    s.hand = s.hand.filter((h) => !ids.has(h.instanceId));

    // 採点（前進前倍率で加点）。差分を gainedScore として返す。
    // 時間延長も同じ前進前倍率を「この合体の価値」として用いる（T-027）。
    const multiplierForThis = s.score.comboMultiplier;
    const before = s.score.score;
    this.score.onSuccess(s.score, resolved.awarded);
    const gainedScore = s.score.score - before;

    // タイムアタック：持ち時間を延長し、速攻判定用の直近成功時刻を更新する（T-027・企画整理書 §11）。
    if (s.gameMode === 'timeAttack' && s.deadlineAtMs !== null) {
      const nowMs = this.now();
      const speedy =
        s.lastSuccessAtMs !== null &&
        nowMs - s.lastSuccessAtMs <= TIME_ATTACK.speedWindowMs;
      s.deadlineAtMs += computeExtensionMs({
        strokes: resolved.awarded.strokes,
        partCount: sel.length,
        speedy,
        multiplier: multiplierForThis,
      });
      s.lastSuccessAtMs = nowMs;
    }

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
   * 手札を上限まで自動で引く（開始時の初期補充・UX）。`playing` かつ空きと残がある限り
   * `pullGacha` を反復する。途中で終了判定に達したら（phase!=='playing'）停止する。
   * デイリー決定性は `pullGacha` の順序引きに従うため、シードから再現可能。
   * 二重補充を避けるため、UI 側は手札が空のとき一度だけ呼ぶこと（GameScreen onMount）。
   */
  fillHand(s: GameSession): void {
    if (s.phase !== 'playing') return;
    // canPullGacha が false（手札上限 or 残0）になるか、終了したら止まる（無限ループ防止）。
    while (s.phase === 'playing' && this.canPullGacha(s)) {
      this.pullGacha(s);
    }
  }

  /**
   * 交換（旧「捨てて引き直す」・PRD F5）。選択した **1枚以上** を一度に交換する（一括交換）。
   * 交換後の手札枚数は不変（選択枚数ぶんを引き直す）。実行できた枚数を KPI に加算する。
   *
   *  - 達成型（deck）：選択を山札へ戻して切り直し、同数を引き直す（部品を場から失わない）。
   *  - タイムアタック：レベル別コスト×枚数を一括で確認し、不足なら no-op（消費なし）。
   *
   * @param instanceIds 交換する手札部品の instanceId 群（手札に無いものは無視）
   */
  exchangeCards(s: GameSession, instanceIds: string[]): void {
    if (s.phase !== 'playing') return;

    const idSet = new Set(instanceIds);
    const targets = s.hand.filter((h) => idSet.has(h.instanceId));
    if (targets.length === 0) {
      this.publish(); // 対象なし → no-op（防御）
      return;
    }

    if (s.gameMode === 'deck') {
      // 達成型（T-029）：選択枚数を**山札に戻し**、切り直して同数を引き直す。
      // 部品を場から失わないため、N字すべてを完成できる状態が保たれる。
      s.hand = s.hand.filter((h) => !idSet.has(h.instanceId));
      for (const t of targets) s.deck.push(t.partId); // 山札へ返却
      s.deck = this.shuffle(s.deck); // 戻した札を含めて切り直す
      for (let i = 0; i < targets.length; i++) {
        const partId = s.deck.pop();
        if (partId === undefined) break; // 山札が尽きたら引ける分だけ
        s.hand.push({ instanceId: this.nextId(), partId });
      }
      s.gachaRemaining = s.deck.length;
      s.stats.discardUsed += targets.length;
      this.checkGameEnd(s);
      this.publish();
      return;
    }

    // タイムアタック：従来の救済（補充プール抽選＋レベル別コスト）を枚数ぶん適用。
    // 「実行できないときは消費もしない」を徹底：総コストを先に確認し、不足なら no-op。
    if (this.rescue === null) return;
    const totalCost = DISCARD_COST[s.level] * targets.length;
    if (s.gachaRemaining < totalCost) {
      this.publish();
      return;
    }
    for (const t of targets) {
      this.rescue.discardAndDraw(s, t.instanceId, this.rng);
    }
    s.stats.discardUsed += targets.length;

    this.checkGameEnd(s);
    this.publish();
  }

  /**
   * 交換（1枚・後方互換）。`exchangeCards` へ委譲する。
   * @param instanceId 交換する手札部品の instanceId
   */
  discardAndDraw(s: GameSession, instanceId: string): void {
    this.exchangeCards(s, [instanceId]);
  }

  /**
   * ヒント（PRD F5）。RescueService に委譲し、合体可能な1組を返す。提供できた場合のみ KPI を加算。
   * むず＝利用不可・残不足・詰みは null（コスト消費なし）。
   */
  useHint(s: GameSession): HandPart[] | null {
    if (s.phase !== 'playing') return null;

    let hint: HandPart[] | null;
    if (s.gameMode === 'deck') {
      // 達成型：無料・常時。既出（作成済み）を除いた、まだ作れる1組を返す（重複は提案しない）。
      hint = this.combineService.findHint(
        s.hand,
        s.level,
        new Set(s.createdKanji)
      );
    } else {
      if (this.rescue === null) return null;
      hint = this.rescue.useHint(s);
    }
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
    // タイムアタックは山札・詰みでは終了しない（時間切れのみ＝checkTimeout で判定）。
    if (s.gameMode === 'timeAttack') return;
    // 達成型（deck・T-029）：異なる漢字を N 字作ったらクリア。
    // 重複禁止により createdKanji は相異なるため、その長さ＝完成した異なり字数。
    // 対象の部品が別字（代表解）を作る場合もあるため、対象char一致ではなく「作った異なり数」で評価する。
    if (s.targetTotal > 0 && s.createdKanji.length >= s.targetTotal) {
      this.end(s, 'deck_empty');
      return;
    }
    // それ以外は、山札を引ききり、手札0 or「まだ作れる新しい字が無い」なら終了（手詰まり）。
    if (s.deck.length > 0) return;
    if (
      s.hand.length === 0 ||
      !this.combineService.canCombineAny(
        s.hand,
        s.level,
        new Set(s.createdKanji)
      )
    ) {
      this.end(s, 'deck_empty');
    }
  }

  /** タイムアタックの初期持ち時間（ms）。UI の残時間バーの満タン基準に使う（ui→domain 直接参照を避ける）。 */
  timeAttackTotalMs(): number {
    return this.timeAttackInitialMs;
  }

  /**
   * タイムアタックの残り時間（ms）。`deadlineAtMs - now` を0でクランプする（T-027）。
   * timeAttack 以外・未開始は0。UI のティッカーが毎フレーム表示と終了判定に使う。
   */
  timeRemainingMs(s: GameSession | null = this.session): number {
    if (s === null || s.gameMode !== 'timeAttack' || s.deadlineAtMs === null) {
      return 0;
    }
    return Math.max(0, s.deadlineAtMs - this.now());
  }

  /**
   * タイムアタックの時間切れを判定し、残0なら終了する（T-027）。UI のティッカーから呼ぶ。
   * playing かつ timeAttack のときのみ作用し、それ以外は no-op。
   */
  checkTimeout(): void {
    const s = this.session;
    if (s === null || s.phase !== 'playing' || s.gameMode !== 'timeAttack') {
      return;
    }
    if (this.timeRemainingMs(s) <= 0) this.end(s, 'timeup');
  }

  /**
   * セッションを終了し結果を確定する（機能設計5.1）。冪等：既に終了済みなら確定済み結果を返す。
   * 図鑑・レベル別ベスト・（デイリーは）デイリーベストを**まとめて永続化**し（書込み集約・機能設計9）、
   * 称号を確定して `GameResult` を返す。
   */
  end(
    s: GameSession,
    reason: 'stuck' | 'empty_hand' | 'timeup' | 'deck_empty'
  ): GameResult {
    if (s.phase === 'ended' && this.result !== null) return this.result;

    s.phase = 'ended';
    s.stats.endReason = reason;
    s.stats.finalScore = s.score.score;
    s.stats.durationMs = this.now() - this.startedAtMs;

    // 新記録判定は永続化の前に行う（persistResults が best を更新し this.persisted を読み直すため）。
    // timeAttack は別枠ベスト、daily はその日のデイリーベスト、free はレベルベストと比較する（T-022・T-027）。
    const prevBest =
      s.gameMode === 'timeAttack'
        ? this.persisted.timeAttackBest[s.level]
        : s.mode === 'daily'
          ? (this.persisted.dailyBest[todayYmdJst(this.now())] ?? 0)
          : this.persisted.bestScores[s.level];
    const isNewBest = s.score.score > prevBest;

    this.persistResults(s);

    // 達成型（deck）の収集実績：作った異なり漢字数 / 出題数 N（N で頭打ち表示）。
    const completedCount =
      s.gameMode === 'deck'
        ? Math.min(s.createdKanji.length, s.targetTotal)
        : 0;

    const result: GameResult = {
      level: s.level,
      mode: s.mode,
      gameMode: s.gameMode,
      isReview: s.isReview,
      score: s.score.score,
      rank: resolveRank(s.score.score),
      createdKanji: [...s.createdKanji],
      newlyDiscovered: [...s.newlyDiscovered],
      reason,
      durationMs: s.stats.durationMs,
      isNewBest,
      completedCount,
      targetTotal: s.targetTotal,
      deckGrades: [...s.deckGrades],
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
    // ベストはモード別の別枠に保存（混ぜない・T-027）。図鑑は両モード共通。
    if (s.gameMode === 'timeAttack') {
      this.storage.saveTimeAttackBest(s.level, s.score.score);
    } else {
      this.storage.saveBest(s.level, s.score.score);
      if (s.mode === 'daily') {
        this.storage.saveDailyBest(todayYmdJst(this.now()), s.score.score);
      }
      // 達成型（deck）のみ：にがて漢字を更新する（T-035）。未完成の対象字は にがて 登録、
      // 完成できた対象字は定着で重みを下げる。復習・通常どちらの達成型でも更新する。
      const nextWeak = updateWeakKanji(
        this.persisted.weakKanji,
        [...this.deckTargets],
        s.createdKanji
      );
      this.storage.saveWeakKanji(nextWeak);
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
