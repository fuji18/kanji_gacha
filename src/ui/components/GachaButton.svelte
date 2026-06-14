<script lang="ts">
  import MaterialButton from './MaterialButton.svelte';

  // ガチャボタン（機能設計5・PRD F1・T-017）。残回数を表示し、引けない時は非活性。
  // 見た目は Material（filled/primary）。文言・props は従来通り維持する。
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

<MaterialButton variant="filled" color="primary" {disabled} {onclick}>
  {#if showRemaining}ガチャ（残 {remaining}）{:else}ガチャ{/if}
</MaterialButton>
