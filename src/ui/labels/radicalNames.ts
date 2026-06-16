/**
 * 部首（部品）char → 和名の表示マップ（学習帳カードの「部首名」表示用・T-036）。
 *
 * 注意：本マップは UI 表示のための近似である。元データ（KANJIDIC2 蒸留版）には KANJIDIC の
 * radical 番号が無いため、漢字の厳密な部首を一意に同定できない。図鑑カードでは「代表分解の
 * 構成部品のうち、よく知られた部首にあたるもの」を `pickRadical` で選び、その和名を併記する。
 *
 * 配置：`ui/labels/rarityLabels.ts` / `ui/strokes/kanjiStrokes.ts` と同じく UI 専用の表示資産。
 * ロジック（domain/data）からは参照しない。
 */

/** よく出る部首 char → 和名（読み）。未収録は `getRadicalName` が null を返す。 */
export const RADICAL_NAMES: Record<string, string> = {
  木: 'きへん',
  氵: 'さんずい',
  亻: 'にんべん',
  人: 'ひと',
  口: 'くち',
  日: 'ひへん',
  月: 'つきへん',
  目: 'めへん',
  女: 'おんなへん',
  子: 'こへん',
  火: 'ひ',
  灬: 'れっか',
  水: 'みず',
  手: 'て',
  扌: 'てへん',
  土: 'つち',
  山: 'やまへん',
  川: 'かわ',
  心: 'こころ',
  忄: 'りっしんべん',
  糸: 'いとへん',
  言: 'ごんべん',
  金: 'かねへん',
  雨: 'あめかんむり',
  竹: 'たけかんむり',
  艹: 'くさかんむり',
  宀: 'うかんむり',
  亠: 'なべぶた',
  广: 'まだれ',
  廴: 'えんにょう',
  辶: 'しんにょう',
  阝: 'こざとへん',
  彳: 'ぎょうにんべん',
  禾: 'のぎへん',
  石: 'いしへん',
  田: 'た',
  力: 'ちから',
  刀: 'かたな',
  刂: 'りっとう',
  大: 'だい',
  小: 'しょう',
  示: 'しめす',
  礻: 'しめすへん',
  衣: 'ころも',
  貝: 'かいへん',
  足: 'あしへん',
  馬: 'うまへん',
  魚: 'うおへん',
  鳥: 'とり',
};

/** 部首 char の和名を返す。未収録は null（呼び出し側で char をそのまま表示）。 */
export function getRadicalName(char: string): string | null {
  return RADICAL_NAMES[char] ?? null;
}

/**
 * 分解部品 char の配列から、図鑑カードに出す代表部首を選ぶ（T-036）。
 * 既知部首（`RADICAL_NAMES` 収録）を含む最初の部品を優先し、無ければ先頭部品を char のまま採用する。
 * 空配列は null（部首表示なし）。
 */
export function pickRadical(
  parts: readonly string[]
): { char: string; name: string | null } | null {
  if (parts.length === 0) return null;
  const known = parts.find((p) => p in RADICAL_NAMES);
  if (known !== undefined) return { char: known, name: RADICAL_NAMES[known] };
  return { char: parts[0], name: null };
}
