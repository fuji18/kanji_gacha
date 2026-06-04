import { describe, it, expect, beforeEach } from 'vitest';
import { RescueService } from '../../../../src/domain/rescue/RescueService';
import { CombineService } from '../../../../src/domain/combine/CombineService';
import { GachaService } from '../../../../src/domain/gacha/GachaService';
import { mulberry32 } from '../../../../src/domain/rng/mulberry32';
import { GACHA_COUNT } from '../../../../src/domain/constants';
import type {
  CombineEntry,
  CombineKey,
  GameSession,
  KanjiEntry,
  Level,
  Part,
  PlayStats,
} from '../../../../src/domain/types';

// RescueService の受け入れ条件（T-011 / 機能設計5.1・7.3・PRD F5）を固定する。
//  - ヒントはレベル別の可否・コストに従う（むずは利用不可）
//  - 捨てて引き直すで手札が入れ替わり、コストが正しく減る
//  - 補充ガチャは通常のガチャ残を消費しない（コスト分のみ）
//  - rng は注入（固定シード mulberry32 で決定的に検証）

// ----- 辞書フィクスチャ（木+木=林・elementary） -----
function kanji(char: string, level: Level): KanjiEntry {
  return { char, strokes: 8, readings: [], meanings: [], level };
}

const KANJI: Map<string, KanjiEntry> = new Map([
  ['林', kanji('林', 'elementary')],
]);

const DICT: Map<CombineKey, CombineEntry> = new Map([
  ['ki+ki', { key: 'ki+ki', results: ['林'], primary: '林', partCount: 2 }],
]);

// ----- 部品プール（全レベル scope。draw が level で絞り込む） -----
function part(id: string): Part {
  return {
    id,
    char: id,
    rarity: 1,
    scopes: ['elementary', 'juniorhigh', 'joyo'],
    weight: 1,
  };
}
const POOL: Part[] = [part('ki'), part('kuchi'), part('hi')];

// ----- セッションフィクスチャ -----
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

function session(
  level: Level,
  hand: string[],
  gachaRemaining = GACHA_COUNT
): GameSession {
  return {
    level,
    mode: 'free',
    seed: null,
    gachaRemaining,
    hand: hand.map((partId, i) => ({ instanceId: `i${i}`, partId })),
    score: { score: 0, comboMultiplier: 1.0, comboCount: 0 },
    createdKanji: [],
    newlyDiscovered: [],
    stats: freshStats(),
    phase: 'playing',
  };
}

// 補充部品に決定的な instanceId を採番するカウンタ（純粋・テスト用）
function idFactory(): () => string {
  let n = 0;
  return () => `new-${n++}`;
}

function makeService(): RescueService {
  return new RescueService(
    new CombineService(DICT, KANJI),
    new GachaService(),
    POOL,
    idFactory()
  );
}

describe('RescueService.useHint レベル別の可否・コスト', () => {
  let rescue: RescueService;
  beforeEach(() => {
    rescue = makeService();
  });

  it('やさしい：無料で合体可能な組を返す（ガチャ残は不変）', () => {
    const s = session('elementary', ['ki', 'ki', 'kuchi'], 5);
    const hint = rescue.useHint(s);
    expect(hint).not.toBeNull();
    // 返った組は実際に合体可能（ki+ki=林）
    expect(hint!.map((h) => h.partId).sort()).toEqual(['ki', 'ki']);
    expect(s.gachaRemaining).toBe(5); // 無料＝消費なし
  });

  it('ふつう：合体可能な組を返し、ガチャ残を1消費する', () => {
    const s = session('juniorhigh', ['ki', 'ki', 'hi'], 5);
    const hint = rescue.useHint(s);
    expect(hint).not.toBeNull();
    expect(s.gachaRemaining).toBe(4); // -1
  });

  it('むずかしい：利用不可。null を返し、ガチャ残を消費しない', () => {
    const s = session('joyo', ['ki', 'ki', 'hi'], 5);
    const hint = rescue.useHint(s);
    expect(hint).toBeNull();
    expect(s.gachaRemaining).toBe(5); // 利用不可＝消費なし
  });

  it('ふつうで残不足（コスト未満）なら null・消費なし（境界）', () => {
    const s = session('juniorhigh', ['ki', 'ki'], 0); // cost 1 > 残 0
    expect(rescue.useHint(s)).toBeNull();
    expect(s.gachaRemaining).toBe(0);
  });

  it('ふつうで残がコストと等しい（残1）なら実行される（境界・< と <= の取り違え検出）', () => {
    const s = session('juniorhigh', ['ki', 'ki'], 1); // cost 1 === 残 1 → 実行
    expect(rescue.useHint(s)).not.toBeNull();
    expect(s.gachaRemaining).toBe(0);
  });

  it('合体可能な組が無い（詰み）なら、ふつうでも課金しない', () => {
    const s = session('juniorhigh', ['kuchi', 'hi'], 5); // 辞書に無い→詰み
    expect(rescue.useHint(s)).toBeNull();
    expect(s.gachaRemaining).toBe(5); // 価値の無いヒントに課金しない
  });
});

