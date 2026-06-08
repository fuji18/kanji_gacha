<script lang="ts">
  import type { SessionManager } from '../../app/SessionManager';
  import { navigate } from '../../app/stores/routeStore';

  // Result 画面（T-019 / PRD F6・F9）。プレイ結果の表示とリトライ・共有・ホーム導線。
  // 結果は SessionManager.getResult() から取得（型推論で domain/data を直接 import しない）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  // 結果はこの画面に来た時点で確定済み（end() 済み）。マウント時に1度だけ取得する。
  // svelte-ignore state_referenced_locally
  const result = sessionManager.getResult();

  // 作成漢字を文字単位で集計（重複は ×N でまとめる）。一度だけの計算なので素の object で集計する。
  const createdSummary = (() => {
    const counts: Record<string, number> = {};
    for (const c of result?.createdKanji ?? [])
      counts[c] = (counts[c] ?? 0) + 1;
    return Object.entries(counts).map(([char, count]) => ({ char, count }));
  })();

  let shareNote = $state('');

  function retry(): void {
    if (!result) return;
    sessionManager.start(result.level, result.mode);
    navigate('game');
  }

  function share(): void {
    // 入口のみ。送信処理は T-023（結果シェア）で実装する。
    shareNote = 'シェアは準備中です（T-023）。';
  }

  function home(): void {
    navigate('home');
  }
</script>

<section class="screen result">
  <h2>結果</h2>

  {#if result === null}
    <p>結果がありません。</p>
    <nav class="actions">
      <button type="button" onclick={home}>ホーム</button>
    </nav>
  {:else}
    {#if result.isNewBest}
      <p class="newbest" data-testid="new-best">🎉 新記録！</p>
    {/if}

    <p class="rank">称号：<strong data-testid="rank">{result.rank}</strong></p>
    <p class="score">
      スコア <strong data-testid="result-score">{result.score}</strong>
    </p>

    <section class="block">
      <h3>作った漢字（{createdSummary.length}種）</h3>
      {#if createdSummary.length === 0}
        <p class="none">なし</p>
      {:else}
        <ul class="kanji-list" data-testid="created-list">
          {#each createdSummary as item (item.char)}
            <li>
              {item.char}{#if item.count > 1}<small>×{item.count}</small>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="block">
      <h3>新発見（{result.newlyDiscovered.length}）</h3>
      {#if result.newlyDiscovered.length === 0}
        <p class="none">なし</p>
      {:else}
        <ul class="kanji-list" data-testid="discovered-list">
          {#each result.newlyDiscovered as char (char)}
            <li class="new">{char}</li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if shareNote}
      <p class="share-note" role="status">{shareNote}</p>
    {/if}

    <nav class="actions">
      <button type="button" onclick={retry}>もう一回</button>
      <button type="button" onclick={share}>シェア</button>
      <button type="button" onclick={home}>ホーム</button>
    </nav>
  {/if}
</section>

<style>
  .newbest {
    font-size: 1.2rem;
    font-weight: 700;
    color: #e67700;
  }
  .rank,
  .score {
    margin: 0.25rem 0;
    font-size: 1.1rem;
  }
  .score strong,
  .rank strong {
    font-size: 1.3rem;
  }
  .block {
    margin: 1rem 0;
  }
  .block h3 {
    font-size: 0.95rem;
    color: #555;
    margin: 0 0 0.4rem;
  }
  .kanji-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }
  .kanji-list li {
    font-size: 1.4rem;
    padding: 0.2rem 0.4rem;
    border: 1px solid #ddd;
    border-radius: 0.4rem;
  }
  .kanji-list li small {
    font-size: 0.7rem;
    color: #666;
  }
  .kanji-list li.new {
    border-color: #e67700;
  }
  .none {
    color: #888;
    margin: 0;
  }
  .share-note {
    color: #555;
    font-size: 0.9rem;
  }
</style>
