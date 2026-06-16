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
});

test('学習帳カードに画数/部首が出て、学年別収集率が表示される（T-036）', async ({
  page,
}) => {
  await startSmallDeck(page);
  await playToResult(page);
  await page.getByRole('button', { name: 'ホーム' }).click();
  await page.getByRole('button', { name: '図鑑' }).click();

  // 学年別の収集率バー（小1〜小6）が表示される
  await expect(page.getByTestId('grade-rate')).toBeVisible();

  // カードに画数（「N画」）と部首（「部首:」）が表示される
  const firstCard = page.getByTestId('zukan-card').first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard).toContainText('画');
  await expect(firstCard).toContainText('部首:');
});

test('カードをタップすると筆順再生が開き、閉じられる（T-036）', async ({
  page,
}) => {
  await startSmallDeck(page);
  await playToResult(page);
  await page.getByRole('button', { name: 'ホーム' }).click();
  await page.getByRole('button', { name: '図鑑' }).click();

  await page.getByTestId('zukan-card').first().click();
  const playback = page.getByTestId('stroke-playback');
  await expect(playback).toBeVisible();

  // 「もう一度」で再生し直せる（パネルは出たまま）
  await playback.getByRole('button', { name: 'もう一度' }).click();
  await expect(playback).toBeVisible();

  // 「閉じる」で消える
  await playback.getByRole('button', { name: '閉じる' }).click();
  await expect(playback).not.toBeVisible();
});
