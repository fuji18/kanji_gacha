<script lang="ts">
  import type { SessionManager } from '../../app/SessionManager';
  import { navigate } from '../../app/stores/routeStore';
  import { persistedStore } from '../../app/stores/persistedStore';
  import SpeakButton from '../components/SpeakButton.svelte';
  import StrokeKanji from '../components/StrokeKanji.svelte';
  import MaterialButton from '../components/MaterialButton.svelte';

  // 図鑑画面（T-020 / PRD F7・学習帳化 T-036）。発見漢字の一覧・収集率・学年別進捗・筆順を表示する。
  // 漢字の読み/意味/画数/部品と到達可能N は SessionManager 経由で取得（ui→data 直接アクセス回避）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  // 到達可能 primary の総数 N（分母）。セッション中に変わらない定数。
  // svelte-ignore state_referenced_locally
  const total = sessionManager.reachableTotal();
  // 学年別（小1〜小6）の対象漢字数（分母）。静的。
  // svelte-ignore state_referenced_locally
  const gradeTotals = sessionManager.gradeTotals();

  const reducedMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 発見済み漢字（読み/意味/画数/学年/部品つき・初回発見が新しい順）。persistedStore 購読で追従。
  const discovered = $derived(
    Object.entries($persistedStore.zukan.discovered)
      .map(([char, meta]) => {
        const k = sessionManager.kanjiStudyView(char);
        return {
          char,
          readings: k?.readings ?? [],
          meanings: k?.meanings ?? [],
          strokes: k?.strokes ?? 0,
          grade: k?.grade ?? 0,
          parts: k?.parts ?? [],
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

  // 学年別収集率（小1〜小6）。発見済みを学年で数え、分母は gradeTotals。
  const gradeCollection = $derived(
    gradeTotals.map(({ grade, total: t }) => {
      const collected = discovered.filter((d) => d.grade === grade).length;
      return { grade, collected, total: t };
    })
  );

  // 未発見はマスク表示。全 N 件描画は重いのでティーザーとして上限を設ける。
  const maskCount = $derived(Math.min(remaining, 24));
  const maskTiles = $derived(Array.from({ length: maskCount }, (_, i) => i));

  // 筆順再生（T-036）。カードをタップすると選択字の筆順をオーバーレイで再生する。
  let selected = $state<{
    char: string;
    readings: string[];
    meanings: string[];
    strokes: number;
    parts: string[];
    key: number;
  } | null>(null);
  let selectSeq = 0;
  function openStroke(item: (typeof discovered)[number]): void {
    selected = {
      char: item.char,
      readings: item.readings,
      meanings: item.meanings,
      strokes: item.strokes,
      parts: item.parts,
      key: ++selectSeq,
    };
  }
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

  <!-- 学年別収集率（小1〜小6・学習帳化 T-036） -->
  <div class="grades" data-testid="grade-collection">
    <h3 class="grades-title">学年べつ（小学生）</h3>
    {#each gradeCollection as g (g.grade)}
      <div class="grade-row">
        <span class="grade-label">小{g.grade}</span>
        <div
          class="bar small"
          role="progressbar"
          aria-valuenow={g.collected}
          aria-valuemin="0"
          aria-valuemax={g.total}
          aria-label={`小${g.grade} 収集 ${g.collected} / ${g.total}`}
        >
          <div
            class="bar-fill"
            style={`width: ${g.total > 0 ? (g.collected / g.total) * 100 : 0}%`}
          ></div>
        </div>
        <span class="grade-num">{g.collected}/{g.total}</span>
      </div>
    {/each}
  </div>

  {#if discoveredCount === 0}
    <p class="empty">まだ発見した漢字はありません。ゲームで漢字を作ろう！</p>
  {:else}
    <ul class="grid" data-testid="discovered-grid">
      {#each discovered as item (item.char)}
        <li class="card">
          <button
            type="button"
            class="card-char"
            aria-label={`${item.char}の筆順を見る`}
            onclick={() => openStroke(item)}>{item.char}</button
          >
          <SpeakButton
            text={item.readings[0] ?? item.char}
            label={`${item.char}を読み上げ`}
          />
          {#if item.count > 1}<span class="card-count">×{item.count}</span>{/if}
          {#if item.readings.length > 0}
            <span class="card-yomi">{item.readings.slice(0, 2).join('・')}</span
            >
          {/if}
          {#if item.meanings.length > 0}
            <span class="card-mean">{item.meanings[0]}</span>
          {/if}
          <span class="card-strokes">{item.strokes}画</span>
          {#if item.parts.length > 0}
            <span class="card-parts">部品：{item.parts.join('・')}</span>
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
    <MaterialButton
      variant="outlined"
      color="secondary"
      block
      onclick={() => navigate('home')}>戻る</MaterialButton
    >
  </nav>

  {#if selected}
    <div
      class="stroke-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${selected.char}の筆順`}
    >
      <div class="stroke-card">
        <button
          type="button"
          class="stroke-close"
          aria-label="閉じる"
          onclick={() => (selected = null)}>×</button
        >
        {#key selected.key}
          <StrokeKanji char={selected.char} size={120} {reducedMotion} />
        {/key}
        <p class="stroke-yomi">
          {selected.readings.slice(0, 2).join('・')}
          <SpeakButton
            text={selected.readings[0] ?? selected.char}
            label={`${selected.char}を読み上げ`}
          />
        </p>
        {#if selected.meanings.length > 0}
          <p class="stroke-mean">{selected.meanings[0]}</p>
        {/if}
        <p class="stroke-meta">
          {selected.strokes}画{#if selected.parts.length > 0}
            ／部品：{selected.parts.join('・')}{/if}
        </p>
      </div>
    </div>
  {/if}
</section>

<style>
  .zukan h2 {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-headline-size);
    color: var(--md-sys-color-on-surface);
  }
  .rate {
    margin: 0.4rem 0 0.9rem;
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
    /* design: 発見カードは3列、未発見マスクは6列。 */
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }
  .grid.masked {
    grid-template-columns: repeat(6, 1fr);
    gap: 0.4rem;
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
    /* タップで筆順再生するボタン（見た目は素の漢字）。 */
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
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
  .card-strokes,
  .card-parts {
    font-size: 0.68rem;
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
  }
  /* 学年別収集率（T-036） */
  .grades {
    margin: 0 0 0.9rem;
  }
  .grades-title {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-body-size);
    color: var(--md-sys-color-on-surface-variant);
    margin: 0 0 0.4rem;
  }
  .grade-row {
    display: grid;
    grid-template-columns: 2.4rem 1fr auto;
    align-items: center;
    gap: 0.5rem;
    margin: 0.2rem 0;
  }
  .grade-label {
    font-size: 0.8rem;
    color: var(--md-sys-color-on-surface);
    text-align: right;
  }
  .bar.small {
    height: 0.5rem;
    margin: 0;
    max-width: none;
  }
  .grade-num {
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    color: var(--md-sys-color-on-surface-variant);
    white-space: nowrap;
  }
  /* 筆順オーバーレイ（T-036） */
  .stroke-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(43, 43, 43, 0.55);
    padding: 1rem;
  }
  .stroke-card {
    position: relative;
    width: min(18rem, 90vw);
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-large);
    box-shadow: var(--md-sys-elevation-3);
    padding: 1.25rem;
    text-align: center;
  }
  .stroke-close {
    position: absolute;
    top: 0.2rem;
    right: 0.2rem;
    width: 2.75rem;
    height: 2.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    font-size: 1.4rem;
    line-height: 1;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
  }
  .stroke-close:focus-visible {
    outline: 3px solid var(--kg-color-gold-bright);
    outline-offset: -3px;
    border-radius: var(--md-sys-shape-corner-small);
  }
  .stroke-yomi {
    margin: 0.4rem 0 0.2rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .stroke-mean {
    margin: 0;
    font-size: 0.85rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .stroke-meta {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    color: var(--md-sys-color-secondary);
    font-variant-numeric: tabular-nums;
  }
</style>
