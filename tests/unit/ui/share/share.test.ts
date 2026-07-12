import { describe, it, expect, vi, afterEach } from 'vitest';
import { shareOrCopy } from '../../../../src/ui/share/share';

// 共有アクション（T-023 / F11）。Web Share API 優先・非対応はクリップボードへフォールバック。
// navigator をスタブして分岐（対応/キャンセル/例外/コピー/失敗）を検証する。

afterEach(() => {
  vi.unstubAllGlobals();
});

/** navigator を最小スタブに差し替える。 */
function stubNavigator(nav: Partial<Navigator>): void {
  vi.stubGlobal('navigator', nav as Navigator);
}

describe('shareOrCopy', () => {
  it('Web Share API があれば share を呼び shared を返す', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share });

    const outcome = await shareOrCopy('テキスト');

    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'テキスト' });
  });

  it('共有シートのキャンセル（AbortError）は cancelled（コピーへ落とさない）', async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('canceled', 'AbortError'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share, clipboard: { writeText } as unknown as Clipboard });

    const outcome = await shareOrCopy('テキスト');

    expect(outcome).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('share がキャンセル以外で失敗したらクリップボードへフォールバックする', async () => {
    const share = vi.fn().mockRejectedValue(new Error('share failed'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share, clipboard: { writeText } as unknown as Clipboard });

    const outcome = await shareOrCopy('テキスト');

    expect(outcome).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('テキスト');
  });

  it('Web Share 非対応ならクリップボードコピーで copied を返す', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard });

    const outcome = await shareOrCopy('テキスト');

    expect(outcome).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('テキスト');
  });

  it('クリップボード書き込みが失敗したら failed を返す', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard });

    expect(await shareOrCopy('テキスト')).toBe('failed');
  });

  it('share もクリップボードも無ければ failed を返す', async () => {
    stubNavigator({});
    expect(await shareOrCopy('テキスト')).toBe('failed');
  });
});
