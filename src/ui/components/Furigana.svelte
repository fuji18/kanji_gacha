<script lang="ts">
  import { persistedStore } from '../../app/stores/persistedStore';

  // ふりがな表示（学習配慮・T-031）。設定 `furigana` が ON のとき <ruby> でふりがなを付け、
  // OFF のときは元テキストのみを表示する。漢字を読めない低学年が UI を読めるようにする。
  interface Props {
    /** 表示する語（漢字を含む UI 文言）。 */
    text: string;
    /** ふりがな（読み・ひらがな）。 */
    reading: string;
  }
  let { text, reading }: Props = $props();

  const on = $derived($persistedStore.settings.furigana);
</script>

{#if on}<ruby>{text}<rt>{reading}</rt></ruby>{:else}{text}{/if}

<style>
  rt {
    font-size: 0.6em;
    color: var(--md-sys-color-on-surface-variant, #666);
    font-weight: 400;
  }
</style>
