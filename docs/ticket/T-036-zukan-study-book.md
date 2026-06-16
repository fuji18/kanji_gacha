# T-036: 図鑑の学習帳化（読み／意味／画数／部首・学年別収集率）

| 項目 | 値 |
|---|---|
| フェーズ | Phase 7（レベル・学習拡張） |
| 優先度 | P1 |
| 依存 | T-020（図鑑）/ T-028（grade）|
| 関連 | docs/ideas/レベル設計と学習機能.md §2・§6(6) |

## 目的
図鑑を「漢字学習帳」に格上げし、復習導線にする。

## スコープ（実装する）
- 図鑑カードに読み・意味・画数・**部首名**（部品データから導出）を表示。タップで筆順再生。
- **学年別の収集率**（小1〜小6）を進捗バーで表示（grade 利用）。
- 未収集字のヒント表示（現行マスクの拡張）。

## 受け入れ条件
- [x] 図鑑カードに読み/意味/画数/部首が出る
- [x] 学年別の収集率が表示される
- [x] タップで筆順再生

## 主な変更ファイル
- ui/screens/ZukanScreen.svelte（学習帳カード・筆順再生モーダル・学年別収集率バー・未収集の学年別ヒント）
- ui/labels/radicalNames.ts（新規・部首名の表示マップ＋ `getRadicalName`/`pickRadical`）
- app/SessionManager.ts（`kanjiStudyView`＝読み/意味/画数/学年/部品、`gradeTotals`＝学年別の到達可能総数）
- tests: SessionManager.test.ts（追記）/ ui/labels/radicalNames.test.ts（新規）/ e2e/zukan.spec.ts（追記）

## 完了の定義 (DoD)
- [x] 受け入れ条件を満たし、全品質ゲート成功（lint / typecheck / unit test 247件 / build 緑、Zukan E2E 4件緑）

## 実装メモ
- 部首は元データに KANJIDIC の radical 番号が無いため、**代表分解の構成部品からの近似導出**とした
  （`pickRadical`：既知部首を含む最初の部品を採用、無ければ先頭部品を char のまま表示）。部首の和名は
  UI 表示資産 `ui/labels/radicalNames.ts` に集約（`rarityLabels.ts`/`kanjiStrokes.ts` と同列）。
- 筆順再生は既存 `StrokeKanji.svelte`（ガチャ演出資産）を再利用。未収録字はフォントグリフの筆ワイプに
  フォールバックするため、任意の発見字で再生パネルは必ず表示される。`prefers-reduced-motion` 対応。
- 図鑑見出しは既存 DOM 契約（heading「図鑑」）を維持し、サブタイトルで「学習帳」を表現した
  （複数 E2E が heading 名に依存するため）。
