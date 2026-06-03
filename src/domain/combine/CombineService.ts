import type {
  CombineEntry,
  CombineKey,
  CombineResolved,
  HandPart,
  KanjiEntry,
  Level,
} from '../types';
import { makeKey } from './makeKey';
import { selectPrimary } from './selectPrimary';

/**
 * 学年レベルの包含順位。elementary ⊆ juniorhigh ⊆ joyo（機能設計4.1）。
 * 数値が小さいほど易しく、セッションレベル以下の漢字が scope に含まれる。
 */
const LEVEL_RANK: Record<Level, number> = {
  elementary: 0,
  juniorhigh: 1,
  joyo: 2,
};

/**
 * 漢字の学年区分が、現在のセッションレベルの scope に含まれるか判定する。
 * 包含関係（易しいレベルは難しいレベルに内包される）を順位比較で表現する。
 */
function isInScope(kanjiLevel: Level, sessionLevel: Level): boolean {
  return LEVEL_RANK[kanjiLevel] <= LEVEL_RANK[sessionLevel];
}

/**
 * 合体判定の中核サービス（機能設計4.1）。選択された部品集合が現在のレベルで有効な
 * 漢字を成立させるか判定し、成立時は scope 内で動的選定した採点対象（awarded）を返す。
 *
 * 辞書・漢字マスタの Map は data 層（T-012 DictionaryRepository）で構築されるため、
 * 本サービスはそれらを注入で受け取り、辞書ロードに依存しない純粋な判定器に保つ。
 */
export class CombineService {
  /**
   * @param dict 正規化キー → 合体辞書エントリ（O(1) 判定用 Map）
   * @param kanji 漢字 char → 漢字マスタ（画数・頻度・レベル参照用 Map）
   */
  constructor(
    private readonly dict: Map<CombineKey, CombineEntry>,
    private readonly kanji: Map<string, KanjiEntry>
  ) {}

  /**
   * 選択した部品集合が有効な漢字を成立させるか判定する。
   * 配置不問・多部品・複数解に対応（機能設計4.1）。事前計算の `entry.primary` は
   * セッションの scope 外になりうるため採点に使わず、scope 内候補に `selectPrimary`
   * を再適用して `awarded` を確定する（機能設計4.4・新問題B）。
   *
   * @param selected 手札から選んだ部品（2個以上）
   * @param level 現在のレベル（有効辞書スコープ）
   * @returns 成立時は採点対象 awarded を含む CombineResolved、不成立は null
   */
  resolve(selected: HandPart[], level: Level): CombineResolved | null {
    if (selected.length < 2) return null; // 2部品未満は不成立

    const entry = this.dict.get(makeKey(selected));
    if (!entry) return null; // 辞書に無い → ミス

    // レベル scope 内に成立する漢字に絞る。辞書不整合（kanji に無い char）は
    // 安全側に倒して除外する。
    const inScope = entry.results
      .map((char) => this.kanji.get(char))
      .filter(
        (k): k is KanjiEntry => k !== undefined && isInScope(k.level, level)
      );
    if (inScope.length === 0) return null; // 範囲外の漢字のみ → ミス扱い

    // scope 内から採点対象を一意確定し、残りを別解として記録対象にする（機能設計4.4）
    const awarded = selectPrimary(inScope);
    const altInScope = inScope.filter((k) => k.char !== awarded.char);
    return { entry, awarded, altInScope };
  }
}
