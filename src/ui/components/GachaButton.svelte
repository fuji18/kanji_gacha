<script lang="ts">
  // ガチャボタン（機能設計5・PRD F1・T-017）。handoff design の「絵巻（巻物）」スタイル。
  // 朱グラデの巻紙＋両端の軸（rod）＋金グロウ。残回数を表示し、引けない時は非活性。
  // アクセシブル名に「ガチャ」を含める契約は維持（E2E: name=/ガチャ/）。
  interface Props {
    remaining: number;
    disabled?: boolean;
    onclick?: () => void;
    /** 残数を併記するか。タイムアタックは無制限のため false（既定 true で従来通り）。 */
    showRemaining?: boolean;
    /** 残数の見出し。達成型（deck）は「山札」、それ以外は「残」（既定）。 */
    remainingLabel?: string;
  }
  let {
    remaining,
    disabled = false,
    onclick,
    showRemaining = true,
    remainingLabel = '残',
  }: Props = $props();

  const subtitle = $derived(
    showRemaining
      ? `絵巻を引く · ${remainingLabel}${remaining}`
      : '引き放題 · UNLIMITED'
  );
</script>

<button
  type="button"
  class="gacha-scroll kg-scroll-glow"
  {disabled}
  {onclick}
  aria-label={showRemaining
    ? `ガチャ（${remainingLabel} ${remaining}）`
    : 'ガチャ'}
>
  <span class="rod" aria-hidden="true"></span>
  <span class="body">
    <span class="title">ガチャ</span>
    <span class="sub">{subtitle}</span>
  </span>
  <span class="rod" aria-hidden="true"></span>
</button>

<style>
  .gacha-scroll {
    position: relative;
    flex: 1;
    min-height: 3.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.7rem;
    padding: 0 0.6rem;
    border: none;
    border-radius: var(--md-sys-shape-corner-large);
    background: linear-gradient(
      180deg,
      var(--kg-color-vermilion-bright),
      var(--kg-color-vermilion-deep)
    );
    color: #fff3e4;
    cursor: pointer;
    transition:
      transform 0.1s ease,
      filter 0.1s ease;
  }
  /* 巻物の軸（両端の濃い棒）。 */
  .rod {
    flex: none;
    width: 0.55rem;
    height: 2.85rem;
    border-radius: var(--md-sys-shape-corner-small);
    background: linear-gradient(180deg, #3a1c12, #7a4030, #3a1c12);
  }
  .body {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.15;
  }
  .title {
    font-family: var(--md-ref-typeface-brand);
    font-size: 1.35rem;
    letter-spacing: 0.14em;
    color: #fff3e4;
  }
  .sub {
    font-size: 0.65rem;
    color: #ffd9c8;
    font-variant-numeric: tabular-nums;
  }
  .gacha-scroll:hover:not(:disabled) {
    filter: brightness(1.06);
  }
  .gacha-scroll:active:not(:disabled) {
    transform: translateY(1px);
  }
  .gacha-scroll:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    animation: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .gacha-scroll {
      transition: none;
    }
  }
</style>
