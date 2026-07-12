import { describe, it, expect } from 'vitest';
import { CombineService } from '../../../../src/domain/combine/CombineService';
import type {
  CombineEntry,
  CombineKey,
  HandPart,
  KanjiEntry,
  Level,
} from '../../../../src/domain/types';

// CombineService.resolve の受け入れ条件（チケット T-007 / 機能設計4.1・4.4）を固定する。
// 辞書・漢字マスタはインメモリ Map をフィクスチャとして注入する。

function hand(...partIds: string[]): HandPart[] {
  return partIds.map((partId, i) => ({ instanceId: `i${i}`, partId }));
}

function kanji(
  char: string,
  level: Level,
  strokes: number,
  freqRank?: number
): KanjiEntry {
  return { char, strokes, readings: [], meanings: [], level, freqRank };
}

function entry(key: CombineKey, results: string[]): CombineEntry {
  return {
    key,
    results,
    primary: results[0],
    // partCount は resolve では未参照（T-008 詰み判定で使用）。辞書生成と同じ算出。
    partCount: key.split('+').length,
  };
}

/** 各テストで使う辞書・漢字マスタの基本フィクスチャ */
function buildService(): CombineService {
  const kanjiList: KanjiEntry[] = [
    kanji('明', 'elementary', 8, 100), // 日+月（複数解の代表）
    kanji('朙', 'joyo', 12, 500), // 日+月（別解・低頻度）
    kanji('樹', 'juniorhigh', 16, 1200), // 木+壴+寸（多部品）
    kanji('某', 'juniorhigh', 9, 3000), // scope 外テスト用
  ];
  const kanjiMap = new Map(kanjiList.map((k) => [k.char, k]));

  const dict = new Map<CombineKey, CombineEntry>([
    ['hi+tsuki', entry('hi+tsuki', ['明', '朙'])],
    ['ki+kotsuzumi+sun', entry('ki+kotsuzumi+sun', ['樹'])],
    ['ki+kusa', entry('ki+kusa', ['某'])], // juniorhigh のみ（makeKey 正規化後のキー）
  ]);

  return new CombineService(dict, kanjiMap);
}

describe('CombineService.resolve', () => {
  it('resolve_配置違い_同じ漢字（部品順が違っても同じ awarded）', () => {
    const service = buildService();
    const a = service.resolve(hand('hi', 'tsuki'), 'elementary');
    const b = service.resolve(hand('tsuki', 'hi'), 'elementary');
    expect(a?.awarded.char).toBe('明');
    expect(b?.awarded.char).toBe('明');
  });

  it('多部品（3部品）合体が成立する（例 木+壴+寸=樹）', () => {
    const service = buildService();
    const result = service.resolve(
      hand('sun', 'ki', 'kotsuzumi'),
      'juniorhigh'
    );
    expect(result?.awarded.char).toBe('樹');
  });

  it('resolve_2部品未満_null', () => {
    const service = buildService();
    expect(service.resolve(hand('hi'), 'elementary')).toBeNull();
    expect(service.resolve([], 'elementary')).toBeNull();
  });

  it('resolve_scope外_null（範囲外の漢字のみはミス扱い）', () => {
    const service = buildService();
    // 某 は juniorhigh。elementary セッションでは scope 外 → null
    expect(service.resolve(hand('kusa', 'ki'), 'elementary')).toBeNull();
    // juniorhigh なら成立する
    expect(
      service.resolve(hand('kusa', 'ki'), 'juniorhigh')?.awarded.char
    ).toBe('某');
  });

  it('resolve_複数解_awarded一意（残りは altInScope）', () => {
    const service = buildService();
    const result = service.resolve(hand('hi', 'tsuki'), 'joyo');
    // freqRank 最小の 明 が awarded、朙 は altInScope へ
    expect(result?.awarded.char).toBe('明');
    expect(result?.altInScope.map((k) => k.char)).toEqual(['朙']);
  });

  it('複数解でも scope 外の別解は inScope に含まれない', () => {
    const service = buildService();
    // elementary では 朙(joyo) は scope 外。awarded=明・altInScope は空
    const result = service.resolve(hand('hi', 'tsuki'), 'elementary');
    expect(result?.awarded.char).toBe('明');
    expect(result?.altInScope).toEqual([]);
  });

  it('辞書に無いキーは null（ミス扱い）', () => {
    const service = buildService();
    expect(service.resolve(hand('ki', 'ki'), 'joyo')).toBeNull();
  });

  it('辞書にあるが漢字マスタに無い char は安全に除外し null', () => {
    const dict = new Map<CombineKey, CombineEntry>([
      ['x+y', entry('x+y', ['欠損字'])],
    ]);
    const service = new CombineService(dict, new Map());
    expect(service.resolve(hand('x', 'y'), 'joyo')).toBeNull();
  });
});

