import { test, expect } from '@playwright/test';
import { startSmallDeck } from './helpers';

// T-056 演出量・読み上げ速度の設定の E2E。
//  - 「演出」トグルで舞い散る装飾（.petals）が消え、リロード後も設定が保持される
//  - 「ゆっくり」トグルが切り替わり、リロード後も保持される
// TA 終盤ビネット・TTS の実発話はブラウザ環境依存のため対象外（実装は目視/ユニットで担保）。

test('演出すくなめトグルで装飾が消え、リロード後も保持される（T-056）', async ({
  page,
}) => {
  await startSmallDeck(page);
  const effectsTog = page.getByRole('button', { name: /えんしゅつ：/ });

  // 既定は「ふつう」＝装飾あり
  await expect(effectsTog).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.game .petals')).toHaveCount(1);

  // すくなめに切替 → 装飾が即時消える
  await effectsTog.click();
  await expect(effectsTog).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.game .petals')).toHaveCount(0);

  // リロード → 再入場しても設定が保持されている（localStorage 永続化）
  await startSmallDeck(page);
  await expect(
    page.getByRole('button', { name: /えんしゅつ：/ })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.game .petals')).toHaveCount(0);
});

test('よみあげ「ゆっくり」トグルが切り替わり、リロード後も保持される（T-056）', async ({
  page,
}) => {
  await startSmallDeck(page);
  const slowTog = page.getByRole('button', { name: /よみあげ：/ });
  await expect(slowTog).toHaveAttribute('aria-pressed', 'false');
  await slowTog.click();
  await expect(slowTog).toHaveAttribute('aria-pressed', 'true');

  await startSmallDeck(page);
  await expect(
    page.getByRole('button', { name: /よみあげ：/ })
  ).toHaveAttribute('aria-pressed', 'true');
});
