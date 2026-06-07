import { describe, it, expect, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { sessionStore } from '../../../src/app/stores/sessionStore';
import { persistedStore } from '../../../src/app/stores/persistedStore';
import { defaultState } from '../../../src/data/migrations';

// store の最小契約（T-014 / architecture 4）。SessionManager がここを更新し UI が購読する。

// モジュールシングルトンのため、テスト間で初期状態へ戻して順序依存を排除する。
afterEach(() => {
  sessionStore.set(null);
  persistedStore.set(defaultState());
});

describe('app stores', () => {
  it('sessionStore は未開始で null、set/get で更新できる', () => {
    sessionStore.set(null);
    expect(get(sessionStore)).toBeNull();
  });

  it('persistedStore は既定状態で初期化される（ロード前プレースホルダ）', () => {
    persistedStore.set(defaultState());
    expect(get(persistedStore)).toEqual(defaultState());
  });

  it('persistedStore は subscribe で変更が伝播する', () => {
    const seen: number[] = [];
    const unsub = persistedStore.subscribe((s) => seen.push(s.schemaVersion));
    const next = defaultState();
    next.bestScores.joyo = 42;
    persistedStore.set(next);
    unsub();
    expect(seen.length).toBeGreaterThanOrEqual(2); // 初期＋set
    expect(get(persistedStore).bestScores.joyo).toBe(42);
  });
});
