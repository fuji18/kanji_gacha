import { describe, it, expect } from 'vitest';
import { GachaService } from '../../../../src/domain/gacha/GachaService';
import { mulberry32 } from '../../../../src/domain/rng/mulberry32';
import { RARITY_RATES } from '../../../../src/domain/constants';
import type { Level, Part, Rarity } from '../../../../src/domain/types';

// GachaService.draw の受け入れ条件（T-009 / 機能設計4.3）を固定する。
// 乱数は固定シード mulberry32 を注入し、分布・weight・決定性を決定的に検証する。

const RARITIES: Rarity[] = [1, 2, 3, 4, 5];

function part(
  id: string,
  rarity: Rarity,
  weight: number,
  scopes: Level[]
): Part {
  return { id, char: id, rarity, scopes, weight };
}

/** 各レアリティ1部品ずつ（weight一定）の joyo プール。レアリティ分布の検証用。 */
function rarityProbePool(): Part[] {
  return RARITIES.map((r) => part(`r${r}`, r, 1, ['joyo']));
}

describe('GachaService.draw レアリティ分布', () => {
  it('多数試行でレアリティ分布が RARITY_RATES[joyo] に統計的に一致する', () => {
    const gacha = new GachaService();
    const pool = rarityProbePool();
    const rng = mulberry32(12345);
    const N = 20000;
    const counts: Record<Rarity, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (let i = 0; i < N; i++) {
      counts[gacha.draw('joyo', pool, rng).rarity] += 1;
    }
    for (const r of RARITIES) {
      const observed = counts[r] / N;
      expect(observed).toBeCloseTo(RARITY_RATES.joyo[r], 1); // 小数1桁（±0.05）
      expect(Math.abs(observed - RARITY_RATES.joyo[r])).toBeLessThan(0.02);
    }
  });

  it('在庫のあるレアリティのみで正規化する（★欠品でも破綻しない）', () => {
    const gacha = new GachaService();
    // joyo に rarity1 と rarity5 だけ在庫（2,3,4 は欠品）
    const pool = [part('a', 1, 1, ['joyo']), part('b', 5, 1, ['joyo'])];
    const rng = mulberry32(7);
    const seen = new Set<Rarity>();
    let r1 = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const drawn = gacha.draw('joyo', pool, rng);
      seen.add(drawn.rarity);
      if (drawn.rarity === 1) r1 += 1;
    }
    expect(seen).toEqual(new Set<Rarity>([1, 5]));
    // 正規化後 rarity1 = 0.35/(0.35+0.04) ≈ 0.897 で支配的
    expect(r1 / N).toBeGreaterThan(0.8);
  });
});

describe('GachaService.draw weight の効き', () => {
  it('同一レアリティ内で weight が大きい部品ほど出やすい（約9:1）', () => {
    const gacha = new GachaService();
    const pool = [part('heavy', 3, 9, ['joyo']), part('light', 3, 1, ['joyo'])];
    const rng = mulberry32(999);
    const N = 10000;
    let heavy = 0;
    for (let i = 0; i < N; i++) {
      if (gacha.draw('joyo', pool, rng).id === 'heavy') heavy += 1;
    }
    const ratio = heavy / N;
    expect(ratio).toBeGreaterThan(0.86);
    expect(ratio).toBeLessThan(0.94);
  });
});

describe('GachaService.draw scope 絞り込み・異常系', () => {
  it('scope 外の部品は決して抽選されない', () => {
    const gacha = new GachaService();
    const pool = [
      part('elem', 1, 1, ['elementary']), // juniorhigh の scope 外
      part('juni', 1, 1, ['juniorhigh']),
    ];
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      expect(gacha.draw('juniorhigh', pool, rng).id).toBe('juni');
    }
  });

  it('level の scope に部品が無ければ例外を投げる', () => {
    const gacha = new GachaService();
    const rng = mulberry32(1);
    expect(() => gacha.draw('joyo', [], rng)).toThrow();
    // 部品はあるが scope 外しかない場合も例外
    const onlyElem = [part('e', 1, 1, ['elementary'])];
    expect(() => gacha.draw('joyo', onlyElem, rng)).toThrow();
  });
});

describe('GachaService.draw 決定性', () => {
  it('同一シードからは同一の抽選列を返す（rng 注入）', () => {
    const gacha = new GachaService();
    const pool = rarityProbePool();
    const seqA: string[] = [];
    const seqB: string[] = [];
    const rngA = mulberry32(2026);
    const rngB = mulberry32(2026);
    for (let i = 0; i < 50; i++) {
      seqA.push(gacha.draw('joyo', pool, rngA).id);
      seqB.push(gacha.draw('joyo', pool, rngB).id);
    }
    expect(seqA).toEqual(seqB);
  });
});
