<script lang="ts">
  // ヒントボタン（機能設計5・PRD F5・T-017）。むずかしいでは利用不可（非活性）。
  interface Props {
    disabled?: boolean;
    onclick?: () => void;
  }
  let { disabled = false, onclick }: Props = $props();
</script>

<button type="button" class="hint" {disabled} {onclick}>ヒント</button>

<style>
  .hint {
    padding: 0.7rem 1.2rem;
    font-size: 1rem;
    cursor: pointer;
  }
  .hint:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
