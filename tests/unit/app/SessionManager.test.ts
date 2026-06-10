import { describe, it, expect, beforeAll } from 'vitest';
import { writable, get, type Writable } from 'svelte/store';
import {
  SessionManager,
  type SessionManagerOptions,
} from '../../../src/app/SessionManager';
import {
  DictionaryRepository,
  type FetchLike,
} from '../../../src/data/DictionaryRepository';
import {
  StorageRepository,
  type StorageLike,
} from '../../../src/data/StorageRepository';
import {
  dailySeed,
  todayYmdJst,
  dailyLevel,
} from '../../../src/domain/rng/dailySeed';
import { GACHA_COUNT } from '../../../src/domain/constants';
import type {
  CombineEntry,
  GameSession,
  HandPart,
  KanjiEntry,
  Part,
  PersistedState,
} from '../../../src/domain/types';

// SessionManager 統合テスト（T-014 / PRD F1〜F6 / 機能設計5.1・4.5・4.6）。
//  - 開始→ガチャ→合体/ミス→終了（stuck / empty_hand 両経路）
//  - free/daily の RNG 注入（デイリーは固定日付で同一ガチャ列）
//  - 終了判定が各操作後に発火、PlayStats の KPI 記録、終了時の永続化

// ----- テスト辞書（fetch 注入で実 DictionaryRepository を構築） -----
function part(id: string): Part {
  return {
    id,
    char: id,
    rarity: 1,
    scopes: ['elementary', 'juniorhigh', 'joyo'],
    weight: 1,
  };
}
const PARTS: Part[] = ['ki', 'kuchi', 'onna', 'ko', 'hi'].map(part);

function kanji(char: string, strokes: number): KanjiEntry {
  return { char, strokes, readings: [], meanings: [], level: 'elementary' };
}
const KANJI: KanjiEntry[] = [
  kanji('林', 8),
  kanji('好', 6),
  kanji('品', 9),
  kanji('杏', 7), // ki+ko の別解（altInScope 検証用）
];

const COMBINE: CombineEntry[] = [
  { key: 'ki+ki', results: ['林'], primary: '林', partCount: 2 },
  { key: 'ko+onna', results: ['好'], primary: '好', partCount: 2 },
  {
    key: 'kuchi+kuchi+kuchi',
    results: ['品'],
    primary: '品',
    partCount: 3,
  },
  // 複数解：採点対象(awarded)以外は altInScope=別解として記録される
  { key: 'ki+ko', results: ['好', '杏'], primary: '好', partCount: 2 },
];

const REACHABLE = {
  reachableN: { elementary: 3, juniorhigh: 3, joyo: 3 },
  inScopeTotal: { elementary: 3, juniorhigh: 3, joyo: 3 },
};

const PAYLOAD: Record<string, unknown> = {
  'parts.json': PARTS,
  'kanji.json': KANJI,
  'combine-dict.json': COMBINE,
  'reachable.json': REACHABLE,
};

