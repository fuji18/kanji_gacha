import { test, expect } from '@playwright/test';

// T-055 カラーコントラスト是正とダークモードの E2E。
//  - OS ダーク設定（colorScheme エミュレーション）でトークンが夜の和紙へ切り替わる
//  - ライトでは従来の和紙のまま（回帰）
//  - theme-color メタがライト/ダークの2枚構成

test.describe('ダークモード（prefers-color-scheme: dark）', () => {
  test.use({ colorScheme: 'dark' });

  test('ダーク設定で surface トークンが夜の和紙に切り替わり、ホームが表示される', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'モードをえらぶ' })
    ).toBeVisible();
    const surface = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--md-sys-color-surface')
        .trim()
    );
    expect(surface).toBe('#26221b'); // 夜の和紙（ダークトークン）
  });
});

test('ライト設定では従来の和紙トークンのまま（回帰）', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
  const surface = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--md-sys-color-surface')
      .trim()
  );
  expect(surface).toBe('#f5f1e6'); // 和紙（ライトトークン）
});

test('theme-color メタがライト/ダークの2枚構成（T-055）', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator(
      'meta[name="theme-color"][media="(prefers-color-scheme: light)"]'
    )
  ).toHaveAttribute('content', '#c0392b');
  await expect(
    page.locator(
      'meta[name="theme-color"][media="(prefers-color-scheme: dark)"]'
    )
  ).toHaveAttribute('content', '#26221b');
});
