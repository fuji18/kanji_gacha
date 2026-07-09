<script lang="ts">
  import { RARITY_LABELS } from '../labels/rarityLabels';

  // 部品1枚（機能設計5・T-017）。和風かるた札としてレアリティ色で表示し、選択/ヒント状態を示す。
  // domain 型に依存しないよう rarity は number で受ける（1〜5）。
  interface Props {
    char: string;
    rarity: number;
    selected?: boolean;
    hinted?: boolean;
    /** 選択順（1始まり）。複数選択の合体順を札に示す。未選択は null。 */
    selectionOrder?: number | null;
    onToggle?: () => void;
  }
  let {
    char,
    rarity,
    selected = false,
    hinted = false,
    selectionOrder = null,
    onToggle,
  }: Props = $props();

  // レアリティ別のアクセント色（Material ロール）。高レアほど金、中位は朱、低位は藍。
  const color = $derived(
    rarity >= 4
      ? 'var(--md-sys-color-tertiary)'
      : rarity === 3
        ? 'var(--md-sys-color-primary)'
        : 'var(--md-sys-color-secondary)'
  );
  // 落款（右上のレアリティ印）。
  const sealLabel = $derived(RARITY_LABELS[rarity] ?? '');
  // レアリティ別グロウ（★3以上で強調）。kg-glow-* は effects.css 定義。
  const glowClass = $derived(rarity >= 3 ? `kg-glow-${rarity}` : '');
</script>

<!-- kg-capsule-pop：このボタンがマウントされた瞬間（＝ガチャで手札に追加）に1回再生される。
     keyed each で既存チップは再マウントされないため、選択トグル等では再生しない。 -->
<button
  type="button"
  class="chip kg-capsule-pop {glowClass}"
  class:selected
  class:hinted
  data-hinted={hinted}
  aria-pressed={selected}
  style={`--rarity-color: ${color}`}
  onclick={onToggle}
>
  {#if selected && selectionOrder !== null}<span
      class="order-badge"
      aria-hidden="true">{selectionOrder}</span
    >{/if}
  {#if sealLabel}<span class="seal" aria-hidden="true">{sealLabel}</span>{/if}
  <span class="kanji">{char}</span>
</button>

<style>
  .chip {
    position: relative;
    width: 4rem;
    height: 5.1rem;
    padding: 0;
    border: 2px solid var(--rarity-color);
    border-radius: var(--md-sys-shape-corner-medium);
    background: linear-gradient(
      160deg,
      var(--md-sys-color-surface) 0%,
      var(--md-sys-color-surface-container) 100%
    );
    box-shadow: var(--md-sys-elevation-1);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease,
      background 0.12s ease;
  }
  .kanji {
    font-family: var(--md-ref-typeface-kanji);
    font-size: 2.4rem;
    line-height: 1;
    color: var(--md-sys-color-on-surface);
  }
  /* 選択順バッジ（左上）。複数選択時の合体順を示す。 */
  .order-badge {
    position: absolute;
    top: 3px;
    left: 3px;
    z-index: 2;
    min-width: 1.05rem;
    height: 1.05rem;
    padding: 0 0.2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--md-ref-typeface-brand);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    color: var(--md-sys-color-on-primary);
    background: var(--md-sys-color-primary);
    border-radius: var(--md-sys-shape-corner-full);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  }
  .seal {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 1.15rem;
    height: 1.15rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--md-ref-typeface-brand);
    font-size: 0.72rem;
    color: var(--md-sys-color-on-primary);
    background: var(--rarity-color);
    border-radius: var(--md-sys-shape-corner-small);
  }
  .chip.selected {
    border-color: var(--md-sys-color-primary);
    background: var(--md-sys-color-primary-container);
    transform: translateY(-3px);
    box-shadow: var(--md-sys-elevation-2);
  }
  .chip.selected .kanji {
    color: var(--md-sys-color-on-primary-container);
  }
  .chip.hinted {
    box-shadow: 0 0 0 3px var(--md-sys-color-tertiary-bright);
  }
  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
  }
  /* 強制カラーモード（Windows ハイコントラスト等・T-055）：選択・ヒント状態は
     背景色が無効化されるため、システム色の outline で判別を保証する。 */
  @media (forced-colors: active) {
    .chip.selected {
      outline: 3px solid Highlight;
      outline-offset: 2px;
    }
    .chip.hinted {
      outline: 3px dashed Highlight;
      outline-offset: 2px;
    }
  }
</style>
