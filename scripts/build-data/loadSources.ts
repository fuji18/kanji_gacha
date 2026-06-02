/**
 * 蒸留済み元データ（data-sources/）の読み込み。
 *
 * - kanjidic2-joyo.json：KANJIDIC2 由来。常用2,136字の漢字情報。
 * - kanjivg-decomp.json：KanjiVG 由来。漢字→部品分解（深さ1段階に正規化済み）。
 *
 * 本家配布元（edrdg.org）がネットワーク許可リストで遮断されているため、
 * 同等の CC BY-SA データを蒸留して同梱し、オフラインで再現生成する
 * （data-sources/README.md を参照）。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
/** リポジトリルート（scripts/build-data/ から2階層上） */
export const REPO_ROOT = join(HERE, '..', '..');
export const DATA_SOURCES_DIR = join(REPO_ROOT, 'data-sources');
export const PUBLIC_DATA_DIR = join(REPO_ROOT, 'public', 'data');

/** kanjidic2-joyo.json の1レコード（KANJIDIC2 由来フィールドのみ） */
export interface RawKanji {
  char: string;
  strokes: number;
  /** KANJIDIC2 grade（1–6=小学 / 8=常用残り） */
  grade: number;
  /** 頻度順位（無い字は null） */
  freq: number | null;
  /** 音読み */
  on: string[];
  /** 訓読み */
  kun: string[];
  /** 意味（英語・KANJIDIC2 由来） */
  meanings: string[];
}

/** kanjivg-decomp.json：漢字 -> 部品文字の配列（深さ1段階） */
export type RawDecomp = Record<string, string[]>;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadKanjidic(): RawKanji[] {
  return readJson<RawKanji[]>(join(DATA_SOURCES_DIR, 'kanjidic2-joyo.json'));
}

export function loadDecomposition(): RawDecomp {
  return readJson<RawDecomp>(join(DATA_SOURCES_DIR, 'kanjivg-decomp.json'));
}
