import { test, expect } from '@playwright/test';
import { playToResult } from './helpers';

// にがて漢字＆復習モードのリロード越え E2E（T-035）と、記録対象外レバーの検証（T-060）。
//
// T-060 により `?deckMax`/`?taMs` 使用時は記録対象外（にがて等を永続化しない）となったため、
// 従来の「極小山札で にがて を発生させる」方式は使えない。にがて の保持・導線は
// localStorage の事前シードで検証し、記録ロジック自体はユニットテスト
// （domain/review/srs・SessionManager persistResults）でカバーする。

// にがて漢字（林・明）を保存済みの状態。分解エントリを持つ教育漢字を選ぶ
// （復習モードの出題候補フィルタ partsForKanji.length > 0 を満たす）。
const SEEDED_STATE = JSON.stringify({
  schemaVersion: 1,
  settings: { tutorialDone: true },
  weakKanji: { 林: 3, 明: 2 },
});

test.describe('にがて漢字の保持と復習導線（シード済み状態）', () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:4173',
          localStorage: [{ name: 'kg.state.v1', value: SEEDED_STATE }],
        },
      ],
    },
  });

  test('にがて漢字があると復習導線が出て、リロード後も保持される（T-035）', async ({
    page,
  }) => {
    await page.goto('/');
    const reviewBtn = page.getByRole('button', {
      name: /苦手な漢字.*復習する/,
    });
    await expect(reviewBtn).toBeVisible();

    // ★ 実ページ再読込（localStorage から復元）後も にがて が保持され入口が残る。
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'モードをえらぶ' })
    ).toBeVisible();
    await expect(reviewBtn).toBeVisible();

    // 復習モードを開始できる（にがて優先で出題。即クリアなら結果画面も許容）。
    await reviewBtn.click();
    await expect(
      page
        .getByRole('button', { name: /ガチャ/ })
        .or(page.getByRole('heading', { name: '結果' }))
    ).toBeVisible();
  });
});

test('?deckMax 使用時は記録対象外：ベスト・にがてが更新されない（T-060）', async ({
  page,
}) => {
  // 山札3枚では5字を完成できず、通常なら未完成字が にがて 登録される条件。
  await page.goto('/?seed=12345&deckMax=3');
  await page.getByRole('button', { name: '小学生モードをえらぶ' }).click();
  await page.getByRole('button', { name: '全学年をえらぶ' }).click();
  await page.getByRole('button', { name: '5字で開始' }).click();
  await playToResult(page);

  // ホームへ戻っても、記録対象外のため復習導線は出ず、ベストも 0 のまま。
  await page.getByRole('button', { name: 'ホーム' }).click();
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /苦手な漢字.*復習する/ })
  ).toHaveCount(0);
  await expect(page.locator('.level-best').nth(0)).toHaveText('ベスト 0');
});
