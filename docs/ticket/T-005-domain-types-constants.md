# T-005: ドメイン型＋定数

| 項目 | 値 |
|---|---|
| フェーズ | Phase 1 |
| 優先度 | P0 |
| 依存 | T-001 |
| 関連 | 機能設計 3 / development-guidelines 2.2 |

## 目的
ドメイン全体で共有する型と、暫定値（要調整）の定数を1箇所に集約する。

## スコープ（実装する）
- `src/domain/types.ts`：`Part`/`KanjiEntry`/`CombineEntry`/`CombineResolved`/`HandPart`/`GameSession`/`ScoreState`/`PlayStats`/`ZukanState`/`PersistedState`/`Level`/`Rarity`/`Rng`/`CombineResult`
- `src/domain/constants.ts`：`GACHA_COUNT=10`/`HAND_CAP=12`/`COMBO_STEPS`/`MAX_COMBINE_PARTS`/`RARITY_RATES`/`RANK_TABLE`（すべて `// 暫定・要調整` 明記）

## 受け入れ条件
- [ ] 機能設計3章の型がすべて定義され、`any` を含まない
- [ ] 暫定定数に出典コメント（PRD/機能設計の項番）が付く
- [ ] 型は他レイヤーから参照可能（循環依存なし）

## スコープ外
- ロジック実装（後続チケット）

## テスト
- 型のコンパイルが通ること（`tsc --noEmit`）

## 完了の定義 (DoD)
- [ ] typecheckパス、定数が単一の真実として集約
