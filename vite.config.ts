import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// 静的Webアプリ（SSR無し）。vite-plugin-pwa で最小SWを有効化し、初回ロード後の完全オフライン動作を
// 保証する（architecture 1.3/9.1・PRD非機能・T-024）。ホーム追加/インストール等の体験強化は後続フェーズ。
export default defineConfig({
  // fujioha_platform のスポーク（kanji-gattai.fujioha.com）として Cloudflare Pages の
  // ルート `/` に配信する（T-049）。サブパス前提を成果物に埋め込まないため base は常に '/' 固定。
  base: '/',
  plugins: [
    svelte(),
    VitePWA({
      // 新SWは即時に制御を取得（skipWaiting + clientsClaim）。辞書更新時も次回読込で確実に差し替わる。
      registerType: 'autoUpdate',
      // 登録スクリプトを index.html へ自動注入する（アプリのソース main.ts は非改変）。
      injectRegister: 'auto',
      workbox: {
        // 静的アセットに加え、ランタイムで fetch する辞書JSON（kanji/parts/combine/reachable）と
        // LICENSE.txt をプリキャッシュ対象に含める。これによりオフライン時も /data/*.json を供給できる。
        globPatterns: [
          '**/*.{js,css,html,json,txt,svg,ico,png,webmanifest,woff2}',
        ],
        // SPA：未キャッシュのナビゲーションは index.html にフォールバック（オフラインでもルート表示）。
        navigateFallback: 'index.html',
      },
      // Web App Manifest。色は和風ブランド（朱/和紙）に合わせる（T-050）。
      // アイコンは 512/192(any)＋512(maskable) の3枚（T-059）。maskable はセーフゾーン80%に
      // 中身（金枠＋合）を収めた専用画像で、Android の円形マスクでも見切れない。
      manifest: {
        name: '漢字合体ガチャ',
        short_name: '漢字ガチャ',
        description:
          '漢字のパーツを集めて合体させ、新しい漢字を作る学習ガチャ。小学生の学年別から大人の常用漢字まで。',
        lang: 'ja',
        start_url: '.',
        display: 'standalone',
        theme_color: '#c0392b',
        background_color: '#f5f1e6',
        icons: [
          {
            src: 'apple-touch-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
