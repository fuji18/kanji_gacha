<script lang="ts">
  import StrokeKanji from '../components/StrokeKanji.svelte';

  // 初回チュートリアル（T-034）。実ゲーム状態に触れない自己完結のガイド付き1問
  // （木＋木＝林）。部品を2つ選ぶ→合体！→完成、の流れを手取り足取りで体験させる。
  // 完了/スキップで `ondone` を通知（呼び出し側が tutorialDone を永続化する）。
  // 見た目は handoff design「App Screens Wafu」の藍夜テーマ（青海波・進捗ドット・大アイコン円・朱3Dボタン）。
  interface Props {
    ondone: () => void;
  }
  let { ondone }: Props = $props();

  const reducedMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 0:導入 / 1:部品を2つ選ぶ / 2:合体！を押す / 3:完成・読み/意味 / 4:完了
  let step = $state(0);
  let pickedKi = $state(0); // 「木」を選んだ数（2でステップ進行）

  // 進捗ドット（5段階）。design の上部インジケータ。
  const dots = [0, 1, 2, 3, 4];

  function pickKi(): void {
    if (step !== 1 || pickedKi >= 2) return;
    pickedKi += 1;
    if (pickedKi >= 2) step = 2;
  }
  function doCombine(): void {
    if (step !== 2) return;
    step = 3;
  }
</script>

<div
  class="tutorial-backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="あそびかた"
