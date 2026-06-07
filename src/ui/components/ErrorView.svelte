<script lang="ts">
  // 致命的エラー（主に辞書ロード失敗）の共通表示（機能設計11・T-015）。
  // リトライ導線（再読み込み）を必ず提供する。`onRetry` は呼び出し側が渡す（既定は再読み込み）。
  interface Props {
    title?: string;
    message?: string;
    onRetry?: () => void;
  }
  let {
    title = 'エラーが発生しました',
    message = '時間をおいて再度お試しください。',
    onRetry = () => location.reload(),
  }: Props = $props();
</script>

<main class="error" role="alert">
  <h1>漢字合体ガチャ</h1>
  <h2>{title}</h2>
  <p>{message}</p>
  <button type="button" onclick={onRetry}>再読み込み</button>
</main>

<style>
  .error {
    font-family: system-ui, sans-serif;
    max-width: 40rem;
    margin: 4rem auto;
    padding: 0 1rem;
    text-align: center;
  }
  button {
    margin-top: 1rem;
    padding: 0.6rem 1.4rem;
    font-size: 1rem;
    cursor: pointer;
  }
</style>
