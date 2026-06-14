<script lang="ts">
  // タイムアタックの残り時間表示（T-027・企画整理書 §11）。
  // 残り秒（整数・切り上げ）と進捗バーを常設表示し、残5秒以下で朱色＋脈動して警告する。
  // prefers-reduced-motion 時は脈動を止め、色変化のみで知らせる。
  interface Props {
    /** 残り時間（ms）。 */
    remainingMs: number;
    /** 初期持ち時間（ms）。進捗バーの満タン基準。 */
    initialMs: number;
    /** モーション抑制時はアニメーションを無効化する。 */
    reducedMotion?: boolean;
  }
  let { remainingMs, initialMs, reducedMotion = false }: Props = $props();

  // 切り上げ表示（残り 0.2 秒でも「1」と見せ、0 でちょうど 0 にする）。
  const seconds = $derived(Math.ceil(Math.max(0, remainingMs) / 1000));
  // バーは初期時間を 100% とし、延長で上限を超える場合も 100% で頭打ち表示する。
  const ratio = $derived(
    initialMs > 0 ? Math.min(1, Math.max(0, remainingMs) / initialMs) : 0
  );
  const low = $derived(remainingMs <= 5_000);
</script>

<div class="timebar" class:low aria-hidden="true">
  <div
    class="track"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={Math.round(initialMs / 1000)}
    aria-valuenow={seconds}
    aria-label={`残り時間 ${seconds} 秒`}
  >
    <div
      class="fill"
      class:pulse={low && !reducedMotion}
      style:width={`${ratio * 100}%`}
    ></div>
  </div>
  <span class="label" data-testid="time-remaining">{seconds}</span>
</div>

<style>
  .timebar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0 0 0.75rem;
  }
  .track {
    flex: 1;
    height: 0.7rem;
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-full);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--md-sys-color-secondary);
    transition: width 0.15s linear;
  }
  .timebar.low .fill {
    background: var(--md-sys-color-primary);
  }
  .label {
    min-width: 2.2rem;
    text-align: right;
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-headline-size);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--md-sys-color-on-surface);
  }
  .timebar.low .label {
    color: var(--md-sys-color-primary);
  }
  .fill.pulse {
    animation: kg-time-pulse 0.8s ease-in-out infinite;
  }
  @keyframes kg-time-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.45;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fill.pulse {
      animation: none;
    }
  }
</style>
