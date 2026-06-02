/**
 * ビルド時データ生成・検証で共有する定数（機能設計 4.5 / 8.1）。
 *
 * T-005（ドメイン定数）未着手のため、ビルド側に自己完結で置く。
 * T-005 着手時に `src/domain/` の正式な定数へ統合する前提。
 */

import type { Level } from './types';

/** 学年区分の一覧（包含順） */
export const LEVELS: readonly Level[] = ['elementary', 'juniorhigh', 'joyo'];

/** 学年区分のランク（包含判定用：elementary(0) ⊆ juniorhigh(1) ⊆ joyo(2)） */
export const LEVEL_RANK: Record<Level, number> = {
  elementary: 0,
  juniorhigh: 1,
  joyo: 2,
};

/**
 * 合体の探索上限／辞書に採用する最大部品数（機能設計 4.5）。
 * 実行時の詰み判定 `findCombinable` の探索上限と一致させる。
 * T-004 の `verifyMaxParts` が「辞書実最大 === この値」を検証する。
 */
export const MAX_COMBINE_PARTS = 5;

/** KANJIDIC2 grade から level を決める（grade 1–6=小学 / 8=常用残り）。 */
export function gradeToLevel(grade: number, freq: number | null): Level {
  if (grade >= 1 && grade <= 6) return 'elementary';
  // grade === 8（常用のうち中学以降）。頻度のある字を juniorhigh、残りを joyo に割当て、
  // 包含関係（elementary ⊆ juniorhigh ⊆ joyo）を満たす3段プールを構成する。
  return freq != null ? 'juniorhigh' : 'joyo';
}