// T-008 詰み判定・ヒント探索（機能設計4.5・PRD F5/F6）。
// canCombineAny / findHint は resolve を再利用した部分集合総当たり。

describe('CombineService.canCombineAny', () => {
  it('合体可能な手札で true（2部品ペアが成立）', () => {
    const service = buildService();
    expect(service.canCombineAny(hand('hi', 'tsuki'), 'elementary')).toBe(true);
  });

  it('余分な部品が混ざっていても部分集合から成立を見つけて true', () => {
    const service = buildService();
    // zzz は無関係な部品。部分集合 {hi,tsuki} が成立する
    expect(
      service.canCombineAny(hand('hi', 'tsuki', 'zzz'), 'elementary')
    ).toBe(true);
  });

  it('詰み手札（どの組み合わせも成立しない）で false', () => {
    const service = buildService();
    expect(service.canCombineAny(hand('zzz', 'qqq', 'www'), 'joyo')).toBe(
      false
    );
  });

  it('手札が2枚未満なら false', () => {
    const service = buildService();
    expect(service.canCombineAny(hand('hi'), 'elementary')).toBe(false);
    expect(service.canCombineAny([], 'elementary')).toBe(false);
  });

  it('3部品のみで成立する手札（2部品ペアが無い）でも true', () => {
    const service = buildService();
    expect(
      service.canCombineAny(hand('ki', 'kotsuzumi', 'sun'), 'juniorhigh')
    ).toBe(true);
  });

  it('scope 外の漢字しか作れない手札は false（レベル境界）', () => {
    const service = buildService();
    // ki+kusa=某 は juniorhigh。elementary では scope 外 → 詰み扱い
    expect(service.canCombineAny(hand('ki', 'kusa'), 'elementary')).toBe(false);
    expect(service.canCombineAny(hand('ki', 'kusa'), 'juniorhigh')).toBe(true);
  });

  it('同一部品が複数枚あっても別インスタンスとして部分集合を作れる', () => {
    const service = buildService();
    // hi が2枚。{hi(0),tsuki} / {hi(1),tsuki} のどちらかで 明 が成立
    expect(service.canCombineAny(hand('hi', 'hi', 'tsuki'), 'elementary')).toBe(
      true
    );
  });
});

describe('CombineService.findHint', () => {
  it('返したヒントは実際に resolve で成立する（妥当性）', () => {
    const service = buildService();
    const hint = service.findHint(hand('hi', 'tsuki', 'zzz'), 'elementary');
    expect(hint).not.toBeNull();
    expect(service.resolve(hint!, 'elementary')?.awarded.char).toBe('明');
  });

  it('最小サイズの組を優先して返す（2部品 vs 3部品が両立する手札）', () => {
    const service = buildService();
    // {hi,tsuki}=明（2部品）と {ki,kotsuzumi,sun}=樹（3部品）が両立
    const hint = service.findHint(
      hand('hi', 'tsuki', 'ki', 'kotsuzumi', 'sun'),
      'juniorhigh'
    );
    expect(hint).toHaveLength(2);
    expect(service.resolve(hint!, 'juniorhigh')?.awarded.char).toBe('明');
  });

  it('3部品のみ成立する手札では3部品の組を返す', () => {
    const service = buildService();
    const hint = service.findHint(hand('ki', 'kotsuzumi', 'sun'), 'juniorhigh');
    expect(hint).toHaveLength(3);
    expect(service.resolve(hint!, 'juniorhigh')?.awarded.char).toBe('樹');
  });

  it('詰み手札では null を返す', () => {
    const service = buildService();
    expect(service.findHint(hand('zzz', 'qqq'), 'joyo')).toBeNull();
  });

  it('満杯手札（12枚・成立組なし）でも早期returnで高速に false/null', () => {
    const service = buildService();
    // 辞書に存在しない部品で12枚埋める（最悪ケースの探索量 ≈ 1,573通り）
    const fullHand = hand(...Array.from({ length: 12 }, (_, i) => `none${i}`));
    const start = performance.now();
    const stuck = service.canCombineAny(fullHand, 'joyo');
    const elapsed = performance.now() - start;
    expect(stuck).toBe(false);
    expect(service.findHint(fullHand, 'joyo')).toBeNull();
    // 感覚値：全探索しても十分高速（目標5ms以下。CI揺らぎを見て緩めに50ms）
    expect(elapsed).toBeLessThan(50);
  });
});
