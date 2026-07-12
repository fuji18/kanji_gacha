<script lang="ts">
  import { persistedStore } from '../../app/stores/persistedStore';
  import { canSpeak, speak } from '../util/speak';

  // 読み上げボタン（T-032）。読み上げ設定が ON かつ環境が対応する場合のみ表示し、
  // 押すと `text` を日本語で発話する（外部送信なし・ローカル完結）。
  interface Props {
    /** 発話するテキスト（読み）。 */
    text: string;
    /** アクセシブル名。 */
    label?: string;
  }
  let { text, label = '読み上げ' }: Props = $props();

  const show = $derived($persistedStore.settings.tts && canSpeak());
  // よみあげ速度（T-056）：「ゆっくり」設定で 0.85 倍速（低学年配慮）。
  const rate = $derived($persistedStore.settings.slowTts ? 0.85 : 1);
</script>

{#if show}
  <button
    type="button"
    class="speak"
    aria-label={label}
    onclick={() => speak(text, 'ja-JP', rate)}>🔊</button
  >
{/if}

<style>
  .speak {
    /* 親が pointer-events:none の場合でも押せるよう個別に有効化する。 */
    pointer-events: auto;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0.1rem 0.2rem;
  }
</style>
