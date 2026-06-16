import { describe, it, expect } from 'vitest';
import {
  selectReviewTargets,
  updateWeakKanji,
  type WeakKanji,
} from '../../../../src/domain/review/srs';
import { REVIEW } from '../../../../src/domain/constants';

// 簡易SRS（T-035）の純粋関数を固定する。
//  - updateWeakKanji：未完成→重み増（頭打ち・新規登録）／完成→重み減（0以下で外す）
//  - selectReviewTargets：重み降順で優先、同値は注入RNGでランダム、最大 n 件

describe('updateWeakKanji', () => {
  it('未完成で終わった対象字を にがて 登録する（新規＝failDelta）', () => {
    const next = updateWeakKanji({}, ['林', '好'], []);
    expect(next['林']).toBe(REVIEW.failDelta);
    expect(next['好']).toBe(REVIEW.failDelta);
  });

  it('未完成の繰り返しで重みが増えるが weightMax で頭打ち', () => {
    const start: WeakKanji = { 林: REVIEW.weightMax - 1 };
    const next = updateWeakKanji(start, ['林'], []);
    expect(next['林']).toBe(REVIEW.weightMax); // min(max, max-1+failDelta)
  });

  it('完成できた対象字は重みを successDelta 下げる', () => {
    const start: WeakKanji = { 林: REVIEW.successDelta + 1 };
    const next = updateWeakKanji(start, ['林'], ['林']);
    expect(next['林']).toBe(1);
  });

  it('完成で重みが0以下になったら にがて から外す（定着）', () => {
    const start: WeakKanji = { 林: REVIEW.successDelta };
    const next = updateWeakKanji(start, ['林'], ['林']);
    expect('林' in next).toBe(false);
  });

  it('対象字でない既存の にがて 字は変えない', () => {
    const start: WeakKanji = { 品: 3 };
    const next = updateWeakKanji(start, ['林'], ['林']);
    expect(next['品']).toBe(3);
  });

  it('元のマップを破壊しない（新しいオブジェクトを返す）', () => {
    const start: WeakKanji = { 林: 1 };
    const next = updateWeakKanji(start, ['林'], []);
    expect(start['林']).toBe(1); // 元は不変
    expect(next).not.toBe(start);
  });

  it('完成と未完成が混在しても字ごとに正しく増減する', () => {
    const start: WeakKanji = { 林: 2, 好: 2 };
    // 林=完成（-1）、好=未完成（+2）、品=新規未完成（+2）
    const next = updateWeakKanji(start, ['林', '好', '品'], ['林']);
    expect(next['林']).toBe(2 - REVIEW.successDelta);
    expect(next['好']).toBe(Math.min(REVIEW.weightMax, 2 + REVIEW.failDelta));
    expect(next['品']).toBe(REVIEW.failDelta);
  });
});

describe('selectReviewTargets', () => {
  const weak: WeakKanji = { 林: 5, 好: 3, 品: 1, 杏: 1 };

  it('重みの大きい順に最大 n 件返す（優先出題）', () => {
    const out = selectReviewTargets(weak, ['品', '林', '好'], 2, () => 0.5);
    expect(out).toEqual(['林', '好']); // 5 > 3 > 1
  });

  it('n が候補数を超えても候補数で頭打ち（全件返す）', () => {
    const out = selectReviewTargets(weak, ['林', '好'], 10, () => 0);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe('林');
  });

  it('n が0以下なら空配列', () => {
    expect(selectReviewTargets(weak, ['林', '好'], 0, () => 0)).toEqual([]);
    expect(selectReviewTargets(weak, ['林', '好'], -1, () => 0)).toEqual([]);
  });

  it('同じ RNG なら決定的（同一の並び）', () => {
    const seq = mkRng([0.1, 0.7, 0.3, 0.9]);
    const a = selectReviewTargets(weak, ['林', '好', '品', '杏'], 4, seq);
    const seq2 = mkRng([0.1, 0.7, 0.3, 0.9]);
    const b = selectReviewTargets(weak, ['林', '好', '品', '杏'], 4, seq2);
    expect(a).toEqual(b);
  });

  it('同値の重みは RNG のシャッフルで順序が変わりうる（ランダム性）', () => {
    // 品・杏 は同値(1)。重みで差が付かないため、並びは注入RNGのシャッフルに従う。
    const out1 = selectReviewTargets(weak, ['品', '杏'], 2, mkRng([0.99, 0]));
    const out2 = selectReviewTargets(weak, ['品', '杏'], 2, mkRng([0, 0]));
    // どちらも同じ2字を含むが、少なくとも一方は並びが入れ替わることを確認する。
    expect(new Set(out1)).toEqual(new Set(['品', '杏']));
    expect(out1).not.toEqual(out2);
  });

  it('候補が空なら空配列', () => {
    expect(selectReviewTargets(weak, [], 3, () => 0)).toEqual([]);
  });

  it('重み未登録（マップに無い）候補は重み0扱いで末尾に回る', () => {
    // 杏 は weak に無い→0扱い。林(5) が先頭、杏 は最下位。
    const out = selectReviewTargets({ 林: 5 }, ['杏', '林'], 2, () => 0.5);
    expect(out).toEqual(['林', '杏']);
  });
});

/** 与えた数列を順に返す決定的 RNG（末尾以降は 0）。 */
function mkRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? 0;
}
