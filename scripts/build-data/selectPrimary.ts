/**
 * 代表解の選定（機能設計 4.4）。
 *
 * 1つの key に複数漢字が成立する場合、採点・図鑑付与する1字を一意に決める。
 *   1. freqRank が最小（最も一般的）を優先
 *   2. 同順位なら画数が大きい方（得点が高い方）を優先
 *
 * ビルド時（generate.ts）とプレイ時（将来 T-007）で同一ルールを使うため共通化する。
 */

import type { KanjiEntry } from './types';

export function selectPrimary(candidates: KanjiEntry[]): KanjiEntry {
  if (candidates.length === 0) {
    throw new Error('selectPrimary: candidates must not be empty');
  }
  return [...candidates].sort(
    (a, b) =>
      (a.freqRank ?? Infinity) - (b.freqRank ?? Infinity) ||
      b.strokes - a.strokes
  )[0];
}
