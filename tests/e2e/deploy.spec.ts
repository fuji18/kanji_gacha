import { test, expect } from '@playwright/test';

// T-026 のデプロイ／CSP 検証。本番相当の静的ビルド（vite preview）に対して、
// CSP meta が配信HTMLに含まれ、その制約下でもルート画面が起動することを確認する。
// （GitHub Pages は _headers を解釈しないため、CSP は meta で全配信先に適用している）。

test('index.html に CSP meta（default-src self）が含まれる', async ({
  page,
}) => {
  await page.goto('/');
  const csp = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(csp).toHaveCount(1);
  const content = await csp.getAttribute('content');
  expect(content).toContain("default-src 'self'");
});

test('CSP 適用下でもルート画面が起動する（スモーク）', async ({ page }) => {
  const violations: string[] = [];
  // CSP 違反は securitypolicyviolation イベント／コンソールに現れる。発生すれば失敗させる。
  page.on('console', (msg) => {
    if (msg.text().includes('Content Security Policy')) {
      violations.push(msg.text());
    }
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '漢字合体ガチャ' })
  ).toBeVisible();
  expect(violations).toEqual([]);
});
