# T-012: DictionaryRepository

| 項目 | 値 |
|---|---|
| フェーズ | Phase 2 |
| 優先度 | P0 |
| 依存 | T-003, T-007 |
| 関連 | 機能設計 5.2,9 / architecture 4.1 |

## 目的
静的JSON辞書を取得し、O(1)判定のため `Map` に展開する。

## スコープ（実装する）
- `src/data/DictionaryRepository.ts`：`load()`（fetch→`Map<CombineKey,CombineEntry>`/`Map<char,KanjiEntry>`/レベル別pool）、`getKanji`/`getCombine`/`getPool`、到達可能N取得
- ロード失敗時に `DictionaryLoadError` を投げる

## 受け入れ条件
- [ ] `load()` 後、合体判定が `Map.get` のO(1)で引ける
- [ ] 辞書ロード失敗で `DictionaryLoadError`
- [ ] 起動ロードが目標2秒以内（中位端末）

## スコープ外
- マウント制御（T-015）

## テスト
- モックfetchでMap展開、失敗時の例外

## 完了の定義 (DoD)
- [ ] テスト緑、O(1)判定が可能
