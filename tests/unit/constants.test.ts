import { describe, it, expect } from 'vitest';
import {
  GACHA_COUNT,
  HAND_CAP,
  COMBO_STEPS,
  MAX_COMBINE_PARTS,
  RARITY_RATES,
  RANK_TABLE,
} from '../../src/domain/constants';
import type { Level } from '../../src/domain/types';

// 暫定定数の不変条件を固定するテスト（機能設計4.2/4.3/4.7）。
// 値そのものではなく「壊れてはいけない性質」を検証し、調整時の事故を防ぐ。

describe('domain constants', () => {
  describe('RARITY_RATES', () => {
    const levels: Level[] = ['elementary', 'juniorhigh', 'joyo'];

    it('各レベルの出現率合計が 1.0 になる（機能設計4.3）', () => {
      for (const level of levels) {
        const sum = Object.values(RARITY_RATES[level]).reduce(
          (a, b) => a + b,
          0
        );
        // 浮動小数の丸め誤差を許容
        expect(sum).toBeCloseTo(1.0, 10);
      }
    });

    it('全レベルで ★1〜★5 の確率がすべて非負', () => {
      for (const level of levels) {
        for (const rate of Object.values(RARITY_RATES[level])) {
          expect(rate).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('COMBO_STEPS', () => {
    it('全要素が 1.0 以上（コンボでスコアが下がらない・機能設計4.2）', () => {
      for (const step of COMBO_STEPS) {
        expect(step).toBeGreaterThanOrEqual(1.0);
      }
    });

    it('単調増加である', () => {
      for (let i = 1; i < COMBO_STEPS.length; i++) {
        expect(COMBO_STEPS[i]).toBeGreaterThan(COMBO_STEPS[i - 1]);
      }
    });
  });

  describe('RANK_TABLE', () => {
    it('min が降順に並ぶ（先頭一致探索の前提・機能設計4.7）', () => {
      for (let i = 1; i < RANK_TABLE.length; i++) {
        expect(RANK_TABLE[i].min).toBeLessThan(RANK_TABLE[i - 1].min);
      }
    });

    it('末尾の min が 0（どんなスコアでも必ず称号が確定する）', () => {
      expect(RANK_TABLE[RANK_TABLE.length - 1].min).toBe(0);
    });
  });

  describe('整数スカラー定数', () => {
    it('GACHA_COUNT / HAND_CAP / MAX_COMBINE_PARTS は正の整数', () => {
      for (const value of [GACHA_COUNT, HAND_CAP, MAX_COMBINE_PARTS]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    });

    it('手札上限は合体探索上限以上（探索が手札に収まる・機能設計4.5）', () => {
      expect(HAND_CAP).toBeGreaterThanOrEqual(MAX_COMBINE_PARTS);
    });
  });
});
