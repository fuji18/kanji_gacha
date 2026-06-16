<script lang="ts">
  import type { SessionManager } from '../../app/SessionManager';
  import { navigate } from '../../app/stores/routeStore';
  import { persistedStore } from '../../app/stores/persistedStore';
  import Furigana from '../components/Furigana.svelte';

  // Home 画面（T-016 / PRD F3・F9）。レベル選択とエントリ導線を提供する。
  // SessionManager は App から prop で受け取る（ui→app の依存のみ。domain/data は型も含め直接 import しない）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  // タイムアタックは常用漢字すべて（joyo スコープ）で行う。
  const TIME_ATTACK_LEVEL = 'joyo' as const;
  type DeckLevel = 'elementary' | 'juniorhigh';

  // 小学生モードの学年（小1〜小6＋全学年の7択）。grades は domain の grade（1–6）。
  const GRADES: { label: string; grades: number[] }[] = [
    { label: '小1', grades: [1] },
    { label: '小2', grades: [2] },
    { label: '小3', grades: [3] },
    { label: '小4', grades: [4] },
    { label: '小5', grades: [5] },
    { label: '小6', grades: [6] },
    { label: '全学年', grades: [1, 2, 3, 4, 5, 6] },
  ];

  // 出題数プリセット（達成型）。「全部」は count 未指定＝対象すべて。
  const COUNTS: { label: string; count?: number }[] = [
    { label: '5字', count: 5 },
    { label: '10字', count: 10 },
    { label: '20字', count: 20 },
    { label: '50字', count: 50 },
    { label: '全部', count: undefined },
  ];

  // 2段選択フロー：top → (小学生は学年) → 出題数 → 開始（T-029）。
  type Step =
    | { kind: 'top' }
    | { kind: 'grade' }
    | { kind: 'count'; level: DeckLevel; grades: number[]; title: string };
  let step = $state<Step>({ kind: 'top' });

  function startDeck(level: DeckLevel, grades: number[], count?: number): void {
    sessionManager.start(level, 'free', 'deck', { grades, count });
    navigate('game');
  }
  function toGrade(): void {
    step = { kind: 'grade' };
  }
  function chooseGrade(g: { label: string; grades: number[] }): void {
    step = {
      kind: 'count',
      level: 'elementary',
      grades: g.grades,
      title: `小学生モード・${g.label}`,
    };
  }
  function toAdultCount(): void {
    step = {
      kind: 'count',
      level: 'juniorhigh',
      grades: [8],
      title: '大人モード',
    };
  }
  function chooseCount(count?: number): void {
    if (step.kind !== 'count') return;
    startDeck(step.level, step.grades, count);
  }
  function back(): void {
    step = { kind: 'top' };
  }

  // 今日のお題（daily・T-022）。日付から日替わり固定レベルを決めて開始する。
  // svelte-ignore state_referenced_locally
  const daily = sessionManager.dailyInfo();
  const dailyLabel = daily.level === 'elementary' ? '小学生' : '大人';
  const dailyBest = $derived($persistedStore.dailyBest[daily.ymd] ?? 0);

  function startDaily(): void {
    sessionManager.start(daily.level, 'daily');
    navigate('game');
  }

  // タイムアタック（T-027）。常用漢字で、正解すると持ち時間が延びる実力勝負モード。
  function startTimeAttack(): void {
    sessionManager.start(TIME_ATTACK_LEVEL, 'free', 'timeAttack');
    navigate('game');
  }

  // 復習モード（T-035）。にがて漢字（未完成で終わった字）を優先して出題する達成型。
  // にがて字が1つ以上あるときだけ入口を出す。常用スコープ（joyo）でどの学年の字も解決可能にする。
  const weakCount = $derived(Object.keys($persistedStore.weakKanji).length);
  function startReview(): void {
    sessionManager.start('joyo', 'free', 'deck', { review: true });
    navigate('game');
  }

  // ふりがな表示設定（T-031）。低学年向けに UI 文言へふりがなを付ける。
  const furiganaOn = $derived($persistedStore.settings.furigana);
  function toggleFurigana(): void {
    sessionManager.setFurigana(!furiganaOn);
  }

  // 文字サイズ拡大（T-037・アクセシビリティ）。
  const largeTextOn = $derived($persistedStore.settings.largeText);
  function toggleLargeText(): void {
    sessionManager.setLargeText(!largeTextOn);
  }

  // 読み上げ（音声・T-032）。
  const ttsOn = $derived($persistedStore.settings.tts);
  function toggleTts(): void {
    sessionManager.setTts(!ttsOn);
  }
