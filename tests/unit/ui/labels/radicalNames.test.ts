import { describe, it, expect } from 'vitest';
import {
  getRadicalName,
  pickRadical,
} from '../../../../src/ui/labels/radicalNames';

// 部首名の表示マップ（学習帳カード・T-036）の単体テスト。
describe('radicalNames', () => {
  describe('getRadicalName', () => {
    it('既知の部首 char は和名を返す', () => {
      expect(getRadicalName('木')).toBe('きへん');
      expect(getRadicalName('氵')).toBe('さんずい');
    });
    it('未収録 char は null', () => {
      expect(getRadicalName('林')).toBeNull();
      expect(getRadicalName('')).toBeNull();
    });
  });

  describe('pickRadical', () => {
    it('空配列は null', () => {
      expect(pickRadical([])).toBeNull();
    });
    it('未収録部品が先頭でも、後続の既知部首を探して採用する', () => {
      // 'zz' は RADICAL_NAMES 未収録。先頭が未知でも既知部首 女(おんなへん) を採用する。
      expect(pickRadical(['zz', '女'])).toEqual({
        char: '女',
        name: 'おんなへん',
      });
    });
    it('既知部首が無ければ先頭部品を char のまま採用（name は null）', () => {
      expect(pickRadical(['ki', 'foo'])).toEqual({ char: 'ki', name: null });
    });
    it('先頭が既知部首ならそれを採用する', () => {
      expect(pickRadical(['木', '口'])).toEqual({
        char: '木',
        name: 'きへん',
      });
    });
  });
});
