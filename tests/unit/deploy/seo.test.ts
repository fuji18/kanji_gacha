import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// 掲載メタ／配信ファイルの契約テスト（T-050）。検索・SNSシェア・PWA で必要な
// メタタグと静的ファイルの存在を固定する。

const root = process.cwd();
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

describe('index.html の SEO / OGP メタ', () => {
  it('description と canonical と theme-color がある', () => {
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]{30,}"/);
    expect(html).toMatch(
      /<link\s+rel="canonical"\s+href="https:\/\/kanji-gattai\.fujioha\.com\/"/
    );
    expect(html).toMatch(/<meta\s+name="theme-color"\s+content="#c0392b"/);
  });

  it('Open Graph（type/url/title/description/image）が揃っている', () => {
    for (const prop of [
      'og:type',
      'og:url',
      'og:title',
      'og:description',
      'og:image',
    ]) {
      expect(html).toContain(`property="${prop}"`);
    }
    expect(html).toContain('https://kanji-gattai.fujioha.com/og.png');
  });

  it('Twitter Card は summary_large_image', () => {
    expect(html).toMatch(
      /<meta\s+name="twitter:card"\s+content="summary_large_image"/
    );
  });

  it('favicon と apple-touch-icon が参照されている', () => {
    expect(html).toMatch(/rel="icon"[^>]*href="\/favicon\.svg"/);
    expect(html).toMatch(
      /rel="apple-touch-icon"[^>]*href="\/apple-touch-icon\.png"/
    );
  });
});

describe('public 配信ファイル', () => {
  it('robots.txt / sitemap.xml が存在し公開設定', () => {
    const robots = readFileSync(resolve(root, 'public/robots.txt'), 'utf8');
    expect(robots).toMatch(/User-agent:\s*\*/);
    expect(robots).toMatch(/Allow:\s*\//);
    expect(existsSync(resolve(root, 'public/sitemap.xml'))).toBe(true);
  });

  it('OGP画像とアイコンが実体として存在する', () => {
    for (const f of [
      'public/og.png',
      'public/apple-touch-icon.png',
      'public/favicon.svg',
    ]) {
      const p = resolve(root, f);
      expect(existsSync(p), `${f} が存在しない`).toBe(true);
      expect(statSync(p).size, `${f} が空`).toBeGreaterThan(0);
    }
  });
});
