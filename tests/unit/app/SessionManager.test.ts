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
import { dailySeed, todayYmdJst } from '../../../src/domain/rng/dailySeed';
import { GACHA_COUNT, TIME_ATTACK } from '../../../src/domain/constants';
import type {
  CombineEntry,
  GameSession,
  HandPart,
  KanjiEntry,
  Part,
  PersistedState,
} from '../../../src/domain/types';

// SessionManager 統合テスト（T-014 ＋ レベル再設計）。
//  - deck（達成型）：山札構築・非復元 draw・収集率・deck_empty 終了・discard 補充・無料ヒント
//  - timeAttack：時間延長・無制限ガチャ・時間切れ（T-027）
//  - 合体成功/ミス・KPI・永続化・表示支援

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
  // fixture は全字 grade 1（小学1年）。start の既定 grades=[1..6] で全対象になる。
  return {
    char,
    strokes,
    readings: [],
    meanings: [],
    level: 'elementary',
    grade: 1,
  };
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

/** 固定時刻・固定乱数のSM。store は毎回新規で隔離。 */
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
    timeAttackBest: { elementary: 0, juniorhigh: 0, joyo: 0 },
    dailyBest: {},
    settings: { hintAlwaysOn: false, furigana: false },
    schemaVersion: 1,
  };
}

/** 手札を既知の部品で固定する（合体シナリオを決定化）。 */
function setHand(s: GameSession, partIds: string[]): void {
  s.hand = partIds.map((partId, i) => ({ instanceId: `t${i}`, partId }));
}

// fixture の elementary 山札＝対象 [林,好,品,杏] の構成部品（重複あり）。合計9枚・対象4字。
const DECK_SIZE = 9;
const TARGET_TOTAL = 4;

describe('SessionManager start（deck・達成型）', () => {
  it('free/deck は seed=null・山札を構築して playing 初期化（残=山札長・対象総数）', () => {
    const { sm, sessionStore } = makeSM();
    const s = sm.start('elementary', 'free');
    expect(s.gameMode).toBe('deck');
    expect(s.seed).toBeNull();
    expect(s.deck).toHaveLength(DECK_SIZE);
    expect(s.gachaRemaining).toBe(DECK_SIZE); // 山札残＝山札長
    expect(s.targetTotal).toBe(TARGET_TOTAL);
    expect(s.deadlineAtMs).toBeNull();
    expect(s.hand).toEqual([]);
    expect(s.phase).toBe('playing');
    expect(get(sessionStore)).not.toBe(s);
    expect(get(sessionStore)).toEqual(s);
  });

  it('daily は固定日付で同一の山札順を再現する（シード・決定性）', () => {
    const now = () => 1_780_000_000_000;
    const a = makeSM(undefined, { now });
    const b = makeSM(undefined, { now });
    const sa = a.sm.start('elementary', 'daily');
    const sb = b.sm.start('elementary', 'daily');
    expect(sa.seed).toBe(dailySeed(todayYmdJst(now())));
    expect(sa.deck).toEqual(sb.deck); // 同シード→同一シャッフル順
  });
});

