<script lang="ts">
  import MaterialButton from './MaterialButton.svelte';

  // ヒントボタン（機能設計5・PRD F5・T-017）。むずかしいでは利用不可（非活性）。
  // 見た目は Material（outlined/secondary）。文言は従来通り「ヒント」。
  interface Props {
    disabled?: boolean;
    onclick?: () => void;
  }
  let { disabled = false, onclick }: Props = $props();
</script>

<MaterialButton variant="outlined" color="secondary" {disabled} {onclick}>
  ヒント
</MaterialButton>
