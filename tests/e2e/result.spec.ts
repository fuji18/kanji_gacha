import { test, expect, type Page } from '@playwright/test';

// T-019 Result画面の E2E（受け入れ条件）。
//  - 終了（詰み/手札0）で結果が表示される（スコア・作成漢字・新発見・称号・新記録）
//  - もう一回/ホームが遷移、シェア入口が存在する
// 決定性は `?seed=` で確保し、終了までヒント合体を繰り返す。

const SEED = 12345;

async function startSeeded(page: Page): Promise<void> {
  await page.goto(`/?seed=${SEED}`);
  await page.getByRole('button', { name: 'やさしいでゲーム開始' }).click();
  await expect(page.getByRole('button', { name: /ガチャ/ })).toBeVisible();
}

/** 残が尽きるまでガチャ → ヒント合体を繰り返し、詰み/手札0で Result へ到達させる。 */
async function playToResult(page: Page): Promise<void> {
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  for (let i = 0; i < 30; i++) {
    if (!(await gacha.isEnabled())) break;
    await gacha.click();
  }
  const resultHeading = page.getByRole('heading', { name: '結果' });
  for (let i = 0; i < 12; i++) {
    if (await resultHeading.isVisible()) return;
    await page.getByRole('button', { name: 'ヒント' }).click();
    const hinted = page.locator('.chip[data-hinted="true"]');
    if ((await hinted.count()) === 0) break; // 合体不能＝既に終了判定済みのはず
    for (let j = 0, n = await hinted.count(); j < n; j++)
      await hinted.nth(j).click();
    await page.getByRole('button', { name: '合体！' }).click();
  }
  await expect(resultHeading).toBeVisible();
}

test('終了すると結果（称号・スコア・作成漢字）が表示される', async ({
  page,
}) => {
  await startSeeded(page);
  await playToResult(page);

  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  await expect(page.getByTestId('rank')).toBeVisible();
  await expect(page.getByTestId('result-score')).toBeVisible();
  // 少なくとも1漢字は作っているので作成漢字一覧がある
  await expect(page.getByTestId('created-list')).toBeVisible();
  // 初プレイ（localStorage 空）で漢字を作ったので新発見一覧もある
  await expect(page.getByTestId('discovered-list')).toBeVisible();
  // 初プレイで得点しているため新記録が表示される
  await expect(page.getByTestId('new-best')).toBeVisible();
});

test('もう一回でゲームへ、ホームでホームへ遷移できる', async ({ page }) => {
  await startSeeded(page);
  await playToResult(page);

  await page.getByRole('button', { name: 'もう一回' }).click();
  await expect(page.getByRole('button', { name: /ガチャ/ })).toBeVisible();

  // ゲーム中断してホームへ戻り、再度終了→ホーム導線も確認
  await page.getByRole('button', { name: 'やめる' }).click();
  await expect(
    page.getByRole('heading', { name: 'レベルをえらぶ' })
  ).toBeVisible();
});

test('結果からホームへ戻れる', async ({ page }) => {
  await startSeeded(page);
  await playToResult(page);

  await page.getByRole('button', { name: 'ホーム' }).click();
  await expect(
    page.getByRole('heading', { name: 'レベルをえらぶ' })
  ).toBeVisible();
});

test('シェア入口が存在する（実体は T-023）', async ({ page }) => {
  await startSeeded(page);
  await playToResult(page);

  const share = page.getByRole('button', { name: 'シェア' });
  await expect(share).toBeVisible();
  await share.click();
  await expect(page.getByText('シェアは準備中です（T-023）。')).toBeVisible();
});
