import { defineConfig, devices } from '@playwright/test';

// E2E は本番相当の静的ビルドを vite preview で配信して検証する（architecture / dev-guidelines 6.2）。
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // 既定で初回チュートリアル（T-034）を「済」にしてからテストする（通常 E2E を妨げない）。
    // チュートリアル自体のテストは spec 側で storageState を空に上書きする。
    storageState: './tests/e2e/storage-state.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
