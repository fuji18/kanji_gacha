import { describe, it, expect } from 'vitest';
import { resolveRank } from '../../../../src/domain/rank/resolveRank';

// resolveRank の閾値境界（T-010 / 機能設計4.7・RANK_TABLE）を固定する。
// RANK_TABLE: 200=名人 / 120=上級 / 60=中級 / 0=見習い（score>=min の先頭マッチ）。

describe('resolveRank', () => {
  it('各閾値ちょうどで該当ランクを返す（境界・以上）', () => {
    expect(resolveRank(200)).toBe('名人');
    expect(resolveRank(120)).toBe('上級');
    expect(resolveRank(60)).toBe('中級');
    expect(resolveRank(0)).toBe('見習い');
  });

  it('閾値の直下では一つ下のランクになる', () => {
    expect(resolveRank(199)).toBe('上級');
    expect(resolveRank(119)).toBe('中級');
    expect(resolveRank(59)).toBe('見習い');
  });

  it('閾値を大きく超えるスコアは最上位（名人）', () => {
    expect(resolveRank(9999)).toBe('名人');
  });

  it('負のスコアでも防御的に最下位（見習い）を返す', () => {
    expect(resolveRank(-1)).toBe('見習い');
  });
});
