import { describe, it, expect } from 'vitest';
import {
  DictionaryRepository,
  DictionaryLoadError,
  type FetchLike,
  type FetchResponseLike,
} from '../../../src/data/DictionaryRepository';
import type {
  CombineEntry,
  KanjiEntry,
  Level,
  Part,
} from '../../../src/domain/types';

// DictionaryRepository の受け入れ条件（T-012 / 機能設計5.2・9・11）を固定する。
//  - load() 後に Map.get の O(1) で引ける（getCombine/getKanji/getPool/getReachableN/map公開）
//  - getPool が level scope で絞られる、getCombine ミスは undefined、getKanji 不在は例外
//  - 未ロードアクセスは例外
//  - ロード失敗（非200 / fetch 拒否 / JSON 破損）は DictionaryLoadError

// ----- フィクスチャ（実物 public/data と同じ形） -----
const PARTS: Part[] = [
  {
    id: 'ki',
    char: '木',
    rarity: 1,
    scopes: ['elementary', 'juniorhigh', 'joyo'],
    weight: 9,
  },
  {
    id: 'kuchi',
    char: '口',
    rarity: 1,
    scopes: ['elementary', 'juniorhigh', 'joyo'],
    weight: 8,
  },
  { id: 'rare', char: '龠', rarity: 5, scopes: ['joyo'], weight: 1 }, // joyo のみ
];

const KANJI: KanjiEntry[] = [
  {
    char: '林',
    strokes: 8,
    readings: ['はやし'],
    meanings: ['woods'],
    level: 'elementary',
    freqRank: 1500,
  },
  {
    char: '品',
    strokes: 9,
    readings: ['ひん'],
    meanings: ['goods'],
    level: 'elementary',
  },
];

const COMBINE: CombineEntry[] = [
  { key: 'ki+ki', results: ['林'], primary: '林', partCount: 2 },
  { key: 'kuchi+kuchi+kuchi', results: ['品'], primary: '品', partCount: 3 },
];

const REACHABLE = {
  reachableN: { elementary: 888, juniorhigh: 1903, joyo: 1997 },
  inScopeTotal: { elementary: 1006, juniorhigh: 2039, joyo: 2136 },
};

const PAYLOAD: Record<string, unknown> = {
  'parts.json': PARTS,
  'kanji.json': KANJI,
  'combine-dict.json': COMBINE,
  'reachable.json': REACHABLE,
};

function ok(body: unknown): FetchResponseLike {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

/** 正常系のフェイク fetch。URL 末尾のファイル名で payload を返す。baseUrl は '/' を注入。 */
function fakeFetch(): FetchLike {
  return (url) => {
    const name = url.split('/').pop() ?? '';
    const body = PAYLOAD[name];
    if (body === undefined) {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve(null),
      });
    }
    return Promise.resolve(ok(body));
  };
}

async function loadedRepo(
  fetchFn: FetchLike = fakeFetch()
): Promise<DictionaryRepository> {
  const repo = new DictionaryRepository(fetchFn, '/');
  await repo.load();
  return repo;
}

