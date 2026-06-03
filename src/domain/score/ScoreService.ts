import type { KanjiEntry, ScoreState } from '../types';
import { COMBO_STEPS } from '../constants';

/**
 * 画数 → 基礎点の係数（暫定・要調整・機能設計4.2）。画数ベースのため、多部品・高画数ほど
 * 自然に高得点になる（自己バランス）。
 */
const STROKE_COEFFICIENT = 1;

/**
 * スコア・コンボ計算サービス（機能設計4.2・PRD F4）。引数で受けた `ScoreState` をその場で
 * 更新する（実行時ステートの進行）。外部依存を持たない純粋なロジック。
 */
export class ScoreService {
  /**
   * 合体成功時の加点とコンボ前進（機能設計4.2）。
   * 加点は **前進前の現在倍率** で行う（初回成功は ×1.0、2回目は ×1.5…）。加点後に
   * コンボを1段進め、倍率を `COMBO_STEPS` から引き直す（1.0→1.5→2.0→3.0→3.0…上限3.0）。
   *
   * @param s 更新対象のスコア状態（その場で変更）
   * @param awarded 採点対象の漢字（画数を基礎点に使う）
   */
  onSuccess(s: ScoreState, awarded: KanjiEntry): void {
    const base = awarded.strokes * STROKE_COEFFICIENT;
    s.score += Math.floor(base * s.comboMultiplier);
    s.comboCount += 1;
    s.comboMultiplier =
      COMBO_STEPS[Math.min(s.comboCount, COMBO_STEPS.length - 1)];
  }

  /**
   * ミス時のコンボリセット（機能設計4.2・PRD F4）。スコアは変えず、倍率と連続成功数のみ
   * 初期化する。
   *
   * @param s 更新対象のスコア状態（その場で変更）
   */
  onMiss(s: ScoreState): void {
    s.comboCount = 0;
    s.comboMultiplier = 1.0;
  }
}
