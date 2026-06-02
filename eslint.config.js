import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';
import svelteParser from 'svelte-eslint-parser';

// レイヤー間の一方向依存（repository-structure 5.1）を no-restricted-imports で強制する。
// ui → app → domain / data の順で、下位・横レイヤーへの直接 import を禁止する。
const layerImportRules = {
  // domain は最下層。上位・横レイヤー（app/ui/data）に依存してはならない。
  domain: ['**/app/**', '**/ui/**', '**/data/**'],
  // data は app/ui に依存してはならない（domain の型参照のみ許可）。
  data: ['**/app/**', '**/ui/**'],
  // app は ui に依存してはならない。
  app: ['**/ui/**'],
  // ui は domain / data に直接依存してはならない（必ず app 経由）。
  ui: ['**/domain/**', '**/data/**'],
};

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettierConfig,
  ...svelte.configs['flat/prettier'],
  {
    plugins: { import: importPlugin },
    // import/no-cycle が TypeScript / Svelte の import を解決できるよう resolver を設定する
    // （これが無いと .ts の循環依存がサイレントに素通りする / repository-structure 5.3）
    settings: {
      'import/parsers': { '@typescript-eslint/parser': ['.ts', '.svelte'] },
      'import/resolver': {
        typescript: {
          project: ['tsconfig.json', 'tsconfig.scripts.json'],
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // 循環依存の機械的検出（repository-structure 5.3）
      'import/no-cycle': 'error',
    },
  },
  {
    // .svelte は svelte パーサで解析（Svelte 5 runes 対応）
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tseslint.parser },
    },
  },
  // --- レイヤー別 import 境界（repository-structure 5.1） ---
  {
    // domain 層：上位・横レイヤー import 禁止 ＋ 乱数/時刻の禁止（純粋性 5.2 / dev-guidelines 6.3）
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
          message:
            'domain層でMath.random()は禁止。RNGを引数で注入すること（repository-structure 2.1）',
        },
        {
          selector:
            'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
          message:
            'domain層でDate.now()は禁止。タイムスタンプを引数で受け取ること（repository-structure 2.1）',
        },
      ],
      'no-restricted-imports': ['error', { patterns: layerImportRules.domain }],
    },
  },
  {
    files: ['src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: layerImportRules.data }],
    },
  },
  {
    files: ['src/app/**/*.{ts,svelte}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: layerImportRules.app }],
    },
  },
  {
    files: ['src/ui/**/*.{ts,svelte}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: layerImportRules.ui }],
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dev-dist/**',
      'coverage/**',
      'public/data/**',
      '.steering/**',
    ],
  }
);
