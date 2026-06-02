/**
 * データ検証ゲート オーケストレータ（T-004）。`npm run verify:data` のエントリ。
 *
 * `gen:data`（T-003）の出力に対し、3つの検証を実行して CI の品質ゲートにする：
 *   1. reachable      … 各レベルの到達可能 primary 漢字数 N（図鑑分母）＋構造健全性
 *   2. verifyMaxParts … 辞書実最大 partCount === MAX_COMBINE_PARTS
 *   3. simulateStuckRate … 各レベルの詰み終了率を実測し KPI帯（10〜20%）を判定
 *
 * ハードゲート（不合格で非0終了）：
 *   - reachable の構造健全性エラー
 *   - verifyMaxParts の不一致
 *   - 詰み率の帯外（**既定は警告**。`KG_ENFORCE_STUCK_RATE=1` でハードゲート化）
 *
 * 詰み率が既定で警告なのは、帯に収めるための weight フロア設計が T-009 のスコープで
 * あり、本ゲートを即ハード化すると T-005 以降の全PRがCIで一律ブロックされるため。
 * weight 調整後（T-009）に `KG_ENFORCE_STUCK_RATE=1` を既定化してハードゲートにする。
 */

import { STUCK_RATE_BAND } from './constants';
import { loadGenerated } from './loadGenerated';
import { runReachable } from './reachable';
import { verifyMaxParts } from './verifyMaxParts';
import { checkStuckRate, simulateStuckRate } from './simulateStuckRate';

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

function main(): void {
  const data = loadGenerated();
  const failures: string[] = [];

  // 1) 到達可能 N（図鑑分母）＋ 構造健全性 ----------------------------------
  const reach = runReachable(data);
  console.log('[verify:data] 到達可能 primary 漢字数 N（図鑑分母）:');
  for (const level of ['elementary', 'juniorhigh', 'joyo'] as const) {
    console.log(
      `  ${level.padEnd(11)}: N=${reach.reachableN[level]}` +
        ` / in-scope ${reach.inScopeTotal[level]}`
    );
  }
  if (reach.structuralErrors.length > 0) {
    failures.push(`構造健全性エラー ${reach.structuralErrors.length} 件`);
    for (const e of reach.structuralErrors.slice(0, 5))
      console.error(`  ✗ ${e}`);
  }

  // 2) MAX_COMBINE_PARTS 一致 -----------------------------------------------
  const mp = verifyMaxParts(data.combine);
  console.log(
    `[verify:data] MAX_COMBINE_PARTS: 辞書実最大=${mp.actualMax}` +
      ` / 定数=${mp.expected} → ${mp.ok ? 'OK' : 'NG'}`
  );
  if (!mp.ok) {
    failures.push(
      `MAX_COMBINE_PARTS 不一致（実最大 ${mp.actualMax} ≠ ${mp.expected}）`
    );
  }

  // 3) 詰み率シミュレーション ------------------------------------------------
  const enforceStuck = process.env.KG_ENFORCE_STUCK_RATE === '1';
  const sim = simulateStuckRate(data);
  const check = checkStuckRate(sim.rates);
  console.log(
    `[verify:data] 詰み終了率（${sim.trials}試行/level・KPI帯 ` +
      `${pct(STUCK_RATE_BAND.min)}〜${pct(STUCK_RATE_BAND.max)}）:`
  );
  for (const level of ['elementary', 'juniorhigh', 'joyo'] as const) {
    const inBand =
      sim.rates[level] >= STUCK_RATE_BAND.min &&
      sim.rates[level] <= STUCK_RATE_BAND.max;
    console.log(
      `  ${level.padEnd(11)}: ${pct(sim.rates[level])} ${inBand ? '✓' : '✗(帯外)'}`
    );
  }
  if (!check.ok) {
    const detail = check.failures
      .map((f) => `${f.level}=${pct(f.rate)}`)
      .join(', ');
    if (enforceStuck) {
      failures.push(`詰み率が帯外: ${detail}`);
    } else {
      console.warn(
        '  ⚠ 詰み率が KPI帯外です（weight のフロア設計は T-009 のスコープ）。' +
          ' 既定では警告として続行します（KG_ENFORCE_STUCK_RATE=1 でハードゲート化）。'
      );
      console.warn(`    帯外: ${detail}`);
    }
  }

  // 総合判定 ----------------------------------------------------------------
  if (failures.length > 0) {
    console.error('\n[verify:data] 検証失敗:');
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log('\n[verify:data] すべての検証をパスしました。');
}

main();

export {};
