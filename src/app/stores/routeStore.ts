import { writable } from 'svelte/store';

/** アプリの画面（機能設計6 の画面遷移図）。 */
export type Screen = 'home' | 'game' | 'result' | 'zukan' | 'about';

/**
 * 現在表示中の画面（architecture 4・機能設計6）。`App.svelte` が購読して画面を切り替え、
 * 各画面・コンポーネントは [[navigate]] で遷移を要求する。起動直後は Home。
 *
 * セッションの進行状態（playing/ended）は [[sessionStore]] が持つ。本 store は「どの画面か」のみを表す。
 */
export const routeStore = writable<Screen>('home');

/** 画面を切り替える（`routeStore.set` のラッパ。呼び出し意図を明示し、将来の遷移制御の集約点にする）。 */
export function navigate(screen: Screen): void {
  routeStore.set(screen);
}
