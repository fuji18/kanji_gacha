import { test, expect, type Page } from '@playwright/test';

// T-024 最小SW・PWA の E2E（受け入れ条件）。
//  - 初回ロードで Service Worker が登録・制御取得し、静的アセット＋辞書JSON をプリキャッシュ
//  - オフライン化して再読込してもホーム表示・ガチャ到達まで動作（完全オフライン動作の保証）
// E2E は本番ビルドを vite preview で配信するため SW が有効（localhost は secure context 扱い）。

/** Service Worker がページ制御を取得（clientsClaim 完了）するまで待つ。 */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return reg.active !== null && navigator.serviceWorker.controller !== null;
    },
    undefined,
    { timeout: 30_000 }
  );
}

test('オフライン化して再読込してもホーム表示・プレイ開始できる（T-024）', async ({
  page,
  context,
}) => {
  // 1) オンラインで初回ロード（SW 登録・プリキャッシュ）。
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
  await waitForServiceWorker(page);

  // 2) オフラインへ切り替え。
  await context.setOffline(true);

  try {
    // 3) 再読込：index.html / JS / CSS / 辞書JSON はすべて precache から供給され、ホームが表示される。
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'モードをえらぶ' })
    ).toBeVisible();

    // 4) オフラインのままゲーム開始まで到達（辞書ロード成功の証跡・2段選択）。
    await page.getByRole('button', { name: '小学生モードをえらぶ' }).click();
    await page.getByRole('button', { name: '全学年をえらぶ' }).click();
    await page.getByRole('button', { name: '5字で開始' }).click();
    await expect(page.getByRole('button', { name: /ガチャ/ })).toBeVisible();
  } finally {
    // 後続テストへ影響しないようオンラインへ戻す。
    await context.setOffline(false);
  }
});
