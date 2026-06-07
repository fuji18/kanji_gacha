<script lang="ts">
  import { navigate } from '../../app/stores/routeStore';
  // プレースホルダ（T-015）。発見漢字一覧・読み/意味・収集率は T-020 で実装する。
</script>

<section class="screen">
  <h2>図鑑</h2>
  <p>発見漢字一覧・読み/意味・収集率は T-020 で実装します。</p>
  <nav class="actions">
    <button type="button" onclick={() => navigate('home')}>戻る</button>
  </nav>
</section>
