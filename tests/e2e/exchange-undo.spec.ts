import { test, expect } from '@playwright/test';
import { startSmallDeck } from './helpers';

// T-057 交換の取り消し（Undo）の E2E。
//  - 交換直後にスナックバー「もとにもどす」が出て、押すと手札が完全復元される
//  - 次の操作（ガチャ等）でスナックバーが消える

test('交換→もとにもどす で手札が復元される（T-057）', async ({ page }) => {
  await startSmallDeck(page);
  const chips = page.locator('.chip');
  const before = await chips.allTextContents();

  // 2枚選んで一括交換
  await chips.nth(0).click();
  await chips.nth(1).click();
  await page.getByRole('button', { name: '交換' }).click();

  const undoBtn = page.getByRole('button', { name: 'もとにもどす' });
  await expect(undoBtn).toBeVisible();
  await expect(page.getByText('2枚こうかんした')).toBeVisible();

  await undoBtn.click();
  await expect(undoBtn).toHaveCount(0);
  await expect(chips).toHaveText(before); // 並び順まで完全復元

  // 直前1回のみ：スナックバーは再表示されない
  await expect(page.getByRole('button', { name: 'もとにもどす' })).toHaveCount(
    0
  );
});

test('次の操作（ヒント）でスナックバーが消える（T-057）', async ({ page }) => {
  await startSmallDeck(page);
  await page.locator('.chip').first().click();
  await page.getByRole('button', { name: '交換' }).click();
  await expect(
    page.getByRole('button', { name: 'もとにもどす' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'ヒント' }).click();
  await expect(page.getByRole('button', { name: 'もとにもどす' })).toHaveCount(
    0
  );
});
