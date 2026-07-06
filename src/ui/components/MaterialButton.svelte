<script lang="ts">
  import type { Snippet } from 'svelte';

  // 単一ボタン体系（和風 Material）。全画面のボタンはこのコンポーネントに統一する。
  //  - filled : 主CTA。和風3D「ぷっくり」（下方向の厚み影＋押下で沈む）。1画面に1つが原則。
  //  - tonal  : 副アクション（container 背景・平面）。
  //  - outlined: 第3アクション（枠線）。
  //  - text   : 低強度（戻る・ホーム等の離脱導線）。
  // 文言・aria・disabled は呼び出し側が制御する（アクセシブル名＝children のテキスト）。
  interface Props {
    variant?: 'filled' | 'tonal' | 'outlined' | 'text';
    color?: 'primary' | 'secondary' | 'tertiary';
    /** md=48px（既定・主要操作）/ sm=40px（コンパクトなツールバー）。 */
    size?: 'md' | 'sm';
    /** 全幅（下部アクションバー用）。 */
    block?: boolean;
    disabled?: boolean;
    /** 特別強調（金のアクセントリング。今日のお題・新記録など）。 */
    accentRing?: boolean;
    type?: 'button' | 'submit';
    onclick?: () => void;
    children: Snippet;
  }
  let {
    variant = 'filled',
    color = 'primary',
    size = 'md',
    block = false,
    disabled = false,
    accentRing = false,
    type = 'button',
    onclick,
    children,
  }: Props = $props();
</script>

<button
  {type}
  class="md-btn {variant} {color} {size}"
  class:block
  class:accent-ring={accentRing}
  {disabled}
  {onclick}
>
  {@render children()}
</button>

<style>
  .md-btn {
    --c: var(--md-sys-color-primary);
    --on-c: var(--md-sys-color-on-primary);
    --c-container: var(--md-sys-color-primary-container);
    --on-c-container: var(--md-sys-color-on-primary-container);
    /* 3D の厚み影色（主色を暗く）。 */
    --c-shadow: color-mix(in srgb, var(--c) 72%, #000);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 3rem; /* md=48px（WCAG 2.5.5 / Material タップ領域） */
    padding: 0 20px;
    font-family: var(--md-ref-typeface-brand);
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.2;
    border: 1px solid transparent;
    border-radius: var(--md-sys-shape-corner-full);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease,
      filter 0.1s ease,
      background 0.1s ease;
  }
  .md-btn.secondary {
    --c: var(--md-sys-color-secondary);
    --on-c: var(--md-sys-color-on-secondary);
    --c-container: var(--md-sys-color-secondary-container);
    --on-c-container: var(--md-sys-color-on-secondary-container);
  }
  .md-btn.tertiary {
    --c: var(--md-sys-color-tertiary);
    --on-c: var(--md-sys-color-on-tertiary);
    --c-container: var(--md-sys-color-tertiary-container);
    --on-c-container: var(--md-sys-color-on-tertiary-container);
  }

  .md-btn.sm {
    min-height: 2.5rem; /* 40px（間隔を確保したコンパクト用） */
    padding: 0 14px;
    font-size: 0.92rem;
  }
  .md-btn.block {
    width: 100%;
  }

  /* filled：和風3D「ぷっくり」。下方向の厚み影、押下で沈む。 */
  .md-btn.filled {
    background: var(--c);
    color: var(--on-c);
    box-shadow:
      0 var(--kg-btn-raise) 0 var(--c-shadow),
      var(--md-sys-elevation-1);
  }
  .md-btn.filled:hover:not(:disabled) {
    filter: brightness(1.05);
  }
  .md-btn.filled:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow:
      0 2px 0 var(--c-shadow),
      var(--md-sys-elevation-1);
  }

  /* tonal：副アクション（container 背景・平面）。 */
  .md-btn.tonal {
    background: var(--c-container);
    color: var(--on-c-container);
    box-shadow: var(--md-sys-elevation-1);
  }
  .md-btn.tonal:hover:not(:disabled) {
    filter: brightness(0.98);
    box-shadow: var(--md-sys-elevation-2);
  }
  .md-btn.tonal:active:not(:disabled) {
    transform: translateY(1px);
  }

  /* outlined：第3アクション（枠線）。 */
  .md-btn.outlined {
    background: transparent;
    color: var(--c);
    border-color: var(--md-sys-color-outline);
  }
  .md-btn.outlined:hover:not(:disabled) {
    background: color-mix(in srgb, var(--c) 8%, transparent);
  }
  .md-btn.outlined:active:not(:disabled) {
    transform: translateY(1px);
  }

  /* text：低強度（離脱導線）。 */
  .md-btn.text {
    background: transparent;
    color: var(--c);
    border-color: transparent;
  }
  .md-btn.text:hover:not(:disabled) {
    background: color-mix(in srgb, var(--c) 10%, transparent);
  }
  .md-btn.text:active:not(:disabled) {
    transform: translateY(1px);
  }

  .md-btn.accent-ring {
    box-shadow:
      0 0 0 2px var(--kg-color-gold-bright),
      var(--md-sys-elevation-2);
  }
  .md-btn.filled.accent-ring {
    box-shadow:
      0 0 0 2px var(--kg-color-gold-bright),
      0 var(--kg-btn-raise) 0 var(--c-shadow);
  }

  /* フォーカスは outline で（3Dの box-shadow を潰さない）。 */
  .md-btn:focus-visible {
    outline: 3px solid var(--kg-color-gold-bright);
    outline-offset: 2px;
  }
  .md-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    box-shadow: none;
    transform: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .md-btn {
      transition: none;
    }
    .md-btn.filled:active:not(:disabled),
    .md-btn.tonal:active:not(:disabled),
    .md-btn.outlined:active:not(:disabled),
    .md-btn.text:active:not(:disabled) {
      transform: none;
    }
  }
</style>
