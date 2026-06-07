import { writable } from 'svelte/store';
import type { PersistedState } from '../../domain/types';
import { defaultState } from '../../data/migrations';

/**
 * 永続データ（図鑑・レベル別ベスト・デイリーベスト・設定）の読み取りビュー（architecture 4）。
 * `SessionManager` が起動時とセッション終了時に `StorageRepository.loadState()` の結果で更新し、
 * Home/Zukan 画面（Phase 3）が購読する。初期値は既定状態（ロード前のプレースホルダ）。
 */
export const persistedStore = writable<PersistedState>(defaultState());
