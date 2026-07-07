# T-054: アクセシビリティ即効改善（aria-live・focus-visible・フォーカストラップ）

| 項目 | 値 |
|---|---|
| フェーズ | Phase 9（品質・信頼性強化） |
| 優先度 | P0 |
| 依存 | T-017,T-034 |
| 関連 | T-037 / docs/ideas/20260706-develop-improvement-review.md §3-1,3-2,4-1 |

## 背景
develop レビューで以下が判明した。
1. ゲームの主要フィードバック（`feedback`：「+12！」「✕ ミス…」等）に `aria-live` が無く、
   スクリーンリーダーに通知されない。
2. `src/` 全体に `:focus`/`:focus-visible` スタイルが **0 件**で、キーボード操作時に
   現在位置が視認できない（教育現場のタブレット＋外付けキーボードを想定）。
3. チュートリアル（`role="dialog"` `aria-modal`）にフォーカストラップが無く、
   Tab が背景コンテンツへ抜ける。

## 目的
低コスト・低リスクの構造改善で、支援技術・キーボード利用者の基本体験を確保する。

## スコープ（実装する）
- GameScreen の feedback 表示に `role="status"`（暗黙 aria-live="polite"）を付与。
  既存の `.organize`（role="status"）と一貫させる。
- グローバル CSS に `:focus-visible` リングを追加
  （例: `outline: 3px solid var(--md-sys-color-secondary); outline-offset: 2px`）。
  全ボタン・リンクに適用され、マウス操作では出ない（focus-visible 準拠）。
- TutorialOverlay のフォーカストラップ: 表示中は overlay 内で Tab 巡回、Esc で閉じる
  （スキップ扱い）。背景は `inert` 属性で不活性化する。

## 受け入れ条件
- [ ] 合体成功/ミス/ヒントの feedback がスクリーンリーダーに通知される（role="status"）
- [ ] Tab 操作で全画面のフォーカス位置が視認できる（マウスクリックではリング非表示）
- [ ] チュートリアル表示中に Tab が背景へ抜けず、Esc で閉じられる
- [ ] E2E: キーボードのみでガチャ→選択→合体が完了できる

## 主な変更ファイル
- ui/screens/GameScreen.svelte / ui/screens/TutorialOverlay.svelte /
  ui/styles/material-tokens.css（またはグローバル CSS）

## 完了の定義 (DoD)
- [ ] 受け入れ条件を満たし、全品質ゲート成功
