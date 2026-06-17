// 掲載用の OG 画像・アイコンを生成する（T-050）。
// chromium（Playwright）で和風テンプレートをレンダリングして PNG を書き出す。
// ブランドフォント（Yuji Syuku 筆文字）を data URI で埋め込み、サブセット外の字は
// IPA ゴシックへフォールバックさせて tofu（□）を防ぐ。
//
// 使い方: node scripts/gen-assets.mjs
// 生成物: public/og.png（1200x630）, public/apple-touch-icon.png（180x180）

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fontB64 = readFileSync(
  resolve(root, 'src/ui/styles/fonts/yuji-syuku-ui.woff2')
).toString('base64');

const C = {
  washi: '#f5f1e6',
  washi2: '#eae2cf',
  sumi: '#2b2b2b',
  shu: '#c0392b',
  kin: '#b8860b',
  kinBright: '#d4af37',
};

const fontFace = `
  @font-face {
    font-family: 'YujiBrand';
    src: url('data:font/woff2;base64,${fontB64}') format('woff2');
    font-display: block;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'YujiBrand', 'IPAGothic', sans-serif; }
`;

/** 部品カード（墨で描いた札のイメージ）。 */
function chip(ch, size) {
  return `<div style="
    width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(160deg,#fff, ${C.washi2});
    border:3px solid ${C.kin};border-radius:18px;
    box-shadow:0 6px 16px rgba(43,43,43,.18);
    font-size:${Math.round(size * 0.62)}px;color:${C.sumi};line-height:1;">${ch}</div>`;
}

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}
  .stage{width:1200px;height:630px;background:
    radial-gradient(circle at 80% 18%, ${C.washi2} 0%, ${C.washi} 60%);
    position:relative;overflow:hidden;}
  .frame{position:absolute;inset:28px;border:4px solid ${C.kin};border-radius:24px;
    box-shadow:inset 0 0 0 2px ${C.kinBright};}
  .seal{position:absolute;top:64px;right:72px;width:96px;height:96px;border-radius:14px;
    background:${C.shu};color:#fff;display:flex;align-items:center;justify-content:center;
    font-size:42px;transform:rotate(-4deg);box-shadow:0 6px 14px rgba(192,57,43,.4);}
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:36px;}
  .title{font-size:128px;color:${C.sumi};letter-spacing:6px;}
  .title b{color:${C.shu};}
  .motif{display:flex;align-items:center;gap:26px;}
  .op{font-size:64px;color:${C.kin};}
  .sub{font-size:34px;color:#5c5645;letter-spacing:2px;}
  .url{position:absolute;bottom:56px;font-size:26px;color:${C.kin};letter-spacing:1px;}
</style></head><body>
  <div class="stage">
    <div class="frame"></div>
    <div class="seal">合</div>
    <div class="wrap">
      <div class="title"><b>漢字</b>合体ガチャ</div>
      <div class="motif">
        ${chip('木', 96)}<span class="op">＋</span>${chip('木', 96)}<span class="op">＝</span>${chip('林', 110)}
      </div>
      <div class="sub">パーツを集めて合体させる、漢字の学習ガチャ</div>
    </div>
    <div class="url">kanji-gattai.fujioha.com</div>
  </div>
</body></html>`;

const iconHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}
  .icon{width:512px;height:512px;background:
    radial-gradient(circle at 30% 25%, ${C.shu} 0%, #9c2c20 100%);
    display:flex;align-items:center;justify-content:center;position:relative;}
  .ring{position:absolute;inset:34px;border:10px solid ${C.kinBright};border-radius:96px;opacity:.85;}
  .ch{font-size:300px;color:#fff;line-height:1;}
</style></head><body>
  <div class="icon"><div class="ring"></div><div class="ch">合</div></div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator('.stage')
    .screenshot({ path: resolve(root, 'public/og.png') });

  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(iconHtml, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const iconBuf = await page.locator('.icon').screenshot();
  // 512 を 180（apple-touch-icon）にリサイズせず、そのまま 512 として保存しつつ
  // HTML 側で sizes を指定する（PNG リサイズ依存を避け、ツール追加を最小化）。
  writeFileSync(resolve(root, 'public/apple-touch-icon.png'), iconBuf);

  console.log('generated: public/og.png, public/apple-touch-icon.png');
} finally {
  await browser.close();
}
