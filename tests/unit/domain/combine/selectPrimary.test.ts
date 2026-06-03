import { describe, it, expect } from 'vitest';
import { selectPrimary } from '../../../../src/domain/combine/selectPrimary';
import type { KanjiEntry } from '../../../../src/domain/types';

// selectPrimary は複数解から採点対象を一意決定する共通ルール（機能設計4.4）。
// freqRank 最小 → 同順位は画数大、の優先順位を固定する。

function kanji(char: string, strokes: number, freqRank?: number): KanjiEntry {
  return {
    char,
    strokes,
    readings: [],
    meanings: [],
    level: 'joyo',
    freqRank,
  };
}

describe('selectPrimary', () => {
  it('freqRank が最小（最も一般的）の漢字を選ぶ', () => {
    const result = selectPrimary([kanji('朙', 12, 500), kanji('明', 8, 100)]);
    expect(result.char).toBe('明');
  });

  it('freqRank が同順位なら画数が大きい方を選ぶ', () => {
    const result = selectPrimary([kanji('小', 3, 50), kanji('大', 9, 50)]);
    expect(result.char).toBe('大');
  });

  it('freqRank 未定義は最劣後（定義済みを優先）', () => {
    const result = selectPrimary([
      kanji('稀', 12, undefined),
      kanji('常', 11, 200),
    ]);
    expect(result.char).toBe('常');
  });

  it('全て freqRank 未定義なら画数が大きい方を選ぶ', () => {
    const result = selectPrimary([
      kanji('甲', 5, undefined),
      kanji('乙', 1, undefined),
    ]);
    expect(result.char).toBe('甲');
  });

  it('入力配列を破壊しない（純粋関数）', () => {
    const input = [kanji('明', 8, 100), kanji('朙', 12, 500)];
    const snapshot = input.map((k) => k.char);
    selectPrimary(input);
    expect(input.map((k) => k.char)).toEqual(snapshot);
  });
});
