# 漢字合体ガチャ（仮称）

ガチャで引いた部品（部首・パーツ）を合体させて漢字を作る、クライアント完結の静的Webアプリ。

- **技術スタック**: Vite + Svelte 5 + TypeScript（バックエンド無し・完全静的）
- **アーキテクチャ**: レイヤード（UI → App → Domain → Data）。詳細は [`docs/`](./docs) を参照

## セットアップ

```bash
npm ci        # 依存インストール（lockfile から再現）
npm run dev   # 開発サーバー起動
```

## 主なスクリプト

| コマンド            | 内容                         |
| ------------------- | ---------------------------- |
| `npm run dev`       | 開発サーバー（Vite HMR）     |
| `npm run build`     | 本番ビルド（`dist/` を生成） |
| `npm run preview`   | ビルド成果物のプレビュー     |
| `npm run lint`      | ESLint                       |
| `npm run format`    | Prettier 整形                |
| `npm run typecheck` | 型チェック（svelte-check）   |
| `npm run test`      | ユニットテスト（Vitest）     |

## ディレクトリ構成

```
src/
  domain/   ドメイン層（純粋ロジック・外部依存なし）
  app/      アプリケーション層（進行・状態）
  data/     データ層（辞書ロード・永続化）
  ui/       UIレイヤー（Svelteコンポーネント・演出）
scripts/build-data/   ビルド時データ生成（実行時には含まれない）
data-sources/         元データ（KANJIDIC2 / KRADFILE）
public/data/          ビルド生成の辞書JSON
tests/{unit,integration,e2e}/   テスト
```

詳細は [リポジトリ構造定義書](./docs/repository-structure.md) を参照。

## ドキュメント

[PRD](./docs/product-requirements.md) ／ [機能設計](./docs/functional-design.md) ／
[アーキテクチャ](./docs/architecture.md) ／ [リポジトリ構造](./docs/repository-structure.md) ／
[開発ガイドライン](./docs/development-guidelines.md) ／ [用語集](./docs/glossary.md) ／
[開発チケット](./docs/ticket/README.md)

## ライセンス

コードは [MIT License](./LICENSE)。辞書データは元データ（KANJIDIC2 / KRADFILE）の
CC BY-SA を継承する（`data-sources/` ・ `public/data/LICENSE.txt` を参照）。
