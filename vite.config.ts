import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// 静的Webアプリ（SSR無し）。vite-plugin-pwa で最小SWを有効化し、初回ロード後の完全オフライン動作を
// 保証する（architecture 1.3/9.1・PRD非機能・T-024）。ホーム追加/インストール等の体験強化は後続フェーズ。
export default defineConfig({
  // fujioha_platform のスポーク（kanji-gattai.fujioha.com）として Cloudflare Pages の
  // ルート `/` に配信する（T-049）。サブパス前提を成果物に埋め込まないため base は常に '/' 固定。
  base: '/',
  // アプリバージョン（About 画面の表示・T-053）。npm 経由の実行では npm_package_version が
  // package.json の version を持つ。直接 vite 実行時のフォールバックは '0.0.0'。
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
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
      // Web App Manifest。色は和風ブランド（朱/和紙）に合わせる（T-050）。アイコンは og 生成と
      // 共通の 512px PNG を流用（apple-touch-icon.png）。maskable 専用アイコンは後続フェーズ。
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
        ],
      },
    }),
  ],
});
