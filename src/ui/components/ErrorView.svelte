<script lang="ts">
  // 致命的エラー（主に辞書ロード失敗）の共通表示（機能設計11・T-015）。
  // リトライ導線（再読み込み）を必ず提供する。`onRetry` は呼び出し側が渡す（既定は再読み込み）。
  // 見た目は handoff design「App Screens Wafu」のエラー画面（破の円＋朱3Dボタン）。
  interface Props {
    title?: string;
    message?: string;
    onRetry?: () => void;
    /** 任意のエラーコード表示（装飾・サポート用）。 */
    code?: string;
  }
  let {
    title = 'エラーが発生しました',
    message = '時間をおいて再度お試しください。',
    onRetry = () => location.reload(),
    code = 'ERR_DICT_LOAD',
  }: Props = $props();
</script>

<main class="error" role="alert">
  <div class="card">
    <span class="brand-kicker">漢字合体ガチャ</span>
    <div class="mark">破</div>
    <div class="text">
      <h2>{title}</h2>
      <p class="message">{message}</p>
    </div>
    <button type="button" class="retry" onclick={onRetry}>再読み込み</button>
    {#if code}<span class="code">{code}</span>{/if}
  </div>
</main>

<style>
  .error {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .card {
    width: min(20rem, 92vw);
    padding: 2rem 1.6rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.3rem;
    text-align: center;
    background: linear-gradient(
      180deg,
      var(--md-sys-color-surface),
      var(--md-sys-color-surface-container-low)
    );
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: 1.4rem;
    box-shadow: var(--md-sys-elevation-2);
  }
  .brand-kicker {
    font-family: var(--md-ref-typeface-brand);
    font-size: 0.66rem;
    letter-spacing: 0.16em;
    color: var(--md-sys-color-on-surface-variant);
  }
  .mark {
    width: 6rem;
    height: 6rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--md-ref-typeface-brand);
    font-size: 2.8rem;
    color: var(--md-sys-color-primary);
    background: rgba(192, 57, 43, 0.08);
    border: 1.5px dashed rgba(192, 57, 43, 0.4);
  }
  h2 {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 800;
    font-size: 1.25rem;
    margin: 0 0 0.5rem;
    color: var(--md-sys-color-on-surface);
  }
  .message {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.8;
    color: var(--md-sys-color-on-surface-variant);
    max-width: 16rem;
  }
  .retry {
    width: 100%;
    max-width: 15rem;
    min-height: 3rem;
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    font-size: 1.05rem;
    color: #fff3e4;
    background: linear-gradient(
      180deg,
      var(--kg-color-vermilion-bright),
      var(--kg-color-vermilion-deep)
    );
    border: none;
    border-radius: var(--md-sys-shape-corner-medium);
    box-shadow: 0 4px 0 #7d2c1c;
    cursor: pointer;
  }
  .retry:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 #7d2c1c;
  }
  .retry:focus-visible {
    outline: 3px solid var(--kg-color-gold-bright);
    outline-offset: 2px;
  }
  .code {
    font-family: monospace;
    font-size: 0.62rem;
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
