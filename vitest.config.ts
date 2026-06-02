import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // DOM を要するコンポーネント/ストアのテストに対応（development-guidelines 6.4）
    environment: 'happy-dom',
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    // E2E（Playwright）は vitest の対象外
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // `npm run test`（--coverage フラグ無し）でも閾値を評価できるよう常時有効化する。
      // これが無いと CI の test ステップで thresholds が評価されず domain 90% 強制が機能しない。
      enabled: true,
      // 未テストのファイルも 0% として計上し閾値を厳密に効かせる（development-guidelines 4.1）。
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '.steering/**',
        'tests/e2e/**',
        'src/main.ts', // エントリポイント（bootstrap、ユニットテスト対象外）
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        '**/types/**',
      ],
      // ドメイン層は 90% を強制、グローバルは緩め（development-guidelines 4.1 / repository-structure 5.2）
      thresholds: {
        'src/domain/**': {
          lines: 90,
          functions: 90,
          branches: 90,
        },
        lines: 70,
      },
    },
  },
});
