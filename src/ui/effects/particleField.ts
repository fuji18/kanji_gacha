/**
 * 合体成功の Canvas 2D 演出（architecture 2.3 / T-018）。白フラッシュ＋同心円リング2重＋
 * 16方向パーティクルを、**単一 rAF ループ**と**オブジェクトプール**で描画する。
 *
 * 60fps 死守：パーティクルは固定数プール（`maxParticles`）を再利用し、空きが無ければ spawn を捨てる
 * （連続成功で多発しても同時描画数を頭打ちにする＝間引き）。判定（ロジック）はこのループを待たない。
 *
 * テスト容易性：`step(dtMs)` は副作用が ctx 描画のみの純粋更新で直接呼べる。rAF/cancel は scheduler
 * 注入で差し替え可能。`prefers-reduced-motion` の尊重は `reducedMotion` フラグで制御する。
 */

/** 描画フレームのスケジューラ（テストで差し替え可能）。 */
export interface RafScheduler {
  raf: (cb: (ts: number) => void) => number;
  caf: (id: number) => void;
}

export interface ParticleFieldOptions {
  /** 同時描画パーティクルの上限（プールサイズ・間引きの要）。 */
  maxParticles?: number;
  /** モーション軽減（true ならパーティクルを出さずフラッシュのみ）。 */
  reducedMotion?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 残り寿命(ms)
  maxLife: number;
  size: number;
  active: boolean;
}

interface Ring {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  active: boolean;
}

const DEFAULT_MAX = 192;
const RING_POOL = 12;
const PARTICLE_DIRS = 16; // 16方向
const PARTICLE_LIFE_MS = 700;
const RING_LIFE_MS = 500;
const FLASH_DECAY_PER_MS = 1 / 250; // フラッシュは ~250ms で消える

export class ParticleField {
  private readonly particles: Particle[];
  private readonly rings: Ring[];
  private flash = 0; // 0..1
  private width = 0;
  private height = 0;
  private running = false;
  private rafId = 0;
  private lastTs = -1; // <0 は「初回フレーム」を表す（ts=0 と衝突しない番兵）
  private readonly reducedMotion: boolean;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    opts: ParticleFieldOptions = {},
    private readonly scheduler: RafScheduler = {
      raf: (cb) => requestAnimationFrame(cb),
      caf: (id) => cancelAnimationFrame(id),
    }
  ) {
    const max = opts.maxParticles ?? DEFAULT_MAX;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.particles = Array.from({ length: max }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: PARTICLE_LIFE_MS,
      size: 0,
      active: false,
    }));
    this.rings = Array.from({ length: RING_POOL }, () => ({
      x: 0,
      y: 0,
      life: 0,
      maxLife: RING_LIFE_MS,
      active: false,
    }));
  }

  /** 描画領域のサイズを設定する（canvas のピクセルサイズに合わせる）。 */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** アクティブなパーティクル数（テスト・デバッグ用）。 */
  get activeCount(): number {
    return this.particles.reduce((n, p) => (p.active ? n + 1 : n), 0);
  }

  /**
   * (x, y) で成功演出を発火する。フラッシュ＋リング2重＋16方向パーティクル。
   * モーション軽減時はフラッシュのみ（パーティクル/リングは出さない）。
   */
  burst(x: number, y: number): void {
    this.flash = this.reducedMotion ? 0.35 : 0.85;
    if (this.reducedMotion) return;

    this.spawnRing(x, y, RING_LIFE_MS); // 内側（速い）
    this.spawnRing(x, y, RING_LIFE_MS * 1.5); // 外側（ゆっくり広がる）＝2重リング

    for (let i = 0; i < PARTICLE_DIRS; i++) {
      const p = this.freeParticle();
      if (p === null) break; // プール上限＝間引き
      const angle = (i / PARTICLE_DIRS) * Math.PI * 2;
      const speed = 0.12 + (i % 3) * 0.04; // px/ms（方向ごとに少しばらす）
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = PARTICLE_LIFE_MS;
      p.maxLife = PARTICLE_LIFE_MS;
      p.size = 4;
      p.active = true;
    }
  }

  /** 1フレーム分の更新と描画（rAF から駆動。テストは dtMs を渡して直接呼べる）。 */
  step(dtMs: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 白フラッシュ
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dtMs * FLASH_DECAY_PER_MS);
      ctx.save();
      ctx.globalAlpha = this.flash;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    // 同心円リング
    for (const ring of this.rings) {
      if (!ring.active) continue;
      ring.life -= dtMs;
      if (ring.life <= 0) {
        ring.active = false;
        continue;
      }
      const t = 1 - ring.life / ring.maxLife; // 0..1
      const radius = 8 + t * 80;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // パーティクル
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dtMs;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dtMs;
      p.y += p.vy * dtMs;
      p.vy += 0.0004 * dtMs; // 軽い重力
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 単一 rAF ループを開始する（多重開始しない）。 */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = -1;
    const frame = (ts: number): void => {
      if (!this.running) return;
      const dt = this.lastTs < 0 ? 16 : ts - this.lastTs;
      this.lastTs = ts;
      this.step(dt);
      this.rafId = this.scheduler.raf(frame);
    };
    this.rafId = this.scheduler.raf(frame);
  }

  /** ループを停止する（コンポーネント破棄時など）。未開始なら no-op。 */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.scheduler.caf(this.rafId);
  }

  // ----- 内部 -----

  private freeParticle(): Particle | null {
    for (const p of this.particles) if (!p.active) return p;
    return null; // 空き無し＝間引き
  }

  private spawnRing(x: number, y: number, lifeMs: number): void {
    for (const ring of this.rings) {
      if (ring.active) continue;
      ring.x = x;
      ring.y = y;
      ring.maxLife = lifeMs;
      ring.life = lifeMs;
      ring.active = true;
      return;
    }
  }
}
