import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 配信設定の契約テスト（T-049）。fujioha_platform スポークとして Cloudflare Pages に
// ルート配信するための `public/_headers` / `wrangler.toml` の必須項目を固定する。
// CI のテストはビルド前に走るため、dist ではなくソース（public/_headers）を対象にする。

const root = process.cwd();
const headers = readFileSync(resolve(root, 'public/_headers'), 'utf8');
const csp =
  headers
    .split('\n')
    .find((l) => l.includes('Content-Security-Policy:'))
    ?.split('Content-Security-Policy:')[1]
    ?.trim() ?? '';

describe('public/_headers（Cloudflare 配信ヘッダ）', () => {
  it('CSP は default-src 自己オリジン限定で、外部許可を持たない', () => {
    expect(csp).toContain("default-src 'self'");
    // 外部オリジン（https:）を許可していない＝完全自己完結
    expect(csp).not.toMatch(/https?:\/\//);
  });

  it('CSP に iframe 埋め込み禁止と base/object のロックがある', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  it('Svelte の動的 inline style 属性のため style-src に unsafe-inline を許容する', () => {
    expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
  });

  it('script-src は self のみ（インラインJSを許容しない）', () => {
    expect(csp).toMatch(/script-src[^;]*'self'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it('主要なセキュリティヘッダが揃っている', () => {
    expect(headers).toMatch(/X-Content-Type-Options:\s*nosniff/);
    expect(headers).toMatch(/Referrer-Policy:/);
    expect(headers).toMatch(/Permissions-Policy:/);
    expect(headers).toMatch(/Strict-Transport-Security:/);
  });

  it('Service Worker は no-cache、ハッシュ付きアセットは長期キャッシュ', () => {
    expect(headers).toMatch(/\/sw\.js[\s\S]*?Cache-Control:\s*no-cache/);
    expect(headers).toMatch(
      /\/assets\/\*[\s\S]*?Cache-Control:\s*public, max-age=31536000, immutable/
    );
  });
});

describe('wrangler.toml（Cloudflare Pages プロジェクト）', () => {
  const wrangler = readFileSync(resolve(root, 'wrangler.toml'), 'utf8');

  it('出力ディレクトリ dist を宣言している', () => {
    expect(wrangler).toMatch(/pages_build_output_dir\s*=\s*"\.\/dist"/);
  });

  it('プロジェクト名は kanji-gattai', () => {
    expect(wrangler).toMatch(/name\s*=\s*"kanji-gattai"/);
  });
});
