import { describe, it, expect } from 'vitest';
import { computeExtensionMs } from '../../../../src/domain/timeattack/timeAttack';
import { TIME_ATTACK } from '../../../../src/domain/constants';

// 時間延長計算（T-027・企画整理書 §11）の受け入れ条件を固定する。
//   延長 = round( (基礎 + 知識 + 多部品 + 速度) × コンボ倍率 )

const T = TIME_ATTACK;

describe('computeExtensionMs', () => {
  it('最小ケース：2部品・低画数・速攻なし・×1.0 は基礎＋知識のみ', () => {
    // 画数4 → 知識 floor(4/4)=1秒。多部品なし・速攻なし・×1.0
    const ms = computeExtensionMs({
      strokes: 4,
      partCount: 2,
      speedy: false,
      multiplier: 1.0,
    });
    expect(ms).toBe(T.baseExtendMs + 1000);
  });

  it('知識ボーナスは floor(画数 / strokesDivisorSec) 秒', () => {
    // 画数16 → floor(16/4)=4秒
    const ms = computeExtensionMs({
      strokes: 16,
      partCount: 2,
      speedy: false,
      multiplier: 1.0,
    });
    expect(ms).toBe(T.baseExtendMs + 4000);
  });

  it('画数が divisor 未満なら知識ボーナス0（floor で切り捨て）', () => {
    const ms = computeExtensionMs({
      strokes: T.strokesDivisorSec - 1,
      partCount: 2,
      speedy: false,
      multiplier: 1.0,
    });
    expect(ms).toBe(T.baseExtendMs);
  });

  it('部品数が閾値以上で多部品ボーナスが加算される', () => {
    const base = {
      strokes: 4, // 知識1秒
      speedy: false,
      multiplier: 1.0,
    };
    const two = computeExtensionMs({ ...base, partCount: 2 });
    const three = computeExtensionMs({
      ...base,
      partCount: T.multiPartThreshold,
    });
    expect(three - two).toBe(T.multiPartBonusMs);
  });

  it('速攻フラグで速度ボーナスが加算される', () => {
    const base = {
      strokes: 4,
      partCount: 2,
      multiplier: 1.0,
    };
    const slow = computeExtensionMs({ ...base, speedy: false });
    const fast = computeExtensionMs({ ...base, speedy: true });
    expect(fast - slow).toBe(T.speedBonusMs);
  });

  it('コンボ倍率が括弧全体に乗算される', () => {
    const input = {
      strokes: 16, // 知識4秒
      partCount: T.multiPartThreshold, // 多部品
      speedy: true, // 速攻
    };
    const sum = T.baseExtendMs + 4000 + T.multiPartBonusMs + T.speedBonusMs;
    expect(computeExtensionMs({ ...input, multiplier: 1.0 })).toBe(sum);
    expect(computeExtensionMs({ ...input, multiplier: 3.0 })).toBe(
      Math.round(sum * 3.0)
    );
  });

  it('乗算結果は round で整数 ms に丸める', () => {
    // 倍率1.5 で端数が出るケース
    const ms = computeExtensionMs({
      strokes: 4,
      partCount: 2,
      speedy: false,
      multiplier: 1.5,
    });
    expect(ms).toBe(Math.round((T.baseExtendMs + 1000) * 1.5));
    expect(Number.isInteger(ms)).toBe(true);
  });
});
