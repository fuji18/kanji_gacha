# T-060: セキュリティ運用強化（URL レバーの記録対象外化・依存監査）

| 項目 | 値 |
|---|---|
| フェーズ | Phase 9（品質・信頼性強化） |
| 優先度 | P1 |
| 依存 | T-002 |
| 関連 | docs/ideas/20260706-develop-improvement-review.md §5-1,5-3 / public/_headers（Phase2 の connect-src 方針） |

## 背景
- E2E 用 URL レバー `?taMs=` / `?deckMax=` が本番でも有効で、短時間セッションや極小山札で
  ベストスコア・図鑑・にがて記録を「正規プレイでない条件」で更新できる。現状の被害は
  自分の localStorage に閉じるため小さいが、記録の意味を薄める。
- 依存監査（Dependabot / npm audit）の継続運用が未設定。ランタイム外部通信ゼロでも
  ビルド時サプライチェーン（vite/svelte/workbox 等）のリスクは残る。

## 目的
記録（ベスト・図鑑・にがて）の正当性を守り、依存脆弱性を継続検知する。

## スコープ（実装する）
- `?taMs`/`?deckMax` 指定時はセッションを**記録対象外**とする:
  終了時のベスト更新・図鑑反映・にがて更新をスキップ（SessionManager に
  `recordable` フラグを追加し、main.ts のレバー解釈で false に）。
  `?seed` はデイリー再現と同思想のため記録対象のまま維持（判断を記録）。
- E2E が記録系を検証しているテスト（persistence/review 等）への影響を確認し、
  必要なら「レバー無し・deckLimit 注入」等のテスト専用経路に置き換える。
- GitHub Dependabot（`dependabot.yml`: npm 週次）を追加。CI に `npm audit --audit-level=high`
  を追加するかは既存 ci.yml の方針（変更禁止コメント）を確認のうえ最小差分で判断。
- 将来ランキング等のバックエンド導入時は「URL レバー全無効化＋サーバー側検証」を
  必須とする一文を docs/architecture.md に追記。

## 受け入れ条件
- [ ] `?taMs`/`?deckMax` 付きセッションではベスト・図鑑・にがてが更新されない
- [ ] 通常セッションの記録動作は不変（既存 E2E 全緑）
- [ ] Dependabot が有効で、依存更新 PR が作られる
- [ ] architecture.md に Phase2 の注意書きが追記されている

## スコープ外
- CI パイプライン自体の再構成（E2E は ci.yml で実施済み）

## 主な変更ファイル
- src/main.ts / app/SessionManager.ts / .github/dependabot.yml / docs/architecture.md / tests

## 完了の定義 (DoD)
- [ ] 受け入れ条件を満たし、全品質ゲート成功
