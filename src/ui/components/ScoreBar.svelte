<script lang="ts">
  // スコア・コンボ倍率・ガチャ残の常時表示（機能設計5・PRD F4・T-017）。和風 Material 版。
  interface Props {
    score: number;
    comboMultiplier: number;
    comboCount: number;
    gachaRemaining: number;
    /** ガチャ残stat を表示するか。タイムアタックは時間表示に置き換えるため false（既定 true で従来通り）。 */
    showGachaRemaining?: boolean;
  }
  let {
    score,
    comboMultiplier,
    comboCount,
    gachaRemaining,
    showGachaRemaining = true,
  }: Props = $props();
</script>

<dl class="scorebar">
  <div class="stat">
    <dt>スコア</dt>
    <dd data-testid="score">{score}</dd>
  </div>
  <div class="stat">
    <dt>コンボ</dt>
    <dd class="accent" data-testid="combo">
      ×{comboMultiplier.toFixed(1)}<small>（{comboCount}）</small>
    </dd>
  </div>
  {#if showGachaRemaining}
    <div class="stat">
      <dt>ガチャ残</dt>
      <dd data-testid="gacha-remaining">{gachaRemaining}</dd>
    </div>
  {/if}
</dl>

<style>
  .scorebar {
    display: flex;
    justify-content: space-around;
    gap: 0.5rem;
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--md-sys-color-surface-container-low);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-medium);
    box-shadow: var(--md-sys-elevation-1);
  }
  .stat {
    text-align: center;
  }
  dt {
    font-family: var(--md-ref-typeface-plain);
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
    letter-spacing: 0.04em;
  }
  dd {
    margin: 0;
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-headline-size);
    font-weight: 700;
    color: var(--md-sys-color-on-surface);
    font-variant-numeric: tabular-nums;
  }
  dd.accent {
    color: var(--md-sys-color-primary);
  }
  small {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
