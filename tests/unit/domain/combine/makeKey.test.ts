import { describe, it, expect } from 'vitest';
import { makeKey } from '../../../../src/domain/combine/makeKey';
import type { HandPart } from '../../../../src/domain/types';

// makeKey はマルチセット正規化（配置不問・重複可）を担う（機能設計4.1）。
// 「順序・配置の違いを吸収し、同じ部品構成は同じキーになる」性質を固定する。

function hand(...partIds: string[]): HandPart[] {
  return partIds.map((partId, i) => ({ instanceId: `i${i}`, partId }));
}

describe('makeKey', () => {
  it('部品の選択順が違っても同じキーになる（配置不問）', () => {
    expect(makeKey(hand('ki', 'kuchi'))).toBe(makeKey(hand('kuchi', 'ki')));
  });

  it('部品idを昇順ソートして "+" 連結する', () => {
    expect(makeKey(hand('kuchi', 'ki'))).toBe('ki+kuchi');
  });

  it('同一部品の重複を保持する（マルチセット・例 木+木）', () => {
    expect(makeKey(hand('ki', 'ki'))).toBe('ki+ki');
  });

  it('3部品以上も昇順で連結する', () => {
    expect(makeKey(hand('ki', 'sun', 'kotsuzumi'))).toBe('ki+kotsuzumi+sun');
  });
});
