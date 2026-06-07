<script lang="ts">
  import { navigate } from '../../app/stores/routeStore';
  // プレースホルダ（T-015）。ガチャ・手札・合体・スコア等は T-017 で実装する。
  // セッション終了時に Result へ自動遷移する配線も T-017 で行う（sessionStore.phase 監視）。
</script>

<section class="screen">
  <h2>ゲーム</h2>
  <p>ガチャ・手札・合体・スコアは T-017 で実装します。</p>
  <nav class="actions">
    <button type="button" onclick={() => navigate('result')}
      >終了（結果へ）</button
    >
    <button type="button" onclick={() => navigate('home')}>ホーム</button>
  </nav>
</section>
