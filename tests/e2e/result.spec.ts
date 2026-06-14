import { test, expect, type Page } from '@playwright/test';

// T-019 Result画面の E2E（受け入れ条件）。
//  - 終了（詰み/手札0）で結果が表示される（スコア・作成漢字・新発見・称号・新記録）
//  - もう一回/ホームが遷移、シェア（T-023：Web Share / クリップボードフォールバック）が機能する
// 決定性は `?seed=` で確保し、終了までヒント合体を繰り返す。

const SEED = 12345;
// 達成型（deck）の山札は大きいので、E2E では `?deckMax` で短縮して終了（deck_empty）に到達させる。
const DECK_MAX = 30;

async function startSeeded(page: Page): Promise<void> {
  await page.goto(`/?seed=${SEED}&deckMax=${DECK_MAX}`);
  await page.getByRole('button', { name: 'やさしいでゲーム開始' }).click();
  await expect(page.getByRole('button', { name: /ガチャ/ })).toBeVisible();
}

/** 山札を引き、合体可能なら合体・不能なら1枚捨てて循環し、山札枯渇＋手詰まりで Result へ到達させる。 */
async function playToResult(page: Page): Promise<void> {
  const gacha = page.getByRole('button', { name: /ガチャ/ });
  const resultHeading = page.getByRole('heading', { name: '結果' });
  for (let i = 0; i < 200; i++) {
    if (await resultHeading.isVisible()) return;
    // 手札を上限まで（または山札が尽きるまで）補充する。
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

// シェア文面の書式（T-023 / F11）。レベルは startSeeded＝やさしい固定。
const SHARE_TEXT_RE =
  /^漢字合体ガチャ｜やさしい｜スコア\d+｜作った字：.+ #漢字合体ガチャ$/;

test('Web Share API 対応端末では共有シートが出る（T-023 / F11）', async ({
  page,
}) => {
  // navigator.share を注入し、呼び出しと受領文面を捕捉する。
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: string[] };
    w.__shared = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data: { text?: string }) => {
        w.__shared.push(data.text ?? '');
        return Promise.resolve();
      },
    });
  });
  await startSeeded(page);
  await playToResult(page);

  await page.getByRole('button', { name: 'シェア' }).click();
  const shared = await page.evaluate(
    () => (window as unknown as { __shared: string[] }).__shared
  );
  expect(shared).toHaveLength(1);
  expect(shared[0]).toMatch(SHARE_TEXT_RE);
});

test('Web Share 非対応ではクリップボードコピーにフォールバックする（T-023）', async ({
  page,
}) => {
  // share を無効化し、clipboard.writeText で受領文面を捕捉（ヘッドレスの権限差異を回避）。
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    const w = window as unknown as { __copied: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (t: string) => {
          w.__copied.push(t);
          return Promise.resolve();
        },
      },
    });
  });
  await startSeeded(page);
  await playToResult(page);

  await page.getByRole('button', { name: 'シェア' }).click();
  await expect(
    page.getByText('クリップボードにコピーしました。')
  ).toBeVisible();
  const copied = await page.evaluate(
    () => (window as unknown as { __copied: string[] }).__copied
  );
  expect(copied).toHaveLength(1);
  expect(copied[0]).toMatch(SHARE_TEXT_RE);
});
