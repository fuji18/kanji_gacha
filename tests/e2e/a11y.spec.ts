import { test, expect } from '@playwright/test';
import { startSmallDeck } from './helpers';

// T-054 アクセシビリティ即効改善の E2E。
//  - キーボードのみ（focus + Enter）でヒント→選択→合体が完了できる
//  - Tab 操作でフォーカス位置が可視（グローバル :focus-visible リング）

test('キーボードのみでヒント→選択→合体ができる（T-054）', async ({ page }) => {
  await startSmallDeck(page);
  const hintBtn = page.getByRole('button', { name: 'ヒント' });
  const result = page.getByRole('heading', { name: '結果' });

  for (let i = 0; i < 40; i++) {
    if (await result.isVisible()) break;
    await hintBtn.focus();
    await page.keyboard.press('Enter');
    const hinted = page.locator('.chip[data-hinted="true"]');
    const n = await hinted.count();
    if (n >= 2) {
      for (let j = 0; j < n; j++) {
        await hinted.nth(j).focus();
        await page.keyboard.press('Enter');
      }
      const combineBtn = page.getByRole('button', { name: '合体！' });
      await combineBtn.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('score')).not.toHaveText('0');
      return;
    }
    // 揃わなければキーボード操作で1枚交換して引き直す
    const chip = page.locator('.chip').first();
    await chip.focus();
    await page.keyboard.press('Enter');
    const exchangeBtn = page.getByRole('button', { name: '交換' });
    await exchangeBtn.focus();
    await page.keyboard.press('Enter');
  }
  throw new Error('キーボード操作で合体に到達できませんでした');
});

test('Tab フォーカスが可視リングを持つ（T-054 / WCAG 2.4.7）', async ({
  page,
}) => {
  await page.goto('/');
  // アプリは辞書ロード後に非同期マウントされるため、描画を待ってから Tab する
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
  // キーボード発火の focus-visible を成立させるため Tab でフォーカス移動する
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === document.body) return 'none';
    const cs = getComputedStyle(el);
    return `${cs.outlineStyle} ${cs.outlineWidth}`;
  });
  expect(outline).toContain('solid');
});
