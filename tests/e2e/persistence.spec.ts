import { test, expect } from '@playwright/test';
import { startSmallDeck, playToResult } from './helpers';

// 永続化のリロード越え E2E（architecture 8.3）。
//  - 1プレイで漢字発見・ベスト更新 → ページ再読込 → 図鑑収集数・モードベストが保持
// 決定性は `?seed=`＋出題数5字（小さい山札）で確保する。

test('図鑑収集とモードベストはページ再読込後も保持される（永続化・F7/F9）', async ({
  page,
}) => {
  // 1プレイして漢字を作り、終了で永続化（zukan / bestScores）。
  await startSmallDeck(page);
  await playToResult(page);
  const score = Number(await page.getByTestId('result-score').textContent());
  expect(score).toBeGreaterThan(0); // 得点しているのでベスト更新対象

  // ホームへ戻る。
  await page.getByRole('button', { name: 'ホーム' }).click();
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();

  // ★ 実ページ再読込（main.ts 再起動・localStorage から復元）。
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();

  // 小学生モード（先頭カード）のベストがリロード後も > 0 で保持される。
  const elementaryBest = page.locator('.level-best').nth(0);
  await expect(elementaryBest).not.toHaveText('ベスト 0');

  // 図鑑の収集数もリロード後に保持される（>0）。
  await page.getByRole('button', { name: '図鑑' }).click();
  await expect(page.getByRole('heading', { name: '図鑑' })).toBeVisible();
  const collected = Number(await page.getByTestId('collected').textContent());
  expect(collected).toBeGreaterThan(0);
});
