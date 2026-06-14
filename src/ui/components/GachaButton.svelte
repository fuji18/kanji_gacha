<script lang="ts">
  // ガチャボタン（機能設計5・PRD F1・T-017）。残回数を表示し、引けない時は非活性。
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
</script>

<button type="button" class="gacha" {disabled} {onclick}>
  {#if showRemaining}ガチャ（{remainingLabel} {remaining}）{:else}ガチャ{/if}
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
