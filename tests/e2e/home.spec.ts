import { test, expect } from '@playwright/test';

// T-016 Home画面の E2E（受け入れ条件）。
//  - 3レベルを選んでゲーム開始できる（1タップ＝2タップ以内）
//  - レベル別ベストスコアを表示
//  - 図鑑・About・今日のお題へ遷移できる

const LEVELS = ['やさしい', 'ふつう', 'むずかしい'];

test('3レベルそれぞれ1タップでゲーム開始できる', async ({ page }) => {
  for (const label of LEVELS) {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'レベルをえらぶ' })
    ).toBeVisible();
    await page.getByRole('button', { name: `${label}でゲーム開始` }).click();
    await expect(page.getByRole('heading', { name: 'ゲーム' })).toBeVisible();
  }
});

test('レベル別ベストスコアを表示する', async ({ page }) => {
  await page.goto('/');
  // 初期状態（localStorage 空）は各レベル ベスト 0
  await expect(page.getByText('ベスト 0')).toHaveCount(LEVELS.length);
});

test('今日のお題からゲームへ遷移できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '今日のお題' }).click();
  await expect(page.getByRole('heading', { name: 'ゲーム' })).toBeVisible();
});

test('図鑑・About へ遷移できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '図鑑' }).click();
  await expect(page.getByRole('heading', { name: '図鑑' })).toBeVisible();
  await page.getByRole('button', { name: '戻る' }).click();

  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
});
