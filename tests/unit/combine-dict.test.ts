/**
 * T-003 受け入れテスト：生成された辞書（public/data/*.json）の健全性。
 *
 * `npm run gen:data` の出力を対象に、既知の合体が存在すること・キーの正規化・
 * 常用外除外・複数解の保持・部品マスタの健全性を検証する。
 * CI では gen:data → test の順に実行されるため、本テスト時点で生成物が存在する。
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MAX_COMBINE_PARTS } from '../../src/domain/constants';
import type { CombineEntry, KanjiEntry, Part } from '../../src/domain/types';

const DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'public',
  'data'
);
const readData = <T>(name: string): T =>
  JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8')) as T;

const combine = readData<CombineEntry[]>('combine-dict.json');
const kanji = readData<KanjiEntry[]>('kanji.json');
const parts = readData<Part[]>('parts.json');

/** 成立漢字 -> エントリの逆引き */
const byResult = new Map<string, CombineEntry>();
for (const e of combine) for (const r of e.results) byResult.set(r, e);

describe('combine-dict.json（合体辞書）', () => {
  it('既知の合体（林・明・好・詩・樹）が辞書に存在する', () => {
    for (const ch of ['林', '明', '好', '詩', '樹']) {
      expect(byResult.has(ch), `${ch} が辞書に存在しない`).toBe(true);
    }
  });

  it('林 は 木+木（重複部品）に正規化される', () => {
    expect(byResult.get('林')?.key).toBe('木+木');
  });

  it('キーは配置不問（コードポイント昇順ソート済み）で partCount と一致する', () => {
    for (const e of combine) {
      const sorted = [...e.key.split('+')].sort(
        (a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0)
      );
      expect(e.key).toBe(sorted.join('+'));
      expect(e.partCount).toBe(e.key.split('+').length);
    }
  });

  it(`全エントリが 2..MAX_COMBINE_PARTS(${MAX_COMBINE_PARTS}) 部品に収まる`, () => {
    for (const e of combine) {
      expect(e.partCount).toBeGreaterThanOrEqual(2);
      expect(e.partCount).toBeLessThanOrEqual(MAX_COMBINE_PARTS);
    }
  });

  it('複数解が results 配列で保持され、primary は results の1つ', () => {
    const multi = combine.filter((e) => e.results.length > 1);
    expect(multi.length).toBeGreaterThan(0);
    for (const e of combine) expect(e.results).toContain(e.primary);
  });
});

describe('kanji.json（漢字マスタ）', () => {
  it('常用漢字2,136字に絞り込まれている', () => {
    expect(kanji.length).toBe(2136);
  });

  it('level は3区分のいずれかで、小学（elementary）が一定数存在する', () => {
    for (const k of kanji) {
      expect(['elementary', 'juniorhigh', 'joyo']).toContain(k.level);
    }
    const elem = kanji.filter((k) => k.level === 'elementary').length;
    expect(elem).toBeGreaterThan(0);
  });

  it('合体辞書の results / primary はすべて kanji.json に存在する（常用外を含まない）', () => {
    const known = new Set(kanji.map((k) => k.char));
    for (const e of combine) {
      for (const r of e.results) expect(known.has(r)).toBe(true);
      expect(known.has(e.primary)).toBe(true);
    }
  });
});

describe('parts.json（部品マスタ）', () => {
  it('合体辞書で使われる部品がすべて定義されている', () => {
    const defined = new Set(parts.map((p) => p.id));
    for (const e of combine) {
      for (const id of e.key.split('+')) expect(defined.has(id)).toBe(true);
    }
  });

  it('各部品は rarity 1..5・weight>=1・scopes 非空を持つ', () => {
    for (const p of parts) {
      expect(p.rarity).toBeGreaterThanOrEqual(1);
      expect(p.rarity).toBeLessThanOrEqual(5);
      expect(p.weight).toBeGreaterThanOrEqual(1);
      expect(p.scopes.length).toBeGreaterThan(0);
    }
  });
});
