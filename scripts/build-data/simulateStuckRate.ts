/**
 * 詰み率シミュレーション（T-004・機能設計 8.1 手順9 / 4.3 / 4.5）。
 *
 * 各レベルのプール・出現率・weight で耐久プレイをモンテカルロ実行し、
 * 詰み終了率（endReason='stuck' の割合）を実測する。固定シード＋固定試行数で
 * 決定的（CI で再現可能）。
 *
 * 帯判定（`checkStuckRate`）は KPI目標（10〜20%）からの逸脱を検出する。
 * weight のフロア設計は T-009 のスコープのため、`verify.ts` では既定で警告扱い
 * （`KG_ENFORCE_STUCK_RATE=1` でハードゲート化）。本モジュールは純粋な計測・判定を担う。
 */

import {
  GACHA_COUNT,
  HAND_CAP,
  RARITY_RATES,
} from '../../src/domain/constants';
import type { Level, Part, Rarity, Rng } from '../../src/domain/types';
import { LEVELS, LEVEL_RANK } from './levels';
import type { GeneratedData } from './loadGenerated';
import { mulberry32 } from './rng';

/**
 * 詰み終了率の KPI 目標帯（PRD KPI / 機能設計の「詰み終了率 10〜20%」）。
 * 検証時のみ必要で実行時バンドルに不要なため、ビルドローカルに co-locate する。
 */
export const STUCK_RATE_BAND = { min: 0.1, max: 0.2 } as const;

export interface StuckRateOptions {
  /** 乱数シード（決定性のため固定既定） */
  seed?: number;
  /** レベルごとの試行回数 */
  trials?: number;
  /** 1プレイのガチャ回数（機能設計 3.2 暫定 10） */
  gacha?: number;
  /** 手札上限（機能設計 3.2 暫定 12） */
  handCap?: number;
}

export interface StuckRateResult {
  rates: Record<Level, number>;
  trials: number;
}

// gacha/handCap は実際のゲーム設定（src/domain）を参照し、シミュレーションが
// 実プレイ条件と乖離しないようにする（development-guidelines 2.2・値の一元管理）。
const DEFAULTS = {
  seed: 20260603,
  trials: 2000,
  gacha: GACHA_COUNT,
  handCap: HAND_CAP,
};

/** 合体エントリを「部品マルチセット＋result最小ランク」に前処理 */
interface PreparedEntry {
  parts: [string, number][];
  minResultRank: number;
}

function prepareEntries(data: GeneratedData): PreparedEntry[] {
  const rankOf = new Map(data.kanji.map((k) => [k.char, LEVEL_RANK[k.level]]));
  return data.combine.map((e) => {
    const m = new Map<string, number>();
    for (const p of e.key.split('+')) m.set(p, (m.get(p) ?? 0) + 1);
    const minResultRank = Math.min(
      ...e.results.map((r) => rankOf.get(r) ?? Infinity)
    );
    return { parts: [...m.entries()], minResultRank };
  });
}

/** レアリティを出現率で抽選（機能設計 4.3） */
function pickRarity(rates: Record<Rarity, number>, rng: Rng): Rarity {
  const r = rng();
  let acc = 0;
  for (const rar of [1, 2, 3, 4, 5] as Rarity[]) {
    acc += rates[rar];
    if (r < acc) return rar;
  }
  return 5;
}

/** level プールから weight 付きで1部品を引く（機能設計 4.3 drawPart 相当） */
function makeDraw(level: Level, pool: Part[], rng: Rng): () => string {
  const byRarity: Record<Rarity, Part[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };
  for (const p of pool) byRarity[p.rarity].push(p);
  return () => {
    const rar = pickRarity(RARITY_RATES[level], rng);
    let cands = byRarity[rar];
    // 当該レアリティが空なら近いレアリティにフォールバック
    if (cands.length === 0) {
      for (const d of [1, 2, 3, 4, 5] as Rarity[]) {
        if (byRarity[d].length) {
          cands = byRarity[d];
          break;
        }
      }
    }
    const total = cands.reduce((s, p) => s + p.weight, 0);
    let x = rng() * total;
    for (const p of cands) {
      x -= p.weight;
      if (x <= 0) return p.id;
    }
    return cands[cands.length - 1].id;
  };
}

/** 手札（部品マルチセット）に合体可能なエントリがあれば、その部品集合を返す */
function findCombinable(
  hand: Map<string, number>,
  levelRank: number,
  entries: PreparedEntry[]
): [string, number][] | null {
  for (const e of entries) {
    if (e.minResultRank > levelRank) continue;
    let ok = true;
    for (const [p, c] of e.parts) {
      if ((hand.get(p) ?? 0) < c) {
        ok = false;
        break;
      }
    }
    if (ok) return e.parts;
  }
  return null;
}

type EndReason = 'stuck' | 'empty_hand';

/** 1プレイ：合体可能なら合体・無ければ抽選を繰り返し、終了理由を返す（機能設計 4.5） */
function playOnce(
  levelRank: number,
  entries: PreparedEntry[],
  draw: () => string,
  gacha: number,
  handCap: number
): EndReason {
  const hand = new Map<string, number>();
  let size = 0;
  let remaining = gacha;
  for (;;) {
    const combo = findCombinable(hand, levelRank, entries);
    if (combo) {
      for (const [p, c] of combo) {
        const next = (hand.get(p) ?? 0) - c;
        size -= c;
        if (next <= 0) hand.delete(p);
        else hand.set(p, next);
      }
      continue;
    }
    if (remaining > 0 && size < handCap) {
      const id = draw();
      hand.set(id, (hand.get(id) ?? 0) + 1);
      size += 1;
      remaining -= 1;
      continue;
    }
    // 合体不能：手札0かつガチャ0なら empty_hand、それ以外（ガチャ0で残部品あり／
    // 手札満杯で合体不能）は stuck（機能設計 4.5 checkGameEnd の詰み経路）
    if (size === 0) return 'empty_hand';
    return 'stuck';
  }
}

export function simulateStuckRate(
  data: GeneratedData,
  opts: StuckRateOptions = {}
): StuckRateResult {
  const { seed, trials, gacha, handCap } = { ...DEFAULTS, ...opts };
  const entries = prepareEntries(data);
  const rates = {} as Record<Level, number>;

  for (const level of LEVELS) {
    const pool = data.parts.filter((p) => p.scopes.includes(level));
    // level ごとにシードを決定的にずらし、独立かつ再現可能にする
    const rng = mulberry32(seed + LEVEL_RANK[level]);
    const draw = makeDraw(level, pool, rng);
    const levelRank = LEVEL_RANK[level];
    let stuck = 0;
    for (let i = 0; i < trials; i++) {
      if (playOnce(levelRank, entries, draw, gacha, handCap) === 'stuck') {
        stuck += 1;
      }
    }
    rates[level] = stuck / trials;
  }

  return { rates, trials };
}

export interface StuckRateCheck {
  ok: boolean;
  failures: { level: Level; rate: number }[];
}

/** 詰み率が KPI帯（既定 10〜20%）に収まるか判定する */
export function checkStuckRate(
  rates: Record<Level, number>,
  band: { min: number; max: number } = STUCK_RATE_BAND
): StuckRateCheck {
  const failures: { level: Level; rate: number }[] = [];
  for (const level of LEVELS) {
    const rate = rates[level];
    if (rate < band.min || rate > band.max) failures.push({ level, rate });
  }
  return { ok: failures.length === 0, failures };
}
