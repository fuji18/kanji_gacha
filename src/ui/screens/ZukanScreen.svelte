<script lang="ts">
  import { onMount } from 'svelte';
  import type { SessionManager } from '../../app/SessionManager';
  import { navigate } from '../../app/stores/routeStore';
  import { persistedStore } from '../../app/stores/persistedStore';
  import StrokeKanji from '../components/StrokeKanji.svelte';
  import Furigana from '../components/Furigana.svelte';
  import { pickRadical } from '../labels/radicalNames';

  // 図鑑＝学習帳（T-036 / 旧 T-020 を拡張）。発見漢字を 読み/意味/画数/部首 つきで一覧し、
  // タップで筆順を再生する。学年別（小1〜小6）の収集率も進捗バーで表示する。
  // 漢字情報・到達可能数は SessionManager 経由で取得（ui→data 直接アクセス回避）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  // 到達可能 primary の総数 N（全体の分母）。セッション中に変わらない定数。
  // svelte-ignore state_referenced_locally
  const total = sessionManager.reachableTotal();
  // 学年別（小1〜小6）の到達可能字数（分母）。静的値なので1度だけ取得する。
  // svelte-ignore state_referenced_locally
  const gradeTotals = sessionManager.gradeTotals();

  // prefers-reduced-motion 時は筆順を即時表示にする（StrokeKanji に委譲）。
  let reducedMotion = $state(false);
  onMount(() => {
    reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });

  // 発見済み漢字（学習帳ビュー・初回発見が新しい順）。persistedStore 購読で新規発見に追従。
  const discovered = $derived(
    Object.entries($persistedStore.zukan.discovered)
      .map(([char, meta]) => {
        const k = sessionManager.kanjiStudyView(char);
        const radical = pickRadical(k?.parts ?? []);
        // 図鑑には辞書既知の字のみ永続化される（persistResults）ため k は通常非 null。
        // 念のためのフォールバック（保存データ改変・将来の辞書縮小時の防御）。
        return {
          char,
          readings: k?.readings ?? [],
          meanings: k?.meanings ?? [],
          strokes: k?.strokes ?? 0,
          grade: k?.grade ?? 0,
          radical,
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

  // 学年別の収集率（小1〜小6）。発見字を grade でバケットし、分母は gradeTotals。
  const gradeRates = $derived(
    gradeTotals.map(({ grade, total: gTotal }) => {
      const collected = discovered.filter((d) => d.grade === grade).length;
      const left = Math.max(0, gTotal - collected);
      const pct = gTotal > 0 ? Math.round((collected / gTotal) * 100) : 0;
      return { grade, collected, total: gTotal, left, pct };
    })
  );

  // 未発見はマスク表示。全 N 件描画は重いのでティーザーとして上限を設ける。
  const maskCount = $derived(Math.min(remaining, 24));
  const maskTiles = $derived(Array.from({ length: maskCount }, (_, i) => i));

  // 筆順再生の対象字。null=非表示。replayKey を変えると StrokeKanji を再マウントして再生する。
  let selectedChar = $state<string | null>(null);
  let replayKey = $state(0);
  const selected = $derived(
    selectedChar === null
      ? null
      : discovered.find((d) => d.char === selectedChar)
  );

  function openPlayback(char: string): void {
    selectedChar = char;
    replayKey += 1;
  }
  function replay(): void {
    replayKey += 1;
  }
  function closePlayback(): void {
    selectedChar = null;
  }
</script>

<section class="screen zukan">
  <h2><Furigana text="図鑑" reading="ずかん" /></h2>
  <p class="subtitle">
    あつめた漢字の<Furigana text="学習帳" reading="がくしゅうちょう" />
  </p>

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

  <!-- 学年別の収集率（小1〜小6・T-036） -->
  <h3 class="section-title">
    <Furigana text="学年別" reading="がくねんべつ" />のあつまり
  </h3>
  <ul class="grade-list" data-testid="grade-rate">
    {#each gradeRates as g (g.grade)}
      <li class="grade-row">
        <span class="grade-label">小{g.grade}</span>
        <div
          class="bar grade-bar"
          role="progressbar"
          aria-valuenow={g.pct}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label={`小学${g.grade}年 ${g.collected} / ${g.total}（${g.pct}%）`}
        >
          <div class="bar-fill" style={`width: ${g.pct}%`}></div>
        </div>
        <span class="grade-num">{g.collected}/{g.total}</span>
      </li>
    {/each}
  </ul>

  {#if discoveredCount === 0}
    <p class="empty">まだ発見した漢字はありません。ゲームで漢字を作ろう！</p>
  {:else}
    <h3 class="section-title">あつめた漢字（タップで筆順）</h3>
    <ul class="grid" data-testid="discovered-grid">
      {#each discovered as item (item.char)}
        <li>
          <button
            type="button"
            class="card"
            data-testid="zukan-card"
            onclick={() => openPlayback(item.char)}
            aria-label={`${item.char} の筆順を見る`}
          >
            <span class="card-char">{item.char}</span>
            {#if item.count > 1}<span class="card-count">×{item.count}</span
              >{/if}
            {#if item.readings.length > 0}
              <span class="card-yomi"
                >{item.readings.slice(0, 2).join('・')}</span
              >
            {/if}
            {#if item.meanings.length > 0}
              <span class="card-mean">{item.meanings[0]}</span>
            {/if}
            <span class="card-meta">
              {item.strokes}画{#if item.radical}
                ・ 部首:{item.radical.name ?? item.radical.char}{/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if maskCount > 0}
    <h3 class="mask-title">未発見（あと {remaining} 字）</h3>
    <p class="mask-hint">
      {#each gradeRates.filter((g) => g.left > 0) as g (g.grade)}
        <span class="mask-chip">小{g.grade}：あと{g.left}字</span>
      {/each}
    </p>
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

{#if selected}
  <!-- バックドロップは presentation（閉じる導線はモーダル内の「閉じる」に集約）。
       外側クリックと Escape での閉じるは利便性のために維持する。 -->
  <div
    class="playback-backdrop"
    role="presentation"
    onclick={closePlayback}
    onkeydown={(e) => {
      if (e.key === 'Escape') closePlayback();
    }}
  >
    <div
      class="playback"
      data-testid="stroke-playback"
      role="dialog"
      aria-modal="true"
      aria-label={`${selected.char} の筆順`}
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
      tabindex="-1"
    >
      <h3 class="playback-title">
        <Furigana text="筆順" reading="ひつじゅん" />
      </h3>
      <div class="playback-stage">
        {#key replayKey}
          <StrokeKanji char={selected.char} size={160} {reducedMotion} />
        {/key}
      </div>
      <p class="playback-info">
        <span class="playback-char">{selected.char}</span>
        <span class="playback-sub">
          {selected.strokes}画{#if selected.radical}
            ・ 部首:{selected.radical.name ?? selected.radical.char}{/if}
        </span>
      </p>
      {#if selected.readings.length > 0}
        <p class="playback-yomi">{selected.readings.slice(0, 4).join('・')}</p>
      {/if}
      {#if selected.meanings.length > 0}
        <p class="playback-mean">{selected.meanings[0]}</p>
      {/if}
      <div class="playback-actions">
        <button type="button" onclick={replay}>もう一度</button>
        <button type="button" onclick={closePlayback}>閉じる</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .zukan h2 {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-headline-size);
    color: var(--md-sys-color-on-surface);
  }
  .subtitle {
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
    margin: -0.25rem 0 0.5rem;
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
  .section-title {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-title-size);
    color: var(--md-sys-color-on-surface);
    margin: 1.25rem 0 0.4rem;
  }
  /* 学年別バー */
  .grade-list {
    list-style: none;
    padding: 0;
    margin: 0.25rem 0 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .grade-row {
    display: grid;
    grid-template-columns: 2.5rem 1fr auto;
    align-items: center;
    gap: 0.5rem;
  }
  .grade-label {
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
  }
  .grade-bar {
    margin: 0;
    max-width: none;
  }
  .grade-num {
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
    font-variant-numeric: tabular-nums;
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
    width: 100%;
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
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  button.card:hover {
    border-color: var(--md-sys-color-tertiary);
  }
  button.card:focus-visible {
    outline: 2px solid var(--md-sys-color-tertiary);
    outline-offset: 2px;
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
  .card-meta {
    font-size: 0.66rem;
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
    margin-top: 0.1rem;
  }
  .mask-title {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-body-size);
    color: var(--md-sys-color-on-surface-variant);
    margin: 1rem 0 0.4rem;
  }
  .mask-hint {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0 0 0.4rem;
  }
  .mask-chip {
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-full);
    padding: 0.05rem 0.5rem;
  }
  .card.mask {
    color: var(--md-sys-color-outline-variant);
    font-family: var(--md-ref-typeface-kanji);
    font-size: 1.4rem;
    min-height: 3rem;
    justify-content: center;
  }
  /* 筆順再生モーダル */
  .playback-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 20;
  }
  .playback {
    background: var(--md-sys-color-surface);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-large);
    box-shadow: var(--md-sys-elevation-3);
    padding: 1.25rem;
    max-width: 22rem;
    width: 100%;
    text-align: center;
  }
  .playback-title {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-title-size);
    color: var(--md-sys-color-on-surface);
    margin: 0 0 0.5rem;
  }
  .playback-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 160px;
  }
  .playback-info {
    margin: 0.5rem 0 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .playback-char {
    font-family: var(--md-ref-typeface-kanji);
    font-size: 1.6rem;
    color: var(--md-sys-color-on-surface);
  }
  .playback-sub {
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
  }
  .playback-yomi,
  .playback-mean {
    font-size: var(--md-sys-typescale-body-size);
    color: var(--md-sys-color-on-surface-variant);
    margin: 0.1rem 0;
  }
  .playback-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 0.75rem;
  }
</style>
