<script lang="ts">
  import type { SessionManager } from '../../app/SessionManager';
  import { navigate } from '../../app/stores/routeStore';
  import { persistedStore } from '../../app/stores/persistedStore';

  // 図鑑画面（T-020 / PRD F7）。発見漢字の一覧と収集率を表示する。
  // 漢字の読み/意味と到達可能N は SessionManager 経由で取得（ui→data 直接アクセス回避）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  // 到達可能 primary の総数 N（分母）。セッション中に変わらない定数。
  // svelte-ignore state_referenced_locally
  const total = sessionManager.reachableTotal();

  // 発見済み漢字（読み/意味付き・初回発見が新しい順）。persistedStore 購読で新規発見に追従。
  const discovered = $derived(
    Object.entries($persistedStore.zukan.discovered)
      .map(([char, meta]) => {
        const k = sessionManager.kanjiView(char);
        return {
          char,
          readings: k?.readings ?? [],
          meanings: k?.meanings ?? [],
          count: meta.count,
          firstAt: meta.firstAt,
        };
      })
      // ISO 8601 は辞書順＝時刻順のため localeCompare で日時降順（新しい発見が先頭）にできる。
      .sort((a, b) => b.firstAt.localeCompare(a.firstAt))
  );

  const discoveredCount = $derived(discovered.length);
  const remaining = $derived(Math.max(0, total - discoveredCount));
  const rate = $derived(
    total > 0 ? Math.round((discoveredCount / total) * 100) : 0
  );
  // 未発見はマスク表示。全 N 件描画は重いのでティーザーとして上限を設ける。
  const maskCount = $derived(Math.min(remaining, 24));
  const maskTiles = $derived(Array.from({ length: maskCount }, (_, i) => i));
</script>

<section class="screen zukan">
  <h2>図鑑</h2>

  <div class="rate">
    <p class="rate-num">
      <strong data-testid="collected">{discoveredCount}</strong> / {total}
    </p>
    <div
      class="bar"
      role="progressbar"
      aria-valuenow={rate}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label={`収集率 ${discoveredCount} / ${total}（${rate}%）`}
    >
      <div class="bar-fill" style={`width: ${rate}%`}></div>
    </div>
    <p class="rate-note">常用漢字2,136字のうち到達可能 {total} 字（目安）</p>
  </div>

  {#if discoveredCount === 0}
    <p class="empty">まだ発見した漢字はありません。ゲームで漢字を作ろう！</p>
  {:else}
    <ul class="grid" data-testid="discovered-grid">
      {#each discovered as item (item.char)}
        <li class="card">
          <span class="card-char">{item.char}</span>
          {#if item.count > 1}<span class="card-count">×{item.count}</span>{/if}
          {#if item.readings.length > 0}
            <span class="card-yomi">{item.readings.slice(0, 2).join('・')}</span
            >
          {/if}
          {#if item.meanings.length > 0}
            <span class="card-mean">{item.meanings[0]}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if maskCount > 0}
    <h3 class="mask-title">未発見（あと {remaining} 字）</h3>
    <ul class="grid masked" aria-hidden="true">
      {#each maskTiles as i (i)}
        <li class="card mask">？</li>
      {/each}
    </ul>
  {/if}

  <nav class="actions">
    <button type="button" onclick={() => navigate('home')}>戻る</button>
  </nav>
</section>

<style>
  .zukan h2 {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-headline-size);
    color: var(--md-sys-color-on-surface);
  }
  .rate {
    margin: 0.5rem 0 1.25rem;
  }
  .rate-num {
    font-size: var(--md-sys-typescale-title-size);
    margin: 0;
  }
  .rate-num strong {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-display-size);
    font-variant-numeric: tabular-nums;
    color: var(--md-sys-color-tertiary);
  }
  .bar {
    height: 0.6rem;
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-full);
    overflow: hidden;
    margin: 0.4rem auto;
    max-width: 20rem;
  }
  .bar-fill {
    height: 100%;
    background: linear-gradient(
      to right,
      var(--md-sys-color-tertiary),
      var(--md-sys-color-tertiary-bright)
    );
    transition: width 0.3s ease;
  }
  .rate-note {
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
    margin: 0.25rem 0 0;
  }
  .empty {
    color: var(--md-sys-color-on-surface-variant);
  }
  .grid {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
    gap: 0.5rem;
  }
  .card {
    background: linear-gradient(
      160deg,
      var(--md-sys-color-surface) 0%,
      var(--md-sys-color-surface-container) 100%
    );
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-medium);
    box-shadow: var(--md-sys-elevation-1);
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
  }
  .card-char {
    font-family: var(--md-ref-typeface-kanji);
    font-size: 1.7rem;
    color: var(--md-sys-color-on-surface);
  }
  .card-count {
    font-size: 0.7rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .card-yomi {
    font-size: 0.72rem;
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
  }
  .card-mean {
    font-size: 0.72rem;
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
  }
  .mask-title {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-body-size);
    color: var(--md-sys-color-on-surface-variant);
    margin: 1rem 0 0.4rem;
  }
  .card.mask {
    color: var(--md-sys-color-outline-variant);
    font-family: var(--md-ref-typeface-kanji);
    font-size: 1.4rem;
    min-height: 3rem;
    justify-content: center;
  }
</style>
