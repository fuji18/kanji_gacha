# T-006: RNG（mulberry32・dailySeed）

| 項目 | 値 |
|---|---|
| フェーズ | Phase 1 |
| 優先度 | P0 |
| 依存 | T-005 |
| 関連 | PRD F8 / 機能設計 4.6 / development-guidelines 2.1 |

## 目的
決定的乱数とJST固定の日付シードを、ドメイン純粋関数として実装する。

## スコープ（実装する）
- `src/domain/rng/Rng.ts`：`RNG` インターフェース（`() => number`）
- `src/domain/rng/mulberry32.ts`：シード→決定的乱数列
- `src/domain/rng/dailySeed.ts`：`todayYmdJst(nowMs)`（JST+9固定でYYYYMMDD）/ `dailySeed(ymd)`

## 受け入れ条件
- [ ] 同一シードで `mulberry32` が同一乱数列を返す
- [ ] `todayYmdJst` がlocale非依存でJST基準（境界：JST 0:00で日付が変わる）
- [ ] `nowMs` は引数注入。`Date.now()` をモジュール内で呼ばない（lint強制）

## スコープ外
- RNGの生成・注入（T-014のSessionManager）

## テスト
- `mulberry32(1)` の先頭N個が固定値（スナップショット）
- JST境界（UTC 14:59→15:00相当）で日付が切り替わる

## 完了の定義 (DoD)
- [ ] 決定性テストが緑、domain純粋性lintをパス
