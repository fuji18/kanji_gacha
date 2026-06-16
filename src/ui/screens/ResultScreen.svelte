<script lang="ts">
  import type { SessionManager } from '../../app/SessionManager';
  import { navigate } from '../../app/stores/routeStore';
  import { buildShareText } from '../share/shareText';
  import { shareOrCopy } from '../share/share';

  // Result 画面（T-019 / PRD F6・F9）。プレイ結果の表示とリトライ・共有・ホーム導線。
  // 結果は SessionManager.getResult() から取得（型推論で domain/data を直接 import しない）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  // レベル表示名（HomeScreen の LEVELS と対応）。result.level は domain の Level 値だが
  // ui→domain 直接依存を避けるため表示名はこのマップで解決する（T-023・F11）。
  const LEVEL_LABELS: Record<string, string> = {
    elementary: '小学生', // 小学生モード（T-028）
    juniorhigh: '大人', // 大人モード（小学生以外の常用）
    joyo: '常用', // タイムアタック（常用すべて）の表示
  };

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
  let sharing = $state(false);

  function retry(): void {
    if (!result) return;
    // 復習モード（T-035）は学年に依存しないため review フラグで再現する。
    // 復習は常に joyo/deck 固定（HomeScreen.startReview と同じ呼び出し）。
    if (result.isReview) {
      sessionManager.start('joyo', result.mode, 'deck', { review: true });
      navigate('game');
      return;
    }
    // 同じモード・同じ対象学年・同じ出題数で再開する（T-027/T-029）。
    sessionManager.start(result.level, result.mode, result.gameMode, {
      grades: result.deckGrades,
      count: result.targetTotal,
    });
    navigate('game');
  }

  // 結果シェア（T-023 / PRD F11）。レベル・スコア・作成漢字から定型文を生成し、Web Share API で
  // 共有シートを開く。非対応端末はクリップボードコピーにフォールバックし、結果をメッセージ表示する。
  async function share(): Promise<void> {
    if (!result || sharing) return;
    sharing = true;
    shareNote = '';
    const text = buildShareText({
      levelLabel: LEVEL_LABELS[result.level] ?? result.level,
      score: result.score,
      createdKanji: result.createdKanji,
    });
    const outcome = await shareOrCopy(text);
    if (outcome === 'copied') shareNote = 'クリップボードにコピーしました。';
    else if (outcome === 'failed') shareNote = 'シェアできませんでした。';
    // shared / cancelled は OS の共有シート側で完結するためメッセージは出さない。
    sharing = false;
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

    {#if result.gameMode === 'timeAttack'}
      <p class="mode" data-testid="result-mode">タイムアタック</p>
    {/if}

    {#if result.gameMode === 'deck'}
      <p class="collection" data-testid="collection">
        収集 <strong>{result.completedCount}</strong> / {result.targetTotal}
        <small>（{LEVEL_LABELS[result.level] ?? result.level}の漢字）</small>
      </p>
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
      <button type="button" onclick={share} disabled={sharing}>シェア</button>
      <button type="button" onclick={home}>ホーム</button>
    </nav>
  {/if}
</section>

<style>
  .newbest {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-title-size);
    font-weight: 700;
    color: var(--md-sys-color-tertiary);
  }
  .mode {
    display: inline-block;
    margin: 0.25rem 0;
    padding: 0.1rem 0.7rem;
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-label-size);
    font-weight: 700;
    color: var(--md-sys-color-primary);
    border: 1px solid var(--md-sys-color-primary);
    border-radius: var(--md-sys-shape-corner-full);
  }
  /* 称号は巻物/賞状風の枠で強調する。 */
  .rank {
    margin: 0.5rem auto;
    max-width: 18rem;
    padding: 0.6rem 1rem;
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-title-size);
    color: var(--md-sys-color-on-surface);
    background: linear-gradient(
      160deg,
      var(--md-sys-color-surface) 0%,
      var(--md-sys-color-surface-container) 100%
    );
    border: 2px solid var(--md-sys-color-tertiary);
    border-radius: var(--md-sys-shape-corner-medium);
    box-shadow: var(--md-sys-elevation-1);
  }
  .collection {
    margin: 0.25rem 0;
    font-size: var(--md-sys-typescale-title-size);
    color: var(--md-sys-color-on-surface);
  }
  .collection strong {
    font-size: var(--md-sys-typescale-headline-size);
    font-variant-numeric: tabular-nums;
    color: var(--md-sys-color-tertiary);
  }
  .collection small {
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.8rem;
  }
  .score {
    margin: 0.25rem 0;
    font-size: var(--md-sys-typescale-title-size);
    color: var(--md-sys-color-on-surface);
  }
  .rank strong {
    font-size: var(--md-sys-typescale-headline-size);
    color: var(--md-sys-color-primary);
  }
  .score strong {
    font-size: var(--md-sys-typescale-headline-size);
    font-variant-numeric: tabular-nums;
    color: var(--md-sys-color-tertiary);
  }
  .block {
    margin: 1rem 0;
  }
  .block h3 {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-body-size);
    color: var(--md-sys-color-on-surface-variant);
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
    font-family: var(--md-ref-typeface-kanji);
    font-size: 1.4rem;
    padding: 0.25rem 0.5rem;
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container-low);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-small);
  }
  .kanji-list li small {
    font-size: 0.7rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .kanji-list li.new {
    border-color: var(--md-sys-color-tertiary);
  }
  .none {
    color: var(--md-sys-color-on-surface-variant);
    margin: 0;
  }
  .share-note {
    color: var(--md-sys-color-on-surface-variant);
    font-size: var(--md-sys-typescale-body-size);
  }
</style>
