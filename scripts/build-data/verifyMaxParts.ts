/**
 * MAX_COMBINE_PARTS 一致検証（T-004・機能設計 8.1 手順8）。
 *
 * 全 CombineEntry.partCount の最大値が、実行時の探索上限 `MAX_COMBINE_PARTS` と
 * 一致することを検証する。不一致なら CI を失敗させる（ハードゲート）：
 *   - 辞書実最大 > 定数 → 探索上限超の合体が発見不能になる（取りこぼし）
 *   - 辞書実最大 < 定数 → 探索が無駄に広い（軽微だが不整合として検出）
 *
 * 定数は src/domain を再利用する（ビルド側で二重定義しない）。
 */

import { MAX_COMBINE_PARTS } from '../../src/domain/constants';
import type { CombineEntry } from '../../src/domain/types';

export interface MaxPartsResult {
  ok: boolean;
  actualMax: number;
  expected: number;
}

export function verifyMaxParts(
  combine: CombineEntry[],
  expected: number = MAX_COMBINE_PARTS
): MaxPartsResult {
  const actualMax = combine.reduce((m, e) => Math.max(m, e.partCount), 0);
  return { ok: actualMax === expected, actualMax, expected };
}
