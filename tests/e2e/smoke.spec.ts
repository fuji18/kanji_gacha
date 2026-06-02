import { test, expect } from '@playwright/test';

// T-002 のスモークE2E：ビルド成果物が配信され、ルート画面が描画されることを確認する。
// 画面遷移の本格的なE2Eは各画面チケット（T-015 以降）で追加する。
test('ルート画面が表示される', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '漢字合体ガチャ' })
  ).toBeVisible();
});
