<script lang="ts">
  // 部品1枚（機能設計5・T-017）。レアリティ色で表示し、選択/ヒント状態を示す。
  // domain 型に依存しないよう rarity は number で受ける（1〜5）。
  interface Props {
    char: string;
    rarity: number;
    selected?: boolean;
    hinted?: boolean;
    onToggle?: () => void;
  }
  let {
    char,
    rarity,
    selected = false,
    hinted = false,
    onToggle,
  }: Props = $props();

  // レアリティ別の縁色（★1〜★5）。index 0 は未使用。
  const RARITY_COLORS = [
    '#9e9e9e',
    '#9e9e9e',
    '#4caf50',
    '#2196f3',
    '#9c27b0',
    '#ff9800',
  ];
  const color = $derived(RARITY_COLORS[rarity] ?? RARITY_COLORS[1]);
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
  {char}
</button>

<style>
  .chip {
    width: 3rem;
    height: 3rem;
    font-size: 1.5rem;
    line-height: 1;
    border: 2px solid var(--rarity-color);
    border-radius: 0.5rem;
    background: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .chip.selected {
    background: var(--rarity-color);
    color: #fff;
    transform: translateY(-2px);
  }
  .chip.hinted {
    box-shadow: 0 0 0 3px gold;
  }
</style>
