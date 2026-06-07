import type {
  CombineEntry,
  CombineKey,
  CombineResolved,
  HandPart,
  KanjiEntry,
  Level,
} from '../types';
import { MAX_COMBINE_PARTS } from '../constants';
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
 * 配列から `size` 個を選ぶ組み合わせ（部分集合）を辞書順に列挙するジェネレータ。
 * 詰み判定・ヒント探索（機能設計4.5）で手札の部分集合を総当たりするために使う。
 * index ベースで生成するため、同一部品が複数枚（同じ partId）あっても別インスタンスと
 * して正しく扱える（マルチセット手札に対応）。
 *
 * @param items 元の配列（手札）
 * @param size 選ぶ個数（1〜items.length で有効。範囲外は何も yield しない）
 */
function* combinations<T>(items: readonly T[], size: number): Generator<T[]> {
  const n = items.length;
  if (size <= 0 || size > n) return;
  // 選択中インデックス（昇順を維持）。初期は [0,1,...,size-1]
  const idx = Array.from({ length: size }, (_, i) => i);
  for (;;) {
    yield idx.map((i) => items[i]);
    // 末尾から、まだ右に進められる桁を探す
    let k = size - 1;
    while (k >= 0 && idx[k] === n - size + k) k--;
    if (k < 0) return; // 全組み合わせを列挙し終えた
    idx[k]++;
    for (let j = k + 1; j < size; j++) idx[j] = idx[j - 1] + 1;
  }
}

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
    private readonly dict: ReadonlyMap<CombineKey, CombineEntry>,
    private readonly kanji: ReadonlyMap<string, KanjiEntry>
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

  /**
   * 手札に合体可能な組み合わせが1つでも存在するか判定する（機能設計4.5）。
   * F6 終了判定（詰み）と F5 ヒントの両方が依存する基盤。最初の成立で打ち切るため、
   * 詰みでない手札ほど速く返る。
   *
   * @param hand 現在の手札
   * @param level 現在のレベル
   * @returns 成立する組が1つでもあれば true、無ければ false（＝詰み）
   */
  canCombineAny(hand: HandPart[], level: Level): boolean {
    return this.firstCombinable(hand, level) !== null;
  }

  /**
   * 合体可能な組み合わせを1組返す（機能設計4.5・F5 ヒント）。最小サイズ（部品数が
   * 少ない組）を優先して返すため、プレイヤーに分かりやすいヒントになる。
   *
   * @param hand 現在の手札
   * @param level 現在のレベル
   * @returns 成立する部品の組（`resolve` で成立を保証）。無ければ null
   */
  findHint(hand: HandPart[], level: Level): HandPart[] | null {
    return this.firstCombinable(hand, level);
  }

  /**
   * 手札の部分集合を**サイズ昇順**（2〜`MAX_COMBINE_PARTS`）に総当たりし、最初に成立した
   * 組を返す。`canCombineAny` と `findHint` の共通エンジン（早期return を1箇所に集約）。
   * 探索量は手札12・上限5で ΣC(12,k)（k=2..5）≈ 1,573 通り。各判定は `makeKey`→
   * `Map.get` の O(1) で、最初の成立で打ち切るため十分高速（目標5ms以下・機能設計4.5）。
   */
  private firstCombinable(hand: HandPart[], level: Level): HandPart[] | null {
    const maxSize = Math.min(MAX_COMBINE_PARTS, hand.length);
    for (let size = 2; size <= maxSize; size++) {
      for (const subset of combinations(hand, size)) {
        if (this.resolve(subset, level)) return subset;
      }
    }
    return null;
  }
}