describe('SessionManager pullGacha（山札・非復元）', () => {
  it('山札末尾から引いて手札+1・山札-1（残を同期）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    sm.pullGacha(s);
    expect(s.hand).toHaveLength(1);
    expect(s.deck).toHaveLength(DECK_SIZE - 1);
    expect(s.gachaRemaining).toBe(DECK_SIZE - 1);
  });

  it('引ききると canPullGacha=false（回数制限ではなく山札枯渇）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    // 手札上限(12)＞山札(9) のため山札を全部引ける
    for (let i = 0; i < DECK_SIZE; i++) sm.pullGacha(s);
    expect(s.deck).toHaveLength(0);
    expect(sm.canPullGacha(s)).toBe(false);
  });

  it('山札が空での pullGacha は no-op（手札があり合体可能なら継続）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.deck = [];
    setHand(s, ['ki', 'ki', 'kuchi']); // ki+ki が可能
    sm.pullGacha(s);
    expect(s.phase).toBe('playing');
    expect(s.hand).toHaveLength(3);
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
    expect(r.gainedScore).toBe(8);
    expect(s.score.score).toBe(8);
    expect(s.score.comboCount).toBe(1);
    expect(s.hand).toHaveLength(0);
    expect(s.createdKanji).toEqual(['林']);
    expect(s.newlyDiscovered).toEqual(['林']);
    expect(s.stats.combineSuccess).toBe(1);
  });

  it('不成立はミス（コンボリセット・スコア不変・combineMiss++）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki', 'kuchi']);
    sm.combine(s, [s.hand[0], s.hand[1]]); // 林成功
    expect(s.score.comboCount).toBe(1);
    setHand(s, ['ki', 'kuchi']);
    const before = s.score.score;
    const r = sm.combine(s, [...s.hand]);
    expect(r.success).toBe(false);
    expect(s.score.score).toBe(before);
    expect(s.score.comboCount).toBe(0);
    expect(s.stats.combineMiss).toBe(1);
  });

  it('無効入力（2枚未満・手札外）は副作用なしの失敗', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    expect(sm.combine(s, [s.hand[0]]).success).toBe(false);
    const ghost: HandPart = { instanceId: 'ghost', partId: 'ki' };
    expect(sm.combine(s, [s.hand[0], ghost]).success).toBe(false);
    expect(s.stats.combineMiss).toBe(0);
    expect(s.hand).toHaveLength(2);
  });
});

describe('SessionManager 終了判定（deck_empty）', () => {
  it('山札0かつ手札0で deck_empty', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.deck = [];
    setHand(s, ['ki', 'ki']);
    const r = sm.combine(s, [...s.hand]); // 林成立→手札0
    expect(r.success).toBe(true);
    expect(s.phase).toBe('ended');
    expect(s.stats.endReason).toBe('deck_empty');
    expect(sm.getResult()?.reason).toBe('deck_empty');
  });

  it('山札0かつ合体不能で deck_empty（手詰まり）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.deck = [];
    setHand(s, ['ki', 'kuchi']); // 合体不能
    sm.combine(s, [...s.hand]); // ミス→checkGameEnd→deck_empty
    expect(s.phase).toBe('ended');
    expect(s.stats.endReason).toBe('deck_empty');
  });

  it('山札が残っていれば終了しない（達成型は引ききるまで継続）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'kuchi']); // 合体不能だが山札あり
    sm.combine(s, [...s.hand]); // ミス
    expect(s.phase).toBe('playing');
  });
});

describe('SessionManager 救済（deck モード）', () => {
  it('discardAndDraw：捨て札を山札に戻して引き直す（枚数不変・山札総数も不変）・discardUsed++', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.deck = ['ki', 'kuchi'];
    setHand(s, ['onna', 'ko']);
    sm.discardAndDraw(s, 't0'); // 'onna' を捨てる→山札に戻して1枚引く
    expect(s.hand).toHaveLength(2); // 削除1＋補充1
    expect(s.hand.some((h) => h.instanceId === 't0')).toBe(false);
    // 捨て札を山札へ返却（push1）し1枚引く（pop1）ため、山札総数は不変。
    expect(s.deck).toHaveLength(2);
    expect(s.gachaRemaining).toBe(2);
    expect(s.stats.discardUsed).toBe(1);
    // 'onna' は場（手札∪山札）から失われない
    expect([...s.deck, ...s.hand.map((h) => h.partId)]).toContain('onna');
  });

  it('discardAndDraw：山札空でも捨て札を戻して引くので手札は減らない', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.deck = [];
    setHand(s, ['ki', 'ki', 'kuchi']);
    sm.discardAndDraw(s, 't2'); // 'kuchi' を捨て→山札[kuchi]→引き直し
    expect(s.hand).toHaveLength(3); // 戻して引くので枚数不変
    expect(s.stats.discardUsed).toBe(1);
  });

  it('discardAndDraw：対象不在は no-op', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.deck = ['ki'];
    setHand(s, ['ki', 'kuchi']);
    sm.discardAndDraw(s, 'nope');
    expect(s.stats.discardUsed).toBe(0);
    expect(s.hand).toHaveLength(2);
    expect(s.deck).toHaveLength(1);
  });

  it('useHint：deck は無料で合体可能組を返し hintUsed++', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki', 'kuchi']);
    const hint = sm.useHint(s);
    expect(hint).not.toBeNull();
    expect(s.stats.hintUsed).toBe(1);
  });

  it('useHint：合体可能組が無ければ null（消費なし）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'kuchi']); // 合体不能
    expect(sm.useHint(s)).toBeNull();
    expect(s.stats.hintUsed).toBe(0);
  });

  it('canUseHint は deck では playing で常に true（無料）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    expect(sm.canUseHint(s)).toBe(true);
    s.phase = 'ended';
    expect(sm.canUseHint(s)).toBe(false);
  });
});

