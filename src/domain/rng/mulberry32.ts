import type { Rng } from './Rng';

/**
 * 決定的擬似乱数生成器 mulberry32（機能設計4.6）。
 * 同一シードからは必ず同一の乱数列を生成するため、デイリー（F8）の全プレイヤー共通
 * ガチャ列と、ユニットテストの決定性に用いる。
 *
 * `Math.random` は使わない（ドメイン純粋性）。状態 `a` をクロージャに閉じ込め、
 * 呼ぶたびに 32bit を撹拌して [0, 1) に正規化する。
 *
 * @param seed 初期シード（符号なし32bitに丸めて使用）
 * @returns 呼ぶたびに [0, 1) を返す `Rng`
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
