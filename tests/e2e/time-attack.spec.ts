import { test, expect, type Page } from '@playwright/test';

// T-027 タイムアタックモードの E2E（受け入れ条件・企画整理書 §11）。
//  - Home からタイムアタックを開始でき、残り時間が表示される
//  - ガチャは残回数表示が無い（無制限）
//  - 時間切れで結果画面へ遷移し、タイムアタック表示が出る
// 時間は `?taMs` で短縮、合体抽選は `?seed` で決定化する（既存 `?seed` と同思想の無害なレバー）。

const SEED = 12345;

/** タイムアタックを開始する（taMs で持ち時間を短縮）。 */
async function startTimeAttack(page: Page, taMs: number): Promise<void> {
  await page.goto(`/?seed=${SEED}&taMs=${taMs}`);
  await page
    .getByRole('button', { name: 'やさしいでタイムアタック開始' })
    .click();
  await expect(page.getByRole('button', { name: /ガチャ/ })).toBeVisible();
}

test('Home にタイムアタックの導線とベスト表示がある', async ({ page }) => {
  await page.goto('/');
  // 3レベル分のタイムアタック開始ボタンが存在する
  for (const label of ['やさしい', 'ふつう', 'むずかしい']) {
    await expect(
      page.getByRole('button', { name: `${label}でタイムアタック開始` })
    ).toBeVisible();
  }
  // 初期はタイムアタックベスト 0（.ta-best はタイムアタックカード分）
  await expect(page.locator('.ta-best')).toHaveCount(3);
  await expect(page.locator('.ta-best').first()).toHaveText('ベスト 0');
});

test('開始すると残り時間が表示され、ガチャ残は表示されない', async ({
  page,
}) => {
  // 十分長い持ち時間で開始（このテスト中に時間切れにならないように）
  await startTimeAttack(page, 30_000);

  // 残り時間（秒）が表示される
  await expect(page.getByTestId('time-remaining')).toBeVisible();
  // タイムアタックはガチャ無制限のため、ガチャ残statは出さない
  await expect(page.getByTestId('gacha-remaining')).toHaveCount(0);

  // ガチャを引くと手札が増える（残回数の制約なし）
  await page.getByRole('button', { name: /ガチャ/ }).click();
  await expect(page.locator('.chip')).toHaveCount(1);
});

test('時間切れで結果画面へ遷移し、タイムアタックと表示される', async ({
  page,
}) => {
  // ごく短い持ち時間。操作せず放置すると時間切れで Result へ自動遷移する。
  await startTimeAttack(page, 1_200);

  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByTestId('result-mode')).toHaveText('タイムアタック');
  await expect(page.getByTestId('rank')).toBeVisible();
});
