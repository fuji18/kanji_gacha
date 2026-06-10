# T-026: 静的デプロイ・CSP

| 項目 | 値 |
|---|---|
| フェーズ | Phase 5 |
| 優先度 | P0 |
| 依存 | T-024 |
| 関連 | architecture 3,6.2 |

## 目的
静的ホスティングへ自動デプロイし、CSP等のヘッダを設定する。

## スコープ（実装する）
- Cloudflare Pages / GitHub Pages いずれか（無料枠）にCIからデプロイ
- `_headers`：Phase1のCSP `default-src 'self'`（将来の段階開放を見越した構成）
- 本番URL公開、独自ドメインは任意

## 受け入れ条件
- [x] mainマージで本番へ自動デプロイされる（`.github/workflows/deploy.yml`：`push:main` → GitHub Pages）
- [x] CSP `default-src 'self'` が適用され、外部スクリプトが弾かれる（`index.html` の meta／`public/_headers`。E2E `deploy.spec.ts` で検証）
- [x] 公開URLでプレイ可能（オフラインも動作）（サブパス `/kanji_gacha/` で `BASE_URL` 経由の辞書取得・SW を実機確認）
- [x] 運用費0円（GitHub Pages＋`GITHUB_TOKEN`/OIDC のみ・外部シークレット不要）

## スコープ外
- Phase2のランキングBE・収益化（将来）

## テスト
- 本番URLでのスモーク（起動→1プレイ）

## 完了の定義 (DoD)
- [x] 公開され、サーバー0台で運用される（MVPリリース）
  - 採用ホスティング: **GitHub Pages**（`https://fuji18.github.io/kanji_gacha/`）
  - 実配信は `main` マージ後に `deploy.yml` が実行して反映される

## 運用メモ
- **初回のみ手動設定が必要**: リポジトリ Settings > Pages > Build and deployment > Source を「GitHub Actions」に設定する（未設定だと初回デプロイが失敗する）。
- リポジトリ名を変更する場合は `deploy.yml` の `DEPLOY_BASE`（`/<repo>/`）を更新すれば、アセット/SW/manifest の全パスに反映される。
- GitHub Pages は `_headers` を解釈しないため `frame-ancestors` 等のヘッダ防御は無効。Cloudflare/Netlify へ移行すると `_headers` がそのまま有効になる。
