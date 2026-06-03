import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../../../src/domain/rng/mulberry32';

// mulberry32 は決定的PRNG（機能設計4.6）。同一シード→同一列を固定し、
// デイリー再現性（F8）とテストの決定性を担保する。

describe('mulberry32', () => {
  it('同一シードからは同一の乱数列を返す（決定性）', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('seed=1 の先頭5個が固定値（スナップショット）', () => {
    const r = mulberry32(1);
    const seq = Array.from({ length: 5 }, () => r());
    expect(seq).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
      0.9810509674716741, 0.9683778982143849,
    ]);
  });

  it('異なるシードは異なる列になる', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('返り値は常に [0, 1) の範囲に収まる', () => {
    const r = mulberry32(98765);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('負シード・大きいシードでも符号なし32bitに丸めて動作する', () => {
    expect(() => {
      const r = mulberry32(-1);
      r();
    }).not.toThrow();
    // -1 と 0xFFFFFFFF は >>>0 で同値になり、同一列を返す
    const neg = mulberry32(-1);
    const max = mulberry32(0xffffffff);
    expect(neg()).toBe(max());
  });
});
