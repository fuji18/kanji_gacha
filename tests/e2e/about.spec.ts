import { test, expect } from '@playwright/test';

// T-021/T-053 About画面の E2E（受け入れ条件）。
//  - Home から About へ到達できる
//  - クレジット表記（実使用データ＝KANJIDIC2＋KanjiVG に整合・T-053）が掲載される
//  - CC BY-SA リンクが有効（href が正しい）
//  - プライバシー・免責・MIT・問い合わせ・バージョンが表示される（T-053）
//  - 図鑑のブラウザ依存の注意書きがある

test('Home から About に到達し、クレジット・ライセンス・保存注意が表示される', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();

  // クレジット（KANJIDIC2 / EDRDG / CC BY-SA 4.0。KRADFILE は KanjiVG 代替のため逐語から除外・T-053）
  await expect(
    page.getByText('This app uses data from KANJIDIC2')
  ).toBeVisible();
  await expect(
    page.getByText('Copyright © James William Breen and')
  ).toBeVisible();
  await expect(
    page.getByText('The Electronic Dictionary Research and Development Group')
  ).toBeVisible();
  await expect(page.getByText('Licensed under CC BY-SA 4.0')).toBeVisible();

  // KanjiVG（KRADFILE 代替）クレジット
  await expect(
    page.getByText('Ulrich Apel and contributors', { exact: false })
  ).toBeVisible();

  // localStorage のブラウザ依存注意
  await expect(page.getByText('引き継がれません')).toBeVisible();
});

test('CC BY-SA リンクが有効な href を持つ', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'About' }).click();

  await expect(
    page.locator('a[href="https://creativecommons.org/licenses/by-sa/4.0/"]')
  ).toBeVisible();
  await expect(
    page.locator('a[href="https://creativecommons.org/licenses/by-sa/3.0/"]')
  ).toBeVisible();
  await expect(
    page.locator('a[href="https://www.edrdg.org/edrdg/licence.html"]')
  ).toBeVisible();
  await expect(
    page.locator('a[href="https://kanjivg.tagaini.net/"]')
  ).toBeVisible();
});

test('プライバシー・免責・MIT・問い合わせ・バージョンが表示される（T-053）', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'About' }).click();

  // 課金なしの明記
  await expect(page.getByText('課金要素・広告はありません')).toBeVisible();
  // プライバシー（収集なし・localStorage のみ・保護者向け）
  await expect(page.getByText('収集・外部送信しません')).toBeVisible();
  await expect(page.getByText('保護者の方へ')).toBeVisible();
  // 免責事項
  await expect(page.getByText('正確性・網羅性を')).toBeVisible();
  // アプリ本体は MIT（© 2026 fuji18）
  await expect(page.getByRole('link', { name: 'MIT License' })).toBeVisible();
  // 問い合わせ先（GitHub Issues）
  await expect(
    page.locator('a[href="https://github.com/fuji18/kanji_gacha/issues"]')
  ).toBeVisible();
  // バージョン表示（vite define 注入）
  await expect(page.getByText(/© 2026 fuji18 ・ v\d+\.\d+\.\d+/)).toBeVisible();
});

test('About から戻るでホームへ', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'About' }).click();
  await page.getByRole('button', { name: '戻る' }).click();
  await expect(
    page.getByRole('heading', { name: 'モードをえらぶ' })
  ).toBeVisible();
});
