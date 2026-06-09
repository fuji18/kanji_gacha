/**
 * 結果シェアの文面生成（T-023 / PRD F11）。レベル・スコア・作成漢字から定型テキストを組み立てる純粋関数。
 * 副作用（Web Share / クリップボード）は `share.ts` 側に分離し、ここはテスト可能な文字列生成に徹する。
 * domain 型は import せず、レベルは表示ラベル文字列で受け取る（ui→domain 直接依存の禁止）。
 */

/** シェア文面の入力。`levelLabel` は呼び出し側（Result 画面）が用意する表示名。 */
export interface ShareInput {
  /** レベル表示名（例：やさしい / ふつう / むずかしい）。 */
  levelLabel: string;
  /** 最終スコア。 */
  score: number;
  /** 作成漢字一覧（重複可）。代表字の選定と「ほかN字」集計に使う。 */
  createdKanji: string[];
}

/** 文面の固定要素。書式例：`漢字合体ガチャ｜むずかしい｜スコア142｜作った字：林・明・好・樹 ほか3字 #漢字合体ガチャ` */
const TITLE = '漢字合体ガチャ';
const HASHTAG = '#漢字合体ガチャ';
/** 区切り文字（全角縦棒）。 */
const SEP = '｜';
/** 代表として並べる作成漢字の最大字数。残りは「ほかN字」に集約する。 */
const MAX_SHOWN = 4;

/**
 * 作成漢字（重複可）の「作った字：…」部分を生成する。出現順で重複を除き、先頭 `MAX_SHOWN` 字を
 * `・` 連結、残りがあれば ` ほかN字` を付す。0種なら「作った字：なし」。
 */
function buildCreatedPart(createdKanji: string[]): string {
  const unique = [...new Set(createdKanji)];
  if (unique.length === 0) return '作った字：なし';
  const shown = unique.slice(0, MAX_SHOWN);
  const rest = unique.length - shown.length;
  const base = `作った字：${shown.join('・')}`;
  return rest > 0 ? `${base} ほか${rest}字` : base;
}

/**
 * 結果からシェア用テキストを生成する。
 *
 * @param input レベル表示名・スコア・作成漢字
 * @returns SNS 共有・クリップボード用の1行テキスト
 */
export function buildShareText({
  levelLabel,
  score,
  createdKanji,
}: ShareInput): string {
  const created = buildCreatedPart(createdKanji);
  return `${TITLE}${SEP}${levelLabel}${SEP}スコア${score}${SEP}${created} ${HASHTAG}`;
}
