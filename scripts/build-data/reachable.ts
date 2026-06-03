/**
 * 到達可能 primary 漢字総数 N の算出（T-004・機能設計 8.1 手順7）。
 *
 * 各レベルで、プール内の部品の組み合わせから実際に到達可能な漢字の集合を列挙し、
 * その総数 N をレベル別に算出する（図鑑収集率の分母）。到達不能な漢字
 * （単部品・プール外の部品を要する字）は分母に含めない。
 *
 * 出力：public/data/reachable.json
 *   - kanji.json を純粋な KanjiEntry[] に保つため（機能設計 8.2）、N は別ファイルに出す。
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Level } from '../../src/domain/types';
import { LEVELS, LEVEL_RANK } from './levels';
import { PUBLIC_DATA_DIR } from './loadSources';
import { type GeneratedData, loadGenerated } from './loadGenerated';

export interface ReachableResult {
  /** 各レベルの到達可能 primary 漢字数（図鑑分母 N） */
  reachableN: Record<Level, number>;
  /** 各レベルで in-scope な漢字総数（参考） */
  inScopeTotal: Record<Level, number>;
  /** データ構造の不整合（combine の参照先が kanji に存在しない 等） */
  structuralErrors: string[];
}

/** combine の results/primary がすべて kanji.json に存在するか（構造健全性） */
function findStructuralErrors(data: GeneratedData): string[] {
  const known = new Set(data.kanji.map((k) => k.char));
  const errors: string[] = [];
  for (const e of data.combine) {
    for (const r of e.results) {
      if (!known.has(r))
        errors.push(`combine "${e.key}" の result "${r}" が kanji.json に無い`);
    }
    if (!known.has(e.primary)) {
      errors.push(
        `combine "${e.key}" の primary "${e.primary}" が kanji.json に無い`
      );
    }
  }
  return errors;
}

export function computeReachable(data: GeneratedData): ReachableResult {
  const rankOf = new Map(data.kanji.map((k) => [k.char, LEVEL_RANK[k.level]]));

  const reachableN = {} as Record<Level, number>;
  const inScopeTotal = {} as Record<Level, number>;

  for (const level of LEVELS) {
    const lr = LEVEL_RANK[level];
    // level プール＝ scopes に level を含む部品
    const pool = new Set(
      data.parts.filter((p) => p.scopes.includes(level)).map((p) => p.id)
    );
    const reachable = new Set<string>();
    for (const e of data.combine) {
      // 全部品が level プールに存在しなければ到達不能
      if (!e.key.split('+').every((p) => pool.has(p))) continue;
      // in-scope な result のみ図鑑に到達可能（rank <= level）
      for (const r of e.results) {
        if ((rankOf.get(r) ?? Infinity) <= lr) reachable.add(r);
      }
    }
    reachableN[level] = reachable.size;
    inScopeTotal[level] = data.kanji.filter(
      (k) => LEVEL_RANK[k.level] <= lr
    ).length;
  }

  return {
    reachableN,
    inScopeTotal,
    structuralErrors: findStructuralErrors(data),
  };
}

/** CLI から呼ばれる：reachable.json を書き出して結果を返す */
export function runReachable(
  data: GeneratedData = loadGenerated()
): ReachableResult {
  const result = computeReachable(data);
  writeFileSync(
    join(PUBLIC_DATA_DIR, 'reachable.json'),
    JSON.stringify({
      reachableN: result.reachableN,
      inScopeTotal: result.inScopeTotal,
    })
  );
  return result;
}
