/**
 * ビルド時データ生成スクリプト（placeholder）。
 *
 * このスクリプトは KANJIDIC2 / KRADFILE を元に `public/data/*.json`（辞書）を
 * 生成する責務を持つ（development-guidelines 6.2 の `gen:data` ステップ）。
 *
 * 本体ロジックは T-003（データ生成）で実装する。T-002 では CI パイプラインの
 * 配線のみを行うため、ここでは正常終了する最小スタブとする。
 */
function generate(): void {
  // T-003 で KANJIDIC2/KRADFILE のパースと public/data/*.json 出力を実装する。
  console.log('[gen:data] placeholder — 辞書生成は T-003 で実装します。');
}

generate();

export {};
