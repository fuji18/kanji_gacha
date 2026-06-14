<script lang="ts">
  import type { SessionManager } from '../../app/SessionManager';
  import { navigate } from '../../app/stores/routeStore';
  import { persistedStore } from '../../app/stores/persistedStore';

  // Home 画面（T-016 / PRD F3・F9）。レベル選択とエントリ導線を提供する。
  // SessionManager は App から prop で受け取る（ui→app の依存のみ。domain/data は型も含め直接 import しない）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  // じっくり（達成型・山札）レベル定義。むずかしい（joyo）は廃止し、やさしい/ふつうの2段。
  // id を `as const` のリテラル型に保つことで domain の Level 型を import せずに渡せる。
  const LEVELS = [
    {
      id: 'elementary',
      label: 'やさしい',
      desc: '小学校で習う漢字を集めて完成',
    },
    { id: 'juniorhigh', label: 'ふつう', desc: '中学で習う漢字を集めて完成' },
  ] as const;

  type LevelId = (typeof LEVELS)[number]['id'];

  // タイムアタックは常用漢字すべて（joyo スコープ）で行う。
  const TIME_ATTACK_LEVEL = 'joyo' as const;

  // レベル押下で即開始（1タップ）。説明画面を挟まず Game へ遷移する（2タップ以内・F3）。
  function startGame(level: LevelId): void {
    sessionManager.start(level, 'free');
    navigate('game');
  }

  // 今日のお題（daily・T-022）。日付から日替わり固定レベル（elementary/juniorhigh）を決めて開始する。
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

  // タイムアタック（T-027）。常用漢字で、正解すると持ち時間が延びる実力勝負モード。
  function startTimeAttack(): void {
    sessionManager.start(TIME_ATTACK_LEVEL, 'free', 'timeAttack');
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
    <p class="ta-lead">
      常用漢字すべて。正解すると時間が延びる実力勝負モード。
    </p>
    <button
      type="button"
      class="ta"
      onclick={startTimeAttack}
      aria-label="常用でタイムアタック開始"
    >
      <span class="ta-label">常用漢字</span>
      <span class="ta-best"
        >ベスト {$persistedStore.timeAttackBest[TIME_ATTACK_LEVEL]}</span
      >
    </button>
  </section>

  <nav class="actions">
    <button type="button" onclick={() => navigate('zukan')}>図鑑</button>
    <button type="button" onclick={() => navigate('about')}>About</button>
  </nav>
</section>

<style>
  .levels {
    list-style: none;
    padding: 0;
    margin: 0 0 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .level {
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.9rem 1.1rem;
    font-size: 1rem;
    cursor: pointer;
    text-align: left;
  }
  .level-label {
    font-weight: 700;
    font-size: 1.1rem;
  }
  .level-desc {
    color: #555;
    font-size: 0.85rem;
  }
  .level-best {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: #333;
  }
  .daily {
    width: 100%;
    padding: 0.8rem 1.1rem;
    font-size: 1rem;
    cursor: pointer;
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 0.75rem;
    text-align: left;
  }
  .daily-title {
    font-weight: 700;
  }
  .daily-level {
    font-size: 0.85rem;
    color: #555;
  }
  .daily-best {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: #333;
  }
  .ta-section {
    margin: 1.5rem 0 0;
  }
  .ta-title {
    font-size: 1rem;
    margin: 0 0 0.2rem;
  }
  .ta-lead {
    font-size: 0.82rem;
    color: #555;
    margin: 0 0 0.6rem;
  }
  .ta {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 1.1rem;
    font-size: 1rem;
    cursor: pointer;
    text-align: left;
  }
  .ta-label {
    font-weight: 700;
  }
  .ta-best {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: #333;
  }
</style>
