import { describe, it, expect } from 'vitest';
import { ScoreService } from '../../../../src/domain/score/ScoreService';
import type { KanjiEntry, ScoreState } from '../../../../src/domain/types';

// ScoreService の受け入れ条件（T-010 / 機能設計4.2・PRD F4）を固定する。

function freshScore(): ScoreState {
  return { score: 0, comboMultiplier: 1.0, comboCount: 0 };
}

function kanji(strokes: number): KanjiEntry {
  return {
    char: '字',
    strokes,
    readings: [],
    meanings: [],
    level: 'elementary',
  };
}

describe('ScoreService.onSuccess', () => {
  it('画数が大きい漢字ほど高得点（同条件・初回成功）', () => {
    const service = new ScoreService();
    const small = freshScore();
    const large = freshScore();
    service.onSuccess(small, kanji(8));
    service.onSuccess(large, kanji(16));
    expect(small.score).toBe(8);
    expect(large.score).toBe(16);
    expect(large.score).toBeGreaterThan(small.score);
  });

  it('加点は前進前の倍率で行い、累積する（10画: 10,25,45,75,105）', () => {
    const service = new ScoreService();
    const s = freshScore();
    const k = kanji(10);
    service.onSuccess(s, k);
    expect(s.score).toBe(10); // floor(10×1.0)
    service.onSuccess(s, k);
    expect(s.score).toBe(25); // +floor(10×1.5)=15
    service.onSuccess(s, k);
    expect(s.score).toBe(45); // +floor(10×2.0)=20
    service.onSuccess(s, k);
    expect(s.score).toBe(75); // +floor(10×3.0)=30
    service.onSuccess(s, k);
    expect(s.score).toBe(105); // +floor(10×3.0)=30（上限維持）
  });

  it('連続成功で倍率が 1.0→1.5→2.0→3.0 と前進し 3.0 で上限', () => {
    const service = new ScoreService();
    const s = freshScore();
    const k = kanji(1);
    expect(s.comboMultiplier).toBe(1.0);
    service.onSuccess(s, k);
    expect(s.comboMultiplier).toBe(1.5);
    service.onSuccess(s, k);
    expect(s.comboMultiplier).toBe(2.0);
    service.onSuccess(s, k);
    expect(s.comboMultiplier).toBe(3.0);
    service.onSuccess(s, k);
    expect(s.comboMultiplier).toBe(3.0); // 上限
    expect(s.comboCount).toBe(4);
  });

  it('加点は floor で切り捨てる（3画×1.5=4.5→4）', () => {
    const service = new ScoreService();
    const s = freshScore();
    const k = kanji(3);
    service.onSuccess(s, k); // +floor(3×1.0)=3、倍率1.5へ
    expect(s.score).toBe(3);
    service.onSuccess(s, k); // +floor(3×1.5)=floor(4.5)=4
    expect(s.score).toBe(7);
  });
});

describe('ScoreService.onMiss', () => {
  it('ミスで倍率と連続成功数がリセットされ、スコアは不変', () => {
    const service = new ScoreService();
    const s = freshScore();
    const k = kanji(10);
    service.onSuccess(s, k);
    service.onSuccess(s, k); // combo 進行（count=2, mult=2.0, score=25）
    const scoreBefore = s.score;
    service.onMiss(s);
    expect(s.comboCount).toBe(0);
    expect(s.comboMultiplier).toBe(1.0);
    expect(s.score).toBe(scoreBefore); // スコアは変えない
  });

  it('リセット後の成功は再び ×1.0 から始まる', () => {
    const service = new ScoreService();
    const s = freshScore();
    const k = kanji(10);
    service.onSuccess(s, k);
    service.onSuccess(s, k); // score=25, mult=2.0
    service.onMiss(s); // mult=1.0
    service.onSuccess(s, k); // +floor(10×1.0)=10
    expect(s.score).toBe(35);
    expect(s.comboMultiplier).toBe(1.5);
  });
});
