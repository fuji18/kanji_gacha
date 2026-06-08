import { test, expect, type Page } from '@playwright/test';

// T-020 図鑑画面の E2E（受け入れ条件）。
//  - 発見済み一覧・収集率 ○/N の表示
//  - 合体で新規発見すると収集率（収集数）が増える（永続データ反映・F7）
// 決定性は `?seed=` で確保し、終了までヒント合体を繰り返す。

const SEED = 12345;

/** 残が尽きるまでガチャ → ヒント合体を繰り返し、Result へ到達させる。 */
async function playToResult(page: Page): Promise<void> {
  await page.goto(`/?seed=${SEED}`);
  await page.getByRole('button', { name: 'やさしいでゲーム開始' }).click();
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  for (let i = 0; i < 30; i++) {
    if (!(await gacha.isEnabled())) break;
    await gacha.click();
  }
  const resultHeading = page.getByRole('heading', { name: '結果' });
  for (let i = 0; i < 12; i++) {
    if (await resultHeading.isVisible()) return;
    await page.getByRole('button', { name: 'ヒント' }).click();
    const hinted = page.locator('.chip[data-hinted="true"]');
    if ((await hinted.count()) === 0) break;
    for (let j = 0, n = await hinted.count(); j < n; j++)
      await hinted.nth(j).click();
    await page.getByRole('button', { name: '合体！' }).click();
  }
  await expect(resultHeading).toBeVisible();
}

test('初回は収集率 0、収集率表示と戻る導線がある', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '図鑑' }).click();

  await expect(page.getByRole('heading', { name: '図鑑' })).toBeVisible();
  await expect(page.getByTestId('collected')).toHaveText('0');

  await page.getByRole('button', { name: '戻る' }).click();
  await expect(
    page.getByRole('heading', { name: 'レベルをえらぶ' })
  ).toBeVisible();
});

test('合体で新規発見すると図鑑の収集数が増える（F7）', async ({ page }) => {
  // 1プレイして漢字を作り、終了で永続化 → ホーム → 図鑑
  await playToResult(page);
  await page.getByRole('button', { name: 'ホーム' }).click();
  await page.getByRole('button', { name: '図鑑' }).click();

  await expect(page.getByRole('heading', { name: '図鑑' })).toBeVisible();
  // 少なくとも1漢字を発見しているので収集数 >= 1、発見一覧が表示される
  await expect(page.getByTestId('discovered-grid')).toBeVisible();
  const collected = Number(await page.getByTestId('collected').textContent());
  expect(collected).toBeGreaterThan(0);
});
