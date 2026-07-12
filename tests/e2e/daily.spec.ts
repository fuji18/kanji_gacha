import { test, expect, type Page } from '@playwright/test';

// T-022 シードデイリーの E2E（受け入れ条件）。
//  - 同一日付で全プレイヤーが同一ガチャ列（再現性・F8）
//  - 「今日のお題」に対象レベルとデイリーベストが表示される
// デイリーは Date.now() の JST 日付からシードを引くため、同日内の2回の起動でガチャ列が一致する。

/** 今日のお題を開始して n 回ガチャを引き、手札の文字列を順に返す。 */
async function dailyDraws(page: Page, n: number): Promise<string[]> {
  await page.goto('/');
  await page.getByRole('button', { name: /今日のお題/ }).click();
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  for (let i = 0; i < n; i++) {
    if (!(await gacha.isEnabled())) break;
    await gacha.click();
  }
  return page.locator('.chip').allTextContents();
}

test('今日のお題はレベル併記とデイリーベストを表示する', async ({ page }) => {
  await page.goto('/');
  const daily = page.getByRole('button', { name: /今日のお題/ });
  await expect(daily).toBeVisible();
  // 対象レベル（やさしい/ふつう/むずかしい のいずれか）が併記される
  await expect(daily).toContainText(/小学生|大人/);
  // 初回はデイリーベスト 0
  await expect(daily).toContainText('ベスト 0');
});

test('同一日付なら今日のお題のガチャ列が一致する（再現性・F8）', async ({
  page,
}) => {
  const first = await dailyDraws(page, 6);
  expect(first.length).toBeGreaterThan(0);
  const second = await dailyDraws(page, 6);
  expect(second).toEqual(first);
});
