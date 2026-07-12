<script lang="ts">
  /*
   * StrokeKanji.svelte — 漢字を「墨で書いていく」筆順アニメーション（ガチャ巻物演出用）。
   *
   * ストロークパス（kanjiStrokes.ts）があれば SVG path を1画ずつ stroke-dashoffset で描画する。
   * 無ければ明朝フォントグリフを clip-path で上→下にワイプする筆フェードインにフォールバックする。
   * prefers-reduced-motion 時は即時表示（アニメーション無し）。
   */
  import { onMount } from 'svelte';
  import { getStrokes } from '../strokes/kanjiStrokes';

  interface Props {
    char: string;
    /** 文字の表示サイズ（px）。viewBox は 109 固定でスケールする。 */
    size?: number;
    color?: string;
    /** 1画あたりの描画時間（ms）。 */
    strokeDuration?: number;
    /** 画と画の間隔（ms）。 */
    strokeGap?: number;
    reducedMotion?: boolean;
    /** 全画の描画完了時に呼ばれる。 */
    oncomplete?: () => void;
  }
  let {
    char,
    size = 120,
    color = 'var(--md-sys-color-on-surface, #2b2b2b)',
    strokeDuration = 360,
    strokeGap = 90,
    reducedMotion = false,
    oncomplete,
  }: Props = $props();

  const strokes = $derived(getStrokes(char));

  // 各 path の DOM 参照と「描画済み」フラグ
  let pathEls = $state<SVGPathElement[]>([]);
  let drawn = $state<boolean[]>([]);

  onMount(() => {
    if (!strokes) {
      // フォールバック側のアニメーション完了通知
      const total = reducedMotion ? 0 : 520;
      const t = setTimeout(() => oncomplete?.(), total);
      return () => clearTimeout(t);
    }

    drawn = strokes.map(() => false);

    if (reducedMotion) {
      drawn = strokes.map(() => true);
      oncomplete?.();
      return;
    }

    // 各 path の実長を dasharray/offset に設定してから順次 offset→0 へ遷移させる
    const timers: ReturnType<typeof setTimeout>[] = [];
    pathEls.forEach((el) => {
      if (!el) return;
      const len = el.getTotalLength();
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
      el.style.transition = `stroke-dashoffset ${strokeDuration}ms ease`;
    });

    strokes.forEach((_, i) => {
      const delay = i * (strokeDuration + strokeGap);
      timers.push(
        setTimeout(() => {
          drawn[i] = true;
          drawn = [...drawn];
        }, delay)
      );
    });
    timers.push(
      setTimeout(
        () => oncomplete?.(),
        strokes.length * (strokeDuration + strokeGap)
      )
    );
    return () => timers.forEach(clearTimeout);
  });

  // drawn が立った画は offset を 0 にして描画
  $effect(() => {
    pathEls.forEach((el, i) => {
      if (el && drawn[i]) el.style.strokeDashoffset = '0';
    });
  });
</script>

{#if strokes}
  <svg
    class="stroke-kanji"
    viewBox="0 0 109 109"
    width={size}
    height={size}
    role="img"
    aria-label={char}
  >
    {#each strokes as d, i (i)}
      <path
        bind:this={pathEls[i]}
        {d}
        fill="none"
        stroke={color}
        stroke-width="6.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {/each}
  </svg>
{:else}
  <!-- フォールバック: フォントグリフを上→下にワイプして「書いている」風に見せる -->
  <span
    class="glyph-fallback"
    class:reduced={reducedMotion}
    style:font-size={`${size * 0.82}px`}
    style:color
    aria-label={char}
    role="img">{char}</span
  >
{/if}

<style>
  .stroke-kanji {
    display: block;
  }
  .glyph-fallback {
    display: inline-block;
    font-family: var(--md-ref-typeface-kanji, serif);
    line-height: 1;
    animation: kg-brush-wipe 520ms cubic-bezier(0.3, 0.8, 0.3, 1) both;
  }
  .glyph-fallback.reduced {
    animation: none;
  }
  @keyframes kg-brush-wipe {
    0% {
      clip-path: inset(0 0 100% 0);
      opacity: 0.2;
    }
    60% {
      opacity: 1;
    }
    100% {
      clip-path: inset(0 0 0 0);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .glyph-fallback {
      animation: none;
    }
  }
</style>
