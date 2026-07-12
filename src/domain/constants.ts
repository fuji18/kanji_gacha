/**
 * ゲームバランスに関わる暫定値（要調整）の単一の真実
 * （development-guidelines 2.2）。マジックナンバーをロジックに直書きせず、
 * ここを参照する。`// 暫定・要調整` は値確定手順を経て外す。
 */

import type { Level, Rarity } from './types';

/** 1プレイのガチャ回数（暫定・要調整 PRD F6 / 機能設計3.2） */
export const GACHA_COUNT = 10;

/** 手札上限（暫定・要調整 PRD F1 / 機能設計3.2） */
export const HAND_CAP = 12;

/**
 * コンボ倍率の段階。連続成功数で進行する（暫定・要調整 PRD F4 / 機能設計4.2）。
 * 末尾が上限倍率。index は comboCount を clamp して参照する。 */
export const COMBO_STEPS = [1.0, 1.5, 2.0, 3.0] as const;

/** 詰み判定・ヒント探索の部品数上限。辞書の最大 partCount と一致（機能設計4.5 / 8.1） */
export const MAX_COMBINE_PARTS = 5;

/**
 * レベル別レアリティ出現率（暫定・要調整 機能設計4.3／整理書3.5 の初期案）。
 * 各レベルで合計 1.0。難易度はこの分布とプール weight で制御する。 */
export const RARITY_RATES: Record<Level, Record<Rarity, number>> = {
  elementary: { 1: 0.55, 2: 0.3, 3: 0.13, 4: 0.018, 5: 0.002 },
  juniorhigh: { 1: 0.45, 2: 0.3, 3: 0.18, 4: 0.05, 5: 0.02 },
  joyo: { 1: 0.35, 2: 0.3, 3: 0.22, 4: 0.09, 5: 0.04 },
};

/**
 * 称号ランクの固定閾値（暫定・要調整 機能設計4.7）。
 * min 降順で並べ、score >= min の先頭にマッチさせる（末尾 min=0 で必ず確定）。
 * 「上位%」表記は不使用（ローカル完結・PRD F6）。 */
export const RANK_TABLE = [
  { min: 200, name: '名人' },
  { min: 120, name: '上級' },
  { min: 60, name: '中級' },
  { min: 0, name: '見習い' },
] as const;

/**
 * 救済「ヒント」のレベル別コスト＝消費するガチャ残回数（暫定・要調整 PRD F5／機能設計5.1）。
 * `null` は利用不可（むずかしい）。やさしいは無料・常時（0）。 */
export const HINT_COST: Record<Level, number | null> = {
  elementary: 0, // やさしい：無料・常時
  juniorhigh: 1, // ふつう：ガチャ残 -1
  joyo: null, // むずかしい：利用不可
};

/**
 * 救済「捨てて引き直す」のレベル別コスト＝消費するガチャ残回数（暫定・要調整 PRD F5／機能設計5.1）。
 * 補充ガチャ自体は通常のガチャ残を消費せず、このコストのみ減算する（機能設計7.3）。 */
export const DISCARD_COST: Record<Level, number> = {
  elementary: 0, // やさしい：無料
  juniorhigh: 1, // ふつう：ガチャ残 -1
  joyo: 2, // むずかしい：ガチャ残 -2
};

/**
 * タイムアタックモードの時間収支パラメータ（暫定・要調整 T-027／企画整理書 §11）。
 * 延長秒 = (baseExtendMs + 知識 + 速度) × コンボ倍率。すべて ms 単位。
 *  - 知識 = floor(画数 / strokesDivisorSec) 秒 ＋（partCount≥multiPartThreshold で multiPartBonusMs）
 *  - 速度 = 前回成功から speedWindowMs 以内の連続正解で speedBonusMs
 *  - ミス = missPenaltyMs を減算（コンボリセットは既存ロジック）
 * 上限は設けない（雪だるま式の伸びを優先）。 */
export const TIME_ATTACK = {
  initialMs: 30_000, // 初期持ち時間（30秒）
  baseExtendMs: 3_000, // 成功時の基礎延長（3秒）
  strokesDivisorSec: 4, // 知識ボーナス＝floor(画数/4) 秒
  multiPartThreshold: 3, // この部品数以上で多部品ボーナス
  multiPartBonusMs: 2_000, // 多部品ボーナス（+2秒）
  speedWindowMs: 3_000, // 速攻判定の連続成功間隔（3秒以内）
  speedBonusMs: 2_000, // 速攻ボーナス（+2秒）
  missPenaltyMs: 2_000, // ミス時の減算（-2秒）
} as const;

/**
 * にがて漢字＆復習モードの簡易SRSパラメータ（暫定・要調整 T-035／
 * docs/ideas/レベル設計と学習機能.md §2・§6(5)）。
 * 達成型セッション終了時、対象字の完成/未完成で にがて度（重み）を増減する。
 *  - 未完成で終わった対象字 → 重み +failDelta（weightMax で頭打ち＝にがて登録）
 *  - 完成できた対象字 → 重み -successDelta（0以下で にがて から外す＝定着）
 * 復習モードは重みの大きい字を優先出題する。 */
export const REVIEW = {
  weightMax: 5, // にがて度の上限（出やすさの天井）
  failDelta: 2, // 未完成で増える量
  successDelta: 1, // 完成で減る量（複数回の正解で定着＝外れる）
} as const;
