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
  function toggleReducedEffects(): void {
    sessionManager.setReducedEffects(!settings.reducedEffects);
  }
  function toggleSlowTts(): void {
    sessionManager.setSlowTts(!settings.slowTts);
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
  // 演出の実効値（T-056）：OS の reduced-motion を最優先に、アプリ設定「すくなめ」を OR する。
  // OS 設定は常に尊重（アプリ設定で後退させない）。トグル変更に即時追随する。
  const effectiveReduced = $derived(reducedMotion || settings.reducedEffects);

  // ---- 舞い散る装飾（CSS パーティクル。桜びら＋金の粒。演出すくなめ/reduced-motion では出さない）----
  const ambient: string[] = $derived.by(() => {
    if (effectiveReduced) return [];
    const out: string[] = [];
    for (let i = 0; i < 12; i++) {
      const gold = i % 3 === 0;
      const left = (i * 8.3 + ((i * i * 11) % 11)) % 100;
      const dur = 9 + (i % 6) * 2;
      const delay = -((i * 2.1) % dur);
      if (gold) {
        const sz = 4 + (i % 3) * 2;
        out.push(
          `top:${(i * 7) % 70}%;left:${left}%;width:${sz}px;height:${sz}px;border-radius:50%;background:radial-gradient(circle,#ffe9a8,#d4af37);box-shadow:0 0 7px rgba(212,175,55,.85);animation:kg-twinkle ${1.8 + (i % 4) * 0.6}s ease-in-out ${delay}s infinite`
        );
      } else {
        const sz = 7 + (i % 4) * 3;
        out.push(
          `top:0;left:${left}%;width:${sz}px;height:${sz}px;background:rgba(244,176,198,.5);border-radius:100% 0 100% 0;animation:kg-fall-${i % 2 ? 'a' : 'b'} ${dur}s linear ${delay}s infinite`
        );
      }
    }
    return out;
  });

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

  // 合体成功時に浮上する「+N」ポップ（学習カードとは別の即時フィードバック・handoff design）。
  let pop = $state<{ text: string; key: number } | null>(null);
  let popSeq = 0;
  let popTimer: ReturnType<typeof setTimeout> | null = null;

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
      effectiveReduced ? 0 : 600
    );
  }

  onMount(() => {
    const ctx = canvasEl?.getContext('2d') ?? null;
    if (ctx) {
      field = new ParticleField(ctx, { reducedMotion });
      field.start();
    }
    // 初期手札を上限まで自動で引く（開始時のみ・手札が空のとき一度だけ）。
    const s = sessionManager.getSession();
    if (s && s.hand.length === 0) sessionManager.fillHand(s);
    tick();
    tickTimer = setInterval(tick, 100);
  });
  onDestroy(() => {
    field?.stop();
    if (shakeTimer !== null) clearTimeout(shakeTimer);
    if (tickTimer !== null) clearInterval(tickTimer);
    if (popTimer !== null) clearTimeout(popTimer);
    if (undoTimer !== null) clearTimeout(undoTimer);
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
    if (!effectiveReduced && fxWidth > 0 && fxHeight > 0)
      field?.burst(fxWidth / 2, fxHeight / 2);
    floatSeq += 1;
    floatInfo = {
      char: awarded.char,
      reading: awarded.readings[0] ?? '',
      meaning: awarded.meanings[0] ?? '',
      strokes: awarded.strokes,
      gained,
      key: floatSeq,
    };
    // 「+N」ポップ（1.1s で自然消滅）。
    popSeq += 1;
    const myKey = popSeq;
    pop = { text: `+${gained}`, key: myKey };
    if (popTimer !== null) clearTimeout(popTimer);
    popTimer = setTimeout(() => {
      if (pop?.key === myKey) pop = null;
      popTimer = null;
    }, 1100);
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
  const canExchange = $derived(selectedIds.length >= 1);
  const hintDisabled = $derived(!view || !sessionManager.canUseHint(view));

  function toggle(instanceId: string): void {
    selectedIds = selectedIds.includes(instanceId)
      ? selectedIds.filter((id) => id !== instanceId)
      : [...selectedIds, instanceId];
  }

  function doGacha(): void {
    const s = sessionManager.getSession();
    if (!s) return;
    hideUndo();
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
    hideUndo();
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
    hideUndo();

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

  // 交換の Undo スナックバー（T-057）。直前の交換1回だけ、約5秒 or 次の操作まで表示。
  let undoVisible = $state(false);
  let undoCount = $state(0);
  let undoTimer: ReturnType<typeof setTimeout> | null = null;

  function hideUndo(): void {
    undoVisible = false;
    if (undoTimer !== null) {
      clearTimeout(undoTimer);
      undoTimer = null;
    }
  }

  function doExchange(): void {
    const s = sessionManager.getSession();
    if (!s || selectedIds.length < 1) return;
    clearRevealTimer();
    reveal = null;
    const count = selectedIds.length;
    // 選択カードを一括で交換（選択枚数ぶんを引き直す・手札枚数は不変）。
    sessionManager.exchangeCards(s, selectedIds);
    selectedIds = [];
    resetHint();
    feedback = '';
    floatInfo = null;
    // 実行できた場合のみ Undo を提示（残不足 no-op ではスナップショットが無い）。
    hideUndo();
    if (sessionManager.canUndoExchange(s)) {
      undoCount = count;
      undoVisible = true;
      undoTimer = setTimeout(() => {
        undoVisible = false;
        undoTimer = null;
      }, 5_000);
    }
  }

  function doUndoExchange(): void {
    const s = sessionManager.getSession();
    if (!s) return;
    sessionManager.undoExchange(s);
    hideUndo();
    selectedIds = [];
    resetHint();
    feedback = 'もとにもどした';
  }

  function quit(): void {
    navigate('home');
  }

  $effect(() => {
    if ($sessionStore?.phase === 'ended') navigate('result');
  });
</script>

<section class="screen game" class:ta={isTimeAttack} class:kg-shake={shaking}>
  {#if isTimeAttack && timeUrgent && !effectiveReduced}
    <!-- 終盤警告のビネット（T-056）：TimeBar 以外の「見なくても分かる」チャンネル。
         装飾のみ（aria-hidden・pointer-events なし）。演出すくなめ/reduced-motion では出さない。 -->
    <div class="ta-vignette" aria-hidden="true"></div>
  {/if}
  <h2 class="sr-only">ゲーム</h2>

  {#if view === null}
    <p>ゲームが開始されていません。</p>
    <button type="button" onclick={quit}>ホームへ</button>
  {:else}
    <!-- 地紋（麻の葉＝学習 / 青海波＝タイムアタック） -->
    {#if isTimeAttack}
      <svg class="jimon" aria-hidden="true">
        <defs
          ><pattern
            id="seigG"
            x="0"
            y="0"
            width="46"
            height="23"
            patternUnits="userSpaceOnUse"
            ><g fill="none" stroke="#d4af37" stroke-width="1" opacity="0.1"
              ><path d="M0 23 a23 23 0 0 1 46 0" /><path
                d="M7.6 23 a15.3 15.3 0 0 1 30.6 0"
              /><path d="M15.3 23 a7.6 7.6 0 0 1 15.3 0" /><path
                d="M23 23 a23 23 0 0 1 46 0"
              /><path d="M-23 23 a23 23 0 0 1 46 0" /></g
            ></pattern
          ></defs
        >
        <rect width="100%" height="100%" fill="url(#seigG)" />
      </svg>
    {:else}
      <svg class="jimon" aria-hidden="true">
        <defs
          ><pattern
            id="asaG"
            x="0"
            y="0"
            width="46"
            height="27"
            patternUnits="userSpaceOnUse"
            ><g fill="none" stroke="#2c3e6b" stroke-width="0.7" opacity="0.07"
              ><path
                d="M23 0 L23 27 M0 13.5 L46 13.5 M0 0 L46 27 M46 0 L0 27 M23 0 L0 13.5 L23 27 L46 13.5 Z"
              /></g
            ></pattern
          ></defs
        >
        <rect width="100%" height="100%" fill="url(#asaG)" />
      </svg>
    {/if}

    <!-- 舞い散る装飾（桜びら＋金の粒） -->
    {#if ambient.length > 0}
      <div class="petals" aria-hidden="true">
        {#each ambient as s, i (i)}<span style="position:absolute;{s}"
          ></span>{/each}
      </div>
    {/if}

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
            <button
              type="button"
              class="tog"
              class:on={settings.reducedEffects}
              aria-pressed={settings.reducedEffects}
              aria-label={`えんしゅつ：${settings.reducedEffects ? 'すくなめ' : 'ふつう'}`}
              onclick={toggleReducedEffects}
            >
              <span class="tog-glyph">✨</span><span class="tog-cap"
                >{settings.reducedEffects ? '演出 少' : '演出'}</span
              >
            </button>
            <button
              type="button"
              class="tog"
              class:on={settings.slowTts}
              aria-pressed={settings.slowTts}
              aria-label={`よみあげ：${settings.slowTts ? 'ゆっくり' : 'ふつう'}`}
              onclick={toggleSlowTts}
            >
              <span class="tog-glyph">🐢</span><span class="tog-cap"
                >ゆっくり</span
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

      {#if isTimeAttack}
        <div class="ta-combo" aria-hidden="true">
          {#if view.score.comboMultiplier > 1}
            <div class="ta-flame kg-flame">🔥</div>
          {/if}
          <div class="ta-combo-num">
            ×{view.score.comboMultiplier.toFixed(1)}
          </div>
          <div class="ta-combo-cap">COMBO</div>
        </div>
      {/if}

      {#if floatInfo}
        {#key floatInfo.key}
          <div class="learning-card kg-float" data-testid="score-float">
            <span class="lc-splash kg-splash" aria-hidden="true"></span>
            <span class="lc-char kg-reveal">
              <StrokeKanji char={floatInfo.char} size={96} {reducedMotion} />
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

      {#if pop}
        {#key pop.key}
          <div class="score-pop" aria-hidden="true">{pop.text}</div>
        {/key}
      {/if}

      {#if reveal}
        {#key reveal.key}
          <EmakimonoReveal
            char={reveal.char}
            rarity={reveal.rarity}
            rarityLabel={reveal.rarityLabel}
            reducedMotion={effectiveReduced}
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
        手札がいっぱいです。合体や「交換」で整理してください。
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

    {#if undoVisible}
      <!-- 交換の取り消し（T-057）。約5秒 or 次の操作で消える。 -->
      <div class="undo-bar" role="status">
        <span class="undo-msg">{undoCount}枚こうかんした</span>
        <button type="button" class="undo-btn" onclick={doUndoExchange}
          >もとにもどす</button
        >
      </div>
    {/if}

    <nav class="actions">
      <MaterialButton
        variant="outlined"
        color="secondary"
        disabled={!canExchange}
        onclick={doExchange}>交換</MaterialButton
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
    /* ヘッダ＋#main 余白ぶんを差し引き、縦長でもページスクロールが出ないようにする。
       svh（最小ビューポート＝ブラウザ chrome 表示時）基準でアドレスバー表示時も収める。 */
    min-height: calc(100svh - 9.5rem);
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

  /* 地紋（麻の葉/青海波）と舞い散る装飾は本文の背面に敷く。 */
  .jimon {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
  }
  .petals {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 1;
  }

  /* タイムアタックのコンボ演出（炎＋大きな倍率）。ステージ上部中央。 */
  .ta-combo {
    position: absolute;
    top: 0.4rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 4;
    text-align: center;
    pointer-events: none;
  }
  .ta-flame {
    font-size: 1.5rem;
    line-height: 1;
    filter: drop-shadow(0 0 8px rgba(224, 121, 95, 0.8));
  }
  .ta-combo-num {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 800;
    font-size: 2rem;
    line-height: 0.9;
    color: var(--kg-color-gold-bright);
    text-shadow: 0 0 16px rgba(212, 175, 55, 0.6);
  }
  .ta-combo-cap {
    font-size: 0.55rem;
    letter-spacing: 0.22em;
    color: #aeb8d8;
  }
  /* TA はコンボ表示と重ならないよう、ステージ中身を少し下げる。 */
  .screen.game.ta .prompt,
  .screen.game.ta .learning-card {
    margin-top: 3.5rem;
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
    min-height: 7rem;
    margin: 0.1rem 0 0.4rem;
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
  /* タイムアタックのステージに斜めの金の光沢を重ねる（handoff design）。 */
  .screen.game.ta .stage {
    background-image: repeating-linear-gradient(
      115deg,
      transparent 0 18px,
      rgba(212, 175, 55, 0.05) 18px 19px
    );
  }
  /* 合体成功の「+N」ポップ。 */
  .score-pop {
    position: absolute;
    left: 50%;
    bottom: 26%;
    z-index: 6;
    pointer-events: none;
    font-family: var(--md-ref-typeface-brand);
    font-weight: 800;
    font-size: 1.9rem;
    color: var(--kg-color-gold-bright);
    text-shadow: 0 0 12px rgba(212, 175, 55, 0.7);
    animation: kg-pop 1.1s ease forwards;
  }
  @media (prefers-reduced-motion: reduce) {
    .score-pop {
      animation: none;
      opacity: 0;
    }
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
    width: 4.4rem;
    height: 4.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed
      color-mix(in srgb, var(--kg-color-gold-deep) 50%, transparent);
    border-radius: var(--md-sys-shape-corner-full);
    font-family: var(--md-ref-typeface-brand);
    font-size: 2.2rem;
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
    font-size: 1rem;
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
    gap: 0.3rem;
    padding: 1rem 1.8rem;
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
    font-size: 1.1rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .lc-mean {
    font-size: 0.85rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .lc-meta {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    margin-top: 0.15rem;
    font-size: 0.9rem;
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
    flex: none;
  }
  .tray-label {
    margin: 0 0 0.2rem;
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    color: var(--md-sys-color-on-surface-variant);
  }
  /* 手札域は最初から2行ぶんを確保（高さ固定）。札が増えたら内部スクロールし、
     アクション行の高さは動かさない（HandView の .hand を上書き）。 */
  .tray :global(.hand) {
    height: 11rem;
    min-height: 11rem;
    overflow-y: auto;
    align-content: flex-start;
    padding: 0.2rem 0;
    scrollbar-width: thin;
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

  /* タイムアタック終盤（残5秒）の周縁ビネット（T-056）。朱がゆっくり脈動する。 */
  .ta-vignette {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    border-radius: inherit;
    box-shadow: inset 0 0 2.2rem 0.4rem rgba(192, 57, 43, 0.55);
    animation: kg-ta-vignette 1s ease-in-out infinite;
  }
  @keyframes kg-ta-vignette {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ta-vignette {
      animation: none;
    }
  }

  /* 交換の Undo スナックバー（T-057）。アクション行の直上に浮かせる。 */
  .undo-bar {
    position: fixed;
    left: 50%;
    bottom: 6.5rem;
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.5rem 0.9rem;
    background: var(--md-sys-color-on-surface);
    color: var(--md-sys-color-surface);
    border-radius: var(--md-sys-shape-corner-full);
    box-shadow: var(--md-sys-elevation-3);
    font-size: var(--md-sys-typescale-body-size);
  }
  .undo-btn {
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    font-size: var(--md-sys-typescale-body-size);
    font-weight: 700;
    color: var(--md-sys-color-tertiary-bright);
    padding: 0.2rem 0.4rem;
  }
</style>
