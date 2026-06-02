/**
 * 決定的PRNG（mulberry32・機能設計 4.6）。
 *
 * 同一シードから同一乱数列を生成する。詰み率シミュレーション（T-004）を
 * CI で再現可能（決定的）にするために用いる。
 *
 * T-006（RNG）着手時に `src/domain/` の正式実装へ統合する前提。
 */

export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
