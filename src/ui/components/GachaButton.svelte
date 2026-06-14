<script lang="ts">
  // ガチャボタン（機能設計5・PRD F1・T-017）。残回数を表示し、引けない時は非活性。
  interface Props {
    remaining: number;
    disabled?: boolean;
    onclick?: () => void;
    /** 残回数を併記するか。タイムアタックは無制限のため false（既定 true で従来通り）。 */
    showRemaining?: boolean;
  }
  let {
    remaining,
    disabled = false,
    onclick,
    showRemaining = true,
  }: Props = $props();
</script>

<button type="button" class="gacha" {disabled} {onclick}>
  {#if showRemaining}ガチャ（残 {remaining}）{:else}ガチャ{/if}
</button>

<style>
  .gacha {
    padding: 0.7rem 1.4rem;
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
  }
  .gacha:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
