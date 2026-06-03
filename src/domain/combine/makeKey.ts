import type { CombineKey, HandPart } from '../types';

/**
 * 手札から選んだ部品集合を、合体辞書の正規化キーに変換する（機能設計4.1）。
 * 部品idのマルチセットを昇順ソートして "+" 連結することで、配置（⿰⿱…）や
 * 選択順の違いを吸収し、同じ部品構成は常に同じキーになる（配置不問・重複可）。
 *
 * @param parts 手札から選んだ部品（呼び出し側で2個以上を保証する想定。
 *   CombineService.resolve が `selected.length < 2` で先に弾く）
 * @returns 昇順ソート済みの部品idを "+" で連結したキー（例 "ki+ki"）。
 *   0件なら "" を返すが、これは辞書にヒットせずミス扱いになる
 */
export function makeKey(parts: HandPart[]): CombineKey {
  return parts
    .map((p) => p.partId)
    .sort()
    .join('+');
}
