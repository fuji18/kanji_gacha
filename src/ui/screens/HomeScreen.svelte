<script lang="ts">
  import type { SessionManager } from '../../app/SessionManager';
  import { navigate } from '../../app/stores/routeStore';
  import { persistedStore } from '../../app/stores/persistedStore';

  // Home 画面（T-016 / PRD F3・F9）。レベル選択とエントリ導線を提供する。
  // SessionManager は App から prop で受け取る（ui→app の依存のみ。domain/data は型も含め直接 import しない）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  // レベル定義。id を `as const` のリテラル型に保つことで domain の Level 型を import せずに
  // `start(level)` へ渡せる（ui→domain 直接依存の禁止に抵触しない）。
  const LEVELS = [
    { id: 'elementary', label: 'やさしい', desc: '小学校で習う漢字' },
    { id: 'juniorhigh', label: 'ふつう', desc: '中学までに習う漢字' },
    { id: 'joyo', label: 'むずかしい', desc: '常用漢字すべて' },
  ] as const;

  type LevelId = (typeof LEVELS)[number]['id'];

  // レベル押下で即開始（1タップ）。説明画面を挟まず Game へ遷移する（2タップ以内・F3）。
  function startGame(level: LevelId): void {
    sessionManager.start(level, 'free');
    navigate('game');
  }

  // 今日のお題（daily・T-022）。日付から日替わり固定レベルを決め、ボタンに併記して開始する（PRD F8）。
  // svelte-ignore state_referenced_locally
  const daily = sessionManager.dailyInfo();
  const dailyLabel =
    LEVELS.find((l) => l.id === daily.level)?.label ?? daily.level;
  // 今日のデイリーベスト（永続反映・リアクティブ）。
  const dailyBest = $derived($persistedStore.dailyBest[daily.ymd] ?? 0);

  function startDaily(): void {
    sessionManager.start(daily.level, 'daily');
    navigate('game');
  }

  // タイムアタック（T-027）。実力（速度・知識・連続性）で持ち時間を延ばす別モード。free RNG で開始する。
  function startTimeAttack(level: LevelId): void {
    sessionManager.start(level, 'free', 'timeAttack');
    navigate('game');
  }
</script>

<section class="screen home">
  <h2>レベルをえらぶ</h2>

  <ul class="levels">
    {#each LEVELS as lv (lv.id)}
      <li>
        <button
          type="button"
          class="level"
          onclick={() => startGame(lv.id)}
          aria-label={`${lv.label}でゲーム開始`}
        >
          <span class="level-label">{lv.label}</span>
          <span class="level-desc">{lv.desc}</span>
          <span class="level-best"
            >ベスト {$persistedStore.bestScores[lv.id]}</span
          >
        </button>
      </li>
    {/each}
  </ul>

  <button
    type="button"
    class="daily"
    onclick={startDaily}
    aria-label={`今日のお題（${dailyLabel}）でゲーム開始`}
  >
    <span class="daily-title">今日のお題</span>
    <span class="daily-level">{dailyLabel}</span>
    <span class="daily-best">ベスト {dailyBest}</span>
  </button>

  <section class="ta-section">
    <h3 class="ta-title">タイムアタック</h3>
    <p class="ta-lead">制限時間制。正解すると時間が延びる実力勝負モード。</p>
    <ul class="ta-levels">
      {#each LEVELS as lv (lv.id)}
        <li>
          <button
            type="button"
            class="ta"
            onclick={() => startTimeAttack(lv.id)}
            aria-label={`${lv.label}でタイムアタック開始`}
          >
            <span class="ta-label">{lv.label}</span>
            <span class="ta-best"
              >ベスト {$persistedStore.timeAttackBest[lv.id]}</span
            >
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <nav class="actions">
    <button type="button" onclick={() => navigate('zukan')}>図鑑</button>
    <button type="button" onclick={() => navigate('about')}>About</button>
  </nav>
</section>

<style>
  .home h2 {
    font-family: var(--md-ref-typeface-brand);
    font-size: var(--md-sys-typescale-headline-size);
    color: var(--md-sys-color-on-surface);
  }
  /* 和紙カードの共通装飾（レベル札・今日のお題・タイムアタック）。 */
  .level,
  .daily,
  .ta {
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
  .ta:hover {
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
  .levels li:nth-child(3) .level {
    border-left-color: var(--md-sys-color-tertiary);
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
  .ta-levels {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
  @media (prefers-reduced-motion: reduce) {
    .level,
    .daily,
    .ta {
      transition: none;
    }
  }
</style>
