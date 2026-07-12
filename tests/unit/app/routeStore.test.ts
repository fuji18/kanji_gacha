import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  routeStore,
  navigate,
  type Screen,
} from '../../../src/app/stores/routeStore';

// ルーティング store の最小契約（T-015 / 機能設計6）。App.svelte がこれを購読して画面を切替える。

beforeEach(() => {
  routeStore.set('home');
});

describe('routeStore', () => {
  it('既定は home', () => {
    expect(get(routeStore)).toBe('home');
  });

  it('navigate で各画面へ遷移できる', () => {
    const screens: Screen[] = ['game', 'result', 'zukan', 'about', 'home'];
    for (const s of screens) {
      navigate(s);
      expect(get(routeStore)).toBe(s);
    }
  });

  it('subscribe で遷移が伝播する', () => {
    const seen: Screen[] = [];
    const unsub = routeStore.subscribe((s) => seen.push(s));
    navigate('zukan');
    navigate('home');
    unsub();
    expect(seen).toEqual(['home', 'zukan', 'home']); // 初期 + 2遷移
  });
});
