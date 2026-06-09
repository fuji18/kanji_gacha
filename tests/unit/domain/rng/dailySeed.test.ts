import { describe, it, expect } from 'vitest';
import {
  todayYmdJst,
  dailySeed,
  dailyLevel,
} from '../../../../src/domain/rng/dailySeed';
import type { Level } from '../../../../src/domain/types';

// todayYmdJst は JST+9 固定・locale非依存（機能設計4.6・問題5）。
// 日付の切り替わりは JST 0:00 = UTC 前日15:00。境界を固定する。

describe('todayYmdJst', () => {
  it('JST昼間の時刻を YYYYMMDD に変換する（locale非依存）', () => {
    // UTC 2026-06-03 03:00 = JST 2026-06-03 12:00
    const nowMs = Date.UTC(2026, 5, 3, 3, 0, 0);
    expect(todayYmdJst(nowMs)).toBe('20260603');
  });

  it('JST 0:00 の境界で日付が繰り上がる（UTC 14:59→15:00）', () => {
    // UTC 14:59:59 = JST 23:59:59（同日）
    const justBefore = Date.UTC(2026, 5, 2, 14, 59, 59);
    // UTC 15:00:00 = JST 翌日 00:00:00
    const atMidnightJst = Date.UTC(2026, 5, 2, 15, 0, 0);
    expect(todayYmdJst(justBefore)).toBe('20260602');
    expect(todayYmdJst(atMidnightJst)).toBe('20260603');
  });

  it('月・日を2桁ゼロ埋めする', () => {
    // UTC 2026-01-04 00:00 = JST 2026-01-04 09:00
    const nowMs = Date.UTC(2026, 0, 4, 0, 0, 0);
    expect(todayYmdJst(nowMs)).toBe('20260104');
  });

  it('年跨ぎ：UTC大晦日15:00で翌年元日になる', () => {
    // UTC 2026-12-31 15:00 = JST 2027-01-01 00:00
    const nowMs = Date.UTC(2026, 11, 31, 15, 0, 0);
    expect(todayYmdJst(nowMs)).toBe('20270101');
  });
});

describe('dailySeed', () => {
  it('YYYYMMDD を10進整数のシードに変換する', () => {
    expect(dailySeed('20260603')).toBe(20260603);
  });

  it('todayYmdJst と合成して数値シードを得る', () => {
    const nowMs = Date.UTC(2026, 5, 3, 3, 0, 0);
    expect(dailySeed(todayYmdJst(nowMs))).toBe(20260603);
  });
});

describe('dailyLevel（日替わりレベル・T-022/F8）', () => {
  it('seed % 3 で 3レベルを巡回し、必ず有効なレベルを返す', () => {
    const levels: Level[] = ['elementary', 'juniorhigh', 'joyo'];
    // seed % 3 のインデックスでレベルが決まる
    expect(dailyLevel(20260603)).toBe(levels[20260603 % 3]);
    // 3連続シードは3レベルすべてを1回ずつ網羅する
    const trio = [
      dailyLevel(20260603),
      dailyLevel(20260604),
      dailyLevel(20260605),
    ];
    expect(new Set(trio)).toEqual(new Set(levels));
    // 連続する日付で常に有効レベル＆3日周期
    for (let s = 20260601; s <= 20260630; s++) {
      expect(levels).toContain(dailyLevel(s));
      expect(dailyLevel(s)).toBe(dailyLevel(s + 3));
    }
  });

  it('同一シードは常に同一レベル（決定性）', () => {
    expect(dailyLevel(20260603)).toBe(dailyLevel(20260603));
  });
});