describe('SessionManager 重複禁止・出題数（T-029）', () => {
  it('combine：既出の漢字は無効（ノーペナルティ・部品消費なし・コンボ維持）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]); // 林（1回目・成功）
    expect(s.createdKanji).toEqual(['林']);
    expect(s.score.comboCount).toBe(1);
    const scoreBefore = s.score.score;

    setHand(s, ['ki', 'ki']);
    const r = sm.combine(s, [...s.hand]); // 林（2回目・既出）
    expect(r.success).toBe(false);
    expect(r.duplicate).toBe(true);
    expect(s.score.score).toBe(scoreBefore); // 加点なし
    expect(s.score.comboCount).toBe(1); // コンボ維持
    expect(s.hand).toHaveLength(2); // 部品消費なし
    expect(s.createdKanji).toEqual(['林']); // 重複追加なし
    expect(s.stats.combineMiss).toBe(0); // ミス計上もしない
  });

  it('start：出題数 count で N 字の山札を構築（targetTotal=N・deckGrades 記録）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free', 'deck', { grades: [1], count: 2 });
    expect(s.targetTotal).toBe(2); // 対象4字から2字
    expect(s.deckGrades).toEqual([1]);
    expect(s.deck.length).toBeGreaterThan(0);
  });

  it('start：count が対象総数を超える場合は総数に丸める', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free', 'deck', {
      grades: [1],
      count: 99,
    });
    expect(s.targetTotal).toBe(4); // 対象は4字
  });

  it('start：grades で対象学年を絞る（fixture に grade2 は無い→対象0）', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free', 'deck', { grades: [2] });
    expect(s.targetTotal).toBe(0);
    expect(s.deck).toEqual([]);
  });

  it('start(2引数) は既定 grades=[1..6]・count=全部 で従来どおりの山札', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    expect(s.gameMode).toBe('deck');
    expect(s.targetTotal).toBe(TARGET_TOTAL); // 4
    expect(s.deck).toHaveLength(DECK_SIZE); // 9
  });
});

describe('SessionManager end / 収集率・新記録（deck）', () => {
  it('end で収集率（completedCount/targetTotal）を返す', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]); // 林（対象）
    const r = sm.end(s, 'deck_empty');
    expect(r.completedCount).toBe(1);
    expect(r.targetTotal).toBe(TARGET_TOTAL);
  });

  it('初プレイでスコア>0なら新記録（bestScores 比較）', () => {
    const storage = new StorageRepository(new MemoryStorage());
    const { sm } = makeSM(storage);
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]);
    expect(sm.end(s, 'deck_empty').isNewBest).toBe(true);
    expect(storage.loadState().bestScores.elementary).toBe(8);
  });

  it('end は冪等：再呼び出しで同一結果', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]);
    const r1 = sm.end(s, 'deck_empty');
    const r2 = sm.end(s, 'stuck');
    expect(r2).toBe(r1);
  });

  it('終了時に図鑑・ベストを永続化し、リロードで保持', () => {
    const storage = new StorageRepository(new MemoryStorage());
    const { sm } = makeSM(storage);
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]);
    sm.end(s, 'deck_empty');
    const persisted = storage.loadState();
    expect(persisted.bestScores.elementary).toBe(8);
    expect(persisted.zukan.discovered['林'].count).toBe(1);
  });

  it('durationMs を所要時間として記録する', () => {
    let t = 1_000;
    const storage = new StorageRepository(new MemoryStorage());
    const { sm } = makeSM(storage, { now: () => t });
    const s = sm.start('elementary', 'free');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]);
    t = 4_500;
    const r = sm.end(s, 'deck_empty');
    expect(r.durationMs).toBe(3_500);
  });
});

