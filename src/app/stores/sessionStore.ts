import { writable } from 'svelte/store';
import type { GameSession } from '../../domain/types';

/**
 * 現在のプレイセッション（機能設計3.2・architecture 4）。`SessionManager` が各操作後に更新し、
 * UI（Game/Result 画面・Phase 3）が購読してリアクティブに描画する。未開始は `null`。
 *
 * セッション状態はメモリのみ（Svelte store）。永続化は終了時に `StorageRepository` 経由で行う
 * （図鑑/ベストは [[persistedStore]] が反映する）。
 */
export const sessionStore = writable<GameSession | null>(null);
