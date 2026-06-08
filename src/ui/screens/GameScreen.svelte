<script lang="ts">
  import type { SessionManager } from '../../app/SessionManager';
  import { sessionStore } from '../../app/stores/sessionStore';
  import { navigate } from '../../app/stores/routeStore';
  import ScoreBar from '../components/ScoreBar.svelte';
  import HandView from '../components/HandView.svelte';
  import GachaButton from '../components/GachaButton.svelte';
  import HintButton from '../components/HintButton.svelte';

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
  }

  function doCombine(): void {
    const s = sessionManager.getSession();
    if (!s || selectedIds.length < 2) return;
    const sel = s.hand.filter((h) => selectedIds.includes(h.instanceId));
    const result = sessionManager.combine(s, sel);
    feedback = result.success ? `+${result.gainedScore}！` : 'ミス…';
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
  }

  function quit(): void {
    navigate('home');
  }

  // 終了条件（詰み/手札0）に達したら結果画面へ自動遷移する（機能設計6）。
  $effect(() => {
    if ($sessionStore?.phase === 'ended') navigate('result');
  });
</script>

<section class="screen game">
  <h2 class="sr-only">ゲーム</h2>

  {#if view === null}
    <p>ゲームが開始されていません。</p>
    <button type="button" onclick={quit}>ホームへ</button>
  {:else}
    <ScoreBar
      score={view.score.score}
      comboMultiplier={view.score.comboMultiplier}
      comboCount={view.score.comboCount}
      gachaRemaining={view.gachaRemaining}
    />

    <p class="feedback" role="status" data-testid="feedback">{feedback}</p>

    <HandView items={handItems} onToggle={toggle} />

    {#if handFull}
      <p class="organize" role="status">
        手札がいっぱいです。合体や「捨てる」で整理してください。
      </p>
    {/if}

    <div class="controls">
      <GachaButton
        remaining={view.gachaRemaining}
        disabled={!canPull}
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
