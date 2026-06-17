import { test, expect } from '@playwright/test';
import { startSmallDeck, playToResult } from './helpers';

// 図鑑画面の E2E（達成型・小学生モード）。
//  - 発見済み一覧・収集率 ○/N の表示
//  - 合体で新規発見すると収集数が増える（永続データ反映・F7）
// 決定性は `?seed=`＋出題数5字（小さい山札）で確保する。

test('初回は収集率 0、収集率表示と戻る導線がある', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '図鑑' }).click();

  await expect(page.getByRole('heading', { name: '図鑑' })).toBeVisible();
  await expect(page.getByTestId('collected')).toHaveText('0');

  await page.getByRole('button', { name: '戻る' }).click();
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
});

test('合体で新規発見すると図鑑の収集数が増える（F7）', async ({ page }) => {
  // 1プレイして漢字を作り、終了で永続化 → ホーム → 図鑑
  await startSmallDeck(page);
  await playToResult(page);
  await page.getByRole('button', { name: 'ホーム' }).click();
  await page.getByRole('button', { name: '図鑑' }).click();

  await expect(page.getByRole('heading', { name: '図鑑' })).toBeVisible();
  // 少なくとも1漢字を発見しているので収集数 >= 1、発見一覧が表示される
  await expect(page.getByTestId('discovered-grid')).toBeVisible();
  const collected = Number(await page.getByTestId('collected').textContent());
  expect(collected).toBeGreaterThan(0);

  // 読み上げ（T-032・既定ON）：発見カードに読み上げボタンが出る
  await expect(
    page.getByRole('button', { name: /読み上げ/ }).first()
  ).toBeVisible();

  // 学習帳化（T-036）：学年別収集率が表示される
  await expect(page.getByTestId('grade-collection')).toBeVisible();

  // カードをタップすると筆順オーバーレイが開く
  await page
    .getByRole('button', { name: /の筆順を見る/ })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: /の筆順/ })).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();
  await expect(page.getByRole('dialog', { name: /の筆順/ })).toHaveCount(0);
});
