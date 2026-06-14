<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { SessionManager } from '../../app/SessionManager';
  import { sessionStore } from '../../app/stores/sessionStore';
  import { navigate } from '../../app/stores/routeStore';
  import ScoreBar from '../components/ScoreBar.svelte';
  import TimeBar from '../components/TimeBar.svelte';
  import HandView from '../components/HandView.svelte';
  import GachaButton from '../components/GachaButton.svelte';
  import HintButton from '../components/HintButton.svelte';
  import { ParticleField } from '../effects/particleField';
  import '../effects/effects.css';

  // Game 画面（T-017 / PRD F1・F2・F4・F5）。ガチャ・合体・救済の操作とゲーム状態表示。
  // SessionManager は App から prop で受け取り、状態は sessionStore 購読で得る（domain/data は触れない）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  // 表示は store スナップショット（$sessionStore）を購読し、操作（コマンド）は SessionManager の
  // 正本セッション（getSession()）に対して行う。SessionManager は publish 毎に新参照を発行するため、
  // 同一オブジェクトのその場更新でも Svelte が再描画する（architecture 4）。
  const view = $derived($sessionStore);

  // ローカル UI 状態（選択・ヒント強調・直近フィードバック）
  let selectedIds = $state<string[]>([]);
  let hintedIds = $state<string[]>([]);
  let feedback = $state('');

  // ---- タイムアタック（T-027）。残時間はUIのティッカーで実時刻から算出し、0で終了判定する ----
  const isTimeAttack = $derived(view?.gameMode === 'timeAttack');
  // sessionManager は不変の prop。初期値参照で問題ない（残時間バーの満タン基準）。
  // svelte-ignore state_referenced_locally
  const taTotalMs = sessionManager.timeAttackTotalMs();
  let timeRemainingMs = $state(0);
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  // 100ms 間隔で残時間を更新し、0以下なら時間切れ終了を要求する（ended→下部の $effect で result 遷移）。
  function tick(): void {
    const s = sessionManager.getSession();
    if (!s || s.gameMode !== 'timeAttack') return;
    timeRemainingMs = sessionManager.timeRemainingMs(s);
    if (s.phase === 'playing' && timeRemainingMs <= 0) {
      sessionManager.checkTimeout();
    }
  }

  // ---- 演出（T-018）。Canvas は独自 rAF ループで描画し、判定をブロックしない ----
  const reducedMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let fxWidth = $state(0);
  let fxHeight = $state(0);
  let field = $state<ParticleField | null>(null);
  let shaking = $state(false);
  let shakeTimer: ReturnType<typeof setTimeout> | null = null;
  let floatInfo = $state<{
    char: string;
    reading: string;
    meaning: string;
    gained: number;
    key: number;
  } | null>(null);
  let floatSeq = 0;

  onMount(() => {
    const ctx = canvasEl?.getContext('2d') ?? null;
    if (ctx) {
      field = new ParticleField(ctx, { reducedMotion });
      field.start();
    }
    // タイムアタックの残時間ティッカー。timeAttack 以外では tick() が即 return するため無害。
    tick();
    tickTimer = setInterval(tick, 100);
  });
  onDestroy(() => {
    field?.stop();
    if (shakeTimer !== null) clearTimeout(shakeTimer);
    if (tickTimer !== null) clearInterval(tickTimer);
  });

  // canvas のピクセルサイズを要素サイズに同期する。
  $effect(() => {
    if (canvasEl && field) {
      canvasEl.width = fxWidth;
      canvasEl.height = fxHeight;
      field.resize(fxWidth, fxHeight);
    }
  });

  function fireSuccess(
    awarded: {
      char: string;
      readings: string[];
      meanings: string[];
    },
    gained: number
  ): void {
    if (fxWidth > 0 && fxHeight > 0) field?.burst(fxWidth / 2, fxHeight / 2);
    floatSeq += 1;
    floatInfo = {
      char: awarded.char,
      reading: awarded.readings[0] ?? '',
      meaning: awarded.meanings[0] ?? '',
      gained,
      key: floatSeq,
    };
    // 表示は次の操作（ガチャ/合体/捨てる）まで残す。クリアは各ハンドラで行う。
  }

  function fireMiss(): void {
    shaking = true;
    if (shakeTimer !== null) clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => {
      shaking = false;
      shakeTimer = null;
    }, 450);
  }

  // 手札の表示モデル（partId → 文字/レアリティを SessionManager で解決し、選択/ヒントを付与）
  const handItems = $derived(
    (view?.hand ?? []).map((h) => {
      const part = sessionManager.partView(h.partId);
      return {
        instanceId: h.instanceId,
        char: part?.char ?? '？',
        rarity: part?.rarity ?? 1,
        selected: selectedIds.includes(h.instanceId),
        hinted: hintedIds.includes(h.instanceId),
      };
    })
  );

  const canPull = $derived(view ? sessionManager.canPullGacha(view) : false);
  // 残はあるのに引けない＝手札上限。整理（合体/捨てる）を促す。
  const handFull = $derived(
    view !== null && view.gachaRemaining > 0 && !canPull
  );
  const canCombine = $derived(selectedIds.length >= 2);
  const canDiscard = $derived(selectedIds.length === 1);
  const hintDisabled = $derived(!view || !sessionManager.canUseHint(view));

  function toggle(instanceId: string): void {
    selectedIds = selectedIds.includes(instanceId)
      ? selectedIds.filter((id) => id !== instanceId)
      : [...selectedIds, instanceId];
  }

  function doGacha(): void {
    const s = sessionManager.getSession();
    if (!s) return;
    sessionManager.pullGacha(s);
    selectedIds = []; // 手札が変わるので選択もリセット（他コマンドと一貫）
    hintedIds = [];
    feedback = '';
    floatInfo = null;
  }

  function doCombine(): void {
    const s = sessionManager.getSession();
    if (!s || selectedIds.length < 2) return;
    const sel = s.hand.filter((h) => selectedIds.includes(h.instanceId));
    const result = sessionManager.combine(s, sel);
    if (result.success && result.resolved) {
      feedback = `+${result.gainedScore}！`;
      fireSuccess(result.resolved.awarded, result.gainedScore);
    } else {
      feedback = '✕ ミス…';
      floatInfo = null;
      fireMiss();
    }
    selectedIds = [];
    hintedIds = [];
  }

  function doHint(): void {
    const s = sessionManager.getSession();
    if (!s) return;
    const hint = sessionManager.useHint(s);
    if (hint === null) {
      hintedIds = [];
      feedback = 'ヒントが出せません';
      return;
    }
    hintedIds = hint.map((h) => h.instanceId);
    feedback = '光っている部品が合体できます';
  }

  function doDiscard(): void {
    const s = sessionManager.getSession();
    if (!s || selectedIds.length !== 1) return;
    sessionManager.discardAndDraw(s, selectedIds[0]);
    selectedIds = [];
    hintedIds = [];
    feedback = '';
    floatInfo = null;
  }

  function quit(): void {
    navigate('home');
  }

  // 終了条件（詰み/手札0）に達したら結果画面へ自動遷移する（機能設計6）。
  $effect(() => {
    if ($sessionStore?.phase === 'ended') navigate('result');
  });
