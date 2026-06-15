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
  import MaterialButton from '../components/MaterialButton.svelte';
  import EmakimonoReveal from '../components/EmakimonoReveal.svelte';
  import StrokeKanji from '../components/StrokeKanji.svelte';
  import { RARITY_LABELS } from '../labels/rarityLabels';
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
    strokes: number;
    gained: number;
    key: number;
  } | null>(null);
  let floatSeq = 0;

  // ---- ガチャ獲得演出（おみくじ巻物）。装飾オーバーレイのため操作はブロックしない ----
  let reveal = $state<{
    char: string;
    rarity: number;
    rarityLabel: string;
    key: number;
  } | null>(null);
  let revealSeq = 0;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;

  function clearRevealTimer(): void {
    if (revealTimer !== null) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
  }

  // 筆順描画の完了後、一定時間表示してから巻物を消す。
  function onRevealComplete(): void {
    clearRevealTimer();
    revealTimer = setTimeout(
      () => {
        reveal = null;
        revealTimer = null;
      },
      reducedMotion ? 0 : 600
    );
  }

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
    clearRevealTimer();
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
      strokes: number;
    },
    gained: number
  ): void {
    if (fxWidth > 0 && fxHeight > 0) field?.burst(fxWidth / 2, fxHeight / 2);
    floatSeq += 1;
    floatInfo = {
      char: awarded.char,
      reading: awarded.readings[0] ?? '',
      meaning: awarded.meanings[0] ?? '',
      strokes: awarded.strokes,
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
    // ガチャ前後の手札 instanceId 差分で「新しく引いた部品」を特定し、巻物演出に渡す。
    const before = new Set(s.hand.map((h) => h.instanceId));
    sessionManager.pullGacha(s);
    selectedIds = []; // 手札が変わるので選択もリセット（他コマンドと一貫）
    hintedIds = [];
    feedback = '';
    floatInfo = null;

    clearRevealTimer();
    const added = s.hand.find((h) => !before.has(h.instanceId));
    const part = added ? sessionManager.partView(added.partId) : null;
    reveal = part
      ? {
          char: part.char,
          rarity: part.rarity,
          rarityLabel: RARITY_LABELS[part.rarity] ?? '',
          key: ++revealSeq,
        }
      : null;
  }

  function doCombine(): void {
    const s = sessionManager.getSession();
    if (!s || selectedIds.length < 2) return;
    clearRevealTimer();
    reveal = null;
    const sel = s.hand.filter((h) => selectedIds.includes(h.instanceId));
    const result = sessionManager.combine(s, sel);
    if (result.success && result.resolved) {
      feedback = `+${result.gainedScore}！`;
      fireSuccess(result.resolved.awarded, result.gainedScore);
    } else if (result.duplicate) {
      // 達成型：既出の漢字（重複）はノーペナルティ。ミス演出は出さない（T-029）。
      feedback = 'もう作ったよ';
      floatInfo = null;
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
    clearRevealTimer();
    reveal = null;
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
      remainingLabel="山札"
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
            <span class="sf-char">
              <StrokeKanji char={floatInfo.char} size={64} {reducedMotion} />
            </span>
            <span class="sf-info">
              {#if floatInfo.reading}<span class="sf-yomi"
                  >{floatInfo.reading}</span
                >{/if}
              {#if floatInfo.meaning}<span class="sf-mean"
                  >{floatInfo.meaning}</span
                >{/if}
              <span class="sf-strokes">{floatInfo.strokes}画</span>
              <span class="sf-score">+{floatInfo.gained}</span>
            </span>
          </div>
        {/key}
      {/if}

      {#if reveal}
        {#key reveal.key}
          <EmakimonoReveal
            char={reveal.char}
            rarity={reveal.rarity}
            rarityLabel={reveal.rarityLabel}
            {reducedMotion}
            oncomplete={onRevealComplete}
          />
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
        remainingLabel="山札"
        onclick={doGacha}
      />
      <MaterialButton
        variant="filled"
        color="primary"
        accentRing
        disabled={!canCombine}
        onclick={doCombine}>合体！</MaterialButton
      >
      <HintButton disabled={hintDisabled} onclick={doHint} />
      <MaterialButton
        variant="outlined"
        color="secondary"
        disabled={!canDiscard}
        onclick={doDiscard}>捨てて引き直す</MaterialButton
      >
    </div>

    <nav class="actions">
      <MaterialButton variant="outlined" color="secondary" onclick={quit}
        >やめる</MaterialButton
      >
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
  .screen.game {
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    border-radius: var(--md-sys-shape-corner-large);
    padding: 1rem;
  }
  .feedback {
    min-height: 1.4rem;
    margin: 0 0 0.5rem;
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    color: var(--md-sys-color-primary);
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
  /* 合体成功の学習カード（完成漢字の筆順＋読み・意味・画数・加点。T-030）。 */
  .score-float {
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    pointer-events: none;
    display: flex;
    gap: 0.6rem;
    align-items: center;
    justify-content: center;
    background: var(--md-sys-color-surface, rgba(255, 255, 255, 0.92));
    border: 1px solid var(--md-sys-color-outline-variant, #ddd);
    box-shadow: var(--md-sys-elevation-2);
    padding: 0.4rem 0.7rem;
    border-radius: var(--md-sys-shape-corner-medium, 0.5rem);
  }
  /* 筆順アニメ（StrokeKanji）の表示枠。 */
  .sf-char {
    display: inline-flex;
    color: var(--md-sys-color-on-surface);
  }
  .sf-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    text-align: left;
  }
  .sf-yomi {
    color: var(--md-sys-color-on-surface-variant, #555);
    font-size: 0.9rem;
  }
  .sf-mean {
    color: var(--md-sys-color-on-surface-variant, #555);
    font-size: 0.8rem;
  }
  .sf-strokes {
    color: var(--md-sys-color-secondary, #2c3e6b);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
  .sf-score {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    color: var(--md-sys-color-primary, #2a6);
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
  /* App.svelte の :global(.screen .actions button)（特異性 0,2,1）に対し、
     Material ボタン寸法を 0,3,0 で上書きして「やめる」の見た目を保つ。 */
  .actions :global(.md-btn) {
    padding: 0 20px;
    font-size: 1.05rem;
  }
</style>