>
  <div class="card">
    <button type="button" class="skip" onclick={ondone}>スキップ</button>

    <div class="dots" aria-hidden="true">
      {#each dots as d (d)}
        <span class="dot" class:on={d <= step}></span>
      {/each}
    </div>
    <p class="step-counter">あそびかた {step + 1} / 5</p>

    <div class="stage">
      {#if step === 0}
        <div class="icon-circle">🎴</div>
        <h2>あそびかた</h2>
        <p class="body">
          ぶひんを 2つ えらんで「合体！」すると かんじが できるよ。<br
          />れんしゅうで「木＋木＝林」を つくってみよう。
        </p>
        <button type="button" class="primary" onclick={() => (step = 1)}
          >つぎへ</button
        >
      {:else if step === 1}
        <div class="icon-circle">👆</div>
        <h2>カードを2枚えらぶ</h2>
        <p class="body">「木」を 2つ タップしてね（{pickedKi}/2）</p>
        <div class="parts">
          {#each [0, 1] as i (i)}
            <button
              type="button"
              class="tile"
              class:selected={i < pickedKi}
              disabled={i < pickedKi}
              aria-label="木をえらぶ"
              onclick={pickKi}
            >
              {#if i < pickedKi}<span class="tile-order">{i + 1}</span>{/if}木
            </button>
          {/each}
        </div>
      {:else if step === 2}
        <div class="icon-circle char">合</div>
        <h2>「合体！」でつくる</h2>
        <p class="body">いいね！下の「合体！」を おそう</p>
        <div class="parts">
          <span class="tile selected">木</span>
          <span class="plus">＋</span>
          <span class="tile selected">木</span>
        </div>
        <button type="button" class="primary" onclick={doCombine}>合体！</button
        >
      {:else if step === 3}
        <h2>できた！</h2>
        <div class="result">
          <StrokeKanji char="林" size={92} {reducedMotion} />
          <div class="meta">
            <span class="yomi">はやし／リン</span>
            <span class="mean">林（woods）・8画</span>
          </div>
        </div>
        <button type="button" class="primary" onclick={() => (step = 4)}
          >つぎへ</button
        >
      {:else}
        <div class="icon-circle">📖</div>
        <h2>じゅんびOK！</h2>
        <p class="body">
          つくった漢字は図鑑に集まるよ。ヒントも つかえる。はじめよう！
        </p>
        <button type="button" class="primary" onclick={ondone}>はじめる</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .tutorial-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(8, 12, 26, 0.62);
    padding: 1rem;
  }
  /* 藍夜の札（青海波の地紋を repeating-radial で軽量に再現）。 */
  .card {
    position: relative;
    width: min(22rem, 92vw);
    color: #f5f1e6;
    background:
      repeating-radial-gradient(
        circle at 50% 100%,
        transparent 0 17px,
        rgba(212, 175, 55, 0.06) 17px 18px
      ),
      linear-gradient(180deg, #34467a, #1c2848 70%, #141d36);
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: var(--md-sys-shape-corner-large);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
    padding: 1.5rem 1.3rem 1.4rem;
    text-align: center;
    overflow: hidden;
  }
  .dots {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }
  .dot {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: rgba(159, 176, 224, 0.3);
    transition: background 0.2s ease;
  }
  .dot.on {
    background: var(--kg-color-gold-bright);
  }
  .step-counter {
    margin: 0 0 1rem;
    font-size: 0.75rem;
    letter-spacing: 0.14em;
    color: #aeb8d8;
    text-align: left;
  }
  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    min-height: 17rem;
    justify-content: center;
  }
  .icon-circle {
    width: 7rem;
    height: 7rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3.2rem;
    background: rgba(212, 175, 55, 0.1);
    border: 1.5px solid rgba(212, 175, 55, 0.35);
  }
  .icon-circle.char {
    font-family: var(--md-ref-typeface-brand);
    color: var(--kg-color-gold-bright);
    font-size: 3rem;
  }
  h2 {
    font-family: var(--md-ref-typeface-brand);
    font-size: 1.4rem;
    font-weight: 800;
    margin: 0;
    color: #f5f1e6;
  }
  .body {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.8;
    color: #cdd4e8;
    max-width: 17rem;
  }
  .parts {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    justify-content: center;
    margin: 0.2rem 0;
  }
  .plus {
    font-weight: 700;
    color: #aeb8d8;
  }
  .tile {
    position: relative;
    width: 3.4rem;
    height: 4.2rem;
    font-family: var(--md-ref-typeface-kanji);
    font-size: 1.8rem;
    color: #f5f1e6;
    border: 2px solid rgba(159, 176, 224, 0.4);
    border-radius: var(--md-sys-shape-corner-medium);
    background: linear-gradient(160deg, #26314f, #19213a);
    cursor: pointer;
  }
  .tile.selected {
    border-color: var(--kg-color-gold-bright);
    background: linear-gradient(160deg, #33406a, #212a4a);
    box-shadow: 0 0 16px rgba(212, 175, 55, 0.4);
  }
  .tile-order {
    position: absolute;
    top: 3px;
    left: 4px;
    min-width: 1rem;
    height: 1rem;
    padding: 0 0.2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--md-ref-typeface-brand);
    font-size: 0.65rem;
    font-weight: 700;
    color: #241a08;
    background: var(--kg-color-gold-bright);
    border-radius: var(--md-sys-shape-corner-full);
  }
  .result {
    display: flex;
    gap: 0.9rem;
    align-items: center;
    justify-content: center;
    padding: 0.8rem 1rem;
    border-radius: var(--md-sys-shape-corner-medium);
    background: rgba(8, 12, 26, 0.4);
    border: 1px solid rgba(212, 175, 55, 0.3);
  }
  /* 完成字の筆順は明色で見せるため、StrokeKanji の継承色を白系に。 */
  .result :global(svg) {
    color: #f5f1e6;
  }
  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .yomi {
    color: #cdd4e8;
  }
  .mean {
    color: #aeb8d8;
    font-size: 0.85rem;
  }
  /* 朱の3Dボタン（design の box-shadow:0 4px 0）。 */
  .primary {
    margin-top: 0.3rem;
    min-height: 3rem;
    padding: 0 1.6rem;
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    font-size: 1.05rem;
    color: #fff3e4;
    background: linear-gradient(
      180deg,
      var(--kg-color-vermilion-bright),
      var(--kg-color-vermilion-deep)
    );
    border: none;
    border-radius: var(--md-sys-shape-corner-medium);
    box-shadow: 0 4px 0 #7d2c1c;
    cursor: pointer;
  }
  .primary:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 #7d2c1c;
  }
  .primary:focus-visible,
  .tile:focus-visible,
  .skip:focus-visible {
    outline: 3px solid var(--kg-color-gold-bright);
    outline-offset: 2px;
  }
  .skip {
    position: absolute;
    top: 0.5rem;
    right: 0.7rem;
    z-index: 2;
    background: none;
    border: none;
    color: #aeb8d8;
    font-size: 0.8rem;
    cursor: pointer;
  }
  @media (prefers-reduced-motion: reduce) {
    .dot,
    .primary {
      transition: none;
    }
  }
</style>