</script>

<section class="screen game" class:kg-shake={shaking}>
  <h2 class="sr-only">ゲーム</h2>

  {#if view === null}
    <p>ゲームが開始されていません。</p>
    <button type="button" onclick={quit}>ホームへ</button>
  {:else}
    {#if isTimeAttack}
      <TimeBar
        remainingMs={timeRemainingMs}
        initialMs={taTotalMs}
        {reducedMotion}
      />
    {/if}

    <ScoreBar
      score={view.score.score}
      comboMultiplier={view.score.comboMultiplier}
      comboCount={view.score.comboCount}
      gachaRemaining={view.gachaRemaining}
      showGachaRemaining={!isTimeAttack}
    />

    <p class="feedback" role="status" data-testid="feedback">{feedback}</p>

    <div
      class="fx-wrap"
      bind:clientWidth={fxWidth}
      bind:clientHeight={fxHeight}
    >
      <canvas class="fx-layer" bind:this={canvasEl} aria-hidden="true"></canvas>
      <HandView items={handItems} onToggle={toggle} />

      {#if floatInfo}
        {#key floatInfo.key}
          <div class="kg-score-float score-float" data-testid="score-float">
            <span class="sf-char">{floatInfo.char}</span>
            {#if floatInfo.reading}<span class="sf-yomi"
                >{floatInfo.reading}</span
              >{/if}
            {#if floatInfo.meaning}<span class="sf-mean"
                >{floatInfo.meaning}</span
              >{/if}
            <span class="sf-score">+{floatInfo.gained}</span>
          </div>
        {/key}
      {/if}
    </div>

    {#if handFull}
      <p class="organize" role="status">
        手札がいっぱいです。合体や「捨てる」で整理してください。
      </p>
    {/if}

    <div class="controls">
      <GachaButton
        remaining={view.gachaRemaining}
        disabled={!canPull}
        showRemaining={!isTimeAttack}
        onclick={doGacha}
      />
      <button
        type="button"
        class="combine"
        disabled={!canCombine}
        onclick={doCombine}>合体！</button
      >
      <HintButton disabled={hintDisabled} onclick={doHint} />
      <button
        type="button"
        class="discard"
        disabled={!canDiscard}
        onclick={doDiscard}>捨てて引き直す</button
      >
    </div>

    <nav class="actions">
      <button type="button" onclick={quit}>やめる</button>
    </nav>
  {/if}
</section>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .feedback {
    min-height: 1.4rem;
    margin: 0 0 0.5rem;
    font-weight: 700;
    color: #2a6;
  }
  .fx-wrap {
    position: relative;
  }
  /* 合体成功の Canvas 演出。手札域に重ね、操作を妨げない。 */
  .fx-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
  }
  /* スコア/読み・意味の浮上表示（DOM・アクセシビリティ確保）。 */
  .score-float {
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    pointer-events: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: baseline;
    justify-content: center;
    background: rgba(255, 255, 255, 0.85);
    padding: 0.3rem 0.6rem;
    border-radius: 0.5rem;
  }
  .sf-char {
    font-size: 1.4rem;
    font-weight: 700;
  }
  .sf-yomi {
    color: #555;
  }
  .sf-mean {
    color: #555;
    font-size: 0.85rem;
  }
  .sf-score {
    font-weight: 700;
    color: #2a6;
  }
  .organize {
    color: #b00;
    font-size: 0.9rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    justify-content: center;
    margin-top: 1rem;
  }
  .controls button {
    padding: 0.7rem 1.2rem;
    font-size: 1rem;
    cursor: pointer;
  }
  .controls button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .combine {
    font-weight: 700;
  }
</style>
