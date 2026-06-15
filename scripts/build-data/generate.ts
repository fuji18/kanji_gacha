/**
 * ビルド時データ生成スクリプト（T-003）。
 *
 * 蒸留済み元データ（data-sources/）から、実行時に使う3つのJSON辞書を生成する：
 *   - public/data/kanji.json        … KanjiEntry[]
 *   - public/data/parts.json        … Part[]
 *   - public/data/combine-dict.json … CombineEntry[]
 *   - public/data/LICENSE.txt       … 生成物の CC BY-SA 表記
 *
 * 機能設計 8.1 の手順に従う。実行：`npm run gen:data`
 * （tsx --tsconfig tsconfig.scripts.json scripts/build-data/generate.ts）
 *
 * 型・定数・selectPrimary は src/domain を再利用する（ビルド側で二重定義しない）。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { selectPrimary } from '../../src/domain/combine/selectPrimary';
import { MAX_COMBINE_PARTS } from '../../src/domain/constants';
import type {
  CombineEntry,
  KanjiEntry,
  Part,
  Rarity,
} from '../../src/domain/types';
import { LEVELS, LEVEL_RANK, gradeToLevel } from './levels';
import {
  PUBLIC_DATA_DIR,
  loadDecomposition,
  loadKanjidic,
  type RawKanji,
} from './loadSources';

/** kanji.json のアセット圧縮：読み・意味の上限（約100KB以内・PRD 性能要件） */
const MAX_READINGS = 6;
const MAX_MEANINGS = 2;

/** 部品文字をコードポイント昇順に並べる比較関数 */
function byCodePoint(a: string, b: string): number {
  return (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0);
}

/** 1) kanji.json（KanjiEntry[]）を構築する */
function buildKanji(raw: RawKanji[]): KanjiEntry[] {
  return raw
    .map((k): KanjiEntry => {
      const entry: KanjiEntry = {
        char: k.char,
        strokes: k.strokes,
        readings: [...k.on, ...k.kun].slice(0, MAX_READINGS),
        meanings: k.meanings.slice(0, MAX_MEANINGS),
        level: gradeToLevel(k.grade, k.freq),
        grade: k.grade, // 学年別出題（T-028）。1–6＝小学／8＝中学以降
      };
      // 頻度のある字のみ freqRank を持たせる（selectPrimary の代表解選定に使用）
      if (k.freq != null) entry.freqRank = k.freq;
      return entry;
    })
    .sort((a, b) => byCodePoint(a.char, b.char));
}

