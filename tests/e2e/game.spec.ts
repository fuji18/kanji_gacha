import { test, expect } from '@playwright/test';
import { startSmallDeck, combineOnce } from './helpers';

// Game画面の E2E（達成型・山札／小学生モード）。
//  - ガチャ（山札）で手札が増え、山札残が減る
//  - 手札上限でガチャ非活性
//  - 合体成功でスコア加算・コンボ前進／既出は無効（ノーペナルティ）／ミスでコンボリセット
//  - 捨てて引き直すで手札枚数は不変（山札に戻して引く）

test('開始時に手札が自動補充され、スコアと山札残が表示される', async ({
  page,
}) => {
  await startSmallDeck(page);
  await expect(page.getByTestId('score')).toHaveText('0');

  // 開始時に手札は自動で（上限まで）補充される。
  const count = await page.locator('.chip').count();
  expect(count).toBeGreaterThan(0);
  // 山札は非復元のため、自動補充ぶんだけ残が減っている（残が表示されている）。
  await expect(page.getByTestId('gacha-remaining')).toBeVisible();
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

test('段階ヒント：押すごとに 光る→読み→答え と進む（T-033）', async ({
  page,
}) => {
  await startSmallDeck(page);
  const hintBtn = page.getByRole('button', { name: 'ヒント' });
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  const feedback = page.getByTestId('feedback');

  // 合体可能な組が手札に揃うまで引きつつヒントを試す
  let highlighted = false;
  for (let i = 0; i < 14; i++) {
    if (await gacha.isEnabled()) await gacha.click();
    await hintBtn.click();
    if ((await page.locator('.chip[data-hinted="true"]').count()) >= 2) {
      highlighted = true;
      break;
    }
  }
  expect(highlighted).toBe(true); // ①光る

  await hintBtn.click(); // ②読み
  await expect(feedback).toContainText('読み：');

  await hintBtn.click(); // ③答え
  await expect(feedback).toContainText('答え：');
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

test('交換で手札枚数が変わらない（山札に戻して引く）', async ({ page }) => {
  await startSmallDeck(page);
  // 開始時に手札は自動で上限まで補充される。その枚数を基準に、交換後も不変を確認する。
  const chips = page.locator('.chip');
  const before = await chips.count();
  expect(before).toBeGreaterThan(0);

  await chips.first().click();
  await page.getByRole('button', { name: '交換' }).click();
  await expect(chips).toHaveCount(before); // 戻して引くので不変
});

test('複数選択で一括交換できる（手札枚数は不変）', async ({ page }) => {
  await startSmallDeck(page);
  const chips = page.locator('.chip');
  const before = await chips.count();
  expect(before).toBeGreaterThanOrEqual(2);

  // 2枚を選択して一括交換 → 枚数は不変
  await chips.nth(0).click();
  await chips.nth(1).click();
  await page.getByRole('button', { name: '交換' }).click();
  await expect(chips).toHaveCount(before);
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
