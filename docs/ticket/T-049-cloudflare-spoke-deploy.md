# T-049: Cloudflare Pages スポーク配信への再構築

| 項目 | 値 |
|---|---|
| フェーズ | Phase 8 |
| 優先度 | P0 |
| 依存 | T-024 |
| 関連 | fujioha_platform `docs/playbook/add-new-spoke.md` / docs/ideas/fujioha-platform掲載スポーク作成プロンプト.md |

## 背景
T-026（PR #57）は **GitHub Pages・サブパス `/kanji_gacha/`** 前提で実装されており、
fujioha_platform の掲載契約（**Cloudflare Pages・サブドメインのルート `/` 配信**）と不適合。
かつ PR #57 は T-027〜T-037 より前から分岐しており、マージすると後続実装を退行させる。
本チケットで **現 develop 上に Cloudflare 用デプロイ設定を作り直す**。PR #57 はクローズする。

## 目的
当ゲームを `kanji-drop.fujioha.com`（独立 Cloudflare Pages プロジェクト・ルート配信）として
公開できる状態にする。

## スコープ（実装する）
- PR #57 をクローズ（マージしない）。
- `vite.config.ts`：`DEPLOY_BASE` 分岐を撤去し `base: '/'` 固定。meta CSP 注入プラグインを撤去。
- GitHub Pages 用 `deploy.yml` は作らない（配信は Cloudflare Pages 側のGit連携で行う）。
- `public/_headers` を**セキュリティヘッダの単一の正**として整備:
  `Content-Security-Policy`(default-src 'self' 系・frame-ancestors 'none')、
  `X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`、
  `Strict-Transport-Security`、`/assets/*` 長期キャッシュ、`/sw.js` no-cache。
- ビルド出力 `dist/`、`npm ci && npm run build`（Node 22+）成功を確認。

## 受け入れ条件
- [ ] `npm run build` 成功・出力は `dist/`、生成HTMLに meta CSP もサブパス base も含まれない
- [ ] `public/_headers` の CSP が `default-src 'self'` 系で frame-ancestors を含む
- [ ] Cloudflare Pages（Root `/`・Build `npm ci && npm run build`・Output `dist`・NODE_VERSION=22）で配信可能
- [ ] PR #57 がクローズされている

## スコープ外
- レジストリ登録（T-051）・SEO/OGP（T-050）・独自ドメインのDNS発行作業（運用手順）

## テスト
- `tests/e2e/deploy.spec.ts` 相当を現 develop 向けに再整備（dist のスモーク）
- 既存の E2E / 品質ゲートが緑

## 完了の定義 (DoD)
- [ ] Cloudflare Pages のプロダクションデプロイが成功し公開URLでプレイ可能
- [ ] 運用費0円・サーバー0台