const fakeFetch: FetchLike = (url) => {
  const name = url.split('/').pop() ?? '';
  const body = PAYLOAD[name];
  if (body === undefined) {
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve(null),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
};

// ----- メモリ Storage -----
class MemoryStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

let dict: DictionaryRepository;
beforeAll(async () => {
  dict = new DictionaryRepository(fakeFetch, '/');
  await dict.load();
});

/** 固定時刻のSM（デイリー再現・durationMs の決定化用）。store は毎回新規で隔離。 */
function makeSM(
  storage = new StorageRepository(new MemoryStorage()),
  opts: SessionManagerOptions = {}
): {
  sm: SessionManager;
  sessionStore: Writable<GameSession | null>;
  persistedStore: Writable<PersistedState>;
} {
  const ss = writable<GameSession | null>(null);
  const ps = writable<PersistedState>(emptyState());
  const sm = new SessionManager(dict, storage, {
    now: () => 1_780_000_000_000,
    random: () => 0.42,
    sessionStore: ss,
    persistedStore: ps,
    ...opts,
  });
  return { sm, sessionStore: ss, persistedStore: ps };
}

// persistedStore の初期値はSMが上書きするため任意。型を満たす空状態を渡すだけ。
function emptyState(): PersistedState {
  return {
    zukan: { discovered: {}, altDiscovered: {} },
    bestScores: { elementary: 0, juniorhigh: 0, joyo: 0 },
    dailyBest: {},
    settings: { hintAlwaysOn: false },
    schemaVersion: 1,
  };
}

/** 手札を既知の部品で固定する（ガチャ乱数に依存せず合体シナリオを決定化）。 */
function setHand(s: GameSession, partIds: string[]): void {
  s.hand = partIds.map((partId, i) => ({ instanceId: `t${i}`, partId }));
}

describe('SessionManager start / RNG 注入', () => {
  it('free は seed=null、playing で初期化（残=GACHA_COUNT・空手札）', () => {
    const { sm, sessionStore } = makeSM();
    const s = sm.start('elementary', 'free');
    expect(s.seed).toBeNull();
    expect(s.gachaRemaining).toBe(GACHA_COUNT);
    expect(s.hand).toEqual([]);
    expect(s.phase).toBe('playing');
    // store へ publish（Svelte 再描画のため毎回シャローコピーを発行＝別参照・内容は等価）
    expect(get(sessionStore)).not.toBe(s);
    expect(get(sessionStore)).toEqual(s);
  });

  it('daily は固定日付の dailySeed を注入する', () => {
    const now = () => 1_780_000_000_000;
    const { sm } = makeSM(undefined, { now });
    const s = sm.start('elementary', 'daily');
    expect(s.seed).toBe(dailySeed(todayYmdJst(now())));
  });

  it('daily は固定日付で同一ガチャ列を再現する（決定性・F8）', () => {
    const now = () => 1_780_000_000_000;
    const a = makeSM(undefined, { now });
    const b = makeSM(undefined, { now });
    const sa = a.sm.start('elementary', 'daily');
    const sb = b.sm.start('elementary', 'daily');
    for (let i = 0; i < 5; i++) {
      a.sm.pullGacha(sa);
      b.sm.pullGacha(sb);
    }
    expect(sa.hand.map((h) => h.partId)).toEqual(sb.hand.map((h) => h.partId));
    expect(sa.hand.length).toBe(5);
  });
});

describe('SessionManager pullGacha', () => {
  it('手札に追加し残回数を1減らす', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    sm.pullGacha(s);
    expect(s.hand).toHaveLength(1);
    expect(s.gachaRemaining).toBe(GACHA_COUNT - 1);
  });

  it('残0では no-op（事前条件・防御）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.gachaRemaining = 0;
    sm.pullGacha(s);
    expect(s.hand).toHaveLength(0);
  });
});

describe('SessionManager combine（成功 / ミス）', () => {
  it('成立で採点・作成漢字・新規発見・コンボ前進、手札から除去', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    const r = sm.combine(s, [...s.hand]);
    expect(r.success).toBe(true);
    expect(r.resolved?.awarded.char).toBe('林');
    expect(r.gainedScore).toBe(8); // 8画 ×1.0
    expect(s.score.score).toBe(8);
    expect(s.score.comboCount).toBe(1);
    expect(s.hand).toHaveLength(0); // 2部品とも消費
    expect(s.createdKanji).toEqual(['林']);
    expect(s.newlyDiscovered).toEqual(['林']);
    expect(s.stats.combineSuccess).toBe(1);
    expect(s.stats.newDiscoveries).toBe(1);
  });

  it('不成立はミス（コンボリセット・スコア不変・combineMiss++）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki', 'kuchi']);
    sm.combine(s, [s.hand[0], s.hand[1]]); // 林成功でコンボ1
    expect(s.score.comboCount).toBe(1);
    setHand(s, ['ki', 'kuchi']); // ki+kuchi は辞書に無い
    const before = s.score.score;
    const r = sm.combine(s, [...s.hand]);
    expect(r.success).toBe(false);
    expect(s.score.score).toBe(before); // スコア不変
    expect(s.score.comboCount).toBe(0); // リセット
    expect(s.stats.combineMiss).toBe(1);
  });

  it('同一セッションで同じ漢字を2回作っても newlyDiscovered は重複しない', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]); // 林（1回目・新規）
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]); // 林（2回目）
    expect(s.newlyDiscovered).toEqual(['林']); // 重複しない
    expect(s.stats.newDiscoveries).toBe(1);
    expect(s.createdKanji).toEqual(['林', '林']); // 作成は2回
  });

  it('無効入力（2枚未満・手札外）は副作用なしの失敗', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    expect(sm.combine(s, [s.hand[0]]).success).toBe(false); // 1枚
    const ghost: HandPart = { instanceId: 'ghost', partId: 'ki' };
    expect(sm.combine(s, [s.hand[0], ghost]).success).toBe(false); // 手札外
    expect(s.stats.combineMiss).toBe(0); // ミス計上もしない
    expect(s.hand).toHaveLength(2);
  });
});

