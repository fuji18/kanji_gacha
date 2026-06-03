/**
 * ビルド固有の学年区分ユーティリティ（T-003）。
 *
 * `Level` 型・ロジック本体はドメイン（src/domain）にあるが、KANJIDIC2 の `grade` から
 * `Level` を決める変換と包含順の補助テーブルは「元データ → ドメイン」への写像であり
 * 生成時のみ必要なため、ビルド側に置く（ドメインは元データ形式を知らない）。
 */

import type { Level } from '../../src/domain/types';

/** 学年区分の一覧（包含順 elementary ⊆ juniorhigh ⊆ joyo） */
export const LEVELS: readonly Level[] = ['elementary', 'juniorhigh', 'joyo'];

/** 学年区分のランク（包含判定用：小さいほど基礎的） */
export const LEVEL_RANK: Record<Level, number> = {
  elementary: 0,
  juniorhigh: 1,
  joyo: 2,
};

/**
 * KANJIDIC2 grade から level を決める（grade 1–6=小学 / 8=常用残り）。
 * grade 8（中学以降の常用）は、頻度のある字を juniorhigh、残りを joyo に割り当て、
 * 包含関係（elementary ⊆ juniorhigh ⊆ joyo）を満たす3段プールを構成する。
 */
export function gradeToLevel(grade: number, freq: number | null): Level {
  if (grade >= 1 && grade <= 6) return 'elementary';
  return freq != null ? 'juniorhigh' : 'joyo';
}