/** 2) combine-dict.json（CombineEntry[]）を構築する */
function buildCombineDict(
  decomp: Record<string, string[]>,
  kanjiByChar: Map<string, KanjiEntry>
): CombineEntry[] {
  // key（正規化済み部品マルチセット）-> 成立する漢字の集合
  const byKey = new Map<string, Set<string>>();
  for (const [char, comps] of Object.entries(decomp)) {
    // 合体不能（2部品未満）・探索上限超（MAX_COMBINE_PARTS 超）は辞書から除外
    if (comps.length < 2 || comps.length > MAX_COMBINE_PARTS) continue;
    // 採点対象の漢字情報が無ければスキップ（常用外などは元データに無い）
    if (!kanjiByChar.has(char)) continue;
    // 部品idマルチセットを昇順ソートして "+" 連結＝配置不問の正規化キー
    const key = [...comps].sort(byCodePoint).join('+');
    let set = byKey.get(key);
    if (!set) {
      set = new Set<string>();
      byKey.set(key, set);
    }
    set.add(char);
  }

  return [...byKey.entries()]
    .map(([key, set]): CombineEntry => {
      const results = [...set].sort(byCodePoint);
      const candidates = results.map((c) => kanjiByChar.get(c)!);
      return {
        key,
        results,
        primary: selectPrimary(candidates).char,
        partCount: key.split('+').length,
      };
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** 3) parts.json（Part[]）を構築する */
function buildParts(
  combine: CombineEntry[],
  kanjiByChar: Map<string, KanjiEntry>
): Part[] {
  // 各部品について：2部品エントリ数（weight 素）と作れる漢字の最小 level を集計する
  interface Agg {
    twoPartCount: number; // weight の素（機能設計 4.3）
    minRank: number; // 作れる漢字の最小 level ランク（scopes 算出用）
  }
  const agg = new Map<string, Agg>();
  for (const entry of combine) {
    const comps = entry.key.split('+');
    // このエントリで作れる漢字の最小 level ランク
    const entryMinRank = Math.min(
      ...entry.results.map((c) => LEVEL_RANK[kanjiByChar.get(c)!.level])
    );
    for (const c of new Set(comps)) {
      let a = agg.get(c);
      if (!a) {
        a = { twoPartCount: 0, minRank: Infinity };
        agg.set(c, a);
      }
      if (entry.partCount === 2) a.twoPartCount += 1;
      if (entryMinRank < a.minRank) a.minRank = entryMinRank;
    }
  }

  // weight 分布の分位点でレアリティ境界を決める（汎用度が高いほど rarity 小・暫定 T-009）
  const weights = [...agg.values()]
    .map((a) => Math.max(1, a.twoPartCount))
    .sort((x, y) => y - x);
  const quantile = (p: number): number =>
    weights[Math.min(weights.length - 1, Math.floor(weights.length * p))] ?? 1;
  const r1 = quantile(0.2);
  const r2 = quantile(0.4);
  const r3 = quantile(0.6);
  const r4 = quantile(0.8);
  const rarityOf = (w: number): Rarity =>
    w >= r1 ? 1 : w >= r2 ? 2 : w >= r3 ? 3 : w >= r4 ? 4 : 5;

  return [...agg.entries()]
    .map(([char, a]): Part => {
      const weight = Math.max(1, a.twoPartCount);
      // scopes = 作れる漢字の最小 level 以上（包含関係を満たす）
      const minRank = Number.isFinite(a.minRank) ? a.minRank : LEVEL_RANK.joyo;
      const scopes = LEVELS.filter((l) => LEVEL_RANK[l] >= minRank);
      return { id: char, char, rarity: rarityOf(weight), scopes, weight };
    })
    .sort((a, b) => byCodePoint(a.char, b.char));
}

/** 生成物の CC BY-SA ライセンス表記（SA 継承・repository-structure 9） */
function licenseText(): string {
  return [
    '漢字合体ガチャ（仮称） — 生成辞書のライセンス表記',
    '====================================================',
    '',
    'public/data/ の生成物（kanji.json / parts.json / combine-dict.json）は、',
    '下記の CC BY-SA データから生成した二次的著作物です。ShareAlike（継承）',
    '義務により、本生成物を Creative Commons 表示-継承 4.0 国際',
    '(CC BY-SA 4.0) https://creativecommons.org/licenses/by-sa/4.0/ で提供します。',
    '',
    '元データ・クレジット:',
    '  - KANJIDIC2 / KRADFILE  (c) Electronic Dictionary Research and Development',
    '    Group (EDRDG) — CC BY-SA 4.0 — https://www.edrdg.org/',
    '    （漢字の読み・意味・画数・学年・頻度）',
    '  - KanjiVG  (c) Ulrich Apel and contributors — CC BY-SA 3.0 —',
    '    https://kanjivg.tagaini.net/  （部品分解・KRADFILE の代替）',
    '',
    'ライセンス原本は data-sources/LICENSE-EDRDG.txt / LICENSE-KANJIVG.txt を参照。',
    '',
  ].join('\n');
}

/** JSON を minify して書き出し、バイト数を返す */
function writeJson(name: string, data: unknown): number {
  const json = JSON.stringify(data);
  writeFileSync(join(PUBLIC_DATA_DIR, name), json);
  return Buffer.byteLength(json);
}

function generate(): void {
  mkdirSync(PUBLIC_DATA_DIR, { recursive: true });

  const rawKanji = loadKanjidic();
  const decomp = loadDecomposition();

  const kanji = buildKanji(rawKanji);
  const kanjiByChar = new Map(kanji.map((k) => [k.char, k]));
  const combine = buildCombineDict(decomp, kanjiByChar);
  const parts = buildParts(combine, kanjiByChar);

  const bKanji = writeJson('kanji.json', kanji);
  const bParts = writeJson('parts.json', parts);
  const bCombine = writeJson('combine-dict.json', combine);
  writeFileSync(join(PUBLIC_DATA_DIR, 'LICENSE.txt'), licenseText());

  const kb = (n: number): string => `${(n / 1024).toFixed(1)}KB`;
  const multi = combine.filter((e) => e.results.length > 1).length;
  const maxParts = combine.reduce((m, e) => Math.max(m, e.partCount), 0);
  console.log('[gen:data] 生成完了:');
  console.log(`  kanji.json        : ${kanji.length} 字 (${kb(bKanji)})`);
  console.log(`  parts.json        : ${parts.length} 部品 (${kb(bParts)})`);
  console.log(
    `  combine-dict.json : ${combine.length} エントリ` +
      ` (複数解 ${multi} / 最大部品数 ${maxParts}) (${kb(bCombine)})`
  );
  console.log(`  合計(非圧縮)      : ${kb(bKanji + bParts + bCombine)}`);
}

generate();

export {};
