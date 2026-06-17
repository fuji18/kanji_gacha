# fujioha_platform 掲載スポーク 作成ガイド & 再利用プロンプト

本ゲーム（漢字合体ガチャ）は [fujioha_platform](https://github.com/fuji18/fujioha_platform)
の `apps/game`（ゲーム一覧ハブ）に「スポーク」として掲載することを想定している。
本書は、当ゲームおよび**今後同様に掲載するゲーム**を作る際の制約・注意事項をまとめ、
そのまま指示として使える「再利用プロンプト」を提供する。

---

## 1. プラットフォームの掲載モデル（前提）

`fujioha_platform` は **npm workspaces モノレポ + Astro + Cloudflare Pages** の
ハブ＆スポーク構成（正典: 同リポジトリ `docs/playbook/add-new-spoke.md`）。

- **1スポーク = 1リポジトリ = 1サブドメイン**（例 `color-sense.fujioha.com`）。
  - パス相乗り(`game.fujioha.com/<id>`)・ネストサブドメイン(`<id>.game.fujioha.com`)は**禁止**。
    理由: XSS隔離 / Service Worker スコープ衝突回避 / Cookie漏洩防止 / ブラスト半径限定 /
    Cloudflare Universal SSL が2段ワイルドカードに非対応。
- 各ゲームは**独立した Cloudflare Pages プロジェクト**として**ルート `/`** に配信。
  `npm ci && npm run build`（Node 22+）が成功し、出力は `dist/`、ルートディレクトリは `/`。
- セキュリティヘッダは **`public/_headers`**（Cloudflare が解釈）に置く。
- ハブ(`apps/game`)はゲーム本体を埋め込まず、**`apps/game/src/content/games/<id>.json`**
  のレジストリから **`url` で外部リンク**（`target="_blank" rel="noopener noreferrer"`、
  `status:"published"` のみ一覧表示）。
- 品質バー: **Lighthouse 4項目すべて 90+**、モバイル可、PIIを localStorage/Cookie に置かない、
  カタログ用サムネ `apps/game/public/games/<id>.png`。

### レジストリのスキーマ（`apps/game/src/content/config.ts`）

```jsonc
{
  "id": "<id>",            // 英小文字とハイフンのみ。ファイル名と一致
  "jp": "日本語名",
  "en": "English name",
  "genre": "パズル",
  "genreEn": "Puzzle",
  "time": "1〜2 min",
  "tag": "new",            // "new" | "wip" | null
  "icon": "kanji",         // kanji | clock | map | rhythm | palette
  "hue": "#f6d472",        // アクセント色 #rrggbb
  "url": "https://<id>.fujioha.com", // 未デプロイなら null
  "status": "published",   // published のみ一覧表示。draft | archived
  "featured": false,
  "publishedAt": "2026-06-17", // YYYY-MM-DD
  "image": "/games/<id>.png"   // サムネ（任意）
}
```

---

## 2. 再利用プロンプト

新規ゲーム着手時の指示、または各ゲームリポジトリの `CLAUDE.md` 追記として使う。

```markdown
# fujioha_platform 掲載スポーク 作成プロンプト

あなたは fujioha_platform（ハブ＆スポーク / Astro + Cloudflare Pages）に
「スポーク」として掲載するブラウザゲームを作成する。以下を**ハード制約**として
設計・実装・レビューのすべてで遵守すること。逸脱する場合は理由を明示して確認を取る。

## アーキテクチャ制約（違反＝掲載不可）
1. 1スポーク = 1リポジトリ = 1サブドメイン（`<id>.fujioha.com`、ルート`/`配信）。
   - パス相乗り(`game.fujioha.com/<id>`)・ネストサブドメイン(`<id>.game.fujioha.com`)は禁止。
2. 配信は Cloudflare Pages。`npm ci && npm run build`（Node 22+）が成功し、出力は `dist/`。
   - ルートディレクトリは `/`。ビルド成果物にサブパス前提(base)を埋め込まない（base は `/`）。
3. 完全静的（SSR・サーバー状態なし）。外部APIに依存しない。データは同一オリジンの静的JSON。
4. id は英小文字とハイフンのみ。リポジトリ名・サブドメイン・レジストリ id・サムネ名を一致させる。

## セキュリティ / ヘッダ
5. セキュリティヘッダは `public/_headers` に**単一の正**として置く（meta の CSP は作らない）。
   最低限:
       /*
         Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'
         X-Content-Type-Options: nosniff
         Referrer-Policy: strict-origin-when-cross-origin
         Permissions-Policy: camera=(), microphone=(), geolocation=()
         Strict-Transport-Security: max-age=31536000; includeSubDomains
       /assets/*
         Cache-Control: public, max-age=31536000, immutable
   - 外部リソース（フォント等）は自己ホストし `'self'` で完結させる。必要時のみ最小限で許可元を追加。
6. localStorage / Cookie に PII を保存しない。外部スクリプトを使うなら SRI を付ける。

## SEO / メタ / PWA
7. `index.html` に: lang、title、meta description、canonical、OGP(title/description/image)、
   favicon、theme-color を必ず入れる。`public/robots.txt` を置く。
8. Lighthouse の Performance / Accessibility / Best Practices / SEO すべて 90+ を満たす。
9. PWA/SW を使う場合、SW は自己破壊/autoUpdate で `/sw.js` を `Cache-Control: no-cache`。
   スコープはルート`/`。manifest の name/short_name/theme_color はゲーム実体に合わせる。

## ブランド一貫性（推奨）
10. 可能なら `@fujioha/ui` / `@fujioha/tokens` を取り込みブランドを揃える。

## 掲載レジストリ（プラットフォーム側PR）
11. デプロイ後、`fujioha_platform` の `apps/game/src/content/games/<id>.json` を
    `apps/game/src/content/config.ts` のスキーマ通りに作成/更新する:
        { id, jp, en, genre, genreEn, time, tag(new|wip|null),
          icon(kanji|clock|map|rhythm|palette), hue(#rrggbb),
          url:"https://<id>.fujioha.com", status:"published",
          featured, publishedAt(YYYY-MM-DD), image:"/games/<id>.png" }
    - サムネ `apps/game/public/games/<id>.png` を追加。
    - `npm run typecheck`（zod スキーマ検証）が通ること。`status:"published"` のみ一覧表示。

## リリース前チェックリスト（全部 ✅ で完了）
- [ ] `<id>.fujioha.com` に直アクセスして表示・HTTPS
- [ ] `_headers` の CSP で Console にブロックエラーが出ない
- [ ] Lighthouse 4項目 90+ / モバイル崩れなし
- [ ] PII を永続化していない
- [ ] ハブ一覧にカードが出る / リンクが新規タブ(noopener)
- [ ] robots.txt /(使うなら)sitemap が取得できる
```

---

## 3. 当ゲーム（漢字合体ガチャ）固有のメモ

- **id/サブドメインは `kanji-gattai`（漢字合体）に統一**する方針。
  サブドメインは `kanji-gattai.fujioha.com`、サムネは `/games/kanji-gattai.png`。
- レジストリ枠は既に `apps/game/src/content/games/kanji-drop.json`
  （`id:"kanji-drop"`, `jp:"ガチャ漢字"`, `url:null`, `status:"draft"`, `tag:"wip"`）として存在するため、
  公開時に **`kanji-gattai.json` へリネーム**し id を `"kanji-gattai"` に変更する（詳細は T-051）。
- 現状の T-026（PR #57）は **GitHub Pages・サブパス `/kanji_gacha/`** 前提で作られており、
  Cloudflare Pages・ルート配信とは不適合。かつ後続実装(T-027〜T-037)より前から分岐しており
  退行を含むため、**現 develop 上で Cloudflare 用に作り直す**こと。
- CSP は `vite` の meta と `_headers` に二重実装されている → **`_headers` を単一の正**にする。
- `index.html` は SEO/OGP/canonical/favicon/theme-color が未整備 → 追加が必要。
