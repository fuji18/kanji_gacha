<script lang="ts">
  import type { Snippet } from 'svelte';

  // Material Design 3 ボタン（filled / outlined）の共通実装。和風パレットのトークンを参照する。
  // 既存ボタンを段階的に置き換えるためのラッパ。文言・aria・disabled は呼び出し側が制御する。
  interface Props {
    variant?: 'filled' | 'outlined';
    color?: 'primary' | 'secondary' | 'tertiary';
    disabled?: boolean;
    /** 主要アクション強調（金のアクセントリング）。 */
    accentRing?: boolean;
    type?: 'button' | 'submit';
    onclick?: () => void;
    children: Snippet;
  }
  let {
    variant = 'filled',
    color = 'primary',
    disabled = false,
    accentRing = false,
    type = 'button',
    onclick,
    children,
  }: Props = $props();
</script>

<button
  {type}
  class="md-btn {variant} {color}"
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    padding: 0 20px;
    font-family: var(--md-ref-typeface-brand);
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.2;
    border: 1px solid transparent;
    border-radius: var(--md-sys-shape-corner-full);
    cursor: pointer;
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease,
      filter 0.1s ease;
  }
  .md-btn.secondary {
    --c: var(--md-sys-color-secondary);
    --on-c: var(--md-sys-color-on-secondary);
  }
  .md-btn.tertiary {
    --c: var(--md-sys-color-tertiary);
    --on-c: var(--md-sys-color-on-tertiary);
  }

  .md-btn.filled {
    background: var(--c);
    color: var(--on-c);
    box-shadow: var(--md-sys-elevation-1);
  }
  .md-btn.filled:hover:not(:disabled) {
    filter: brightness(1.06);
    box-shadow: var(--md-sys-elevation-2);
  }
  .md-btn.outlined {
    background: transparent;
    color: var(--c);
    border-color: var(--md-sys-color-outline);
  }
  .md-btn.outlined:hover:not(:disabled) {
    background: color-mix(in srgb, var(--c) 8%, transparent);
  }

  .md-btn.accent-ring {
    box-shadow:
      0 0 0 2px var(--md-sys-color-tertiary-bright),
      var(--md-sys-elevation-2);
  }
  .md-btn:active:not(:disabled) {
    transform: translateY(1px);
  }
  .md-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    box-shadow: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .md-btn {
      transition: none;
    }
  }
</style>
