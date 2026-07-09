import { test, expect } from '@playwright/test';

// T-058 チュートリアル再表示導線の E2E。
// 既定の storageState（tutorialDone=true）のまま実行する（初回状態にしない）
// ＝「完了済みでも Home から再表示できる」ことを検証する。

test('Home の「遊び方」からチュートリアルを再表示できる（T-058）', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
  // 完了済みなので起動時には出ない
  await expect(page.getByRole('dialog', { name: 'あそびかた' })).toHaveCount(0);

  await page.getByRole('button', { name: /遊び方/ }).click();
  const dialog = page.getByRole('dialog', { name: 'あそびかた' });
  await expect(dialog).toBeVisible();

  // 最後まで進めて閉じられる
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('button', { name: '木をえらぶ' }).nth(0).click();
  await page.getByRole('button', { name: '木をえらぶ' }).nth(1).click();
  await page.getByRole('button', { name: '合体！' }).click();
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(dialog).toHaveCount(0);
});

test('再表示を閉じてリロードしても、初回チュートリアルとして再出現しない（T-058）', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /遊び方/ }).click();
  const dialog = page.getByRole('dialog', { name: 'あそびかた' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'スキップ' }).click();
  await expect(dialog).toHaveCount(0);

  // ★ リロードしても再出現しない（一時フラグは永続化されない・tutorialDone は true のまま）
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'あそびかた' })).toHaveCount(0);
});
