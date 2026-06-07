<script lang="ts">
  import { setContext } from 'svelte';
  import type { SessionManager } from './app/SessionManager';
  import { routeStore } from './app/stores/routeStore';
  import HomeScreen from './ui/screens/HomeScreen.svelte';
  import GameScreen from './ui/screens/GameScreen.svelte';
  import ResultScreen from './ui/screens/ResultScreen.svelte';
  import ZukanScreen from './ui/screens/ZukanScreen.svelte';
  import AboutScreen from './ui/screens/AboutScreen.svelte';

  // ルートコンポーネント（T-015）。`routeStore` を購読して現在画面をレンダリングする。
  // 進行中の SessionManager は context で子画面（T-016 以降）へ渡す。
  let { sessionManager }: { sessionManager: SessionManager } = $props();
  // sessionManager はマウント時に一度だけ渡される単一インスタンス（差し替えない）。
  // 初期値の捕捉が意図どおりのため state_referenced_locally 警告を抑制する。
  // svelte-ignore state_referenced_locally
  setContext('sessionManager', sessionManager);
</script>

<header class="app-header">
  <h1>漢字合体ガチャ</h1>
</header>

<main id="main">
  {#if $routeStore === 'home'}
    <HomeScreen />
  {:else if $routeStore === 'game'}
    <GameScreen />
  {:else if $routeStore === 'result'}
    <ResultScreen />
  {:else if $routeStore === 'zukan'}
    <ZukanScreen />
  {:else if $routeStore === 'about'}
    <AboutScreen />
  {:else}
    <!-- Screen 型を網羅済みのため未到達。型に画面を追加したら明示分岐を足すこと。 -->
    <HomeScreen />
  {/if}
</main>

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
