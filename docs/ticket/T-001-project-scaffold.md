# T-001: プロジェクトscaffold

| 項目 | 値 |
|---|---|
| フェーズ | Phase 0 |
| 優先度 | P0 |
| 依存 | — |
| 関連 | architecture 1〜2 / repository-structure 1 |

## 目的
Vite + Svelte 5 + TypeScript の最小プロジェクトを立ち上げ、リポジトリ構造定義書のディレクトリ骨格を用意する。

## スコープ（実装する）
- `npm create vite`（svelte-ts）相当で初期化、`npm run dev` が起動する
- ディレクトリ骨格を作成：`src/{domain,app,data,ui}`、`scripts/build-data`、`data-sources`、`tests/{unit,integration,e2e}`、`public/data`
- `tsconfig.json`（実行時src用・`include:["src"]`）と `tsconfig.scripts.json`（`scripts/`＋`src/domain`）の2系統
- `App.svelte`／`main.ts` のプレースホルダ（後続T-015で本実装）
- `README.md`・`LICENSE`・`.gitignore`（repository-structure 8.1準拠）

## 受け入れ条件
- [x] `npm ci && npm run dev` でローカル起動する
- [x] `npm run build` が成功し `dist/` が生成される
- [x] ディレクトリ骨格がリポジトリ構造定義書1章と一致
- [x] `tsconfig.scripts.json` から `src/domain` を型解決できる

## スコープ外
- ドメインロジック・UI本実装（後続チケット）

## テスト
- `npm run build` がCIで通ること（T-002で自動化）

## 完了の定義 (DoD)
- [x] build/dev がパス、骨格がドキュメントと整合
