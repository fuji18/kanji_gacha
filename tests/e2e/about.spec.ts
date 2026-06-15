import { test, expect } from '@playwright/test';

// T-021 About画面の E2E（受け入れ条件）。
//  - Home から About へ到達できる
//  - クレジット表記（整理書6.1 雛形）が掲載される
//  - CC BY-SA リンクが有効（href が正しい）
//  - 図鑑のブラウザ依存の注意書きがある

test('Home から About に到達し、クレジット・ライセンス・保存注意が表示される', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();

  // クレジット雛形（KANJIDIC2 / KRADFILE / EDRDG / CC BY-SA 4.0）
  await expect(
    page.getByText('This app uses data from KANJIDIC2 and KRADFILE')
  ).toBeVisible();
  await expect(
    page.getByText('Copyright © James William Breen and')
  ).toBeVisible();
  await expect(
    page.getByText('The Electronic Dictionary Research and Development Group')
  ).toBeVisible();
  await expect(page.getByText('Licensed under CC BY-SA 4.0')).toBeVisible();

  // KanjiVG（KRADFILE 代替）クレジット
  await expect(
    page.getByText('Ulrich Apel and contributors', { exact: false })
  ).toBeVisible();

  // localStorage のブラウザ依存注意
  await expect(page.getByText('引き継がれません')).toBeVisible();
});

test('CC BY-SA リンクが有効な href を持つ', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'About' }).click();

  await expect(
    page.locator('a[href="https://creativecommons.org/licenses/by-sa/4.0/"]')
  ).toBeVisible();
  await expect(
    page.locator('a[href="https://creativecommons.org/licenses/by-sa/3.0/"]')
  ).toBeVisible();
  await expect(
    page.locator('a[href="https://www.edrdg.org/edrdg/licence.html"]')
  ).toBeVisible();
  await expect(
    page.locator('a[href="https://kanjivg.tagaini.net/"]')
  ).toBeVisible();
});

test('About から戻るでホームへ', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'About' }).click();
  await page.getByRole('button', { name: '戻る' }).click();
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
});
