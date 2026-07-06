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
  // 開始時に手札は自動補充される。山札を3枚に絞っているため、補充で引ききって
  // 直ちに手詰まり（結果画面）へ遷移することもある。どちらの場合でも
  // playToResult が結果画面まで到達させる。
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

  // 復習モードを開始する（にがて優先で出題）。deckMax で山札が極小のため、
  // 自動補充で直ちに結果画面へ抜けることもあるが、いずれも復習セッション開始を意味する。
  await reviewBtn.click();
  await expect(
    page
      .getByRole('button', { name: /ガチャ/ })
      .or(page.getByRole('heading', { name: '結果' }))
  ).toBeVisible();
});
