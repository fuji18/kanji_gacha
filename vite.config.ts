import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// 静的Webアプリ（SSR無し）。vite-plugin-pwa で最小SWを有効化し、初回ロード後の完全オフライン動作を
// 保証する（architecture 1.3/9.1・PRD非機能・T-024）。ホーム追加/インストール等の体験強化は後続フェーズ。
export default defineConfig({
  // 本番デプロイ時のみサブパスを適用する（GitHub Pages のプロジェクトページ = /kanji_gacha/）。
  // dev/preview/E2E は DEPLOY_BASE 未設定なので '/' のまま（既存E2Eに影響なし・T-026）。
  // import.meta.env.BASE_URL に反映され、DictionaryRepository の `${baseUrl}data/...` 連結が
  // サブパス配信でも正しく解決する（T-012 で末尾 '/' 正規化済み）。
  base: process.env.DEPLOY_BASE || '/',
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
        globPatterns: ['**/*.{js,css,html,json,txt,svg,ico,png,webmanifest}'],
        // SPA：未キャッシュのナビゲーションは index.html にフォールバック（オフラインでもルート表示）。
        navigateFallback: 'index.html',
      },
      // 最小の Web App Manifest（オフライン保証が主目的）。アイコン/スプラッシュ等は後続フェーズ（F18）。
      manifest: {
        name: '漢字合体ガチャ',
        short_name: '漢字ガチャ',
        description: '漢字のパーツを集めて合体させるガチャゲーム',
        lang: 'ja',
        start_url: '.',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
      },
    }),
  ],
});
