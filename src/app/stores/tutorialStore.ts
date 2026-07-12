import { writable } from 'svelte/store';

/**
 * チュートリアルの手動再表示リクエスト（T-058）。Home の「あそびかたをもう一度みる」で
 * true にし、App がオーバーレイを表示、閉じると false に戻す。
 * **永続化しない**一時フラグ：初回体験（settings.tutorialDone）とは分離し、
 * 再表示を閉じてもリロード後に初回チュートリアルとして再出現しない。
 */
export const tutorialRequestStore = writable(false);
