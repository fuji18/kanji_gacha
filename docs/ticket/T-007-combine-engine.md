# T-007: 合体エンジン

| 項目 | 値 |
|---|---|
| フェーズ | Phase 1 |
| 優先度 | P0 |
| 依存 | T-005 |
| 関連 | PRD F2 / 機能設計 4.1,4.4 |

## 目的
部品集合から有効な漢字を判定し、採点対象を確定する中核ロジック。

## スコープ（実装する）
- `src/domain/combine/makeKey.ts`：部品idマルチセットを昇順ソートして連結（配置不問・重複可）
- `src/domain/combine/selectPrimary.ts`：候補から freqRank最小→画数大 で代表解選定（ビルド時・プレイ時共用）
- `src/domain/combine/CombineService.ts`：`resolve(selected, level)` → scope内候補に `selectPrimary` を適用し `{entry, awarded, altInScope}` を返す。不成立は `null`

## 受け入れ条件
- [ ] 配置違い・部品順違いで同じ漢字が成立（makeKey正規化）
- [ ] 多部品（3つ以上）合体が成立する（例 木+壴+寸=樹）
- [ ] scope外の漢字しか無いkeyは `null`（ミス扱い）
- [ ] 複数解は scope内で `awarded` を一意決定、残りは `altInScope`
- [ ] 2部品未満は `null`

## スコープ外
- 詰み判定・ヒント（T-008）／スコア（T-010）

## テスト
- `resolve_配置違い_同じ漢字`、`resolve_2部品未満_null`、`resolve_複数解_awarded一意`、`resolve_scope外_null`

## 完了の定義 (DoD)
- [ ] ユニットテスト緑、機能設計4.1/4.4と整合
