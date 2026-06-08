import { test, expect, type Page } from '@playwright/test';

// T-017 Game画面の E2E（受け入れ条件）。
//  - ガチャ→手札増・残減・スコア/コンボ/残の表示更新
//  - 残0でガチャ非活性
//  - 合体成功でスコア加算・コンボ前進／ミスでコンボリセット
// 合体の決定性は `?seed=` （フリーRNGの固定）＋ ヒント（有効な組を返す）で担保する。

const SEED = 12345;

/** 残が尽きる（または引けなくなる）までガチャを引く。 */
async function pullUntilEmpty(page: Page): Promise<void> {
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  // 残10回。上限は安全のため 30 回でカット。
  for (let i = 0; i < 30; i++) {
    if (!(await gacha.isEnabled())) break;
    await gacha.click();
  }
}

/**
 * n 回ガチャを引く（残を1以上残す）。残0にすると合体後に詰み/手札0で Result へ自動遷移し得るため、
 * 合体の検証は残≥1 を保って Game 画面に留める。
 */
async function pull(page: Page, n: number): Promise<void> {
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  for (let i = 0; i < n; i++) {
    if (!(await gacha.isEnabled())) break;
    await gacha.click();
  }
}

/** ヒントが示す組を選択する（光った部品をすべてクリック）。 */
async function selectHinted(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'ヒント' }).click();
  const hinted = page.locator('.chip[data-hinted="true"]');
  await expect(hinted.first()).toBeVisible();
  for (let i = 0, n = await hinted.count(); i < n; i++)
    await hinted.nth(i).click();
}

async function startSeeded(page: Page): Promise<void> {
  await page.goto(`/?seed=${SEED}`);
  await page.getByRole('button', { name: 'やさしいでゲーム開始' }).click();
  await expect(page.getByRole('button', { name: /ガチャ/ })).toBeVisible();
}

test('ガチャで手札が増え、ガチャ残が減り、スコア表示がある', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'やさしいでゲーム開始' }).click();

  await expect(page.getByTestId('score')).toHaveText('0');
  const remainingBefore = await page
    .getByTestId('gacha-remaining')
    .textContent();

  await page.getByRole('button', { name: /ガチャ/ }).click();
  await expect(page.locator('.chip')).toHaveCount(1);

  await page.getByRole('button', { name: /ガチャ/ }).click();
  await expect(page.locator('.chip')).toHaveCount(2);

  const remainingAfter = await page
    .getByTestId('gacha-remaining')
    .textContent();
  expect(Number(remainingAfter)).toBeLessThan(Number(remainingBefore));
});

test('ガチャ残が尽きるとガチャボタンが非活性になる', async ({ page }) => {
  await startSeeded(page);
  await pullUntilEmpty(page);
  await expect(page.getByTestId('gacha-remaining')).toHaveText('0');
  await expect(page.getByRole('button', { name: /ガチャ/ })).toBeDisabled();
});

test('ヒントの組を合体すると成功し、スコアとコンボが前進する', async ({
  page,
}) => {
  await startSeeded(page);
  await pull(page, 9); // 残1を保ち、合体後の自動終了を避ける

  await selectHinted(page);
  await page.getByRole('button', { name: '合体！' }).click();

  // スコア加算（>0）・コンボ前進（×1.5）
  await expect(page.getByTestId('score')).not.toHaveText('0');
  await expect(page.getByTestId('combo')).toContainText('×1.5');
});

test('演出：Game に Canvas レイヤーがあり、合体成功でスコアフロート（読み/意味）が出る', async ({
  page,
}) => {
  await startSeeded(page);
  // 合体成功の Canvas 演出レイヤーが存在する
  await expect(page.locator('canvas.fx-layer')).toBeAttached();

  await pull(page, 9);
  await selectHinted(page);
  await page.getByRole('button', { name: '合体！' }).click();

  // スコアフロート（漢字＋スコア）が DOM で表示される（次操作まで残す設計）
  const float = page.getByTestId('score-float');
  await expect(float).toBeVisible();
  await expect(float).toContainText('+');
});

test('捨てて引き直すで手札枚数が変わらない（やさしい＝コスト0）', async ({
  page,
}) => {
  await startSeeded(page);
  await pull(page, 3);
  await expect(page.locator('.chip')).toHaveCount(3);
  const remaining = await page.getByTestId('gacha-remaining').textContent();

  await page.locator('.chip').first().click(); // 1枚選択
  await page.getByRole('button', { name: '捨てて引き直す' }).click();

  await expect(page.locator('.chip')).toHaveCount(3); // 削除1＋補充1で不変
  // やさしいはコスト0・補充は通常ガチャ残を消費しない
  await expect(page.getByTestId('gacha-remaining')).toHaveText(remaining ?? '');
});

test('合体ミスでコンボがリセットされる', async ({ page }) => {
  await startSeeded(page);
  await pull(page, 9);

  // まず1回成功させてコンボを ×1.5 にする
  await selectHinted(page);
  await page.getByRole('button', { name: '合体！' }).click();
  await expect(page.getByTestId('combo')).toContainText('×1.5');

  // 手札全体を選んで合体すると、その組み合わせは辞書に無く必ずミス → コンボ ×1.0
  const chips = page.locator('.chip');
  for (let i = 0, n = await chips.count(); i < n; i++)
    await chips.nth(i).click();
  await page.getByRole('button', { name: '合体！' }).click();

  await expect(page.getByTestId('combo')).toContainText('×1.0');
});
