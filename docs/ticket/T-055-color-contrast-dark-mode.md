# T-055: カラーコントラスト是正とダークモード

| 項目 | 値 |
|---|---|
| フェーズ | Phase 9（品質・信頼性強化） |
| 優先度 | P1 |
| 依存 | feature/20260623-button-ux-system のマージ（コンフリクト回避） |
| 関連 | T-037 / docs/ideas/20260706-develop-improvement-review.md §1 |

## 背景
- 金 `--md-sys-color-tertiary: #b8860b` は和紙背景 `#f5f1e6` に対し**約 2.9:1** で
  WCAG AA（通常 4.5:1・大文字 3:1）に不適合。ベストスコアの金数字・高レア表示等の
  「テキスト用途」が対象（T-037 は完了済みだがこの残課題が漏れている）。
- `prefers-color-scheme` 分岐が無くダークモード未対応。トークンは
  material-tokens.css に集約済みで拡張コストは小さい。

## 目的
テキストのコントラストを AA 準拠にし、夜間・OLED 利用向けのダークテーマを提供する。

## スコープ（実装する）
- テキスト用の金トークン（例 `--md-sys-color-tertiary-text: #8a6508` 程度）を追加し、
  テキスト用途を差し替え。`#b8860b`/`#d4af37` は装飾（罫線・グロウ・落款）専用と明記。
- `@media (prefers-color-scheme: dark)` で和風ダークパレット
  （墨背景 × 生成り文字 × 抑えた朱/藍/金）を定義。全画面はトークン参照のみなので
  トークン側の上書きで完結させる。
- `index.html` の `theme-color` を `media` 属性付きで 2 色併記。
- `forced-colors: active`（Windows ハイコントラスト）で PartChip の選択状態が
  識別できることを確認し、必要箇所のみ手当て。

## 受け入れ条件
- [ ] テキスト用途の金が背景に対し 4.5:1 以上（大文字のみの箇所は 3:1 以上）
- [ ] OS ダーク設定で全画面が破綻なくダーク表示される（コントラスト AA 維持）
- [ ] ライト/ダークで PWA の theme-color が追随する
- [ ] forced-colors で選択中チップが判別できる

## スコープ外
- アプリ内での手動テーマ切替 UI（OS 追随のみ。要望が出たら別チケット）

## 主な変更ファイル
- ui/styles/material-tokens.css / index.html / 金テキストを使う画面（Home/Result/PartChip）

## 完了の定義 (DoD)
- [ ] 受け入れ条件を満たし、全品質ゲート成功
