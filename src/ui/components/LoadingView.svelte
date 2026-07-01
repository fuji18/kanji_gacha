<script lang="ts">
  // 起動時の辞書ロード中に表示する共通ビュー（機能設計11・T-015）。
  // handoff design「App Screens Wafu」のローディング演出（回転リング＋合バッジ＋進捗バー）。
  // 単独マウント（App 外）のため、暗地の上の和紙札として自己完結で表示する。
</script>

<main class="loading" aria-busy="true">
  <div class="card">
    <div class="ring-wrap">
      <div class="ring"></div>
      <div class="badge">合</div>
    </div>
    <div class="text">
      <div class="title">読み込み中</div>
      <p class="sub" role="status">絵巻をひらいています…</p>
    </div>
    <div class="progress"><div class="progress-fill"></div></div>
  </div>
</main>

<style>
  .loading {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .card {
    width: min(20rem, 92vw);
    padding: 2.4rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.6rem;
    background: linear-gradient(
      180deg,
      var(--md-sys-color-surface),
      var(--md-sys-color-surface-container-low)
    );
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: 1.4rem;
    box-shadow: var(--md-sys-elevation-2);
  }
  .ring-wrap {
    position: relative;
    width: 6.5rem;
    height: 6.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid rgba(184, 134, 11, 0.18);
    border-top-color: var(--md-sys-color-primary);
    animation: kg-load-spin 1s linear infinite;
  }
  .badge {
    width: 4.4rem;
    height: 4.4rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--md-ref-typeface-brand);
    font-size: 2.4rem;
    color: #fff3e4;
    background: linear-gradient(160deg, var(--md-sys-color-primary), #9e2f23);
    box-shadow: 0 6px 18px rgba(192, 57, 43, 0.4);
  }
  .text {
    text-align: center;
  }
  .title {
    font-family: var(--md-ref-typeface-brand);
    font-weight: 700;
    font-size: 1.1rem;
    letter-spacing: 0.18em;
    color: var(--md-sys-color-on-surface);
  }
  .sub {
    margin: 0.3rem 0 0;
    font-size: 0.7rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .progress {
    width: 11rem;
    height: 0.4rem;
    border-radius: var(--md-sys-shape-corner-full);
    background: var(--md-sys-color-surface-container-high);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    width: 64%;
    border-radius: var(--md-sys-shape-corner-full);
    background: linear-gradient(
      90deg,
      var(--kg-color-gold-deep),
      var(--kg-color-gold-bright)
    );
    animation: kg-load-pulse 1.4s ease-in-out infinite;
  }
  @keyframes kg-load-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes kg-load-pulse {
    0%,
    100% {
      transform: translateY(0);
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ring,
    .progress-fill {
      animation: none;
    }
  }
</style>