describe('SessionManager 終了判定（両経路・機能設計4.5）', () => {
  it('empty_hand：最後の合体で手札0かつ残0', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.gachaRemaining = 0;
    setHand(s, ['ki', 'ki']);
    const r = sm.combine(s, [...s.hand]); // 林成立→手札0
    expect(r.success).toBe(true);
    expect(s.phase).toBe('ended');
    expect(s.stats.endReason).toBe('empty_hand');
    expect(sm.getResult()?.reason).toBe('empty_hand');
  });

  it('stuck：残0で合体不能（ミス操作後に発火）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.gachaRemaining = 0;
    setHand(s, ['ki', 'kuchi']); // 合体不能
    sm.combine(s, [...s.hand]); // ミス→checkGameEnd→stuck
    expect(s.phase).toBe('ended');
    expect(s.stats.endReason).toBe('stuck');
    expect(sm.getResult()?.reason).toBe('stuck');
  });

  it('残0でも合体可能なら継続する', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.gachaRemaining = 0;
    setHand(s, ['ki', 'ki', 'kuchi']); // ki+ki が可能
    sm.pullGacha(s); // 残0で no-op だが終了判定は走る→合体可能なので継続
    expect(s.phase).toBe('playing');
  });

  it('残0で詰みのとき pullGacha（no-op）でも stuck を検出する', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.gachaRemaining = 0;
    setHand(s, ['ki', 'kuchi']); // 合体不能
    sm.pullGacha(s); // 引けないが終了判定が走る
    expect(s.phase).toBe('ended');
    expect(s.stats.endReason).toBe('stuck');
  });

  it('手札上限（HAND_CAP）到達時は no-op（事前条件・防御）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.hand = Array.from({ length: 12 }, (_, i) => ({
      instanceId: `t${i}`,
      partId: 'ki',
    }));
    const remaining = s.gachaRemaining;
    sm.pullGacha(s);
    expect(s.hand).toHaveLength(12); // 増えない
    expect(s.gachaRemaining).toBe(remaining); // 残も減らない
    expect(s.phase).toBe('playing'); // 残ありなので終了しない
  });
});

describe('SessionManager 救済（KPI 記録）', () => {
  it('useHint：elementary は無料で合体可能組を返し hintUsed++', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki', 'kuchi']);
    const hint = sm.useHint(s);
    expect(hint).not.toBeNull();
    expect(s.gachaRemaining).toBe(GACHA_COUNT); // 無料
    expect(s.stats.hintUsed).toBe(1);
  });

  it('useHint：joyo は利用不可で null・KPI 不変', () => {
    const { sm } = makeSM();
    const s = sm.start('joyo', 'free');
    setHand(s, ['ki', 'ki']);
    expect(sm.useHint(s)).toBeNull();
    expect(s.stats.hintUsed).toBe(0);
  });

  it('discardAndDraw：手札を入れ替え discardUsed++（elementary はコスト0）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'kuchi']);
    sm.discardAndDraw(s, 't0'); // 't0'(ki) を捨てる
    expect(s.hand).toHaveLength(2); // 削除1＋補充1
    expect(s.hand.some((h) => h.instanceId === 't0')).toBe(false);
    expect(s.gachaRemaining).toBe(GACHA_COUNT); // elementary コスト0
    expect(s.stats.discardUsed).toBe(1);
  });

  it('discardAndDraw：対象不在は no-op で KPI 不変', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'kuchi']);
    sm.discardAndDraw(s, 'nope');
    expect(s.stats.discardUsed).toBe(0);
    expect(s.hand).toHaveLength(2);
  });
});

