# T-013: StorageRepository＋migration

| 項目 | 値 |
|---|---|
| フェーズ | Phase 2 |
| 優先度 | P0 |
| 依存 | T-005 |
| 関連 | PRD F7,F9 / 機能設計 3.3,5.2,8.3 |

## 目的
図鑑・ベスト・デイリーベスト・設定をlocalStorageに永続化し、スキーマ移行を扱う。

## スコープ（実装する）
- `src/data/StorageRepository.ts`：単一キー `kg.state.v1`、`loadState()`（常に最新スキーマを返す）、`saveZukan`/`saveBest`/`saveDailyBest`
- `src/data/migrations.ts`：`schemaVersion`（現在1・`altDiscovered`含む）順次移行、破損時初期化
- localStorage不可時は `StorageUnavailableError`、メモリ動作にフォールバック

## 受け入れ条件
- [x] 図鑑追加→リロード→保持（F7）
- [x] レベル別ベスト・デイリーベストの保存/更新（F9）
- [x] 旧スキーマ（altDiscoveredなし）から `{}` 補完で移行
- [x] localStorage不可でもクラッシュせず継続（保存系のみ無効）

## スコープ外
- 図鑑/結果のUI（T-019,T-020）

## テスト
- 保存/読込ラウンドトリップ、マイグレーション、破損データの初期化、不可環境のフォールバック

## 完了の定義 (DoD)
- [x] テスト緑、永続化と移行が動作
