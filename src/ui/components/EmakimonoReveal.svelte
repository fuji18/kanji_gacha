<script lang="ts">
  /*
   * EmakimonoReveal.svelte — おみくじ風のガチャ獲得演出（T: 和風Material UI）。
   *
   * 巻物が左右に開き、中央で StrokeKanji が獲得パーツを筆順で描く装飾オーバーレイ。
   * 完全に非対話（role/tabindex/onclick を持たない）＋ pointer-events:none で、
   * チップ選択・各ボタン操作を一切ブロックしない（既存 E2E の pull→操作連鎖を壊さない）。
   * 読み上げは aria-live="polite" のテキストで行う。reduced-motion 時は即時表示。
   */
  import StrokeKanji from './StrokeKanji.svelte';

  interface Props {
    char: string;
    rarity: number;
    /** レアリティ落款の文字（常/良/珍/稀/神）。 */
    rarityLabel: string;
    reducedMotion?: boolean;
    /** 筆順描画の完了通知（親が表示時間の計測に使う）。 */
    oncomplete?: () => void;
  }
  let {
    char,
    rarity,
    rarityLabel,
    reducedMotion = false,
    oncomplete,
  }: Props = $props();

  // 落款色をレアリティに連動（高レア=金 / 中位=朱 / 低位=藍）。
  const sealColor = $derived(
    rarity >= 4
      ? 'var(--md-sys-color-tertiary)'
      : rarity === 3
        ? 'var(--md-sys-color-primary)'
        : 'var(--md-sys-color-secondary)'
  );

  let written = $state(false);
</script>

<div class="reveal-backdrop" class:reduced={reducedMotion}>
  <div class="scroll" class:reduced={reducedMotion}>
    <!-- 巻物の軸（左右） -->
    <span class="rod left" aria-hidden="true"></span>
    <span class="rod right" aria-hidden="true"></span>

    <div class="paper">
      {#if rarityLabel}
        <span
          class="seal"
          style={`--seal-color: ${sealColor}`}
          aria-hidden="true">{rarityLabel}</span
        >
      {/if}
      <div class="glyph" class:done={written}>
        <StrokeKanji
          {char}
          size={120}
          {reducedMotion}
          oncomplete={() => {
            written = true;
            oncomplete?.();
          }}
        />
      </div>
    </div>
  </div>

  <!-- スクリーンリーダー向け通知（装飾は aria-hidden のため別途読み上げる）。 -->
  <p class="sr-only" aria-live="polite">
    {char} を手に入れた（{rarityLabel || '部品'}）
  </p>
</div>

<style>
  .reveal-backdrop {
    position: absolute;
    inset: 0;
    z-index: 8;
    display: flex;
    align-items: center;
    justify-content: center;
    /* 装飾オーバーレイ：操作を一切ブロックしない。 */
    pointer-events: none;
  }
  .scroll {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    animation: kg-scroll-open 420ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }
  .scroll.reduced {
    animation: none;
  }
  .paper {
    position: relative;
    min-width: 7.5rem;
    min-height: 8.5rem;
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      160deg,
      var(--md-sys-color-surface) 0%,
      var(--md-sys-color-surface-container) 100%
    );
    border-top: 2px solid var(--md-sys-color-outline-variant);
    border-bottom: 2px solid var(--md-sys-color-outline-variant);
    box-shadow: var(--md-sys-elevation-3);
  }
  .rod {
    width: 14px;
    align-self: stretch;
    border-radius: var(--md-sys-shape-corner-full);
    background: linear-gradient(to right, #6b4f2a, #a9824b 50%, #6b4f2a);
    box-shadow: var(--md-sys-elevation-2);
  }
  .seal {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 1.5rem;
    height: 1.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--md-ref-typeface-brand);
    font-size: 0.9rem;
    color: var(--md-sys-color-on-primary);
    background: var(--seal-color);
    border-radius: var(--md-sys-shape-corner-small);
  }
  .glyph {
    color: var(--md-sys-color-on-surface);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  @keyframes kg-scroll-open {
    0% {
      transform: scaleX(0.05);
      opacity: 0.2;
    }
    100% {
      transform: scaleX(1);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .scroll {
      animation: none;
    }
  }
</style>
