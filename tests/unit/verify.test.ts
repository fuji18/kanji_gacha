/**
 * T-004 受け入れテスト：データ検証ゲートの枠組み。
 *
 * - verifyMaxParts：実データで一致／ダミー（max=6）で不一致を検出
 * - checkStuckRate：帯内で ok／帯外ダミーで fail（「意図的に外したダミーで非0終了」）
 * - computeReachable：N>0・到達不能字を分母に含めない・構造健全性
 * - simulateStuckRate：同一シードで決定的
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { CombineEntry, KanjiEntry, Part } from '../../src/domain/types';
import type { GeneratedData } from '../../scripts/build-data/loadGenerated';
import { computeReachable } from '../../scripts/build-data/reachable';
import {
  checkStuckRate,
  simulateStuckRate,
} from '../../scripts/build-data/simulateStuckRate';
import { verifyMaxParts } from '../../scripts/build-data/verifyMaxParts';

const DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'public',
  'data'
);
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8')) as T;

const realData: GeneratedData = {
  kanji: read<KanjiEntry[]>('kanji.json'),
  parts: read<Part[]>('parts.json'),
  combine: read<CombineEntry[]>('combine-dict.json'),
};

describe('verifyMaxParts（MAX_COMBINE_PARTS 一致）', () => {
  it('実データの辞書実最大 === MAX_COMBINE_PARTS(5)', () => {
    const r = verifyMaxParts(realData.combine);
    expect(r.actualMax).toBe(5);
    expect(r.ok).toBe(true);
  });

  it('意図的に上限超（partCount=6）のダミーは不一致を検出する', () => {
    const dummy: CombineEntry[] = [
      { key: 'a+b+c+d+e+f', results: ['X'], primary: 'X', partCount: 6 },
    ];
    const r = verifyMaxParts(dummy, 5);
    expect(r.ok).toBe(false);
    expect(r.actualMax).toBe(6);
  });
});

describe('checkStuckRate（KPI帯判定）', () => {
  it('帯内（全レベル 15%）は ok', () => {
    const r = checkStuckRate({
      elementary: 0.15,
      juniorhigh: 0.15,
      joyo: 0.15,
    });
    expect(r.ok).toBe(true);
    expect(r.failures).toHaveLength(0);
  });

  it('意図的に帯を外したダミー（50%）は fail（=verify:data を非0終了させる）', () => {
    const r = checkStuckRate({ elementary: 0.5, juniorhigh: 0.05, joyo: 0.15 });
    expect(r.ok).toBe(false);
    // 帯外は elementary(0.5) と juniorhigh(0.05) の2件
    expect(r.failures.map((f) => f.level).sort()).toEqual([
      'elementary',
      'juniorhigh',
    ]);
  });
});

describe('computeReachable（図鑑分母 N）', () => {
  it('実データで N>0、かつ N <= in-scope 総数（到達不能字を含めない）', () => {
    const r = computeReachable(realData);
    for (const level of ['elementary', 'juniorhigh', 'joyo'] as const) {
      expect(r.reachableN[level]).toBeGreaterThan(0);
      expect(r.reachableN[level]).toBeLessThanOrEqual(r.inScopeTotal[level]);
    }
    // 実データは構造健全（results/primary はすべて kanji.json に存在）
    expect(r.structuralErrors).toHaveLength(0);
  });

  it('プール外の部品を要する漢字は分母 N に含めない', () => {
    // 合成データ：心 は joyo 限定の部品。木+心→想(joyo) は elementary では到達不能。
    const data: GeneratedData = {
      kanji: [
        {
          char: '林',
          strokes: 8,
          readings: [],
          meanings: [],
          level: 'elementary',
        },
        { char: '想', strokes: 13, readings: [], meanings: [], level: 'joyo' },
      ],
      parts: [
        {
          id: '木',
          char: '木',
          rarity: 1,
          scopes: ['elementary', 'juniorhigh', 'joyo'],
          weight: 1,
        },
        { id: '心', char: '心', rarity: 1, scopes: ['joyo'], weight: 1 },
      ],
      combine: [
        { key: '木+木', results: ['林'], primary: '林', partCount: 2 },
        { key: '心+木', results: ['想'], primary: '想', partCount: 2 },
      ],
    };
    const r = computeReachable(data);
    // elementary：林 のみ到達可能（想 は joyo 限定部品 心 が必要で到達不能）
    expect(r.reachableN.elementary).toBe(1);
    // joyo：林・想 の両方が到達可能
    expect(r.reachableN.joyo).toBe(2);
  });
});

describe('simulateStuckRate（決定性）', () => {
  it('同一シード・試行数で再現可能（決定的）', () => {
    const a = simulateStuckRate(realData, { seed: 42, trials: 50 });
    const b = simulateStuckRate(realData, { seed: 42, trials: 50 });
    expect(a.rates).toEqual(b.rates);
  });
});
