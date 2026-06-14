import { test, expect, type Page } from '@playwright/test';

// Game画面の E2E（レベル再設計＝達成型・山札）。
//  - ガチャ（山札）で手札が増え、山札残が減る／スコア表示
//  - 手札上限でガチャ非活性
//  - 合体成功でスコア加算・コンボ前進／ミスでコンボリセット
//  - 捨てて引き直すで手札枚数は不変（山札から補充）
// 山札は部品がシャッフルされるため、合体可能な組が手札に揃うまで引く/捨てるをループして決定化する。

const SEED = 12345;

async function startSeeded(page: Page): Promise<void> {
  await page.goto(`/?seed=${SEED}`);
  await page.getByRole('button', { name: 'やさしいでゲーム開始' }).click();
  await expect(page.getByRole('button', { name: /ガチャ/ })).toBeVisible();
}

/**
 * 合体を1回成立させる。山札を引き、ヒントで合体可能な組が出たら合体する。
 * 手札が上限なら1枚捨てて循環させる。成立したら true。
 */
async function combineOnce(page: Page): Promise<boolean> {
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  const hintBtn = page.getByRole('button', { name: 'ヒント' });
  const resultHeading = page.getByRole('heading', { name: '結果' });
  for (let i = 0; i < 60; i++) {
    if (await resultHeading.isVisible()) return false;
    if (await gacha.isEnabled()) await gacha.click();
    await hintBtn.click();
    const hinted = page.locator('.chip[data-hinted="true"]');
    const n = await hinted.count();
    if (n >= 2) {
      for (let j = 0; j < n; j++) await hinted.nth(j).click();
      await page.getByRole('button', { name: '合体！' }).click();
      return true;
    }
    // 合体可能な組が無い：手札が上限なら1枚捨てて循環。
    const chips = page.locator('.chip');
    if ((await chips.count()) >= 12) {
      await chips.first().click();
      await page.getByRole('button', { name: '捨てて引き直す' }).click();
    }
  }
  return false;
}

test('ガチャ（山札）で手札が増え、山札残が減り、スコア表示がある', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'やさしいでゲーム開始' }).click();

  await expect(page.getByTestId('score')).toHaveText('0');
  const remainingBefore = await page
    .getByTestId('gacha-remaining')
    .textContent();

  await page.getByRole('button', { name: /ガチャ/ }).click();
  await expect(page.locator('.chip')).toHaveCount(1);
  await page.getByRole('button', { name: /ガチャ/ }).click();
  await expect(page.locator('.chip')).toHaveCount(2);

  const remainingAfter = await page
    .getByTestId('gacha-remaining')
    .textContent();
  // 山札は非復元のため残が減る
  expect(Number(remainingAfter)).toBeLessThan(Number(remainingBefore));
});

test('手札が上限に達するとガチャボタンが非活性になる', async ({ page }) => {
  await startSeeded(page);
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  // 手札上限(12)まで引く（山札はやさしいでは十分大きい）
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
  await startSeeded(page);
  expect(await combineOnce(page)).toBe(true);

  await expect(page.getByTestId('score')).not.toHaveText('0');
  await expect(page.getByTestId('combo')).toContainText('×1.5');
});

test('演出：Game に Canvas レイヤーがあり、合体成功でスコアフロート（読み/意味）が出る', async ({
  page,
}) => {
  await startSeeded(page);
  await expect(page.locator('canvas.fx-layer')).toBeAttached();

  expect(await combineOnce(page)).toBe(true);

  const float = page.getByTestId('score-float');
  await expect(float).toBeVisible();
  await expect(float).toContainText('+');
});

test('捨てて引き直すで手札枚数が変わらない（山札から補充）', async ({
  page,
}) => {
  await startSeeded(page);
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  for (let i = 0; i < 3; i++) await gacha.click();
  await expect(page.locator('.chip')).toHaveCount(3);

  await page.locator('.chip').first().click(); // 1枚選択
  await page.getByRole('button', { name: '捨てて引き直す' }).click();

  // 削除1＋山札からの補充1で枚数は不変
  await expect(page.locator('.chip')).toHaveCount(3);
});

test('合体ミスでコンボがリセットされる', async ({ page }) => {
  await startSeeded(page);

  // まず1回成功させてコンボを ×1.5 にする
  expect(await combineOnce(page)).toBe(true);
  await expect(page.getByTestId('combo')).toContainText('×1.5');

  // 手札を確保し、全体を選んで合体＝辞書に無い組で必ずミス → コンボ ×1.0
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  while ((await page.locator('.chip').count()) < 4 && (await gacha.isEnabled()))
    await gacha.click();
  const chips = page.locator('.chip');
  for (let i = 0, n = await chips.count(); i < n; i++)
    await chips.nth(i).click();
  await page.getByRole('button', { name: '合体！' }).click();

  await expect(page.getByTestId('combo')).toContainText('×1.0');
});
