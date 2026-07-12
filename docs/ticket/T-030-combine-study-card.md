# T-030: 合体成功時の学習カード（読み／意味／画数＋筆順再生）

| 項目 | 値 |
|---|---|
| フェーズ | Phase 7（レベル・学習拡張） |
| 優先度 | P1 |
| 依存 | T-018（演出）/ StrokeKanji |
| 関連 | docs/ideas/レベル設計と学習機能.md §1・§6(3) |

## 目的
合体成功の瞬間を「覚える瞬間」にする。完成漢字の読み・意味・画数を提示し、筆順を再生する。

## スコープ（実装する）
- 巻物リビール（EmakimonoReveal）／スコアフロートに、**読み（音/訓）・意味・画数**を表示
  （`SessionManager.kanjiView` と `KanjiEntry.strokes` で取得）。
- 完成漢字を `StrokeKanji` で**筆順アニメ再生**（データ無しはフォント表示にフォールバック）。
- `prefers-reduced-motion` 時は即時表示。

## 受け入れ条件
- [ ] 合体成功時に読み・意味・画数が表示される
- [ ] 完成漢字の筆順が再生される（対応字）
- [ ] reduced-motion で演出が無効化される
- [ ] 既存 E2E が壊れない（testid 維持）

## 主な変更ファイル
- ui/components/EmakimonoReveal.svelte / StrokeKanji.svelte / screens/GameScreen.svelte

## 完了の定義 (DoD)
- [ ] 受け入れ条件を満たし、全品質ゲート成功
