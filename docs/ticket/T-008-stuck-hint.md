# T-008: 詰み判定・ヒント探索

| 項目 | 値 |
|---|---|
| フェーズ | Phase 1 |
| 優先度 | P0 |
| 依存 | T-007 |
| 関連 | PRD F5,F6 / 機能設計 4.5 |

## 目的
手札に合体可能な組み合わせが存在するかを判定する。終了判定とヒントで共用。

## スコープ（実装する）
- `CombineService.canCombineAny(hand, level)`：サイズ2〜`MAX_COMBINE_PARTS` の組み合わせを辞書総当たり（早期return）
- `CombineService.findHint(hand, level)`：合体可能な組み合わせを1組返す（無ければ null）

## 受け入れ条件
- [x] 合体可能な手札で `canCombineAny` が true
- [x] 詰み手札で false
- [x] `findHint` が実際に合体可能なペア/組を返す
- [x] 手札12・上限5部品で計算が高速（早期return、目標5ms以下）

## スコープ外
- 終了判定の発火（T-014）／ヒントのコスト消費（T-011）

## テスト
- 既知の詰み/非詰み手札での真偽、findHintの妥当性、計算量の感覚値

## 完了の定義 (DoD)
- [x] ユニットテスト緑、共用APIが整う
