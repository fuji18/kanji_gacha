import { RANK_TABLE } from '../constants';

/**
 * スコアから称号ランク名を求める（機能設計4.7・PRD F6）。
 * バックエンドを持たず、ローカルの固定閾値テーブル `RANK_TABLE`（min 降順・末尾 min=0）を
 * `score >= min` で先頭マッチする。「上位%」表記は使わない（実プレイヤー分布を参照しない）。
 *
 * @param score 評価対象のスコア（通常は 0 以上）
 * @returns ランク名（score≥0 では必ず確定。負値は防御的に最下位ランク）
 */
export function resolveRank(score: number): string {
  const tier = RANK_TABLE.find((r) => score >= r.min);
  // 末尾 min=0 のため score≥0 では tier は必ず見つかる。負値のみ防御的にフォールバック。
  return (tier ?? RANK_TABLE[RANK_TABLE.length - 1]).name;
}
