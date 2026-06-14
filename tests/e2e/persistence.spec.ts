import { test, expect, type Page } from '@playwright/test';

// T-025 永続化のリロード越え E2E（architecture 8.3）。
//  - 1プレイで漢字発見・ベスト更新 → ページ再読込（page.reload）→ 図鑑収集数・レベルベストが保持
// localStorage は同一コンテキストで reload を越えて保持される。main.ts 再起動後も StorageRepository が復元する。
// 決定性は `?seed=` で確保し、終了までヒント合体を繰り返す（既存 result/zukan spec と同型）。

const SEED = 12345;
// 達成型（deck）の山札は大きいので、E2E では `?deckMax` で短縮して終了に到達させる。
const DECK_MAX = 30;

/** やさしいを seeded で開始し、山札を引き合体/捨てを循環して deck_empty まで Result へ到達させる。 */
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

test('図鑑収集とレベルベストはページ再読込後も保持される（永続化・F7/F9）', async ({
  page,
}) => {
  // 1プレイして漢字を作り、終了で永続化（zukan / bestScores）。
  await playToResult(page);
  const score = Number(await page.getByTestId('result-score').textContent());
  expect(score).toBeGreaterThan(0); // 得点しているのでベスト更新対象

  // ホームへ戻る。
  await page.getByRole('button', { name: 'ホーム' }).click();
  await expect(
    page.getByRole('heading', { name: 'レベルをえらぶ' })
  ).toBeVisible();

  // ★ 実ページ再読込（main.ts 再起動・localStorage から復元）。
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'レベルをえらぶ' })
  ).toBeVisible();

  // やさしい（先頭レベルカード）のベストがリロード後も > 0 で保持される。
  const elementaryBest = page.locator('.level-best').nth(0);
  await expect(elementaryBest).not.toHaveText('ベスト 0');

  // 図鑑の収集数もリロード後に保持される（>0）。
  await page.getByRole('button', { name: '図鑑' }).click();
  await expect(page.getByRole('heading', { name: '図鑑' })).toBeVisible();
  const collected = Number(await page.getByTestId('collected').textContent());
  expect(collected).toBeGreaterThan(0);
});
