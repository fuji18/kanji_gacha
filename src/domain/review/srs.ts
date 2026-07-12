/**
 * にがて漢字の簡易SRS（spaced repetition lite・T-035 / docs/ideas/レベル設計と学習機能.md §2・§6(5)）。
 *
 * 達成型（deck）セッションの結果から「にがて度（重み）」を増減し、復習モードの出題対象を選ぶ
 * **純粋関数**群（副作用なし・乱数は注入）。アプリ層（SessionManager）が永続データと接続する。
 *
 * 重みの意味：`weak[char] > 0` がにがて。大きいほど復習で優先される。0 以下は定着とみなし外す。
 */

import type { Rng } from '../rng/Rng';
import { REVIEW } from '../constants';

/** にがて度マップ（char -> 重み）。 */
export type WeakKanji = Record<string, number>;

/**
 * 達成型セッションの結果でにがて度を更新した**新しいマップ**を返す（元は破壊しない）。
 *
 *  - `targets` のうち `created` に含まれる字（＝完成＝正解）は重みを `successDelta` 下げ、
 *    0 以下になったら にがて から外す（定着）。
 *  - 完成できなかった対象字（＝未完成＝不正解）は重みを `failDelta` 上げ、`weightMax` で頭打ちにする
 *    （新規はここで にがて 登録される）。
 *
 * `targets` 以外の字（その回の対象でない字）は対象外＝重みを変えない。
 *
 * @param weak 現在のにがて度マップ
 * @param targets そのセッションの出題対象字（達成型の N 字）
 * @param created そのセッションで作成できた漢字（重複可。集合として扱う）
 */
export function updateWeakKanji(
  weak: WeakKanji,
  targets: readonly string[],
  created: readonly string[]
): WeakKanji {
  const next: WeakKanji = { ...weak };
  const done = new Set(created);
  for (const char of targets) {
    const current = next[char] ?? 0;
    if (done.has(char)) {
      const lowered = current - REVIEW.successDelta;
      if (lowered <= 0) delete next[char];
      else next[char] = lowered;
    } else {
      next[char] = Math.min(REVIEW.weightMax, current + REVIEW.failDelta);
    }
  }
  return next;
}

/**
 * 復習モードの出題対象を**重みの大きい順（優先）**で最大 `n` 件選ぶ。
 * 同じ重みの中ではランダムにする（毎回同じ並びにしない）ため、注入 RNG でシャッフルしてから
 * 重み降順に**安定ソート**する（同値は直前のシャッフル順＝ランダムを保つ）。
 *
 * @param weak にがて度マップ（重みの参照元）
 * @param candidates 出題可能な候補字（作れる字に限定済みであること）
 * @param n 取り出す最大件数（0 以下や候補不足は可能な範囲で返す）
 * @param rng 乱数源（[0,1)）。決定的テスト・デイリー再現のため注入する。
 */
export function selectReviewTargets(
  weak: WeakKanji,
  candidates: readonly string[],
  n: number,
  rng: Rng
): string[] {
  const shuffled = shuffle(candidates, rng);
  // Array.prototype.sort は安定（ES2019+）。重み同値はシャッフル順を保ち、ランダム性を担保する。
  shuffled.sort((a, b) => (weak[b] ?? 0) - (weak[a] ?? 0));
  return shuffled.slice(0, Math.max(0, n));
}

/** Fisher–Yates シャッフル（注入 RNG・非破壊）。 */
function shuffle(arr: readonly string[], rng: Rng): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
