import { expect, type Page } from '@playwright/test';

// 達成型（小学生/大人モード・山札）の E2E 共通ヘルパー。
// 部品はシャッフルされるため、合体可能な組が揃うまで引く/捨てるを循環して決定化する。
// 出題数を小さく（5字）して終了（全完成 or 手詰まり）に短時間で到達させる。

/** 小学生モード・全学年・出題数5字で開始する（seed で抽選を固定）。 */
export async function startSmallDeck(page: Page, seed = 12345): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.getByRole('button', { name: '小学生モードをえらぶ' }).click();
  await page.getByRole('button', { name: '全学年をえらぶ' }).click();
  await page.getByRole('button', { name: '5字で開始' }).click();
  await expect(page.getByRole('button', { name: /ガチャ/ })).toBeVisible();
}

/** 合体を1回成立させる（最初の合体は重複にならない）。成立したら true。 */
export async function combineOnce(page: Page): Promise<boolean> {
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  const hintBtn = page.getByRole('button', { name: 'ヒント' });
  const result = page.getByRole('heading', { name: '結果' });
  for (let i = 0; i < 80; i++) {
    if (await result.isVisible()) return false;
    if (await gacha.isEnabled()) await gacha.click();
    await hintBtn.click();
    const hinted = page.locator('.chip[data-hinted="true"]');
    const n = await hinted.count();
    if (n >= 2) {
      for (let j = 0; j < n; j++) await hinted.nth(j).click();
      await page.getByRole('button', { name: '合体！' }).click();
      return true;
    }
    if ((await page.locator('.chip').count()) >= 12) {
      await page.locator('.chip').first().click();
      await page.getByRole('button', { name: '捨てて引き直す' }).click();
    }
  }
  return false;
}

/** 山札を引き、合体（重複は捨てて循環）を繰り返し、達成型を終了（結果画面）まで進める。 */
export async function playToResult(page: Page): Promise<void> {
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  const hintBtn = page.getByRole('button', { name: 'ヒント' });
  const discardBtn = page.getByRole('button', { name: '捨てて引き直す' });
  const feedback = page.getByTestId('feedback');
  const result = page.getByRole('heading', { name: '結果' });
  for (let i = 0; i < 300; i++) {
    if (await result.isVisible()) return;
    while (
      (await page.locator('.chip').count()) < 12 &&
      (await gacha.isEnabled())
    ) {
      await gacha.click();
    }
    if (await result.isVisible()) return;
    await hintBtn.click();
    const hinted = page.locator('.chip[data-hinted="true"]');
    const n = await hinted.count();
    if (n >= 2) {
      for (let j = 0; j < n; j++) await hinted.nth(j).click();
      await page.getByRole('button', { name: '合体！' }).click();
      // 合体でクリア→結果画面に遷移していたら終了（GameScreen は消えている）。
      if (await result.isVisible()) return;
      // 既出（重複）なら手札を1枚捨てて循環させる
      if ((await feedback.textContent()) === 'もう作ったよ') {
        const chip = page.locator('.chip').first();
        if (await chip.count()) {
          await chip.click();
          await discardBtn.click();
        }
      }
    } else {
      const chip = page.locator('.chip').first();
      if ((await chip.count()) === 0) break;
      await chip.click();
      await discardBtn.click();
    }
  }
  await expect(result).toBeVisible();
}
