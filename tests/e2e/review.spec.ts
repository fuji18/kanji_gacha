import { test, expect } from '@playwright/test';
import { playToResult } from './helpers';

// にがて漢字＆復習モードのリロード越え E2E（T-035）。
//  - 山札を絞って（?deckMax）対象字を完成しきれない状況を作り、にがて を発生させる
//  - ホームに復習モード入口が出現し、ページ再読込後も保持される
//  - 復習モードを開始するとゲーム画面に入れる（にがて優先出題）
// 決定性は `?seed=`＋出題数5字＋小さい山札（?deckMax=3）で確保する。

test('にがて漢字が記録され、復習モードで出題・リロード後も保持される（T-035）', async ({
  page,
}) => {
  // 山札を3枚に絞ると5字すべては完成できず、未完成字が にがて 登録される。
  await page.goto('/?seed=12345&deckMax=3');
  await page.getByRole('button', { name: '小学生モードをえらぶ' }).click();
  await page.getByRole('button', { name: '全学年をえらぶ' }).click();
  await page.getByRole('button', { name: '5字で開始' }).click();
  await expect(page.getByRole('button', { name: /ガチャ/ })).toBeVisible();

  // 終了（手詰まり/山札枯渇）まで進める → 未完成字が にがて として永続化される。
  await playToResult(page);

  // ホームへ戻ると復習モード入口が出る（にがて字が1つ以上）。
  await page.getByRole('button', { name: 'ホーム' }).click();
  const reviewBtn = page.getByRole('button', { name: /苦手な漢字.*復習する/ });
  await expect(reviewBtn).toBeVisible();

  // ★ 実ページ再読込（localStorage から復元）後も にがて が保持され入口が残る。
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
  await expect(reviewBtn).toBeVisible();

  // 復習モードを開始するとゲーム画面に入れる（にがて優先で出題）。
  await reviewBtn.click();
  await expect(page.getByRole('button', { name: /ガチャ/ })).toBeVisible();
});
