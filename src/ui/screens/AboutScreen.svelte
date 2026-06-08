<script lang="ts">
  import { navigate } from '../../app/stores/routeStore';
  // About 画面（T-021 / PRD F10）。データ出典のクレジットを常設表示する（CC BY-SA 継承）。
  // 静的表示のみ（SessionManager 不要）。文言は整理書6.1 雛形＋実データ（KanjiVG）に整合。
  const CC_BY_SA_4 = 'https://creativecommons.org/licenses/by-sa/4.0/';
  const CC_BY_SA_3 = 'https://creativecommons.org/licenses/by-sa/3.0/';
  const EDRDG_LICENSE = 'https://www.edrdg.org/edrdg/licence.html';
  const KANJIVG = 'https://kanjivg.tagaini.net/';
</script>

<section class="screen about">
  <h2>About</h2>

  <p class="intro">漢字合体ガチャ — 部品を集めて漢字を合体させる学習ゲーム。</p>

  <section class="block">
    <h3>データ出典・クレジット</h3>
    <!-- 整理書6.1 のクレジット雛形（逐語） -->
    <p class="credit">
      This app uses data from KANJIDIC2 and KRADFILE<br />
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
      です。アプリ本体のコードはこの限りではありません。
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
    <button type="button" onclick={() => navigate('home')}>戻る</button>
  </nav>
</section>

<style>
  .intro {
    color: #444;
  }
  .block {
    margin: 1rem 0;
    text-align: left;
  }
  .block h3 {
    font-size: 0.95rem;
    color: #555;
    margin: 0 0 0.4rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.2rem;
  }
  .credit {
    font-size: 0.85rem;
    line-height: 1.6;
    background: #fafafa;
    border: 1px solid #eee;
    border-radius: 0.4rem;
    padding: 0.6rem 0.8rem;
  }
  .notice {
    font-size: 0.85rem;
    color: #555;
  }
  a {
    color: #1565c0;
    word-break: break-all;
  }
</style>
