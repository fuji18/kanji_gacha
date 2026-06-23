<script lang="ts">
  import '../effects/effects.css';

  // 舞い散る装飾（桜びら＋金の粒）。和紙パネルの背面（z-index:-1）に敷く共通レイヤー。
  // reduced-motion では描画しない（光感度・省電力配慮）。決定的な配置で SSR/再描画にも安定。
  // 親要素は position:relative かつ stacking context（App の .screen は isolation:isolate）であること。
  const reducedMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  const items: string[] = (() => {
    if (reducedMotion) return [];
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
  })();
</script>

{#if items.length > 0}
  <div class="petals" aria-hidden="true">
    {#each items as s, i (i)}<span style="position:absolute;{s}"></span>{/each}
  </div>
{/if}

<style>
  .petals {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
  }
</style>
