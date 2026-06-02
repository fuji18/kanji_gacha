/**
 * ビルド時データ生成・検証で共有する定数（機能設計 4.5 / 8.1）。
 *
 * T-005（ドメイン定数）未着手のため、ビルド側に自己完結で置く。
 * T-005 着手時に `src/domain/` の正式な定数へ統合する前提。
 */

import type { Level, Rarity } from './types';

/** 学年区分の一覧（包含順） */
export const LEVELS: readonly Level[] = ['elementary', 'juniorhigh', 'joyo'];

/**
 * レベル別レアリティ出現率（機能設計 4.3・暫定）。
 * 詰み率シミュレーション（T-004）の抽選で用いる。各 level の合計は 1.0。
 * 実値の調整は T-009。
 */
export const RARITY_RATES: Record<Level, Record<Rarity, number>> = {
  elementary: { 1: 0.55, 2: 0.3, 3: 0.13, 4: 0.018, 5: 0.002 },
  juniorhigh: { 1: 0.45, 2: 0.3, 3: 0.18, 4: 0.05, 5: 0.02 },
  joyo: { 1: 0.35, 2: 0.3, 3: 0.22, 4: 0.09, 5: 0.04 },
};

/** 詰み終了率の KPI 目標帯（PRD・機能設計 4.3）。 */
export const STUCK_RATE_BAND = { min: 0.1, max: 0.2 } as const;

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
