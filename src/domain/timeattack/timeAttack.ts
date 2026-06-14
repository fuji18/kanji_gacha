import { TIME_ATTACK } from '../constants';

/**
 * 時間延長計算の入力（T-027・企画整理書 §11）。実時刻には依存しない純粋な値のみ。
 */
export interface ExtensionInput {
  /** 採点対象漢字の画数（知識ボーナスの基礎）。 */
  strokes: number;
  /** この合体で消費した部品数（多部品ボーナス判定）。 */
  partCount: number;
  /** 前回成功から speedWindowMs 以内の連続正解か（速攻ボーナス）。 */
  speedy: boolean;
  /** 乗算するコンボ倍率（加点に使った前進前の倍率＝この合体の価値）。 */
  multiplier: number;
}

/**
 * タイムアタックの時間延長（ms）を計算する純粋関数（企画整理書 §11）。
 *
 *   延長 = round( (基礎 + 知識 + 多部品 + 速度) × コンボ倍率 )
 *     知識   = floor(画数 / strokesDivisorSec) 秒
 *     多部品 = partCount ≥ multiPartThreshold で multiPartBonusMs
 *     速度   = speedy で speedBonusMs
 *
 * 実時刻・乱数に依存しないため単体テストで決定的に検証できる。
 */
export function computeExtensionMs(input: ExtensionInput): number {
  const knowledgeMs =
    Math.floor(input.strokes / TIME_ATTACK.strokesDivisorSec) * 1000;
  const multiPartMs =
    input.partCount >= TIME_ATTACK.multiPartThreshold
      ? TIME_ATTACK.multiPartBonusMs
      : 0;
  const speedMs = input.speedy ? TIME_ATTACK.speedBonusMs : 0;
  const baseSum =
    TIME_ATTACK.baseExtendMs + knowledgeMs + multiPartMs + speedMs;
  return Math.round(baseSum * input.multiplier);
}
