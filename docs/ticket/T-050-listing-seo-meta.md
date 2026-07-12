# T-050: 掲載向け SEO / OGP / メタ整備

| 項目 | 値 |
|---|---|
| フェーズ | Phase 8 |
| 優先度 | P1 |
| 依存 | T-049 |
| 関連 | fujioha_platform `docs/post-launch-checklist.md` / docs/ideas/fujioha-platform掲載スポーク作成プロンプト.md |

## 背景
現状 `index.html` は `<title>` と `lang` のみで、description / OGP / canonical / favicon /
theme-color が無い。プラットフォームの品質バー（Lighthouse SEO 90+・OGP 確認）を満たさない。

## 目的
掲載リンク（ハブからの外部リンク）でシェア・検索された際に適切に表示され、
Lighthouse 4項目 90+ を満たす。

## スコープ（実装する）
- `index.html` に追加: meta description、canonical、OGP(og:title/og:description/og:image/og:type/og:url)、
  Twitter Card、favicon link、theme-color。
- `public/robots.txt` を追加（本番向け）。
- OGP/サムネ用の静的画像を `public/` に用意（後述 T-051 のカタログサムネと共用可）。
- manifest の `name`/`short_name`/`theme_color`/`description` をゲーム実体に合わせて見直し。

## 受け入れ条件
- [ ] `index.html` に description / canonical / OGP / favicon / theme-color が入っている
- [ ] `public/robots.txt` が配信される
- [ ] Lighthouse の Performance / Accessibility / Best Practices / SEO すべて 90+
- [ ] OGP デバッガ等でタイトル・説明・画像が意図どおり

## スコープ外
- sitemap.xml の動的生成（SPA1ページのため任意）

## テスト
- ビルド後HTMLに各メタが存在することを E2E/スナップショットで確認
- Lighthouse をローカルまたはCIで計測

## 完了の定義 (DoD)
- [ ] 掲載リンク経由でシェアした際のカード表示が正しい
- [ ] Lighthouse 90+ を満たす
