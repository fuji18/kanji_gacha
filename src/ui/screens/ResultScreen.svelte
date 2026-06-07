<script lang="ts">
  import { navigate } from '../../app/stores/routeStore';
  // プレースホルダ（T-015）。最終スコア・作成漢字・新発見・称号・シェアは T-019 で実装する。
</script>

<section class="screen">
  <h2>結果</h2>
  <p>最終スコア・作成漢字・新発見・称号は T-019 で実装します。</p>
  <nav class="actions">
    <button type="button" onclick={() => navigate('game')}>もう一回</button>
    <button type="button" onclick={() => navigate('home')}>ホーム</button>
  </nav>
</section>