describe('DictionaryRepository.load 正常系・O(1)展開', () => {
  it('load 後に合体辞書を Map.get O(1) で引ける（getCombine）', async () => {
    const repo = await loadedRepo();
    expect(repo.getCombine('ki+ki')).toEqual(COMBINE[0]);
    expect(repo.getCombine('kuchi+kuchi+kuchi')?.primary).toBe('品');
  });

  it('getCombine のミス（無効合体）は undefined（正常系・例外にしない）', async () => {
    const repo = await loadedRepo();
    expect(repo.getCombine('nope+nope')).toBeUndefined();
  });

  it('getKanji は char で漢字マスタを引ける', async () => {
    const repo = await loadedRepo();
    expect(repo.getKanji('林').strokes).toBe(8);
  });

  it('getKanji は不在でエラー（データ不整合・既知字の参照前提）。ロード失敗とは別型', async () => {
    const repo = await loadedRepo();
    expect(() => repo.getKanji('存')).toThrow(/存在しません/);
    // 起動失敗（DictionaryLoadError）には流さない＝T-015 のエラーUIへ誤誘導しない
    expect(() => repo.getKanji('存')).not.toThrow(DictionaryLoadError);
  });

  it('getPool は level scope に属する部品だけを返す', async () => {
    const repo = await loadedRepo();
    const elem = repo.getPool('elementary').map((p) => p.id);
    expect(elem).toEqual(['ki', 'kuchi']); // rare(joyo) は含まれない
    const joyo = repo.getPool('joyo').map((p) => p.id);
    expect(joyo).toContain('rare');
    expect(joyo).toHaveLength(3);
  });

  it('getReachableN は図鑑収集率の分母をレベル別に返す', async () => {
    const repo = await loadedRepo();
    const levels: Level[] = ['elementary', 'juniorhigh', 'joyo'];
    for (const l of levels) {
      expect(repo.getReachableN(l)).toBe(REACHABLE.reachableN[l]);
    }
  });

  it('末尾スラッシュ無しの baseUrl でも誤連結せず取得できる（正規化）', async () => {
    const seen: string[] = [];
    const fetchFn: FetchLike = (url) => {
      seen.push(url);
      return fakeFetch()(url);
    };
    const repo = new DictionaryRepository(fetchFn, '/sub'); // 末尾 '/' なし
    await repo.load();
    expect(seen).toContain('/sub/data/parts.json'); // '/subdata/...' にならない
    expect(repo.getCombine('ki+ki')).toEqual(COMBINE[0]);
  });

  it('combineEntries / kanjiEntries を読み取り公開する（T-014 の CombineService 構築用）', async () => {
    const repo = await loadedRepo();
    expect(repo.combineEntries.get('ki+ki')).toEqual(COMBINE[0]);
    expect(repo.kanjiEntries.get('品')?.strokes).toBe(9);
    expect(repo.combineEntries.size).toBe(2);
    expect(repo.kanjiEntries.size).toBe(2);
  });
});

describe('DictionaryRepository 未ロードガード', () => {
  it('load() 前のアクセスは例外（プログラミングエラー）', () => {
    const repo = new DictionaryRepository(fakeFetch(), '/');
    expect(() => repo.getCombine('ki+ki')).toThrow();
    expect(() => repo.getKanji('林')).toThrow();
    expect(() => repo.getPool('joyo')).toThrow();
    expect(() => repo.getReachableN('joyo')).toThrow();
    expect(() => repo.combineEntries).toThrow();
    expect(() => repo.kanjiEntries).toThrow();
  });
});

describe('DictionaryRepository.load 失敗系 → DictionaryLoadError', () => {
  it('非200応答なら DictionaryLoadError（status を含む）', async () => {
    const fetchFn: FetchLike = () =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve(null),
      });
    const repo = new DictionaryRepository(fetchFn, '/');
    await expect(repo.load()).rejects.toBeInstanceOf(DictionaryLoadError);
    await expect(repo.load()).rejects.toThrow(/500/);
  });

  it('fetch 自体が拒否されても DictionaryLoadError に正規化（cause 保持）', async () => {
    const network = new Error('network down');
    const fetchFn: FetchLike = () => Promise.reject(network);
    const repo = new DictionaryRepository(fetchFn, '/');
    await expect(repo.load()).rejects.toBeInstanceOf(DictionaryLoadError);
    await repo.load().catch((e: unknown) => {
      expect((e as { cause?: unknown }).cause).toBe(network);
    });
  });

  it('既定の fetch / baseUrl（注入なし）でもロード失敗は DictionaryLoadError に正規化', async () => {
    // 引数なしで既定の fetch（実 fetch ラッパ）と import.meta.env.BASE_URL を使う経路を実行する。
    // テスト環境にはサーバーが無いため取得は失敗し、DictionaryLoadError へ正規化されること。
    const repo = new DictionaryRepository();
    await expect(repo.load()).rejects.toBeInstanceOf(DictionaryLoadError);
  });

  it('JSON が破損していても DictionaryLoadError に正規化', async () => {
    const fetchFn: FetchLike = (url) => {
      const name = url.split('/').pop() ?? '';
      if (name === 'combine-dict.json') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError('Unexpected token')),
        });
      }
      return fakeFetch()(url);
    };
    const repo = new DictionaryRepository(fetchFn, '/');
    await expect(repo.load()).rejects.toBeInstanceOf(DictionaryLoadError);
  });
});
