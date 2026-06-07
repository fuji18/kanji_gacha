<script lang="ts">
  // 起動時の辞書ロード中に表示する共通ビュー（機能設計11・T-015）。
  // 中身は最小限。演出（スピナー等）は後続で拡張してよい。
</script>

<main class="loading" aria-busy="true">
  <h1>漢字合体ガチャ</h1>
  <p role="status">読み込み中…</p>
</main>

<style>
  .loading {
    font-family: system-ui, sans-serif;
    max-width: 40rem;
    margin: 4rem auto;
    padding: 0 1rem;
    text-align: center;
  }
</style>
