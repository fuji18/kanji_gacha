<script lang="ts">
  import PartChip from './PartChip.svelte';

  // 手札表示・部品の複数選択（機能設計5・T-017）。表示用 view model を受け取り、選択トグルを通知する。
  interface HandItem {
    instanceId: string;
    char: string;
    rarity: number;
    selected: boolean;
    hinted: boolean;
  }
  interface Props {
    items: HandItem[];
    onToggle: (instanceId: string) => void;
  }
  let { items, onToggle }: Props = $props();
</script>

<div class="hand" aria-label="手札">
  {#if items.length === 0}
    <p class="empty">手札がありません。ガチャを回してください。</p>
  {:else}
    {#each items as item (item.instanceId)}
      <PartChip
        char={item.char}
        rarity={item.rarity}
        selected={item.selected}
        hinted={item.hinted}
        onToggle={() => onToggle(item.instanceId)}
      />
    {/each}
  {/if}
</div>

<style>
  .hand {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    min-height: 3.5rem;
    padding: 0.5rem 0;
  }
  .empty {
    color: #777;
    margin: 0;
  }
</style>
