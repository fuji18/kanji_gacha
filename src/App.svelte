<script lang="ts">
  import type { SessionManager } from './app/SessionManager';
  import { routeStore } from './app/stores/routeStore';
  import { persistedStore } from './app/stores/persistedStore';
  import HomeScreen from './ui/screens/HomeScreen.svelte';
  import GameScreen from './ui/screens/GameScreen.svelte';
  import ResultScreen from './ui/screens/ResultScreen.svelte';
  import ZukanScreen from './ui/screens/ZukanScreen.svelte';
  import AboutScreen from './ui/screens/AboutScreen.svelte';
  import TutorialOverlay from './ui/screens/TutorialOverlay.svelte';

  // ルートコンポーネント（T-015）。`routeStore` を購読して現在画面をレンダリングする。
  // SessionManager は必要な画面へ prop で渡す（T-016: Home。Game/Result は各担当チケットで追加）。
  let { sessionManager }: { sessionManager: SessionManager } = $props();

  // 初回チュートリアル（T-034）。未完了なら起動時にガイドを表示し、完了/スキップで永続化する。
  const showTutorial = $derived(!$persistedStore.settings.tutorialDone);
  function finishTutorial(): void {
    sessionManager.setTutorialDone(true);
  }

  // 文字サイズ拡大（T-037）。ルート（html）の基準サイズを拡大し、rem ベースの UI 全体を一律に拡大する。
  $effect(() => {
    document.documentElement.style.fontSize = $persistedStore.settings.largeText
      ? '118%'
      : '';
  });
</script>

<header class="app-header">
  <span class="brand-kicker">KANJI&nbsp;FUSION&nbsp;GACHA</span>
  <h1>漢字合体ガチャ</h1>
</header>

<main id="main">
  {#if $routeStore === 'home'}
    <HomeScreen {sessionManager} />
  {:else if $routeStore === 'game'}
    <GameScreen {sessionManager} />
  {:else if $routeStore === 'result'}
    <ResultScreen {sessionManager} />
  {:else if $routeStore === 'zukan'}
    <ZukanScreen {sessionManager} />
  {:else if $routeStore === 'about'}
    <AboutScreen />
  {:else}
    <!-- Screen 型を網羅済みのため未到達。型に画面を追加したら明示分岐を足すこと。 -->
    <HomeScreen {sessionManager} />
  {/if}
</main>

{#if showTutorial}
  <TutorialOverlay ondone={finishTutorial} />
{/if}

<style>
  /* ページ全体の地：墨地に金/藍のほのかな放射光（handoff design の余白配色）。
     和紙の各画面（.screen）はこの暗地の上に浮くカードとして見せる。 */
  :global(body) {
    background-color: var(--kg-color-ink-bg, #211d17);
    background-image:
      radial-gradient(
        circle at 14% 0%,
        rgba(120, 95, 55, 0.2),
        transparent 55%
      ),
      radial-gradient(
        circle at 88% 100%,
        rgba(44, 62, 107, 0.28),
        transparent 52%
      );
    background-attachment: fixed;
    color: var(--md-sys-color-surface);
  }
  .app-header {
    text-align: center;
    font-family: var(--md-ref-typeface-brand);
    margin: 0.9rem 0 0.4rem;
  }
  .brand-kicker {
    display: block;
    font-family: var(--md-ref-typeface-brand);
    font-size: 0.7rem;
    letter-spacing: 0.42em;
    color: var(--kg-color-gold-bright);
    margin-bottom: 0.3rem;
  }
  .app-header h1 {
    font-size: 1.5rem;
    margin: 0;
    color: #f5f1e6;
    letter-spacing: 0.04em;
  }
  #main {
    font-family: var(--md-ref-typeface-plain);
    max-width: 40rem;
    margin: 0.6rem auto;
    padding: 0 1rem 0.8rem;
    text-align: center;
  }
  /* 全画面共通の和紙パネル。各 .screen は暗地の上の和紙カードとして統一する。
     GameScreen 等が独自に背景/余白を上書きする場合は、より具体的なセレクタが優先される。 */
  :global(.screen) {
    /* 暗地の body から継承する明色テキストを、和紙パネル内では墨色へ戻す
       （明示色を持たない素のテキストが和紙上で読めるようにする）。 */
    color: var(--md-sys-color-on-surface);
    background: linear-gradient(
      180deg,
      var(--md-sys-color-surface),
      var(--md-sys-color-surface-container-low)
    );
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-large);
    box-shadow: var(--md-sys-elevation-2);
    padding: 1.1rem 1.1rem 1.3rem;
  }
  /* 画面見出しは金の圏点（上罫）で和の格を添える。 */
  :global(.screen > h2) {
    position: relative;
    display: inline-block;
    padding-top: 0.4rem;
  }
  :global(.screen > h2)::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 2.2rem;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(
      90deg,
      var(--kg-color-gold-deep),
      var(--kg-color-gold-bright)
    );
  }
  /* アクション行：本文との区切り罫を入れて視覚的に分離する。 */
  :global(.screen .actions) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    justify-content: center;
    margin-top: 1.25rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--md-sys-color-outline-variant);
  }
  /* スマホ：主要アクションを画面下に固定（親指リーチ）。半透明和紙＋セーフエリア対応。
     Game 画面は独自レイアウトのため対象外（:not(.game)）。 */
  @media (max-width: 640px) {
    :global(.screen:not(.game)) {
      display: flex;
      flex-direction: column;
      min-height: calc(100dvh - 4.5rem);
    }
    :global(.screen:not(.game) .actions) {
      position: sticky;
      bottom: 0;
      margin-top: auto;
      padding: 0.8rem 0.2rem;
      padding-bottom: max(0.8rem, env(safe-area-inset-bottom));
      background: var(--kg-surface-bar);
    }
  }
</style>
