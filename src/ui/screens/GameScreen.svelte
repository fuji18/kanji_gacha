<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { SessionManager } from '../../app/SessionManager';
  import { sessionStore } from '../../app/stores/sessionStore';
  import { persistedStore } from '../../app/stores/persistedStore';
  import { navigate } from '../../app/stores/routeStore';
  import TimeBar from '../components/TimeBar.svelte';
  import HandView from '../components/HandView.svelte';
  import GachaButton from '../components/GachaButton.svelte';
  import MaterialButton from '../components/MaterialButton.svelte';
  import EmakimonoReveal from '../components/EmakimonoReveal.svelte';
  import StrokeKanji from '../components/StrokeKanji.svelte';
  import SpeakButton from '../components/SpeakButton.svelte';
  import { RARITY_LABELS } from '../labels/rarityLabels';
  import { ParticleField } from '../effects/particleField';
  import '../effects/effects.css';

  // Game 画面（T-017 / PRD F1・F2・F4・F5）。handoff design「和風モダン」を移植。
  // SessionManager は App から prop で受け取り、状態は sessionStore 購読で得る（domain/data は触れない）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  const view = $derived($sessionStore);

  // ローカル UI 状態（選択・ヒント強調・直近フィードバック）
  let selectedIds = $state<string[]>([]);
  let hintedIds = $state<string[]>([]);
  let feedback = $state('');
  // 段階ヒント（T-033）：0=未使用 / 1=光る / 2=読み開示 / 3=答え開示。
  let hintStage = $state(0);
  let hintInfo = $state<{ char: string; reading: string } | null>(null);

  // ---- タイムアタック（T-027）。残時間はUIのティッカーで実時刻から算出し、0で終了判定する ----
  const isTimeAttack = $derived(view?.gameMode === 'timeAttack');
  // svelte-ignore state_referenced_locally
  const taTotalMs = sessionManager.timeAttackTotalMs();
  let timeRemainingMs = $state(0);
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  function tick(): void {
    const s = sessionManager.getSession();
    if (!s || s.gameMode !== 'timeAttack') return;
    timeRemainingMs = sessionManager.timeRemainingMs(s);
    if (s.phase === 'playing' && timeRemainingMs <= 0) {
      sessionManager.checkTimeout();
    }
  }

  // 残り秒（切り上げ表示）と警告段階（design: ≤10 注意 / ≤5 警告）。
  const timeSeconds = $derived(Math.ceil(Math.max(0, timeRemainingMs) / 1000));
  const timeWarn = $derived(
    timeRemainingMs <= 10_000 && timeRemainingMs > 5_000
  );
  const timeUrgent = $derived(timeRemainingMs <= 5_000);

  // ---- 設定トグル（ふりがな/大きさ/音）。design のカード上トグルを移植（T-031/T-037/T-032） ----
  const settings = $derived($persistedStore.settings);
  function toggleFurigana(): void {
    sessionManager.setFurigana(!settings.furigana);
  }
  function toggleLargeText(): void {
    sessionManager.setLargeText(!settings.largeText);
  }
  function toggleTts(): void {
    sessionManager.setTts(!settings.tts);
  }

  // ---- ずかん収集率（達成型）。作った異なり漢字数 / 出題数 N。 ----
  const collected = $derived(new Set(view?.createdKanji ?? []).size);
  const collectTotal = $derived(view?.targetTotal ?? 0);
  const collectPct = $derived(
    collectTotal > 0 ? Math.round((collected / collectTotal) * 100) : 0
  );

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

  // ステージ背面の透かし（完成字 or 既定「和」）。
  const stageWatermark = $derived(floatInfo?.char ?? '和');

  // 合体プロンプト（選択枚数で文言と点滅を切替）。
  const selCount = $derived(selectedIds.length);
  const combineReady = $derived(selCount >= 2);
  const promptText = $derived(
    combineReady
      ? '↓ 下の「合体！」でつくる'
      : selCount === 1
        ? 'あと1枚えらぶ'
        : 'カードを2枚えらぶ'
  );

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
    tick();
    tickTimer = setInterval(tick, 100);
  });
  onDestroy(() => {
    field?.stop();
    if (shakeTimer !== null) clearTimeout(shakeTimer);
    if (tickTimer !== null) clearInterval(tickTimer);
    clearRevealTimer();
  });

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
  }

  function fireMiss(): void {
    shaking = true;
    if (shakeTimer !== null) clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => {
      shaking = false;
      shakeTimer = null;
    }, 450);
  }

  // 手札の表示モデル（partId → 文字/レアリティを解決し、選択順/ヒントを付与）
  const handItems = $derived(
    (view?.hand ?? []).map((h) => {
      const part = sessionManager.partView(h.partId);
      const order = selectedIds.indexOf(h.instanceId);
      return {
        instanceId: h.instanceId,
        char: part?.char ?? '？',
        rarity: part?.rarity ?? 1,
        selected: order >= 0,
        hinted: hintedIds.includes(h.instanceId),
        selectionOrder: order >= 0 ? order + 1 : null,
      };
    })
  );

  const canPull = $derived(view ? sessionManager.canPullGacha(view) : false);
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
    const before = new Set(s.hand.map((h) => h.instanceId));
    sessionManager.pullGacha(s);
    selectedIds = [];
    resetHint();
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
      feedback = `「${result.resolved.awarded.char}」ができた！`;
      fireSuccess(result.resolved.awarded, result.gainedScore);
    } else if (result.duplicate) {
      // 達成型：既出の漢字（重複）はノーペナルティ。ミス演出は出さない（T-029）。
      feedback = 'もう作ったよ';
      floatInfo = null;
    } else {
      feedback = 'うーん、別の組み合わせかも';
      floatInfo = null;
      fireMiss();
    }
    selectedIds = [];
    resetHint();
  }

  // 段階ヒント（T-033）：1回押すごとに ①光る → ②読み → ③答え と段階が進む。
  function doHint(): void {
    const s = sessionManager.getSession();
    if (!s) return;

    if (hintStage === 0 || hintInfo === null) {
      const hint = sessionManager.useHint(s);
      if (hint === null) {
        hintedIds = [];
        hintStage = 0;
        hintInfo = null;
        feedback = 'ヒントが出せません';
        return;
      }
      const sel = s.hand.filter((h) =>
        hint.some((x) => x.instanceId === h.instanceId)
      );
      const awarded = sessionManager.previewAwarded(sel);
      hintInfo = {
        char: awarded?.char ?? '',
        reading: awarded?.readings[0] ?? '',
      };
      hintedIds = hint.map((h) => h.instanceId);
      hintStage = 1;
      feedback = '光っている部品が合体できます（もう一度で読み）';
    } else if (hintStage === 1) {
      hintStage = 2;
      feedback = `読み：${hintInfo.reading || '？'}（もう一度で答え）`;
    } else {
      hintStage = 3;
      feedback = `答え：${hintInfo.char}`;
    }
  }

  function resetHint(): void {
    hintedIds = [];
    hintStage = 0;
    hintInfo = null;
  }

  function doDiscard(): void {
    const s = sessionManager.getSession();
    if (!s || selectedIds.length !== 1) return;
    clearRevealTimer();
    reveal = null;
    sessionManager.discardAndDraw(s, selectedIds[0]);
    selectedIds = [];
    resetHint();
    feedback = '';
    floatInfo = null;
  }

  function quit(): void {
    navigate('home');
  }

  $effect(() => {
    if ($sessionStore?.phase === 'ended') navigate('result');
  });
