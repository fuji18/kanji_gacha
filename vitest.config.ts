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
      exclude: [
        'node_modules/**',
        'dist/**',
        '.steering/**',
        'tests/e2e/**',
        '**/*.config.{ts,js}',
        '**/types/**',
      ],
      // グローバルは緩め、ドメイン層は 90% を強制（repository-structure 5.2 / dev-guidelines 6.2）
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
        'src/domain/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
});
