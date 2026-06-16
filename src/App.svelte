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
  .app-header {
    text-align: center;
    font-family: system-ui, sans-serif;
    margin: 1.5rem 0 0.5rem;
  }
  .app-header h1 {
    font-size: 1.4rem;
    margin: 0;
  }
  #main {
    font-family: system-ui, sans-serif;
    max-width: 40rem;
    margin: 1rem auto;
    padding: 0 1rem;
    text-align: center;
  }
  :global(.screen .actions) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 1.25rem;
  }
  :global(.screen .actions button) {
    padding: 0.6rem 1.4rem;
    font-size: 1rem;
    cursor: pointer;
  }
</style>
