<script lang="ts">
  // タイムアタックの残り時間ゲージ（T-027・handoff design）。
  // 朱→金グラデの夜空ゲージ。残10秒以下で注意（warn）、5秒以下で警告（urgent）色＋脈動。
  // prefers-reduced-motion 時は脈動を止め、色変化のみで知らせる。残秒数は GameScreen の HUD が表示する。
  interface Props {
    /** 残り時間（ms）。 */
    remainingMs: number;
    /** 初期持ち時間（ms）。進捗バーの満タン基準。 */
    initialMs: number;
    /** モーション抑制時はアニメーションを無効化する。 */
    reducedMotion?: boolean;
  }
  let { remainingMs, initialMs, reducedMotion = false }: Props = $props();

  const seconds = $derived(Math.ceil(Math.max(0, remainingMs) / 1000));
  const ratio = $derived(
    initialMs > 0 ? Math.min(1, Math.max(0, remainingMs) / initialMs) : 0
  );
  const warn = $derived(remainingMs <= 10_000 && remainingMs > 5_000);
  const urgent = $derived(remainingMs <= 5_000);
</script>

<div
  class="track"
  class:warn
  class:urgent
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={Math.round(initialMs / 1000)}
  aria-valuenow={seconds}
  aria-label={`残り時間 ${seconds} 秒`}
>
  <div
    class="fill"
    class:pulse={urgent && !reducedMotion}
    style:width={`${ratio * 100}%`}
  ></div>
</div>

<style>
  .track {
    height: 0.8rem;
    margin: 0 0 0.6rem;
    background: rgba(0, 0, 0, 0.32);
    border: 1px solid rgba(212, 175, 55, 0.35);
    border-radius: var(--md-sys-shape-corner-full);
    overflow: hidden;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .fill {
    height: 100%;
    border-radius: var(--md-sys-shape-corner-full);
    background: linear-gradient(
      90deg,
      var(--md-sys-color-primary),
      #e0795f 55%,
      var(--kg-color-gold-bright)
    );
    box-shadow: 0 0 12px rgba(212, 175, 55, 0.6);
    transition: width 0.15s linear;
  }
  .fill.pulse {
    animation: kg-time-pulse 0.6s ease-in-out infinite;
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
