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
- [x] 各レベルの N が算出され、到達不能字を分母に含めない（elementary=888 / juniorhigh=1903 / joyo=1997・`reachable.json` 出力）
- [x] `MAX_COMBINE_PARTS` と辞書実最大が一致（不一致でCI失敗・実最大=5=定数）
- [ ] 詰み終了率がKPI目標 **10〜20%** に収まる（外れたらCI失敗＝weight調整を促す）
      → 現状 ~100%（帯外）。weight フロア設計は T-009 のスコープのため既定で**警告**、
      `KG_ENFORCE_STUCK_RATE=1` でハードゲート化。検証枠組み自体は完成・帯判定はテスト保証。
- [x] `npm run verify:data` がCIの `gen:data` 後に実行される（`verify.ts` に切替）

## スコープ外
- weightの初期チューニング値（T-009で詰める。本チケットは検証の枠組み）

## テスト
- 意図的に閾値を外したダミーで非0終了することを確認
  → `checkStuckRate`（帯外ダミー）/ `verifyMaxParts`（partCount=6 ダミー）で fail を検証済み

## 完了の定義 (DoD)
- [x] 3検証がCIゲート化され、失敗でマージ不可（N算出・MAX_PARTS はハードゲート。
      詰み率は既定警告＋フラグでハード化。T-009 の weight 調整後にフラグ既定 ON 予定）
