<script lang="ts">
  import StrokeKanji from '../components/StrokeKanji.svelte';

  // 初回チュートリアル（T-034）。実ゲーム状態に触れない自己完結のガイド付き1問
  // （木＋木＝林）。部品を2つ選ぶ→合体！→完成、の流れを手取り足取りで体験させる。
  // 完了/スキップで `ondone` を通知（呼び出し側が tutorialDone を永続化する）。
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

    {#if step === 0}
      <h2>あそびかた</h2>
      <p>ぶひんを 2つ えらんで「合体！」すると かんじが できるよ。</p>
      <p class="lead">れんしゅうで「木＋木＝林」を つくってみよう。</p>
      <button type="button" class="next" onclick={() => (step = 1)}
        >つぎへ</button
      >
    {:else if step === 1}
      <p class="lead">「木」を 2つ タップしてね（{pickedKi}/2）</p>
      <div class="parts">
        {#each [0, 1] as i (i)}
          <button
            type="button"
            class="chip"
            class:selected={i < pickedKi}
            disabled={i < pickedKi}
            aria-label="木をえらぶ"
            onclick={pickKi}>木</button
          >
        {/each}
      </div>
    {:else if step === 2}
      <p class="lead">いいね！「合体！」を おそう</p>
      <div class="parts">
        <span class="chip selected">木</span>
        <span class="plus">＋</span>
        <span class="chip selected">木</span>
      </div>
      <button type="button" class="combine" onclick={doCombine}>合体！</button>
    {:else if step === 3}
      <p class="lead">できた！</p>
      <div class="result">
        <StrokeKanji char="林" size={84} {reducedMotion} />
        <div class="meta">
          <span class="yomi">はやし／リン</span>
          <span class="mean">林（woods）・8画</span>
        </div>
      </div>
      <button type="button" class="next" onclick={() => (step = 4)}
        >つぎへ</button
      >
    {:else}
      <h2>じゅんびOK！</h2>
      <p class="lead">あとは ヒントも つかえるよ。はじめよう！</p>
      <button type="button" class="start" onclick={ondone}>はじめる</button>
    {/if}
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
    background: rgba(43, 43, 43, 0.55);
    padding: 1rem;
  }
  .card {
    position: relative;
    width: min(22rem, 92vw);
    background: var(--md-sys-color-surface, #f5f1e6);
    color: var(--md-sys-color-on-surface, #2b2b2b);
    border: 1px solid var(--md-sys-color-outline-variant, #d6cdb4);
    border-radius: var(--md-sys-shape-corner-large, 16px);
    box-shadow: var(--md-sys-elevation-3);
    padding: 1.25rem 1.1rem;
    text-align: center;
  }
  h2 {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-headline-size, 1.5rem);
    margin: 0 0 0.5rem;
  }
  .lead {
    font-weight: 700;
    margin: 0.4rem 0 0.8rem;
  }
  .parts {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    margin: 0.6rem 0;
  }
  .plus {
    font-weight: 700;
  }
  .chip {
    width: 3.4rem;
    height: 4.2rem;
    font-family: var(--md-ref-typeface-kanji);
    font-size: 1.8rem;
    border: 2px solid var(--md-sys-color-secondary, #2c3e6b);
    border-radius: var(--md-sys-shape-corner-medium, 12px);
    background: var(--md-sys-color-surface-container, #eae2cf);
    cursor: pointer;
  }
  .chip.selected {
    border-color: var(--md-sys-color-primary, #c0392b);
    background: var(--md-sys-color-primary-container, #f6dedb);
  }
  .result {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    justify-content: center;
    margin: 0.6rem 0;
  }
  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .yomi {
    color: var(--md-sys-color-on-surface-variant, #555);
  }
  .mean {
    color: var(--md-sys-color-on-surface-variant, #555);
    font-size: 0.85rem;
  }
  .next,
  .combine,
  .start {
    margin-top: 0.4rem;
    min-height: 2.75rem;
    padding: 0 20px;
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--md-sys-color-on-primary, #fff);
    background: var(--md-sys-color-primary, #c0392b);
    border: none;
    border-radius: var(--md-sys-shape-corner-full, 999px);
    cursor: pointer;
  }
  .skip {
    position: absolute;
    top: 0.5rem;
    right: 0.6rem;
    background: none;
    border: none;
    color: var(--md-sys-color-on-surface-variant, #555);
    font-size: 0.85rem;
    cursor: pointer;
  }
</style>
