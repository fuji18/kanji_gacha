# T-004: データ検証ゲート

| 項目 | 値 |
|---|---|
| フェーズ | Phase 0 |
| 優先度 | P0 |
| 依存 | T-003 |
| 関連 | 機能設計 8.1 / architecture 8.2 / development-guidelines 4.2 |

## 目的
辞書生成物の健全性とゲームバランスをビルド時に検証し、CIの品質ゲートにする。

## スコープ（実装する）
- `scripts/build-data/reachable.ts`：各レベルで到達可能な primary 漢字総数 N を算出し `kanji.json` メタに埋め込む（図鑑分母）
- `scripts/build-data/verifyMaxParts.ts`：`CombineEntry.partCount` 最大値と定数 `MAX_COMBINE_PARTS` の一致を検証
- `scripts/build-data/simulateStuckRate.ts`：各レベルのプール・出現率・weightで耐久10回プレイをモンテカルロし、詰み終了率を実測
- `npm run verify:data` で上記を実行し、不合格なら非0終了

## 受け入れ条件
- [ ] 各レベルの N が算出され、到達不能字を分母に含めない
- [ ] `MAX_COMBINE_PARTS` と辞書実最大が一致（不一致でCI失敗）
- [ ] 詰み終了率がKPI目標 **10〜20%** に収まる（外れたらCI失敗＝weight調整を促す）
- [ ] `npm run verify:data` がCIの `gen:data` 後に実行される

## スコープ外
- weightの初期チューニング値（T-009で詰める。本チケットは検証の枠組み）

## テスト
- 意図的に閾値を外したダミーで非0終了することを確認

## 完了の定義 (DoD)
- [ ] 3検証がCIゲート化され、失敗でマージ不可
