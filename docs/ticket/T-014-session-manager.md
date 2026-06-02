# T-014: SessionManager＋store

| 項目 | 値 |
|---|---|
| フェーズ | Phase 2 |
| 優先度 | P0 |
| 依存 | T-006〜T-013 |
| 関連 | PRD F1〜F6 / 機能設計 5.1,4.5 |

## 目的
ゲーム進行をオーケストレーションし、ドメイン層をstoreと接続する。RNGの生成・注入もここで行う。

## スコープ（実装する）
- `src/app/SessionManager.ts`：`start(level, mode)`（RNG生成：free=`Math.random`ラップ/daily=`mulberry32(...)`）、`pullGacha`、`combine`、`discardAndDraw`、`useHint`、`end`
- 終了判定 `checkGameEnd`（条件a+b＝stuck／手札0=empty_hand、各操作後に実施）
- 手札上限の事前条件（上限時はno-op、UI非活性はT-017）
- `PlayStats` のKPIログ記録（合体/ミス/ヒント/捨て/終了理由/所要時間）
- `src/app/stores/`：`sessionStore`/`persistedStore`

## 受け入れ条件
- [ ] 開始→ガチャ→合体/ミス→終了（stuck・empty_hand両経路）が一貫動作
- [ ] フリー/デイリーで適切なRNGが注入される
- [ ] 終了判定が各操作後に正しく発火
- [ ] PlayStatsがKPI集計に必要な項目を記録

## スコープ外
- 画面描画（Phase 3）

## テスト
- 統合：セッション一連、両終了経路、デイリー再現（固定日付で同一ガチャ列）

## 完了の定義 (DoD)
- [ ] 統合テスト緑、storeでUIに接続可能
