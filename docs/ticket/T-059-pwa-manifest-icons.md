# T-059: PWA マニフェストアイコン整備（192px・maskable）

| 項目 | 値 |
|---|---|
| フェーズ | Phase 9（品質・信頼性強化） |
| 優先度 | P1 |
| 依存 | T-024,T-050 |
| 関連 | docs/ideas/20260706-develop-improvement-review.md §7-1 |

## 背景
マニフェストのアイコンが 512px `purpose: any` の 1 枚（apple-touch-icon.png 流用）のみ。
vite.config.ts のコメントでも「maskable 専用アイコンは後続フェーズ」と明記されている。
192px 欠如は Lighthouse/一部ランチャー要件に、maskable 欠如は Android での
円形マスク時の見切れにつながる。

## 目的
インストール体験（ホーム追加・スプラッシュ・ランチャー表示）を各プラットフォームで整える。

## スコープ（実装する）
- `192x192`（any）アイコンを追加。
- `purpose: 'maskable'` 専用アイコン（512px・セーフゾーン内にモチーフ配置）を追加。
- vite.config.ts の manifest.icons を更新し、PWA プリキャッシュ対象に含まれることを確認。
- （任意）manifest `screenshots` を追加し、インストール UI のリッチ化。

## 受け入れ条件
- [ ] Lighthouse PWA/Best Practices でアイコン起因の指摘が消える
- [ ] Android 実機（またはエミュレーション）で maskable アイコンが見切れない
- [ ] オフラインでもアイコンが解決される（プリキャッシュ確認）

## 主な変更ファイル
- public/（アイコン画像）/ vite.config.ts

## 完了の定義 (DoD)
- [ ] 受け入れ条件を満たし、全品質ゲート成功
