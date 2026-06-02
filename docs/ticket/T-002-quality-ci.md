# T-002: 品質ツール・CIパイプライン

| 項目 | 値 |
|---|---|
| フェーズ | Phase 0 |
| 優先度 | P0 |
| 依存 | T-001 |
| 関連 | development-guidelines 6 / repository-structure 5.2,8.2 |

## 目的
Lint・整形・型・テストの自動化と、CIの品質ゲートを構築する。ドメイン純粋性をコードルールで強制する。

## スコープ（実装する）
- ESLint flat config（`eslint.config.js`）：`ignores`、`eslint-plugin-svelte`、import境界（`no-restricted-imports`）、循環依存（`import/no-cycle`）
- **`src/domain/**` 専用ブロック**：`no-restricted-syntax` で `Math.random()`/`Date.now()` をエラー化（開発ガイドライン6.3）
- Prettier（`.prettierrc`＋`prettier-plugin-svelte`）
- Vitest 設定（`vitest.config.ts`）：`coverage.thresholds` で `src/domain/**` 90%、`environment: 'happy-dom'`
- Playwright 設定（`@playwright/test`）
- Husky + lint-staged（pre-commit）
- npm scripts（`lint`/`format`/`typecheck`/`test`/`test:e2e`/`gen:data`/`verify:data`）
- GitHub Actions `ci.yml`（開発ガイドライン6.2の順序：lint→typecheck→gen:data→verify:data→test→build→playwright install→e2e）

## 受け入れ条件
- [ ] `src/domain/` で `Math.random()` を書くと `npm run lint` が失敗する
- [ ] `ui→domain` 直接importでlintが失敗する
- [ ] `npm run test` がドメイン90%未満でCI失敗する設定になっている
- [ ] CIがPRで自動実行され、各ステップが正しい順序で走る
- [ ] pre-commitで lint-staged が動く

## スコープ外
- 詰み率検証の中身（T-004）

## テスト
- 故意の違反（Math.random／層越えimport）でlintが赤になることを確認

## 完了の定義 (DoD)
- [ ] CI緑、ドメイン純粋性・import境界がCIで強制される
