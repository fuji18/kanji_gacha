import { test, expect } from '@playwright/test';

// Home画面の E2E（レベル再設計＝小学生/大人モード・2段選択）。
//  - 小学生モード → 学年（7択）→ 出題数 → ゲーム開始
//  - 大人モード → 出題数 → ゲーム開始
//  - 今日のお題・図鑑・About 導線

test('小学生モード→学年→出題数でゲーム開始できる', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
  await page.getByRole('button', { name: '小学生モードをえらぶ' }).click();
  await expect(
    page.getByRole('heading', { name: '学年をえらぶ' })
  ).toBeVisible();
  await page.getByRole('button', { name: '小1をえらぶ' }).click();
  await expect(
    page.getByRole('heading', { name: '出題数をえらぶ' })
  ).toBeVisible();
  await page.getByRole('button', { name: '5字で開始' }).click();
  await expect(page.getByRole('heading', { name: 'ゲーム' })).toBeVisible();
});

test('大人モード→出題数でゲーム開始できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '大人モードをえらぶ' }).click();
  await expect(
    page.getByRole('heading', { name: '出題数をえらぶ' })
  ).toBeVisible();
  await page.getByRole('button', { name: '10字で開始' }).click();
  await expect(page.getByRole('heading', { name: 'ゲーム' })).toBeVisible();
});

test('モードのベストスコアを表示する', async ({ page }) => {
  await page.goto('/');
  // 初期状態（localStorage 空）は各モードのベストが 0（.level-best はモードカード分=2）
  await expect(page.locator('.level-best')).toHaveCount(2);
  await expect(page.locator('.level-best').first()).toHaveText('ベスト 0');
});

test('学年選択からもどれる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '小学生モードをえらぶ' }).click();
  await page.getByRole('button', { name: 'もどる' }).click();
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
});

test('ふりがなトグルをオンにでき、リロード後も保持される（T-031）', async ({
  page,
}) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /ふりがな/ });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  // ON にすると見出し等にふりがな（ruby）が付く
  await expect(page.locator('ruby').first()).toBeVisible();

  // リロードしても保持される（localStorage）
  await page.reload();
  await expect(page.getByRole('button', { name: /ふりがな/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('文字サイズ拡大トグルが効き、リロード後も保持される（T-037）', async ({
  page,
}) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /文字大/ });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  // html の基準サイズが拡大される
  const fontSize = await page.evaluate(
    () => document.documentElement.style.fontSize
  );
  expect(fontSize).not.toBe('');

  await page.reload();
  await expect(page.getByRole('button', { name: /文字大/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('今日のお題からゲームへ遷移できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /今日のお題/ }).click();
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
