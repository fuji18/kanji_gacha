import { test, expect } from '@playwright/test';

// T-015 アプリシェルの E2E（受け入れ条件）。
//  - 起動時に辞書ロード→ホーム表示
//  - 画面遷移（Home⇄Game⇄Result/Zukan/About）
//  - 辞書ロード失敗でエラーUI＋再読み込み導線

test('起動するとホーム画面が表示される', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '漢字合体ガチャ' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'レベルをえらぶ' })
  ).toBeVisible();
});

test('Home から各画面へ遷移し、戻れる', async ({ page }) => {
  await page.goto('/');

  // Home → Game → Result → もう一回(Game) → Home
  await page.getByRole('button', { name: 'やさしいでゲーム開始' }).click();
  await expect(page.getByRole('heading', { name: 'ゲーム' })).toBeVisible();
  await page.getByRole('button', { name: '終了（結果へ）' }).click();
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  await page.getByRole('button', { name: 'もう一回' }).click();
  await expect(page.getByRole('heading', { name: 'ゲーム' })).toBeVisible();
  await page.getByRole('button', { name: 'ホーム' }).click();
  await expect(
    page.getByRole('heading', { name: 'レベルをえらぶ' })
  ).toBeVisible();

  // Home → Zukan → 戻る
  await page.getByRole('button', { name: '図鑑' }).click();
  await expect(page.getByRole('heading', { name: '図鑑' })).toBeVisible();
  await page.getByRole('button', { name: '戻る' }).click();
  await expect(
    page.getByRole('heading', { name: 'レベルをえらぶ' })
  ).toBeVisible();

  // Home → About → 戻る
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await page.getByRole('button', { name: '戻る' }).click();
  await expect(
    page.getByRole('heading', { name: 'レベルをえらぶ' })
  ).toBeVisible();
});

test('辞書ロード失敗でエラーUIと再読み込み導線が出る', async ({ page }) => {
  // 静的辞書 JSON の取得を全て失敗させる
  await page.route('**/data/**', (route) => route.abort());
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'データの読み込みに失敗しました' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '再読み込み' })).toBeVisible();
});

test('エラー後に再読み込みを押すと（復旧後）ホームへ復帰する', async ({
  page,
}) => {
  // 1回目のロードだけ失敗させ、エラーUIを出す
  await page.route('**/data/**', (route) => route.abort());
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'データの読み込みに失敗しました' })
  ).toBeVisible();

  // 失敗インターセプトを解除（＝復旧）してから再読み込み導線を押す
  await page.unroute('**/data/**');
  await page.getByRole('button', { name: '再読み込み' }).click();

  // location.reload() で再起動し、辞書ロード成功→ホーム表示
  await expect(
    page.getByRole('heading', { name: 'レベルをえらぶ' })
  ).toBeVisible();
});
