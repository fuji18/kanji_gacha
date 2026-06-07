<script lang="ts">
  import { navigate } from '../../app/stores/routeStore';
  // プレースホルダ（T-015）。レベル選択・今日のお題・ベスト表示は T-016 で実装する。
</script>

<section class="screen">
  <h2>ホーム</h2>
  <p>レベル選択・今日のお題・ベストスコアは T-016 で実装します。</p>
  <nav class="actions">
    <button type="button" onclick={() => navigate('game')}>ゲーム開始</button>
    <button type="button" onclick={() => navigate('zukan')}>図鑑</button>
    <button type="button" onclick={() => navigate('about')}>About</button>
  </nav>
</section>
