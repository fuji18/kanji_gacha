# T-035: にがて漢字リスト＆復習モード（簡易SRS）

| 項目 | 値 |
|---|---|
| フェーズ | Phase 7（レベル・学習拡張） |
| 優先度 | P1 |
| 依存 | T-029（達成型）/ T-013（永続化） |
| 関連 | docs/ideas/レベル設計と学習機能.md §2・§6(5) |

## 目的
間違えた／時間のかかった漢字を集中して再出題し、定着を高める（学習の核）。

## スコープ（実装する）
- 永続データに「にがて漢字」記録（ミスした組・未完成で終わった対象字・正答までの所要）。
- 復習モード：にがて漢字を優先して山札（出題）を構成する。
- 簡易 SRS：正解で出やすさを下げ、間違いで上げる（軽量な重み付け）。

## 受け入れ条件
- [x] にがて漢字が永続記録され、復習モードで優先出題される
- [x] 正解/不正解（完成/未完成）で出やすさが調整される
- [x] リロード後も保持される

## 主な変更ファイル
- domain/types.ts（PersistedState.weakKanji・GameSession/GameResult.isReview 追加）
- domain/constants.ts（REVIEW パラメータ）/ domain/review/srs.ts（新規・簡易SRS純粋関数）
- data/migrations.ts（weakKanji 補完）/ data/StorageRepository.ts（saveWeakKanji）
- app/SessionManager.ts（start の review 分岐・にがて更新）
- ui/screens/HomeScreen.svelte（復習入口）/ ui/screens/ResultScreen.svelte（復習の「もう一回」）

## 完了の定義 (DoD)
- [x] 受け入れ条件を満たし、全品質ゲート成功
  - lint / typecheck / test（domain branch 90% 維持）/ build は通過
  - E2E（review.spec.ts 追加）は本環境で Playwright ブラウザ取得不可のため CI で実行

## 実装メモ
- にがて判定は「完成/未完成」に集約した簡易版（ミス回数・所要時間の精緻化はスコープ外）。
- 復習モードは達成型（deck）の対象字を「にがて優先」に差し替える形で既存基盤を再利用。
  常用（joyo）スコープで開始し、どの学年のにがて字も解決可能にする。