</script>

<section class="screen game" class:ta={isTimeAttack} class:kg-shake={shaking}>
  <h2 class="sr-only">ゲーム</h2>

  {#if view === null}
    <p>ゲームが開始されていません。</p>
    <button type="button" onclick={quit}>ホームへ</button>
  {:else}
    <!-- ===== HUD ===== -->
    <div class="hud">
      {#if isTimeAttack}
        <div class="hud-top">
          <div class="stat-block">
            <span class="stat-cap">残り時間 TIME</span>
            <span
              class="stat-num time"
              class:warn={timeWarn}
              class:urgent={timeUrgent}
              data-testid="time-remaining">{timeSeconds}</span
            >
          </div>
          <div class="stat-block right">
            <span class="stat-cap">SCORE</span>
            <span class="stat-num" data-testid="score">{view.score.score}</span>
          </div>
        </div>
        <TimeBar
          remainingMs={timeRemainingMs}
          initialMs={taTotalMs}
          {reducedMotion}
        />
        <span class="hidden-combo" data-testid="combo"
          >×{view.score.comboMultiplier.toFixed(1)}</span
        >
      {:else}
        <div class="hud-top">
          <div class="deck-block">
            <span class="deck-cap">山札 残り</span>
            <span class="deck-num" data-testid="gacha-remaining"
              >{view.gachaRemaining}</span
            >
          </div>
          <div class="toggles">
            <button
              type="button"
              class="tog"
              class:on={settings.furigana}
              aria-pressed={settings.furigana}
              aria-label={`ふりがな：${settings.furigana ? 'ON' : 'OFF'}`}
              onclick={toggleFurigana}
            >
              <span class="tog-glyph">ふ</span><span class="tog-cap"
                >ふりがな</span
              >
            </button>
            <button
              type="button"
              class="tog"
              class:on={settings.largeText}
              aria-pressed={settings.largeText}
              aria-label={`大きさ：${settings.largeText ? 'ON' : 'OFF'}`}
              onclick={toggleLargeText}
            >
              <span class="tog-glyph">大</span><span class="tog-cap"
                >大きさ</span
              >
            </button>
            <button
              type="button"
              class="tog"
              class:on={settings.tts}
              aria-pressed={settings.tts}
              aria-label={`音：${settings.tts ? 'ON' : 'OFF'}`}
              onclick={toggleTts}
            >
              <span class="tog-glyph" class:muted={!settings.tts}>♪</span><span
                class="tog-cap">{settings.tts ? '音 ON' : '消音'}</span
              >
            </button>
          </div>
        </div>
        <div class="hud-bottom">
          <div class="collect">
            <div class="collect-head">
              <span class="collect-cap">ずかん収集率</span>
              <span class="collect-frac"
                >{collected}<span class="collect-total">/{collectTotal}</span
                ></span
              >
            </div>
            <div class="collect-track">
              <div class="collect-fill" style:width={`${collectPct}%`}></div>
            </div>
          </div>
          <div class="score-block">
            <span class="score-cap">スコア SCORE</span>
            <span class="score-num" data-testid="score">{view.score.score}</span
            >
            <span class="combo-pill" class:hot={view.score.comboMultiplier > 1}>
              <span class="combo-ico" aria-hidden="true"
                >{view.score.comboMultiplier > 1 ? '🔥' : ''}</span
              >
              <span data-testid="combo"
                >COMBO ×{view.score.comboMultiplier.toFixed(1)}</span
              >
            </span>
          </div>
        </div>
      {/if}
    </div>

    <p class="feedback" role="status" data-testid="feedback">{feedback}</p>

    <!-- ===== ステージ ===== -->
    <div
      class="stage fx-wrap"
      bind:clientWidth={fxWidth}
      bind:clientHeight={fxHeight}
    >
      <span class="watermark" aria-hidden="true">{stageWatermark}</span>
      <canvas class="fx-layer" bind:this={canvasEl} aria-hidden="true"></canvas>

      {#if floatInfo}
        {#key floatInfo.key}
          <div class="learning-card kg-float" data-testid="score-float">
            <span class="lc-splash kg-splash" aria-hidden="true"></span>
            <span class="lc-char kg-reveal">
              <StrokeKanji char={floatInfo.char} size={72} {reducedMotion} />
            </span>
            {#if floatInfo.reading}
              <span class="lc-yomi"
                >{floatInfo.reading}<SpeakButton
                  text={floatInfo.reading}
                  label={`${floatInfo.char}を読み上げ`}
                /></span
              >
            {/if}
            {#if floatInfo.meaning}
              <span class="lc-mean">{floatInfo.meaning}</span>
            {/if}
            <span class="lc-meta">
              <span class="lc-strokes">{floatInfo.strokes}画</span>
              <span class="lc-score">+{floatInfo.gained}</span>
            </span>
          </div>
        {/key}
      {:else}
        <div class="prompt" class:ready={combineReady}>
          <span class="prompt-circle" class:ready={combineReady}>合</span>
          <span class="prompt-text">{promptText}</span>
        </div>
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

    <!-- ===== 手札トレイ ===== -->
    <div class="tray">
      <p class="tray-label">
        {#if selCount >= 2}手札 — 「合体！」を押そう{:else if selCount === 1}手札
          — あと1枚えらぶと合体できる{:else}手札 — タップで2枚えらぶ{/if}
      </p>
      <HandView items={handItems} onToggle={toggle} />
    </div>

    {#if handFull}
      <p class="organize" role="status">
        手札がいっぱいです。合体や「捨てる」で整理してください。
      </p>
    {/if}

    <!-- ===== アクション ===== -->
    <div class="actions-row">
      <button
        type="button"
        class="hint-btn"
        disabled={hintDisabled}
        onclick={doHint}
      >
        <span class="hint-tag" aria-hidden="true"></span>
        <span class="hint-cap">ヒント</span>
      </button>

      <GachaButton
        remaining={view.gachaRemaining}
        disabled={!canPull}
        showRemaining={!isTimeAttack}
        remainingLabel="山札"
        onclick={doGacha}
      />

      <button
        type="button"
        class="combine-btn"
        class:ready={canCombine}
        class:kg-ready={canCombine}
        disabled={!canCombine}
        onclick={doCombine}
      >
        <span class="combine-main">合体！</span>
        <span class="combine-sub">{canCombine ? 'できる！' : '2枚えらぶ'}</span>
      </button>
    </div>

    <nav class="actions">
      <MaterialButton
        variant="outlined"
        color="secondary"
        disabled={!canDiscard}
        onclick={doDiscard}>捨てて引き直す</MaterialButton
      >
      <MaterialButton variant="text" color="secondary" onclick={quit}
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
    position: relative;
    /* 縦に伸びる flex カラムで画面高を満たす。ステージ（中央）を可変にして余白を吸わせ、
       手札が増減してもアクション行が画面下に固定される（ボタン位置が動かない）。 */
    display: flex;
    flex-direction: column;
    min-height: calc(100dvh - 5rem);
    background: linear-gradient(
      180deg,
      var(--md-sys-color-surface),
      var(--md-sys-color-surface-container-low)
    );
    color: var(--md-sys-color-on-surface);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-large);
    box-shadow: var(--md-sys-elevation-1);
    padding: 0.9rem 1rem 1.1rem;
    overflow: hidden;
  }

  /* タイムアタックは藍夜テーマ。CSS 変数を上書きして子コンポーネント（札等）にも波及させる。 */
  .screen.game.ta {
    --md-sys-color-surface: var(--kg-color-indigo-night-2);
    --md-sys-color-surface-container-low: var(--kg-color-indigo-night-3);
    --md-sys-color-surface-container: #26314f;
    --md-sys-color-surface-container-high: #2b3760;
    --md-sys-color-on-surface: #f5f1e6;
    --md-sys-color-on-surface-variant: #aeb8d8;
    --md-sys-color-outline-variant: rgba(159, 176, 224, 0.3);
    background: linear-gradient(
      180deg,
      var(--kg-color-indigo-night-1),
      var(--kg-color-indigo-night-2) 70%,
      var(--kg-color-indigo-night-3)
    );
    border-color: rgba(212, 175, 55, 0.25);
  }

  /* ===== HUD ===== */
  .hud {
    position: relative;
    z-index: 3;
  }
  .hud-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.6rem;
  }
  .stat-block,
  .deck-block,
  .score-block {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  .stat-block.right,
  .score-block {
    align-items: flex-end;
    text-align: right;
  }
  .stat-cap,
  .deck-cap,
  .score-cap,
  .collect-cap {
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    color: var(--md-sys-color-on-surface-variant);
  }
  .stat-num,
  .score-num,
  .deck-num {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--md-sys-color-on-surface);
  }
  .stat-num {
    font-size: 1.9rem;
  }
  .stat-num.time.warn {
    color: var(--kg-color-gold-bright);
  }
  .stat-num.time.urgent {
    color: #ff5a44;
    animation: kg-pulse 0.5s ease-in-out infinite;
  }
  .deck-num {
    font-size: 1.25rem;
  }
  .score-num {
    font-size: 1.75rem;
  }
  /* TA の combo は数値を画面に出さないが、testid 契約のため不可視で保持する。 */
  .hidden-combo {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }
  .hud-bottom {
    display: flex;
    align-items: flex-end;
    gap: 0.8rem;
  }
  .collect {
    flex: 1;
  }
  .collect-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.2rem;
  }
  .collect-frac {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    font-size: 0.8rem;
    color: var(--md-sys-color-tertiary);
    font-variant-numeric: tabular-nums;
  }
  .collect-total {
    color: var(--md-sys-color-on-surface-variant);
  }
  .collect-track {
    height: 0.55rem;
    border-radius: var(--md-sys-shape-corner-full);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    overflow: hidden;
  }
  .collect-fill {
    height: 100%;
    border-radius: var(--md-sys-shape-corner-full);
    background: linear-gradient(
      90deg,
      var(--kg-color-gold-deep),
      var(--kg-color-gold-bright)
    );
    transition: width 0.5s ease;
  }
  .score-block {
    min-width: 5.5rem;
  }
  .combo-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    margin-top: 0.15rem;
    padding: 0.05rem 0.5rem;
    border-radius: var(--md-sys-shape-corner-full);
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    font-size: 0.68rem;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
  }
  .combo-pill.hot {
    color: var(--md-sys-color-primary);
    background: var(--md-sys-color-primary-container);
    border-color: var(--md-sys-color-primary);
  }

  /* ===== トグル ===== */
  .toggles {
    display: flex;
    gap: 0.35rem;
  }
  .tog {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    width: 2.7rem;
    height: 2.7rem;
    padding: 0;
    border-radius: var(--md-sys-shape-corner-medium);
    border: 1px solid var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface-container-low);
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
  }
  .tog.on {
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
  }
  .tog-glyph {
    font-size: 1rem;
    line-height: 1;
  }
  .tog-glyph.muted {
    text-decoration: line-through;
    text-decoration-thickness: 2px;
  }
  .tog-cap {
    font-size: 0.44rem;
    letter-spacing: 0.01em;
    line-height: 1.1;
  }

  /* ===== フィードバック ===== */
  .feedback {
    position: relative;
    z-index: 3;
    min-height: 1.2rem;
    margin: 0.3rem 0 0.2rem;
    text-align: center;
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--md-sys-color-primary);
  }
  .screen.game.ta .feedback {
    color: var(--kg-color-gold-bright);
  }

  /* ===== ステージ ===== */
  .stage {
    position: relative;
    /* 余剰高を吸う可変領域。縦長では伸びて中央に収まり、手札増減ぶんはここが伸縮して
       下のアクション行を動かさない。短い画面では min-height まで縮む。 */
    flex: 1 1 0;
    min-height: 9rem;
    margin: 0.2rem 0 0.5rem;
    border-radius: var(--md-sys-shape-corner-large);
    background: color-mix(
      in srgb,
      var(--md-sys-color-surface) 60%,
      transparent
    );
    border: 1px solid var(--md-sys-color-outline-variant);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .watermark {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--md-ref-typeface-kanji);
    font-size: 11rem;
    line-height: 1;
    color: color-mix(in srgb, var(--md-sys-color-secondary) 7%, transparent);
    pointer-events: none;
    user-select: none;
  }
  .screen.game.ta .watermark {
    color: rgba(212, 175, 55, 0.06);
  }
  .fx-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
  }

  /* 合体プロンプト（合 の輪＋誘導文）。 */
  .prompt {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    color: var(--md-sys-color-on-surface-variant);
    pointer-events: none;
  }
  .prompt-circle {
    width: 3.6rem;
    height: 3.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed
      color-mix(in srgb, var(--kg-color-gold-deep) 50%, transparent);
    border-radius: var(--md-sys-shape-corner-full);
    font-family: var(--md-ref-typeface-brand);
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--kg-color-gold-deep);
  }
  .prompt-circle.ready {
    border-style: solid;
    border-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-primary);
    box-shadow: 0 0 20px rgba(192, 57, 43, 0.35);
    animation: kg-pulse 1.1s ease-in-out infinite;
  }
  .screen.game.ta .prompt-circle.ready {
    border-color: var(--kg-color-gold-bright);
    color: var(--kg-color-gold-bright);
    box-shadow: 0 0 22px rgba(212, 175, 55, 0.55);
  }
  .prompt-text {
    font-family: var(--md-ref-typeface-brand);
    font-size: 0.9rem;
  }
  .prompt.ready .prompt-text {
    font-weight: 700;
    color: var(--md-sys-color-primary);
  }
  .screen.game.ta .prompt.ready .prompt-text {
    color: var(--kg-color-gold-bright);
  }

  /* 合体成功の学習カード（T-030）。 */
  .learning-card {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.9rem 1.4rem;
    border-radius: var(--md-sys-shape-corner-large);
    background: linear-gradient(
      160deg,
      var(--md-sys-color-surface-container-low),
      var(--md-sys-color-surface-container)
    );
    border: 1.5px solid
      color-mix(in srgb, var(--kg-color-gold-deep) 50%, transparent);
    box-shadow: var(--kg-elevation-float);
  }
  .lc-splash {
    position: absolute;
    left: 50%;
    top: 42%;
    width: 9rem;
    height: 9rem;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(212, 175, 55, 0.4),
      transparent 65%
    );
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .lc-char {
    display: inline-flex;
    color: var(--md-sys-color-on-surface);
  }
  .lc-yomi {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    font-family: var(--md-ref-typeface-brand);
    font-size: 0.95rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .lc-mean {
    font-size: 0.78rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .lc-meta {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.1rem;
    font-size: 0.78rem;
  }
  .lc-strokes {
    color: var(--md-sys-color-secondary);
    font-variant-numeric: tabular-nums;
  }
  .screen.game.ta .lc-strokes {
    color: #9fb0e0;
  }
  .lc-score {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    color: var(--md-sys-color-primary);
  }
  .screen.game.ta .lc-score {
    color: var(--kg-color-gold-bright);
  }

  /* ===== 手札トレイ ===== */
  .tray {
    position: relative;
    z-index: 3;
  }
  .tray-label {
    margin: 0 0 0.2rem;
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    color: var(--md-sys-color-on-surface-variant);
  }

  .organize {
    position: relative;
    z-index: 3;
    color: var(--md-sys-color-error);
    font-size: 0.85rem;
    text-align: center;
  }
  .screen.game.ta .organize {
    color: #ff8a7a;
  }

  /* ===== アクション ===== */
  .actions-row {
    position: relative;
    z-index: 3;
    display: flex;
    align-items: stretch;
    gap: 0.55rem;
    margin-top: 0.7rem;
  }
  /* ヒント（和紙ボタン＋光る巻物タグ）。 */
  .hint-btn {
    flex: none;
    width: 3.3rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    border-radius: var(--md-sys-shape-corner-large);
    border: 1px solid var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface-container-low);
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .hint-btn:focus-visible,
  .combine-btn:focus-visible {
    outline: 3px solid var(--kg-color-gold-bright);
    outline-offset: 2px;
  }
  .hint-tag {
    width: 1.1rem;
    height: 1.35rem;
    border-radius: 5px 5px 7px 7px;
    background: linear-gradient(180deg, #ffe9a8, #f3c75a);
    box-shadow: 0 0 10px rgba(243, 199, 90, 0.9);
    border-top: 3px solid var(--kg-color-gold-deep);
  }
  .hint-cap {
    font-size: 0.6rem;
    letter-spacing: 0.06em;
  }
  .hint-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  /* 合体！（金グラデ・2枚で点滅）。 */
  .combine-btn {
    flex: none;
    width: 4.6rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    border-radius: var(--md-sys-shape-corner-large);
    border: 2px solid var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface-container-low);
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--md-ref-typeface-brand);
    font-weight: 800;
    cursor: pointer;
    transition:
      transform 0.1s ease,
      filter 0.1s ease;
  }
  .combine-btn.ready {
    border-color: var(--kg-color-gold-deep);
    background: linear-gradient(
      160deg,
      var(--kg-color-gold-bright),
      var(--kg-color-gold-deep)
    );
    color: #241a08;
  }
  .combine-main {
    font-size: 1rem;
    line-height: 1.1;
  }
  .combine-btn:not(.ready) .combine-main {
    font-size: 0.82rem;
  }
  .combine-sub {
    font-size: 0.48rem;
    font-weight: 600;
    opacity: 0.85;
  }
  .combine-btn:disabled {
    cursor: not-allowed;
  }
  .combine-btn.ready:active {
    transform: translateY(1px);
  }

  .actions {
    position: relative;
    z-index: 3;
  }
  .actions :global(.md-btn) {
    padding: 0 18px;
    font-size: 0.95rem;
    min-height: 2.5rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .stat-num.time.urgent,
    .prompt-circle.ready,
    .combine-btn {
      animation: none;
      transition: none;
    }
  }
</style>