</script>

<section class="screen home">
  {#if step.kind === 'top'}
    <h2>モードをえらぶ</h2>

    <ul class="levels">
      <li>
        <button
          type="button"
          class="level"
          onclick={toGrade}
          aria-label="小学生モードをえらぶ"
        >
          <span class="level-label"
            ><Furigana text="小学生" reading="しょうがくせい" />モード</span
          >
          <span class="level-desc">小学校で習う漢字を学年ごとに完成</span>
          <span class="level-best"
            >ベスト {$persistedStore.bestScores.elementary}</span
          >
        </button>
      </li>
      <li>
        <button
          type="button"
          class="level"
          onclick={toAdultCount}
          aria-label="大人モードをえらぶ"
        >
          <span class="level-label"
            ><Furigana text="大人" reading="おとな" />モード</span
          >
          <span class="level-desc"
            >小学生漢字以外のすべて（中学以降の常用）</span
          >
          <span class="level-best"
            >ベスト {$persistedStore.bestScores.juniorhigh}</span
          >
        </button>
      </li>
    </ul>

    <button
      type="button"
      class="daily"
      onclick={startDaily}
      aria-label={`今日のお題（${dailyLabel}）でゲーム開始`}
    >
      <span class="daily-title"
        ><Furigana text="今日のお題" reading="きょうのおだい" /></span
      >
      <span class="daily-level">{dailyLabel}</span>
      <span class="daily-best">ベスト {dailyBest}</span>
    </button>

    <section class="ta-section">
      <h3 class="ta-title">タイムアタック</h3>
      <p class="ta-lead">
        常用漢字すべて。正解すると時間が延びる実力勝負モード。
      </p>
      <button
        type="button"
        class="ta"
        onclick={startTimeAttack}
        aria-label="常用でタイムアタック開始"
      >
        <span class="ta-label"
          ><Furigana text="常用漢字" reading="じょうようかんじ" /></span
        >
        <span class="ta-best"
          >ベスト {$persistedStore.timeAttackBest[TIME_ATTACK_LEVEL]}</span
        >
      </button>
    </section>

    {#if weakCount > 0}
      <section class="review-section">
        <h3 class="review-title">
          <Furigana text="復習" reading="ふくしゅう" />モード
        </h3>
        <p class="review-lead">
          まだ作れていない<Furigana
            text="苦手"
            reading="にがて"
          />な漢字を、優先して出題します。
        </p>
        <button
          type="button"
          class="review"
          onclick={startReview}
          aria-label={`苦手な漢字${weakCount}字を復習する`}
        >
          <span class="review-label"
            ><Furigana text="苦手" reading="にがて" />な漢字を復習</span
          >
          <span class="review-count">{weakCount}字</span>
        </button>
      </section>
    {/if}

    <nav class="actions">
      <button type="button" onclick={() => navigate('zukan')}
        ><Furigana text="図鑑" reading="ずかん" /></button
      >
      <button type="button" onclick={() => navigate('about')}>About</button>
      <button
        type="button"
        class="furigana-toggle"
        aria-pressed={furiganaOn}
        onclick={toggleFurigana}>ふりがな {furiganaOn ? 'ON' : 'OFF'}</button
      >
      <button
        type="button"
        class="furigana-toggle"
        aria-pressed={largeTextOn}
        onclick={toggleLargeText}>文字大 {largeTextOn ? 'ON' : 'OFF'}</button
      >
      <button
        type="button"
        class="furigana-toggle"
        aria-pressed={ttsOn}
        onclick={toggleTts}>音声 {ttsOn ? 'ON' : 'OFF'}</button
      >
    </nav>
  {:else if step.kind === 'grade'}
    <h2><Furigana text="学年" reading="がくねん" />をえらぶ</h2>
    <ul class="picker">
      {#each GRADES as g (g.label)}
        <li>
          <button
            type="button"
            class="pick"
            onclick={() => chooseGrade(g)}
            aria-label={`${g.label}をえらぶ`}>{g.label}</button
          >
        </li>
      {/each}
    </ul>
    <nav class="actions">
      <button type="button" onclick={back}>もどる</button>
    </nav>
  {:else}
    <h2><Furigana text="出題数" reading="しゅつだいすう" />をえらぶ</h2>
    <p class="step-title">{step.title}</p>
    <ul class="picker">
      {#each COUNTS as c (c.label)}
        <li>
          <button
            type="button"
            class="pick"
            onclick={() => chooseCount(c.count)}
            aria-label={`${c.label}で開始`}>{c.label}</button
          >
        </li>
      {/each}
    </ul>
    <nav class="actions">
      <button type="button" onclick={back}>もどる</button>
    </nav>
  {/if}
</section>

<style>
  .home h2 {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-headline-size);
    color: var(--md-sys-color-on-surface);
  }
  /* 和紙カードの共通装飾（レベル札・今日のお題・タイムアタック・復習）。 */
  .level,
  .daily,
  .ta,
  .review {
    width: 100%;
    background: linear-gradient(
      160deg,
      var(--md-sys-color-surface) 0%,
      var(--md-sys-color-surface-container) 100%
    );
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-large);
    box-shadow: var(--md-sys-elevation-1);
    cursor: pointer;
    text-align: left;
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
  }
  .level:hover,
  .daily:hover,
  .ta:hover,
  .review:hover {
    transform: translateY(-1px);
    box-shadow: var(--md-sys-elevation-2);
  }
  .levels {
    list-style: none;
    padding: 0;
    margin: 0 0 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .level {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.9rem 1.1rem;
    /* 難易度で左帯のアクセント色を変える（藍→朱→金）。 */
    border-left: 6px solid var(--md-sys-color-secondary);
  }
  .levels li:nth-child(2) .level {
    border-left-color: var(--md-sys-color-primary);
  }
  .level-label {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    font-size: var(--md-sys-typescale-title-size);
    color: var(--md-sys-color-on-surface);
  }
  .level-desc {
    color: var(--md-sys-color-on-surface-variant);
    font-size: var(--md-sys-typescale-label-size);
  }
  .level-best {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--md-sys-color-on-surface-variant);
  }
  .daily {
    padding: 0.8rem 1.1rem;
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 0.75rem;
    /* 今日のお題は特別感：金の枠アクセント。 */
    border: 1px solid var(--md-sys-color-tertiary);
  }
  .daily-title {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    color: var(--md-sys-color-on-surface);
  }
  .daily-level {
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
  }
  .daily-best {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--md-sys-color-on-surface-variant);
  }
  .ta-section {
    margin: 1.5rem 0 0;
  }
  .ta-title {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-title-size);
    color: var(--md-sys-color-on-surface);
    margin: 0 0 0.2rem;
  }
  .ta-lead {
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
    margin: 0 0 0.6rem;
  }
  .ta {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 1.1rem;
    border-left: 6px solid var(--md-sys-color-primary);
  }
  .ta-label {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    color: var(--md-sys-color-on-surface);
  }
  .ta-best {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--md-sys-color-on-surface-variant);
  }
  .review-section {
    margin: 1.5rem 0 0;
  }
  .review-title {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-title-size);
    color: var(--md-sys-color-on-surface);
    margin: 0 0 0.2rem;
  }
  .review-lead {
    font-size: var(--md-sys-typescale-label-size);
    color: var(--md-sys-color-on-surface-variant);
    margin: 0 0 0.6rem;
  }
  .review {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 1.1rem;
    /* 復習は学び直しの色＝藍（secondary）アクセント。 */
    border-left: 6px solid var(--md-sys-color-secondary);
  }
  .review-label {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    color: var(--md-sys-color-on-surface);
  }
  .review-count {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--md-sys-color-on-surface-variant);
  }
  .step-title {
    font-family: var(--md-ref-typeface-brand);
    color: var(--md-sys-color-primary);
    margin: 0 0 0.75rem;
  }
  .picker {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr));
    gap: 0.6rem;
  }
  .pick {
    width: 100%;
    padding: 0.9rem 0.5rem;
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-title-size);
    font-weight: 700;
    color: var(--md-sys-color-on-surface);
    background: linear-gradient(
      160deg,
      var(--md-sys-color-surface) 0%,
      var(--md-sys-color-surface-container) 100%
    );
    border: 1px solid var(--md-sys-color-outline-variant);
    border-left: 6px solid var(--md-sys-color-secondary);
    border-radius: var(--md-sys-shape-corner-large);
    box-shadow: var(--md-sys-elevation-1);
    cursor: pointer;
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
  }
  .pick:hover {
    transform: translateY(-1px);
    box-shadow: var(--md-sys-elevation-2);
  }
  @media (prefers-reduced-motion: reduce) {
    .level,
    .daily,
    .ta,
    .review,
    .pick {
      transition: none;
    }
  }
</style>