describe('SessionManager dailyInfo（日替わり・T-022）', () => {
  it('注入時刻の JST 日付から日替わりレベルと ymd を返す（決定的）', () => {
    const now = () => 1_780_000_000_000;
    const { sm } = makeSM(undefined, { now });
    const info = sm.dailyInfo();
    const ymd = todayYmdJst(now());
    expect(info.ymd).toBe(ymd);
    expect(info.level).toBe(dailyLevel(dailySeed(ymd)));
    // 別インスタンスでも同一時刻なら同一（全プレイヤー再現性）
    const { sm: sm2 } = makeSM(undefined, { now });
    expect(sm2.dailyInfo()).toEqual(info);
  });
});

describe('SessionManager end / isNewBest（daily は dailyBest 比較・T-022）', () => {
  it('daily の新記録はその日のデイリーベストと比較する', () => {
    const now = () => 1_780_000_000_000;
    const storage = new StorageRepository(new MemoryStorage());
    // 1回目の daily：8点 → デイリーベスト更新（新記録）
    const a = makeSM(storage, { now });
    const lv = a.sm.dailyInfo().level;
    const s1 = a.sm.start(lv, 'daily');
    setHand(s1, ['ki', 'ki']);
    a.sm.combine(s1, [...s1.hand]);
    expect(a.sm.end(s1, 'stuck').isNewBest).toBe(true);
    // 2回目の daily（同日）：0点 → デイリーベスト8未満で非新記録
    const b = makeSM(storage, { now });
    const s2 = b.sm.start(b.sm.dailyInfo().level, 'daily');
    const r2 = b.sm.end(s2, 'empty_hand');
    expect(r2.score).toBe(0);
    expect(r2.isNewBest).toBe(false);
  });
});

describe('SessionManager end / isNewBest（新記録判定・T-019）', () => {
  it('初プレイでスコア>0なら新記録（isNewBest=true）', () => {
    const storage = new StorageRepository(new MemoryStorage());
    const { sm } = makeSM(storage);
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]); // 林（score 8）
    const r = sm.end(s, 'stuck');
    expect(r.isNewBest).toBe(true);
  });

  it('既存ベスト未満なら非新記録（isNewBest=false）', () => {
    const storage = new StorageRepository(new MemoryStorage());
    // 1回目で 8 点のベストを作る
    const a = makeSM(storage);
    const s1 = a.sm.start('elementary', 'free');
    setHand(s1, ['ki', 'ki']);
    a.sm.combine(s1, [...s1.hand]);
    a.sm.end(s1, 'stuck');
    // 2回目はスコア 0（合体せず終了）→ ベスト 8 未満
    const b = makeSM(storage);
    const s2 = b.sm.start('elementary', 'free');
    const r2 = b.sm.end(s2, 'empty_hand');
    expect(r2.score).toBe(0);
    expect(r2.isNewBest).toBe(false);
  });

  it('既存ベストと同点なら新記録としない（score > best の厳密比較）', () => {
    const storage = new StorageRepository(new MemoryStorage());
    const a = makeSM(storage);
    const s1 = a.sm.start('elementary', 'free');
    setHand(s1, ['ki', 'ki']);
    a.sm.combine(s1, [...s1.hand]);
    a.sm.end(s1, 'stuck'); // best = 8
    // 2回目も同じ 8 点 → 同点は更新しない
    const b = makeSM(storage);
    const s2 = b.sm.start('elementary', 'free');
    setHand(s2, ['ki', 'ki']);
    b.sm.combine(s2, [...s2.hand]);
    const r2 = b.sm.end(s2, 'stuck');
    expect(r2.score).toBe(8);
    expect(r2.isNewBest).toBe(false);
  });
});

