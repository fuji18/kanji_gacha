import { test, expect, type Page } from '@playwright/test';

// T-020 図鑑画面の E2E（受け入れ条件）。
//  - 発見済み一覧・収集率 ○/N の表示
//  - 合体で新規発見すると収集率（収集数）が増える（永続データ反映・F7）
// 決定性は `?seed=` で確保し、終了までヒント合体を繰り返す。

const SEED = 12345;
// 達成型（deck）の山札は大きいので、E2E では `?deckMax` で短縮して終了に到達させる。
const DECK_MAX = 30;

/** 山札を引き、合体/捨てを循環して deck_empty まで Result へ到達させる。 */
async function playToResult(page: Page): Promise<void> {
  await page.goto(`/?seed=${SEED}&deckMax=${DECK_MAX}`);
  await page.getByRole('button', { name: 'やさしいでゲーム開始' }).click();
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  const resultHeading = page.getByRole('heading', { name: '結果' });
  for (let i = 0; i < 200; i++) {
    if (await resultHeading.isVisible()) return;
    while (
      (await page.locator('.chip').count()) < 12 &&
      (await gacha.isEnabled())
    ) {
      await gacha.click();
    }
    if (await resultHeading.isVisible()) return;
    await page.getByRole('button', { name: 'ヒント' }).click();
    const hinted = page.locator('.chip[data-hinted="true"]');
    const n = await hinted.count();
    if (n >= 2) {
      for (let j = 0; j < n; j++) await hinted.nth(j).click();
      await page.getByRole('button', { name: '合体！' }).click();
    } else {
      const chips = page.locator('.chip');
      if ((await chips.count()) === 0) break;
      await chips.first().click();
      await page.getByRole('button', { name: '捨てて引き直す' }).click();
    }
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
