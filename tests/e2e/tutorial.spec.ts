import { test, expect } from '@playwright/test';

// 初回チュートリアル（T-034）の E2E。
// 既定の storageState（tutorialDone=true）を空に上書きし、初回状態を再現する。
test.use({ storageState: { cookies: [], origins: [] } });

test('初回はチュートリアルが表示され、最後まで進めて閉じられる', async ({
  page,
}) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'あそびかた' });
  await expect(dialog).toBeVisible();

  // 導入 → つぎへ → 「木」を2回タップ → 合体！ → つぎへ → はじめる
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('button', { name: '木をえらぶ' }).nth(0).click();
  await page.getByRole('button', { name: '木をえらぶ' }).nth(1).click();
  await page.getByRole('button', { name: '合体！' }).click();
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('button', { name: 'はじめる' }).click();

  // 閉じてホームが操作できる
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
});

test('スキップでチュートリアルを閉じられ、リロード後は再表示されない', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'あそびかた' })).toBeVisible();
  await page.getByRole('button', { name: 'スキップ' }).click();
  await expect(page.getByRole('dialog', { name: 'あそびかた' })).toHaveCount(0);

  // リロード後は再表示されない（localStorage に記録）
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'あそびかた' })).toHaveCount(0);
});

test('Esc でチュートリアルを閉じられる（スキップ扱い・T-054）', async ({
  page,
}) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'あそびかた' });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
});

test('チュートリアル表示中は Tab がオーバーレイ内で巡回する（T-054）', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'あそびかた' })).toBeVisible();

  // オーバーレイ内のボタン数より多く Tab を押しても、フォーカスは overlay 内に留まる
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  const inOverlay = await page.evaluate(() => {
    const overlay = document.querySelector('.tutorial-backdrop');
    return overlay?.contains(document.activeElement) ?? false;
  });
  expect(inOverlay).toBe(true);
});
