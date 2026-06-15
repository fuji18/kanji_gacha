import { test, expect } from '@playwright/test';
import { startSmallDeck, combineOnce } from './helpers';

// Game画面の E2E（達成型・山札／小学生モード）。
//  - ガチャ（山札）で手札が増え、山札残が減る
//  - 手札上限でガチャ非活性
//  - 合体成功でスコア加算・コンボ前進／既出は無効（ノーペナルティ）／ミスでコンボリセット
//  - 捨てて引き直すで手札枚数は不変（山札に戻して引く）

test('ガチャ（山札）で手札が増え、山札残が減り、スコア表示がある', async ({
  page,
}) => {
  await startSmallDeck(page);
  await expect(page.getByTestId('score')).toHaveText('0');
  const before = await page.getByTestId('gacha-remaining').textContent();

  await page.getByRole('button', { name: /ガチャ/ }).click();
  await expect(page.locator('.chip')).toHaveCount(1);
  await page.getByRole('button', { name: /ガチャ/ }).click();
  await expect(page.locator('.chip')).toHaveCount(2);

  const after = await page.getByTestId('gacha-remaining').textContent();
  expect(Number(after)).toBeLessThan(Number(before)); // 山札は非復元
});

test('手札が上限に達するとガチャボタンが非活性になる', async ({ page }) => {
  // 出題数を大きめ（全部）にして山札を十分確保し、手札上限を先に迎える
  await page.goto('/?seed=12345');
  await page.getByRole('button', { name: '小学生モードをえらぶ' }).click();
  await page.getByRole('button', { name: '全学年をえらぶ' }).click();
  await page.getByRole('button', { name: '全部で開始' }).click();
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  for (let i = 0; i < 12; i++) {
    if (!(await gacha.isEnabled())) break;
    await gacha.click();
  }
  await expect(page.locator('.chip')).toHaveCount(12);
  await expect(gacha).toBeDisabled();
});

test('ヒントの組を合体すると成功し、スコアとコンボが前進する', async ({
  page,
}) => {
  await startSmallDeck(page);
  expect(await combineOnce(page)).toBe(true);
  await expect(page.getByTestId('score')).not.toHaveText('0');
  await expect(page.getByTestId('combo')).toContainText('×1.5');
});

test('演出：Canvas レイヤーと、合体成功でスコアフロートが出る', async ({
  page,
}) => {
  await startSmallDeck(page);
  await expect(page.locator('canvas.fx-layer')).toBeAttached();
  expect(await combineOnce(page)).toBe(true);
  const float = page.getByTestId('score-float');
  await expect(float).toBeVisible();
  await expect(float).toContainText('+');
});

test('捨てて引き直すで手札枚数が変わらない（山札に戻して引く）', async ({
  page,
}) => {
  await startSmallDeck(page);
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  for (let i = 0; i < 3; i++) await gacha.click();
  await expect(page.locator('.chip')).toHaveCount(3);

  await page.locator('.chip').first().click();
  await page.getByRole('button', { name: '捨てて引き直す' }).click();
  await expect(page.locator('.chip')).toHaveCount(3); // 戻して引くので不変
});

test('合体ミスでコンボがリセットされる', async ({ page }) => {
  await startSmallDeck(page);
  expect(await combineOnce(page)).toBe(true);
  await expect(page.getByTestId('combo')).toContainText('×1.5');

  // 手札を確保し全体を選んで合体＝辞書に無い組で必ずミス → コンボ ×1.0
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  while ((await page.locator('.chip').count()) < 4 && (await gacha.isEnabled()))
    await gacha.click();
  const chips = page.locator('.chip');
  for (let i = 0, n = await chips.count(); i < n; i++)
    await chips.nth(i).click();
  await page.getByRole('button', { name: '合体！' }).click();
  await expect(page.getByTestId('combo')).toContainText('×1.0');
});