describe('SessionManager タイムアタック（T-027）', () => {
  const T0 = 1_780_000_000_000;

  function makeTA(initialMs = 30_000) {
    const clock = { t: T0 };
    const storage = new StorageRepository(new MemoryStorage());
    const { sm, persistedStore } = makeSM(storage, {
      now: () => clock.t,
      timeAttackInitialMs: initialMs,
    });
    return { sm, storage, persistedStore, clock };
  }

  it('start(timeAttack) は deadline を now+初期時間に設定し、残時間を返す', () => {
    const { sm } = makeTA(30_000);
    const s = sm.start('joyo', 'free', 'timeAttack');
    expect(s.gameMode).toBe('timeAttack');
    expect(s.deadlineAtMs).toBe(T0 + 30_000);
    expect(sm.timeRemainingMs(s)).toBe(30_000);
  });

  it('ガチャは無制限：残回数を減らさず、HAND_CAP までは引ける', () => {
    const { sm } = makeTA();
    const s = sm.start('joyo', 'free', 'timeAttack');
    for (let i = 0; i < 15; i++) sm.pullGacha(s);
    expect(s.hand).toHaveLength(12);
    expect(s.gachaRemaining).toBe(GACHA_COUNT);
    expect(s.phase).toBe('playing');
  });

  it('合体成功で deadline が延長される', () => {
    const { sm } = makeTA();
    const s = sm.start('elementary', 'free', 'timeAttack');
    setHand(s, ['ki', 'ki']); // 林（8画）
    const before = s.deadlineAtMs!;
    sm.combine(s, [...s.hand]);
    expect(s.deadlineAtMs! - before).toBe(TIME_ATTACK.baseExtendMs + 2000);
  });

  it('ミスで deadline が missPenaltyMs だけ減算される', () => {
    const { sm } = makeTA();
    const s = sm.start('elementary', 'free', 'timeAttack');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]);
    const before = s.deadlineAtMs!;
    setHand(s, ['ki', 'kuchi']);
    sm.combine(s, [...s.hand]);
    expect(s.deadlineAtMs! - before).toBe(-TIME_ATTACK.missPenaltyMs);
  });

  it('checkTimeout：残時間0で timeup 終了し、結果に gameMode が入る', () => {
    const { sm, clock } = makeTA(5_000);
    const s = sm.start('joyo', 'free', 'timeAttack');
    sm.checkTimeout();
    expect(s.phase).toBe('playing');
    clock.t = T0 + 5_001;
    sm.checkTimeout();
    expect(s.phase).toBe('ended');
    expect(s.stats.endReason).toBe('timeup');
    expect(sm.getResult()?.gameMode).toBe('timeAttack');
  });

  it('ベストは timeAttackBest 別枠に保存し、bestScores を汚さない', () => {
    const { sm, storage } = makeTA();
    const s = sm.start('elementary', 'free', 'timeAttack');
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]);
    const r = sm.end(s, 'timeup');
    expect(r.isNewBest).toBe(true);
    const persisted = storage.loadState();
    expect(persisted.timeAttackBest.elementary).toBe(8);
    expect(persisted.bestScores.elementary).toBe(0);
  });
});

