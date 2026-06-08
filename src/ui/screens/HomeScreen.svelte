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

  // 今日のお題（daily）。暫定で elementary を渡す。
  // TODO(T-022): 日替わりレベルの決定・シード統合と、対象レベルのボタン併記（PRD F8）。
  function startDaily(): void {
    sessionManager.start('elementary', 'daily');
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

  <button type="button" class="daily" onclick={startDaily}>今日のお題</button>

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
  }
</style>