describe('SessionManager end / 永続化', () => {
  it('end は冪等：再呼び出しで同一結果・二重永続化しない', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]); // 林（score 8）
    const r1 = sm.end(s, 'stuck');
    const r2 = sm.end(s, 'empty_hand'); // 既に ended → r1 を返す
    expect(r2).toBe(r1);
    expect(r1.reason).toBe('stuck');
    expect(r1.rank).toBe('見習い'); // score 8
  });

  it('終了時に図鑑・ベストを永続化し、リロードで保持（F7・F9）', () => {
    const storage = new StorageRepository(new MemoryStorage());
    const { sm, persistedStore } = makeSM(storage);
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]);
    sm.end(s, 'stuck');

    const persisted = storage.loadState();
    expect(persisted.bestScores.elementary).toBe(8);
    expect(persisted.zukan.discovered['林'].count).toBe(1);
    expect(get(persistedStore).zukan.discovered['林']).toBeDefined();

    // リロード相当：同じ storage の新 SM はベースラインに 林 を含む
    const reload = makeSM(storage);
    const s2 = reload.sm.start('elementary', 'free');
    setHand(s2, ['ki', 'ki']);
    reload.sm.combine(s2, [...s2.hand]);
    expect(s2.newlyDiscovered).toEqual([]); // 既発見なので新規ではない
    expect(reload.sm.getSession()?.createdKanji).toEqual(['林']);
  });

  it('daily は end でデイリーベストも保存する', () => {
    const now = () => 1_780_000_000_000;
    const storage = new StorageRepository(new MemoryStorage());
    const { sm } = makeSM(storage, { now });
    const s = sm.start('elementary', 'daily');
    setHand(s, ['onna', 'ko']);
    sm.combine(s, [...s.hand]); // 好（6画）
    sm.end(s, 'stuck');
    const ymd = todayYmdJst(now());
    expect(storage.loadState().dailyBest[ymd]).toBe(6);
  });

  it('durationMs を所要時間として記録する', () => {
    let t = 1_000;
    const storage = new StorageRepository(new MemoryStorage());
    const { sm } = makeSM(storage, { now: () => t });
    const s = sm.start('elementary', 'free'); // startedAt=1000
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]);
    t = 4_500;
    const r = sm.end(s, 'stuck');
    expect(r.durationMs).toBe(3_500);
    expect(s.stats.finalScore).toBe(8);
  });

  it('別解（altInScope）は altDiscovered に永続化される（機能設計4.4）', () => {
    const storage = new StorageRepository(new MemoryStorage());
    const { sm } = makeSM(storage);
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ko']); // 好/杏 の複数解
    const r = sm.combine(s, [...s.hand]);
    expect(r.resolved?.altInScope).toHaveLength(1);
    const altChar = r.resolved!.altInScope[0].char;
    sm.end(s, 'stuck');
    expect(storage.loadState().zukan.altDiscovered[altChar].count).toBe(1);
  });

  it('同じ漢字を再作成すると discovered.count が増える', () => {
    const storage = new StorageRepository(new MemoryStorage());
    // 1回目
    const a = makeSM(storage);
    const s1 = a.sm.start('elementary', 'free');
    setHand(s1, ['ki', 'ki']);
    a.sm.combine(s1, [...s1.hand]);
    a.sm.end(s1, 'stuck');
    // 2回目（リロード相当）
    const b = makeSM(storage);
    const s2 = b.sm.start('elementary', 'free');
    setHand(s2, ['ki', 'ki']);
    b.sm.combine(s2, [...s2.hand]);
    b.sm.end(s2, 'stuck');
    expect(storage.loadState().zukan.discovered['林'].count).toBe(2);
  });
});

describe('SessionManager 既定依存・終了後ガード', () => {
  it('opts 無し（実 Date.now / Math.random / モジュール store）でも開始できる', () => {
    const sm = new SessionManager(
      dict,
      new StorageRepository(new MemoryStorage())
    );
    const s = sm.start('elementary', 'free');
    sm.pullGacha(s);
    expect(s.hand).toHaveLength(1);
    expect(s.seed).toBeNull();
  });

  it('終了後は全操作が no-op（pullGacha/combine/discardAndDraw/useHint）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    s.gachaRemaining = 0;
    sm.combine(s, [...s.hand]); // 林→手札0→empty_hand で ended
    expect(s.phase).toBe('ended');

    const handBefore = [...s.hand];
    sm.pullGacha(s);
    setHand(s, ['ki', 'ki']);
    expect(sm.combine(s, [...s.hand]).success).toBe(false);
    sm.discardAndDraw(s, 't0');
    expect(sm.useHint(s)).toBeNull();
    expect(s.stats.combineSuccess).toBe(1); // 終了後の操作は計上されない
    expect(handBefore).toEqual([]); // ended 時点で手札空
  });
});