describe('SessionManager dailyInfo（むずかしい廃止＝joyo は中学に丸める）', () => {
  it('level は elementary / juniorhigh のみを返す（joyo を含まない）', () => {
    // 多数の日付で joyo が出ないことを確認する（dailyLevel が joyo を返しても丸める）。
    const base = 1_780_000_000_000;
    for (let d = 0; d < 30; d++) {
      const { sm } = makeSM(undefined, {
        now: () => base + d * 86_400_000,
      });
      const info = sm.dailyInfo();
      expect(info.level === 'elementary' || info.level === 'juniorhigh').toBe(
        true
      );
    }
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
    expect(s.gameMode).toBe('deck');
  });

  it('終了後は全操作が no-op', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    s.deck = [];
    setHand(s, ['ki', 'ki']);
    sm.combine(s, [...s.hand]); // 林→手札0→deck_empty
    expect(s.phase).toBe('ended');
    sm.pullGacha(s);
    setHand(s, ['ki', 'ki']);
    expect(sm.combine(s, [...s.hand]).success).toBe(false);
    sm.discardAndDraw(s, 't0');
    expect(sm.useHint(s)).toBeNull();
    expect(s.stats.combineSuccess).toBe(1);
  });
});

describe('SessionManager ふりがな設定（T-031）', () => {
  it('setFurigana は設定を永続化し persistedStore を更新する', () => {
    const storage = new StorageRepository(new MemoryStorage());
    const { sm, persistedStore } = makeSM(storage);
    expect(get(persistedStore).settings.furigana).toBe(false);
    sm.setFurigana(true);
    expect(get(persistedStore).settings.furigana).toBe(true);
    expect(storage.loadState().settings.furigana).toBe(true); // 永続化
    sm.setFurigana(false);
    expect(get(persistedStore).settings.furigana).toBe(false);
  });
});

describe('SessionManager 表示支援（T-017 / T-020）', () => {
  it('partView は既知 partId の文字とレアリティを返し、未知は null', () => {
    const { sm } = makeSM();
    sm.start('elementary', 'free');
    expect(sm.partView('ki')).toEqual({ char: 'ki', rarity: 1 });
    expect(sm.partView('unknown')).toBeNull();
  });

  it('kanjiView は既知 char の読み/意味を返し、未知は null', () => {
    const { sm } = makeSM();
    expect(sm.kanjiView('林')).toEqual({
      char: '林',
      readings: [],
      meanings: [],
    });
    expect(sm.kanjiView('存在しない')).toBeNull();
  });

  it('reachableTotal は joyo の到達可能 N を返す（図鑑の分母）', () => {
    const { sm } = makeSM();
    expect(sm.reachableTotal()).toBe(REACHABLE.reachableN.joyo);
  });

  it('canPullGacha は playing・手札未満・山札ありで true', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');
    expect(sm.canPullGacha(s)).toBe(true);
    s.deck = [];
    s.gachaRemaining = 0;
    expect(sm.canPullGacha(s)).toBe(false);
    s.deck = ['ki'];
    s.gachaRemaining = 1;
    s.phase = 'ended';
    expect(sm.canPullGacha(s)).toBe(false);
  });
});

describe('SessionManager KPI 計測ログ（1プレイ統合）', () => {
  it('代表フロー（ガチャ→成功→ミス→ヒント→終了）で PlayStats 主要KPIが記録される', () => {
    const { sm } = makeSM();
    const s = sm.start('elementary', 'free');

    sm.pullGacha(s);
    expect(s.deck).toHaveLength(DECK_SIZE - 1);

    setHand(s, ['ki', 'ki']);
    expect(sm.combine(s, [...s.hand]).success).toBe(true);

    setHand(s, ['ki', 'kuchi']);
    expect(sm.combine(s, [...s.hand]).success).toBe(false);

    // 既出（林）を除いた、まだ作れる組（好＝ko+onna）をヒントが返す
    setHand(s, ['ko', 'onna', 'kuchi']);
    expect(sm.useHint(s)).not.toBeNull();

    const r = sm.end(s, 'deck_empty');
    expect(s.stats.combineSuccess).toBe(1);
    expect(s.stats.combineMiss).toBe(1);
    expect(s.stats.hintUsed).toBe(1);
    expect(s.stats.endReason).toBe('deck_empty');
    expect(r.reason).toBe('deck_empty');
  });
});
