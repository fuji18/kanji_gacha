<script lang="ts">
  // ガチャボタン（機能設計5・PRD F1・T-017）。残回数を表示し、引けない時は非活性。
  interface Props {
    remaining: number;
    disabled?: boolean;
    onclick?: () => void;
  }
  let { remaining, disabled = false, onclick }: Props = $props();
</script>

<button type="button" class="gacha" {disabled} {onclick}>
  ガチャ（残 {remaining}）
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
