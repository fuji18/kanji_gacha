import { describe, it, expect } from 'vitest';
import { buildShareText } from '../../../../src/ui/share/shareText';

// シェア文面の生成（T-023 / F11）。書式例：
//   漢字合体ガチャ｜むずかしい｜スコア142｜作った字：林・明・好・樹 ほか3字 #漢字合体ガチャ

describe('buildShareText', () => {
  it('指定書式で生成する（区切り｜・代表4字・ほかN字・末尾ハッシュタグ）', () => {
    const text = buildShareText({
      levelLabel: 'むずかしい',
      score: 142,
      createdKanji: ['林', '明', '好', '樹', '森', '炎', '鳴'], // 7種
    });
    expect(text).toBe(
      '漢字合体ガチャ｜むずかしい｜スコア142｜作った字：林・明・好・樹 ほか3字 #漢字合体ガチャ'
    );
  });

  it('作成漢字の重複は1字に集約し出現順を保つ', () => {
    const text = buildShareText({
      levelLabel: 'やさしい',
      score: 10,
      createdKanji: ['林', '林', '明', '明', '好'],
    });
    // 3種なので「ほかN字」は付かない
    expect(text).toBe(
      '漢字合体ガチャ｜やさしい｜スコア10｜作った字：林・明・好 #漢字合体ガチャ'
    );
  });

  it('代表字数（4字）ちょうどでは「ほかN字」を付けない', () => {
    const text = buildShareText({
      levelLabel: 'ふつう',
      score: 50,
      createdKanji: ['林', '明', '好', '樹'],
    });
    expect(text).toBe(
      '漢字合体ガチャ｜ふつう｜スコア50｜作った字：林・明・好・樹 #漢字合体ガチャ'
    );
  });

  it('5字（代表4字＋ほか1字）で「ほか1字」を付ける（境界）', () => {
    const text = buildShareText({
      levelLabel: 'ふつう',
      score: 60,
      createdKanji: ['林', '明', '好', '樹', '森'],
    });
    expect(text).toBe(
      '漢字合体ガチャ｜ふつう｜スコア60｜作った字：林・明・好・樹 ほか1字 #漢字合体ガチャ'
    );
  });

  it('作成漢字が0種でも破綻せず「作った字：なし」になる', () => {
    const text = buildShareText({
      levelLabel: 'やさしい',
      score: 0,
      createdKanji: [],
    });
    expect(text).toBe(
      '漢字合体ガチャ｜やさしい｜スコア0｜作った字：なし #漢字合体ガチャ'
    );
  });
});
