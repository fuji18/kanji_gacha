import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// 静的Webアプリ（SSR無し）。vite-plugin-pwa 等の追加設定は後続チケットで導入する。
export default defineConfig({
  plugins: [svelte()],
});
