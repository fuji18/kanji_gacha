import { describe, it, expect } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  defaultState,
  migrate,
} from '../../../src/data/migrations';

// migrations の受け入れ条件（T-013 / 機能設計5.2・問題6・新問題C）を固定する。
//  - v0（altDiscovered なし）→ v1 で {} 補完
//  - 欠損トップレベルは既定で補完、型不整合は既定に置換
//  - 復元不能な破損は throw（loadState が既定初期化に使う）

describe('defaultState', () => {
  it('現行スキーマの空状態を返す', () => {
    const s = defaultState();
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(s.zukan).toEqual({ discovered: {}, altDiscovered: {} });
    expect(s.bestScores).toEqual({ elementary: 0, juniorhigh: 0, joyo: 0 });
    expect(s.timeAttackBest).toEqual({
      elementary: 0,
      juniorhigh: 0,
      joyo: 0,
    });
    expect(s.dailyBest).toEqual({});
    expect(s.weakKanji).toEqual({}); // T-035
    expect(s.settings).toEqual({
      hintAlwaysOn: false,
      furigana: false,
      tutorialDone: false,
      largeText: false,
      tts: true,
      reducedEffects: false, // T-056
      slowTts: false, // T-056
    });
  });

  it('呼び出しごとに独立したオブジェクトを返す（共有参照しない）', () => {
    const a = defaultState();
    const b = defaultState();
    a.bestScores.joyo = 100;
    a.zukan.discovered['林'] = { firstAt: 'x', count: 1 };
    expect(b.bestScores.joyo).toBe(0);
    expect(b.zukan.discovered).toEqual({});
  });
});

describe('migrate v0 → v1（altDiscovered 補完・新問題C）', () => {
  it('schemaVersion 無し・altDiscovered 無しの旧データを {} 補完して v1 にする', () => {
    const v0 = {
      zukan: { discovered: { 林: { firstAt: '2026-01-01', count: 2 } } },
      bestScores: { elementary: 30, juniorhigh: 0, joyo: 0 },
      dailyBest: { '20260101': 30 },
      settings: { hintAlwaysOn: true },
      // schemaVersion / altDiscovered なし
    };
    const m = migrate(v0);
    expect(m.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(m.zukan.altDiscovered).toEqual({}); // 補完
    expect(m.zukan.discovered['林']).toEqual({
      firstAt: '2026-01-01',
      count: 2,
    });
    expect(m.bestScores.elementary).toBe(30);
    expect(m.dailyBest['20260101']).toBe(30);
    expect(m.settings.hintAlwaysOn).toBe(true);
    // T-027：timeAttackBest 無しの旧データは既定 {0,0,0} で補完される（後方互換）。
    expect(m.timeAttackBest).toEqual({ elementary: 0, juniorhigh: 0, joyo: 0 });
    // T-035：weakKanji 無しの旧データは {} 補完される（後方互換）。
    expect(m.weakKanji).toEqual({});
  });

  it('既存の weakKanji は保持し、数値以外のエントリは捨てる（T-035）', () => {
    const m = migrate({
      schemaVersion: 1,
      weakKanji: { 林: 4, 好: 'x', 品: 2 },
    });
    expect(m.weakKanji).toEqual({ 林: 4, 品: 2 }); // 不正値（好）は除外
  });

  it('既存の timeAttackBest は保持し、型不整合フィールドは既定に置換する（T-027）', () => {
    const m = migrate({
      schemaVersion: 1,
      timeAttackBest: { elementary: 120, juniorhigh: 'x', joyo: 80 },
    });
    expect(m.timeAttackBest.elementary).toBe(120); // 保持
    expect(m.timeAttackBest.juniorhigh).toBe(0); // 不正→既定
    expect(m.timeAttackBest.joyo).toBe(80); // 保持
  });
});

describe('migrate 欠損補完・型防御', () => {
  it('トップレベル欠損は既定で補完する', () => {
    const m = migrate({ schemaVersion: 1 }); // 中身ほぼ空
    expect(m).toEqual(defaultState());
  });

  it('型が壊れたフィールドは既定に置換する（防御）', () => {
    const m = migrate({
      schemaVersion: 1,
      zukan: 'broken',
      bestScores: { elementary: 'NaN', joyo: 50 }, // elementary は不正→既定0
      dailyBest: { '20260101': 'x', '20260102': 40 }, // 不正値は除外
      settings: 12345,
    });
    expect(m.zukan).toEqual({ discovered: {}, altDiscovered: {} });
    expect(m.bestScores.elementary).toBe(0);
    expect(m.bestScores.joyo).toBe(50);
    expect(m.dailyBest).toEqual({ '20260102': 40 });
    expect(m.settings).toEqual({
      hintAlwaysOn: false,
      furigana: false,
      tutorialDone: false,
      largeText: false,
      tts: true,
      reducedEffects: false, // T-056
      slowTts: false, // T-056
    });
  });

  it('T-056 設定（reducedEffects/slowTts）は旧データで既定 false 補完・保存値は保持', () => {
    const m1 = migrate({ schemaVersion: 1, settings: {} });
    expect(m1.settings.reducedEffects).toBe(false);
    expect(m1.settings.slowTts).toBe(false);
    const m2 = migrate({
      schemaVersion: 1,
      settings: { reducedEffects: true, slowTts: true },
    });
    expect(m2.settings.reducedEffects).toBe(true);
    expect(m2.settings.slowTts).toBe(true);
  });

  it('settings がオブジェクトでも hintAlwaysOn が非boolなら既定に置換', () => {
    const m = migrate({ schemaVersion: 1, settings: { hintAlwaysOn: 'yes' } });
    expect(m.settings.hintAlwaysOn).toBe(false);
  });

  it('furigana：旧データ（furigana 無し）は false 補完、bool は保持（T-031）', () => {
    expect(migrate({ schemaVersion: 1, settings: {} }).settings.furigana).toBe(
      false
    );
    expect(
      migrate({ schemaVersion: 1, settings: { furigana: true } }).settings
        .furigana
    ).toBe(true);
    expect(
      migrate({ schemaVersion: 1, settings: { furigana: 'x' } }).settings
        .furigana
    ).toBe(false); // 非boolは既定
  });

  it('discovered の不正エントリ（欠損フィールド）は捨てる', () => {
    const m = migrate({
      schemaVersion: 1,
      zukan: {
        discovered: {
          林: { firstAt: '2026-01-01', count: 2 }, // OK
          好: { count: 1 }, // firstAt 欠損 → 捨てる
          明: 'x', // 非オブジェクト → 捨てる
        },
      },
    });
    expect(Object.keys(m.zukan.discovered)).toEqual(['林']);
  });

  it('未知の未来バージョン（>現行）も現行版へ正規化する（“偽の最新”を防ぐ）', () => {
    const m = migrate({ schemaVersion: 99, settings: { hintAlwaysOn: true } });
    expect(m.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(m.settings.hintAlwaysOn).toBe(true); // フィールドは正規化される
  });
});

describe('migrate 復元不能な破損', () => {
  it('非オブジェクト（配列・プリミティブ・null）は throw する', () => {
    expect(() => migrate(null)).toThrow();
    expect(() => migrate('not json object')).toThrow();
    expect(() => migrate(42)).toThrow();
    expect(() => migrate([1, 2, 3])).toThrow();
  });
});