describe('RescueService.discardAndDraw 手札入替とコスト', () => {
  let rescue: RescueService;
  beforeEach(() => {
    rescue = makeService();
  });

  it('指定 instanceId を捨て、補充1枚で手札枚数は不変・対象は消える', () => {
    const s = session('elementary', ['ki', 'kuchi', 'hi'], 5);
    const sizeBefore = s.hand.length;
    rescue.discardAndDraw(s, 'i1', mulberry32(1)); // i1 = kuchi を捨てる
    expect(s.hand.length).toBe(sizeBefore); // 削除1＋追加1で不変
    expect(s.hand.some((h) => h.instanceId === 'i1')).toBe(false); // 捨てた札は消える
    expect(s.hand.some((h) => h.instanceId === 'new-0')).toBe(true); // 補充札が入る
  });

  it('やさしい：コスト0。補充しても通常ガチャ残を消費しない', () => {
    const s = session('elementary', ['ki', 'kuchi'], 5);
    rescue.discardAndDraw(s, 'i0', mulberry32(1));
    expect(s.gachaRemaining).toBe(5); // やさ=0、補充は通常ガチャ残を消費しない
  });

  it('ふつう：ガチャ残を1だけ消費する（補充分は減らさない）', () => {
    const s = session('juniorhigh', ['ki', 'kuchi'], 5);
    rescue.discardAndDraw(s, 'i0', mulberry32(1));
    expect(s.gachaRemaining).toBe(4); // -1 のみ（補充ガチャは無消費）
  });

  it('むずかしい：ガチャ残を2消費する', () => {
    const s = session('joyo', ['ki', 'kuchi'], 5);
    rescue.discardAndDraw(s, 'i0', mulberry32(1));
    expect(s.gachaRemaining).toBe(3); // -2
  });

  it('残不足（コスト未満）なら no-op（手札・ガチャ残とも不変）', () => {
    const s = session('joyo', ['ki', 'kuchi'], 1); // cost 2 > 残 1
    const handBefore = s.hand.map((h) => h.instanceId);
    rescue.discardAndDraw(s, 'i0', mulberry32(1));
    expect(s.gachaRemaining).toBe(1);
    expect(s.hand.map((h) => h.instanceId)).toEqual(handBefore);
  });

  it('むずかしいで残がコストと等しい（残2）なら実行される（境界・< と <= の取り違え検出）', () => {
    const s = session('joyo', ['ki', 'kuchi'], 2); // cost 2 === 残 2 → 実行
    rescue.discardAndDraw(s, 'i0', mulberry32(1));
    expect(s.gachaRemaining).toBe(0); // -2
    expect(s.hand.some((h) => h.instanceId === 'i0')).toBe(false); // 捨てた札は消える
    expect(s.hand.some((h) => h.instanceId === 'new-0')).toBe(true); // 補充札が入る
  });

  it('存在しない instanceId なら no-op（防御）', () => {
    const s = session('juniorhigh', ['ki', 'kuchi'], 5);
    const handBefore = s.hand.map((h) => h.instanceId);
    rescue.discardAndDraw(s, 'nope', mulberry32(1));
    expect(s.gachaRemaining).toBe(5);
    expect(s.hand.map((h) => h.instanceId)).toEqual(handBefore);
  });
});

describe('RescueService.discardAndDraw 補充ガチャの rng 注入・決定性', () => {
  it('同一シードからは同一の補充部品が引かれる（rng 注入）', () => {
    const a = new RescueService(
      new CombineService(DICT, KANJI),
      new GachaService(),
      POOL,
      idFactory()
    );
    const b = new RescueService(
      new CombineService(DICT, KANJI),
      new GachaService(),
      POOL,
      idFactory()
    );
    const sa = session('elementary', ['ki', 'kuchi'], 5);
    const sb = session('elementary', ['ki', 'kuchi'], 5);
    a.discardAndDraw(sa, 'i0', mulberry32(2026));
    b.discardAndDraw(sb, 'i0', mulberry32(2026));
    const drawnA = sa.hand.find((h) => h.instanceId === 'new-0')!.partId;
    const drawnB = sb.hand.find((h) => h.instanceId === 'new-0')!.partId;
    expect(drawnA).toBe(drawnB);
  });
});
