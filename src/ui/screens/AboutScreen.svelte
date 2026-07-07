<script lang="ts">
  import { navigate } from '../../app/stores/routeStore';
  import MaterialButton from '../components/MaterialButton.svelte';
  import Petals from '../components/Petals.svelte';
  // About 画面（T-021 / PRD F10・T-053）。データ出典のクレジットに加え、
  // プライバシー・免責・ライセンス（MIT）・問い合わせ先を常設表示する（保護者が確認できる形）。
  // 静的表示のみ（SessionManager 不要）。文言は整理書6.1 雛形＋実データ（KanjiVG）に整合。
  const CC_BY_SA_4 = 'https://creativecommons.org/licenses/by-sa/4.0/';
  const CC_BY_SA_3 = 'https://creativecommons.org/licenses/by-sa/3.0/';
  const EDRDG_LICENSE = 'https://www.edrdg.org/edrdg/licence.html';
  const KANJIVG = 'https://kanjivg.tagaini.net/';
  const OFL_FAQ = 'https://scripts.sil.org/OFL';
  const ISSUES = 'https://github.com/fuji18/kanji_gacha/issues';
  const MIT = 'https://opensource.org/license/mit';
  // アプリバージョン（vite define で package.json から注入・T-053）。
  const APP_VERSION = __APP_VERSION__;
</script>

<section class="screen about">
  <Petals />
  <h2>About</h2>

  <p class="intro">漢字合体ガチャ — 部品を集めて漢字を合体させる学習ゲーム。</p>

  <p class="notice">
    本アプリは無料です。課金要素・広告はありません（「ガチャ」はゲーム内の演出で、
    お金はかかりません）。
  </p>

  <section class="block">
    <h3>データ出典・クレジット</h3>
    <!-- 整理書6.1 の雛形を実使用データに整合（KRADFILE は KanjiVG で代替のため逐語から除外・T-053） -->
    <p class="credit">
      This app uses data from KANJIDIC2<br />
      Copyright © James William Breen and<br />
      The Electronic Dictionary Research and Development Group<br />
      Licensed under CC BY-SA 4.0<br />
      <a href={EDRDG_LICENSE} target="_blank" rel="noopener noreferrer"
        >{EDRDG_LICENSE}</a
      >
    </p>
    <p class="credit">
      部品分解は KanjiVG © Ulrich Apel and contributors（CC BY-SA 3.0）を
      KRADFILE の代替として使用しています。<br />
      <a href={KANJIVG} target="_blank" rel="noopener noreferrer">{KANJIVG}</a>
    </p>
  </section>

  <section class="block">
    <h3>ライセンス</h3>
    <p>
      本アプリの辞書データ・自作の合体辞書は、上記 CC BY-SA
      データの二次的著作物であり、 継承（ShareAlike）義務により
      <a href={CC_BY_SA_4} target="_blank" rel="noopener noreferrer"
        >Creative Commons 表示-継承 4.0 国際（CC BY-SA 4.0）</a
      >
      で提供します。KanjiVG 由来部分の原ライセンスは
      <a href={CC_BY_SA_3} target="_blank" rel="noopener noreferrer"
        >CC BY-SA 3.0</a
      >
      です。アプリ本体のソースコードは
      <a href={MIT} target="_blank" rel="noopener noreferrer">MIT License</a>
      （© 2026 fuji18）で提供します。
    </p>
  </section>

  <section class="block">
    <h3>プライバシー</h3>
    <p class="notice">
      本アプリは、個人情報・プレイ履歴などのデータを<strong
        >収集・外部送信しません</strong
      >
      （アクセス解析・広告トラッキングは使用していません）。Cookie も使用しません。
      図鑑・ベストスコア・設定は、お使いのブラウザ内（localStorage）にのみ保存され、
      ブラウザの設定からいつでも削除できます。なお、配信基盤（Cloudflare Pages）で技術的なアクセスログが発生する場合があります。
    </p>
    <p class="notice">
      保護者の方へ：本アプリに課金・広告・チャット機能・外部へのデータ送信はありません。
      安心してお子さまにお使いいただけます。
    </p>
  </section>

  <section class="block">
    <h3>免責事項</h3>
    <p class="notice">
      漢字の読み・意味・部品分解は辞書データに基づいており、その正確性・網羅性を
      保証するものではありません。学習の際は教科書等を優先してください。
      本アプリの利用により生じたいかなる損害についても、開発者は責任を負いません。
      リンク先の外部サイトの内容についても責任を負いません。
    </p>
  </section>

  <section class="block">
    <h3>お問い合わせ</h3>
    <p class="notice">
      不具合の報告・データ出典に関するご指摘は GitHub Issues
      までお寄せください。<br />
      <a href={ISSUES} target="_blank" rel="noopener noreferrer">{ISSUES}</a>
    </p>
  </section>

  <section class="block">
    <h3>フォント</h3>
    <p class="credit">
      ボタン・見出し等の筆文字フォントに Yuji Syuku（The Yuji Project
      Authors）の 一部文字を抜粋したサブセットを同梱しています。<br />
      Licensed under the SIL Open Font License, Version 1.1<br />
      <a href={OFL_FAQ} target="_blank" rel="noopener noreferrer">{OFL_FAQ}</a>
    </p>
  </section>

  <section class="block">
    <h3>データの保存について</h3>
    <p class="notice">
      図鑑・ベストスコアはお使いのブラウザ（localStorage）に保存されます。
      ブラウザのデータ消去やシークレットモード、別の端末・ブラウザでは引き継がれません。
    </p>
  </section>

  <nav class="actions">
    <MaterialButton
      variant="outlined"
      color="secondary"
      block
      onclick={() => navigate('home')}>戻る</MaterialButton
    >
  </nav>

  <footer class="app-meta">© 2026 fuji18 ・ v{APP_VERSION}</footer>
</section>

<style>
  .about h2 {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-headline-size);
    color: var(--md-sys-color-on-surface);
  }
  .intro {
    color: var(--md-sys-color-on-surface-variant);
  }
  .block {
    margin: 1rem 0;
    text-align: left;
  }
  .block h3 {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-body-size);
    color: var(--md-sys-color-on-surface);
    margin: 0 0 0.4rem;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    padding-bottom: 0.2rem;
  }
  .credit {
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container-low);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-small);
    padding: 0.6rem 0.8rem;
  }
  .notice {
    font-size: 0.85rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .app-meta {
    margin-top: 1rem;
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
  }
  a {
    color: var(--md-sys-color-secondary);
    word-break: break-all;
  }
</style>