describe('SessionManager 表示支援（T-017 / T-020）', () => {
  it('partView は既知 partId の文字とレアリティを返す', () => {
    const { sm } = makeSM();
    sm.start('elementary', 'free');
    expect(sm.partView('ki')).toEqual({ char: 'ki', rarity: 1 });
  });

  it('partView は未知 partId に null を返す', () => {
    const { sm } = makeSM();
    sm.start('elementary', 'free');
    expect(sm.partView('unknown')).toBeNull();
  });

  it('kanjiView は既知 char の読み/意味を返し、未知は null（図鑑用・T-020）', () => {
    const { sm } = makeSM();
    expect(sm.kanjiView('林')).toEqual({
      char: '林',
      readings: [],
      meanings: [],
    });
    expect(sm.kanjiView('存在しない')).toBeNull();
  });

  it('reachableTotal は joyo の到達可能 N を返す（図鑑の分母・T-020）', () => {
    const { sm } = makeSM();
    expect(sm.reachableTotal()).toBe(REACHABLE.reachableN.joyo);
  });

  it('canPullGacha は playing・手札未満・残ありで true、各条件崩れで false', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    expect(sm.canPullGacha(s)).toBe(true);

    s.gachaRemaining = 0;
    expect(sm.canPullGacha(s)).toBe(false); // 残0
    s.gachaRemaining = 5;

    s.hand = Array.from({ length: 12 }, (_, i) => ({
      instanceId: `c${i}`,
      partId: 'ki',
    }));
    expect(sm.canPullGacha(s)).toBe(false); // 手札上限(HAND_CAP=12)
    s.hand = [];

    s.phase = 'ended';
    expect(sm.canPullGacha(s)).toBe(false); // 終了後
  });

  it('canUseHint はレベル別：やさ=常時可、ふつう=残≥1、むず=不可', () => {
    const { sm } = makeSM();
    const e = sm.start('elementary', 'free');
    expect(sm.canUseHint(e)).toBe(true); // コスト0
    e.gachaRemaining = 0;
    expect(sm.canUseHint(e)).toBe(true); // やさは無料

    const j = sm.start('juniorhigh', 'free');
    expect(sm.canUseHint(j)).toBe(true); // 残あり
    j.gachaRemaining = 0;
    expect(sm.canUseHint(j)).toBe(false); // 残不足（コスト1）

    const v = sm.start('joyo', 'free');
    expect(sm.canUseHint(v)).toBe(false); // 利用不可
  });
});

describe('SessionManager KPI 計測ログ（1プレイ統合・T-025）', () => {
  it('代表フロー（ガチャ→成功→ミス→ヒント→終了）で PlayStats 主要KPIが記録される', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');

    // ガチャ（プレイ進行：残が1減る）
    sm.pullGacha(s);
    expect(s.gachaRemaining).toBe(GACHA_COUNT - 1);

    // 合体成功（ki+ki → 林・新規発見）
    setHand(s, ['ki', 'ki']);
    expect(sm.combine(s, [...s.hand]).success).toBe(true);

    // 合体ミス（辞書に無い組）
    setHand(s, ['ki', 'kuchi']);
    expect(sm.combine(s, [...s.hand]).success).toBe(false);

    // ヒント（elementary は無料で1組返す）
    setHand(s, ['ki', 'ki', 'kuchi']);
    expect(sm.useHint(s)).not.toBeNull();

    // 終了 → KPI（PlayStats）が出揃う
    const r = sm.end(s, 'stuck');
    expect(s.stats.combineSuccess).toBe(1);
    expect(s.stats.combineMiss).toBe(1);
    expect(s.stats.hintUsed).toBe(1);
    expect(s.stats.newDiscoveries).toBe(1);
    expect(s.stats.endReason).toBe('stuck');
    expect(s.stats.finalScore).toBe(s.score.score);
    expect(s.stats.durationMs).toBeGreaterThanOrEqual(0);
    // 結果（GameResult）にも終了理由・所要時間が伝播する
    expect(r.reason).toBe('stuck');
    expect(r.durationMs).toBe(s.stats.durationMs);
  });
});
