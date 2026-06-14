<script lang="ts">
  // スコア・コンボ倍率・ガチャ残の常時表示（機能設計5・PRD F4・T-017）。
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
    <dd data-testid="combo">
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
    border: 1px solid #ddd;
    border-radius: 0.5rem;
  }
  .stat {
    text-align: center;
  }
  dt {
    font-size: 0.75rem;
    color: #666;
  }
  dd {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  small {
    font-size: 0.7rem;
    font-weight: 400;
    color: #666;
  }
</style>
