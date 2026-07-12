/**
 * 結果シェアの共有アクション（T-023 / PRD F11）。Web Share API を基本に、非対応環境では
 * クリップボードコピーへフォールバックする（追加サーバー0台）。文面生成は `shareText.ts` に分離。
 */

/**
 * 共有の結果。
 * - `shared`    : Web Share API で共有シートを開けた
 * - `copied`    : クリップボードにコピーした（フォールバック）
 * - `cancelled` : 共有シートをユーザーがキャンセルした（失敗ではない）
 * - `failed`    : 共有もコピーもできなかった
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** ユーザーが共有シートをキャンセルしたときの DOMException 名。 */
const ABORT_ERROR = 'AbortError';

/**
 * テキストを共有する。`navigator.share` があればそれを使い、無い／失敗した場合は
 * `navigator.clipboard.writeText` でコピーにフォールバックする。
 *
 * @param text 共有テキスト（`buildShareText` の生成結果）
 * @returns 共有結果（UI のメッセージ分岐に使う）
 */
export async function shareOrCopy(text: string): Promise<ShareOutcome> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  // 1) Web Share API 優先。
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ text });
      return 'shared';
    } catch (e) {
      // ユーザーキャンセルは失敗扱いにしない（コピーへ落とさず終了）。
      if (e instanceof DOMException && e.name === ABORT_ERROR)
        return 'cancelled';
      // それ以外の失敗はクリップボードへフォールバックする。
    }
  }

  // 2) クリップボードコピーへフォールバック。
  if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  return 'failed';
}
