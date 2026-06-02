/**
 * 生成済み辞書（public/data/*.json）の読み込み（検証スクリプト共通・T-004）。
 *
 * `gen:data`（T-003）の出力を検証の入力として読む。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CombineEntry, KanjiEntry, Part } from './types';
import { PUBLIC_DATA_DIR } from './loadSources';

export interface GeneratedData {
  kanji: KanjiEntry[];
  parts: Part[];
  combine: CombineEntry[];
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(PUBLIC_DATA_DIR, name), 'utf8')) as T;
}

export function loadGenerated(): GeneratedData {
  return {
    kanji: readJson<KanjiEntry[]>('kanji.json'),
    parts: readJson<Part[]>('parts.json'),
    combine: readJson<CombineEntry[]>('combine-dict.json'),
  };
}
