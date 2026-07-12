import type { KanjiEntry } from '../types';

/**
 * 複数解（同一キーに複数漢字が成立）から採点・図鑑付与する代表解を一意に決める
 * 共通ルール（機能設計4.4）。ビルド時の `CombineEntry.primary` 算出と、プレイ時の
 * scope内 `awarded` 確定の両方で同じ基準を使うために切り出している。
 *
 * 選定基準：
 *   1. `freqRank` が最小（最も一般的）を優先。未定義は最劣後（Infinity 扱い）
 *   2. 同順位なら画数が大きい方（得点が高い方）を優先
 *
 * @param candidates 1件以上の候補（呼び出し側で非空を保証する）
 * @returns 基準で最優先の1字
 */
export function selectPrimary(candidates: KanjiEntry[]): KanjiEntry {
  // 非破壊ソート：入力配列を変更しない（純粋関数）
  return [...candidates].sort(
    (a, b) =>
      (a.freqRank ?? Infinity) - (b.freqRank ?? Infinity) ||
      b.strokes - a.strokes
  )[0];
}
