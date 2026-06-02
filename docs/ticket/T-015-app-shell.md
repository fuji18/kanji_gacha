# T-015: アプリシェル・画面遷移

| 項目 | 値 |
|---|---|
| フェーズ | Phase 3 |
| 優先度 | P0 |
| 依存 | T-012, T-014 |
| 関連 | 機能設計 5.2,6,11 / repository-structure 2.7 |

## 目的
辞書ロード→マウントの初期化と、画面遷移の骨格を作る。

## スコープ（実装する）
- `src/main.ts`：`DictionaryRepository.load()` を await→`App.svelte` マウント。失敗時はエラーUI（リトライ導線）でマウント中断
- `src/ui/App.svelte`：Home/Game/Result/Zukan/About を store購読で切替
- ローディング/エラー表示の共通コンポーネント

## 受け入れ条件
- [ ] 起動時に辞書ロード→ホーム表示
- [ ] 辞書ロード失敗でエラーUI＋再読み込み導線
- [ ] 画面遷移（Home⇄Game⇄Result/Zukan/About）が動作

## スコープ外
- 各画面の中身（T-016〜T-021）

## テスト
- E2E：起動→ホーム、ロード失敗時のエラーUI

## 完了の定義 (DoD)
- [ ] シェルが動作、各画面のマウント先が用意される
