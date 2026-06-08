import { describe, it, expect } from 'vitest';
import {
  ParticleField,
  type RafScheduler,
} from '../../../../src/ui/effects/particleField';

// particleField の受け入れ条件（T-018）：プール上限での間引き・寿命管理・モーション軽減・rAFループ。
// Canvas ctx はモック（happy-dom の 2D 未実装に依存しない）。描画呼び出しは no-op で検証対象外。

/** 使用するメソッド/プロパティだけを持つ ctx モック。 */
function mockCtx(): CanvasRenderingContext2D {
  const noop = (): void => {};
  return {
    clearRect: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('ParticleField burst / プール上限（間引き）', () => {
  it('16方向要求でも maxParticles を超えない（間引き）', () => {
    const field = new ParticleField(mockCtx(), { maxParticles: 10 });
    field.resize(100, 100);
    field.burst(50, 50); // 16 要求 → 上限10
    expect(field.activeCount).toBe(10);

    field.burst(50, 50); // 空き無し → 増えない
    expect(field.activeCount).toBe(10);
  });

  it('十分なプールなら16個（16方向）生成する', () => {
    const field = new ParticleField(mockCtx(), { maxParticles: 64 });
    field.resize(100, 100);
    field.burst(50, 50);
    expect(field.activeCount).toBe(16);
  });
});

describe('ParticleField step / 寿命', () => {
  it('時間経過でパーティクルが寿命切れになり 0 に戻る', () => {
    const field = new ParticleField(mockCtx(), { maxParticles: 32 });
    field.resize(100, 100);
    field.burst(50, 50);
    expect(field.activeCount).toBe(16);

    field.step(100); // まだ生存
    expect(field.activeCount).toBe(16);

    field.step(10_000); // 寿命を超過 → 全消滅
    expect(field.activeCount).toBe(0);
  });
});

describe('ParticleField リングプール上限', () => {
  it('リングプールが満杯でも例外なく間引かれる（多発バースト）', () => {
    // パーティクル0でリングのみ。バースト2本/回 ×7回でリングプール(12)超過。
    const field = new ParticleField(mockCtx(), { maxParticles: 0 });
    field.resize(100, 100);
    expect(() => {
      for (let i = 0; i < 7; i++) field.burst(50, 50);
      field.step(16); // 描画も例外なく通る
    }).not.toThrow();
  });
});

describe('ParticleField モーション軽減', () => {
  it('reducedMotion ではパーティクルを出さない（フラッシュのみ）', () => {
    const field = new ParticleField(mockCtx(), {
      maxParticles: 32,
      reducedMotion: true,
    });
    field.resize(100, 100);
    field.burst(50, 50);
    expect(field.activeCount).toBe(0);
  });
});

describe('ParticleField rAFループ（scheduler 注入）', () => {
  it('start で1フレーム駆動、stop で停止する', () => {
    let frame: ((ts: number) => void) | null = null;
    let canceled = false;
    const scheduler: RafScheduler = {
      raf: (cb) => {
        frame = cb;
        return 1;
      },
      caf: () => {
        canceled = true;
      },
    };
    const field = new ParticleField(mockCtx(), { maxParticles: 32 }, scheduler);
    field.resize(100, 100);
    field.burst(50, 50);

    field.start();
    expect(frame).not.toBeNull();
    // 初回フレームは dt=16 固定。2フレーム目で大きな dt を与えて全消滅させる。
    frame!(0);
    frame!(10_000);
    expect(field.activeCount).toBe(0);

    field.stop();
    expect(canceled).toBe(true);
  });

  it('stop 後に取り残されたフレームが発火しても early-return する', () => {
    let frame: ((ts: number) => void) | null = null;
    const scheduler: RafScheduler = {
      raf: (cb) => {
        frame = cb;
        return 1;
      },
      caf: () => {},
    };
    const field = new ParticleField(mockCtx(), { maxParticles: 32 }, scheduler);
    field.resize(100, 100);
    field.burst(50, 50);
    field.start();
    field.stop();
    const before = field.activeCount;
    frame!(10_000); // 停止後の取り残しフレーム → step されず activeCount 不変
    expect(field.activeCount).toBe(before);
  });

  it('未開始で stop しても no-op（caf を呼ばない）', () => {
    let canceled = false;
    const scheduler: RafScheduler = {
      raf: () => 1,
      caf: () => {
        canceled = true;
      },
    };
    const field = new ParticleField(mockCtx(), {}, scheduler);
    field.stop(); // start していない
    expect(canceled).toBe(false);
  });

  it('既定スケジューラ（実 rAF）でも start/stop が動作する', () => {
    // scheduler 未注入＝既定の requestAnimationFrame/cancelAnimationFrame 経路を実行する。
    // 直後に stop するため、予約フレームは発火前にキャンセルされる。
    const field = new ParticleField(mockCtx());
    field.resize(10, 10);
    expect(() => {
      field.start();
      field.stop();
    }).not.toThrow();
  });

  it('多重 start しても1ループのみ（再 start は no-op）', () => {
    let count = 0;
    const scheduler: RafScheduler = {
      raf: () => {
        count += 1;
        return 1;
      },
      caf: () => {},
    };
    const field = new ParticleField(mockCtx(), {}, scheduler);
    field.start();
    field.start(); // no-op
    expect(count).toBe(1); // 初回 raf 予約は1回だけ
    field.stop();
  });
});
