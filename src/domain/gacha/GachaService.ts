import type { Level, Part, Rarity, Rng } from '../types';
import { RARITY_RATES } from '../constants';

/** レアリティの列挙（昇順）。RARITY_RATES のキー集合と対応。 */
const RARITIES: Rarity[] = [1, 2, 3, 4, 5];

/**
 * 重み付き抽選：候補から `weight` に比例する確率で1件を選ぶ。
 * 累積和を `rng()` で切るオーソドックスな方式。最後の要素を既定返却にすることで、
 * 浮動小数の取りこぼし（`rng()` がほぼ 1.0 の場合）も末尾で吸収し、未到達コードを作らない。
 *
 * @param candidates 1件以上の候補（呼び出し側で非空を保証する）
 * @param rng [0,1) を返す乱数源（注入）
 */
function weightedPick(candidates: Part[], rng: Rng): Part {
  const total = candidates.reduce((sum, p) => sum + p.weight, 0);
  let threshold = rng() * total;
  const last = candidates.length - 1;
  // 末尾以外を累積で判定し、どこにも当たらなければ末尾を返す（＝最後のバケツ）
  for (let i = 0; i < last; i++) {
    threshold -= candidates[i].weight;
    if (threshold < 0) return candidates[i];
  }
  return candidates[last];
}

/**
 * レアリティ抽選：`RARITY_RATES[level]` の出現率でレアリティを1つ選ぶ。
 * ただし **scope プールに在庫のあるレアリティのみ** を対象に確率を正規化する。これにより
 * 在庫ゼロのレアリティ（例：やさしいに★5が無い）を引いて抽選が破綻するのを防ぐ。
 * 全レアリティが在庫ありの well-formed プールでは正規化は無作用で、分布は RARITY_RATES と一致する。
 *
 * @param level 現在のレベル
 * @param scoped level の scope に絞り込み済みの部品（非空）
 * @param rng 乱数源（注入）
 */
function pickRarity(level: Level, scoped: Part[], rng: Rng): Rarity {
  const rates = RARITY_RATES[level];
  // 在庫のあるレアリティだけを母集合にする
  const present: { rarity: Rarity; rate: number }[] = [];
  let total = 0;
  for (const r of RARITIES) {
    if (scoped.some((p) => p.rarity === r)) {
      present.push({ rarity: r, rate: rates[r] });
      total += rates[r];
    }
  }
  let threshold = rng() * total;
  const last = present.length - 1;
  for (let i = 0; i < last; i++) {
    threshold -= present[i].rate;
    if (threshold < 0) return present[i].rarity;
  }
  return present[last].rarity;
}

/**
 * ガチャ抽選サービス（機能設計4.3・PRD F1）。難易度エンジンの主役。
 * レベル別の出現率（`RARITY_RATES`）とプール `weight` で部品を1つ抽選し、床（2部品の
 * 正解が手札に揃う状態）を統計的に維持する。
 *
 * 純粋性：乱数は `Rng` を**引数注入**で受け、`Math.random` を直書きしない。フリープレイは
 * Math.random ラッパ、デイリーは `mulberry32(dailySeed(...))` をアプリ層（T-014）で生成して渡す。
 *
 * weight 設計（機能設計4.3）：`Part.weight` は**ビルド時**に「その部品が、レベルscope内で
 * 成立する2部品有名漢字の数」に比例して与える。高汎用部品（木・日・口・言・女・寺 等）の
 * weight を大きくし、林・明・好・詩… 級の正解が揃いやすくする。初期 weight 値は T-004 の
 * 詰み率モンテカルロ（目標10〜20%）でチューニングする。
 */
export class GachaService {
  /**
   * 部品を1つ抽選する。① レアリティを出現率で選び ② 当該レアリティ・当該scope の候補から
   * weight で重み付き抽選する（機能設計4.3）。
   *
   * @param level 現在のレベル（出現率と scope を決める）
   * @param pool 抽選母集合（全部品。scope 絞り込みは本メソッド内で行う）
   * @param rng [0,1) を返す乱数源（注入）
   * @returns 抽選された部品
   * @throws level の scope に部品が1つも無い場合（プールのデータ不整合）
   */
  draw(level: Level, pool: Part[], rng: Rng): Part {
    const scoped = pool.filter((p) => p.scopes.includes(level));
    if (scoped.length === 0) {
      throw new Error(`gacha pool has no parts for level "${level}"`);
    }
    const rarity = pickRarity(level, scoped, rng);
    const candidates = scoped.filter((p) => p.rarity === rarity);
    return weightedPick(candidates, rng);
  }
}
