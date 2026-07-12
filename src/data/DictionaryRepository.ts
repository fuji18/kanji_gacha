import type {
  CombineEntry,
  CombineKey,
  KanjiEntry,
  Level,
  Part,
} from '../domain/types';

/**
 * 辞書ロード失敗を表すカスタムエラー（機能設計11 / development-guidelines 2.4）。
 * fetch 拒否・非200応答・JSON 破損などインフラ的失敗のみをこの型に集約する。
 * 起動シーケンス（T-015）はこれを捕捉してリトライ導線付きエラーUIを表示する。
 */
export class DictionaryLoadError extends Error {
  override readonly name = 'DictionaryLoadError';
}

/** fetch 応答の最小インターフェース。テストでの差し替えを容易にするため `Response` を直接使わない。 */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** 注入可能な fetch 抽象。既定は実 `fetch`（`data/` 層はブラウザ fetch を使える・repository-structure 2.3）。 */
export type FetchLike = (url: string) => Promise<FetchResponseLike>;

/** `reachable.json` の形（図鑑収集率の分母メタ・機能設計8.1）。 */
interface ReachableMeta {
  reachableN: Record<Level, number>;
  inScopeTotal: Record<Level, number>;
}

/** ロード対象のベース名。`${baseUrl}data/<name>.json` を取得する。 */
const FILES = {
  parts: 'parts.json',
  kanji: 'kanji.json',
  combine: 'combine-dict.json',
  reachable: 'reachable.json',
} as const;

/** Vite が注入する公開ベースパス。デプロイ先のサブパス（T-026）に追従。テスト/Node では '/'。 */
function defaultBaseUrl(): string {
  return import.meta.env.BASE_URL;
}

/** 既定の fetch ラッパ。`this` 束縛を保つため関数で包む（native fetch をメソッド呼びすると壊れる環境がある）。 */
const defaultFetch: FetchLike = (url) => fetch(url);

/**
 * 静的JSON辞書のリポジトリ（機能設計5.2・9 / architecture 4.1）。起動時に配列JSONを取得して
 * `Map` に展開し、合体判定を `Map.get` の O(1)（PRD：判定1ms以下）にする。レベル別 pool も
 * 1度だけ構築して `getPool` を O(1) にする。
 *
 * 純粋ロジック（domain）には依存せず、`domain/types` の型のみ参照する。`fetch` と公開ベースパスは
 * コンストラクタ注入で差し替え可能（テスト容易性・ドメイン層の RNG 注入と同じ思想）。
 */
export class DictionaryRepository {
  private combineMap: Map<CombineKey, CombineEntry> | null = null;
  private kanjiMap: Map<string, KanjiEntry> | null = null;
  private poolByLevel: Record<Level, Part[]> | null = null;
  private reachable: ReachableMeta | null = null;
  private partById: Map<string, Part> | null = null;
  // 漢字 → 代表分解エントリ（山札構築・達成型の makeable 判定に使う）。load 後に遅延構築。
  private deckEntryByKanji: Map<string, CombineEntry> | null = null;

  /** 取得元のベースURL。末尾 '/' を保証して `${baseUrl}data/...` が常に正しく連結されるようにする。 */
  private readonly baseUrl: string;

  /**
   * @param fetchFn fetch 抽象（既定は実 fetch）。テストではフェイクを注入する。
   * @param baseUrl 取得元のベースURL（既定は `import.meta.env.BASE_URL`）。末尾 '/' は内部で正規化する。
   */
  constructor(
    private readonly fetchFn: FetchLike = defaultFetch,
    baseUrl: string = defaultBaseUrl()
  ) {
    // BASE_URL は通常末尾 '/'。サブパス文字列（'/foo'）が渡されても誤連結しないよう正規化する。
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  /**
   * 4つの静的JSON（parts / kanji / combine-dict / reachable）を並列取得し、Map・pool・到達可能N に
   * 展開する。fetch 拒否・非200・JSON 破損はすべて `DictionaryLoadError` に正規化（cause 保持）して投げる。
   *
   * 複数回呼ぶと内部状態を上書きする（アトミック性なし）。起動時に一度だけ await する制御は T-015 が担う。
   */
  async load(): Promise<void> {
    try {
      const [parts, kanji, combine, reachable] = await Promise.all([
        this.fetchJson<Part[]>(FILES.parts),
        this.fetchJson<KanjiEntry[]>(FILES.kanji),
        this.fetchJson<CombineEntry[]>(FILES.combine),
        this.fetchJson<ReachableMeta>(FILES.reachable),
      ]);

      this.kanjiMap = new Map(kanji.map((k) => [k.char, k]));
      this.combineMap = new Map(combine.map((c) => [c.key, c]));
      this.partById = new Map(parts.map((p) => [p.id, p]));
      this.poolByLevel = {
        elementary: parts.filter((p) => p.scopes.includes('elementary')),
        juniorhigh: parts.filter((p) => p.scopes.includes('juniorhigh')),
        joyo: parts.filter((p) => p.scopes.includes('joyo')),
      };
      this.reachable = reachable;
      // 山札の代表分解インデックスはロード直後に1度だけ構築する（getDeck 等を O(1) 化）。
      this.deckEntryByKanji = this.buildDeckEntryIndex(
        this.kanjiMap,
        this.combineMap
      );
    } catch (cause) {
      // 既に DictionaryLoadError ならそのまま、想定外（パース失敗等）も同型に正規化する。
      if (cause instanceof DictionaryLoadError) throw cause;
      throw new DictionaryLoadError('辞書のロードに失敗しました', { cause });
    }
  }

  /**
   * 1ファイルを取得して JSON を返す。非200は `DictionaryLoadError`。
   * `json()` の失敗（破損JSON）は呼び出し元 `load()` の catch で正規化される。
   */
  private async fetchJson<T>(name: string): Promise<T> {
    const url = `${this.baseUrl}data/${name}`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new DictionaryLoadError(
        `辞書ファイルの取得に失敗しました (${name}: HTTP ${res.status})`
      );
    }
    return (await res.json()) as T;
  }

  /**
   * 漢字マスタを引く（画数・読み・意味・レベル参照）。`awarded` など**存在が前提の字**に使う。
   * 不在はデータ不整合として例外（戻り型が非 optional・機能設計5.2）。
   */
  getKanji(char: string): KanjiEntry {
    const entry = this.requireKanji().get(char);
    if (entry === undefined) {
      // ロードは成功しているがデータに無い＝データ不整合（起動失敗ではない）。
      // T-015 の起動エラーUI（DictionaryLoadError 捕捉）には流さず通常 Error にする。
      throw new Error(`漢字マスタに存在しません: ${char}`);
    }
    return entry;
  }

  /**
   * 合体辞書を引く。**ミス（不成立）は正常系**のため `undefined` を返す（例外にしない・guidelines 2.4）。
   * `Map.get` の O(1)（機能設計9）。
   */
  getCombine(key: CombineKey): CombineEntry | undefined {
    return this.requireCombine().get(key);
  }

  /** 指定レベルの scope に属する部品プールを返す（タイムアタックの重み付き抽選の母集合・O(1)）。 */
  getPool(level: Level): Part[] {
    return this.requirePool()[level];
  }

  /**
   * 達成型（山札）の対象漢字一覧（T-028）。`kanji.grade ∈ grades` かつ分解エントリを持つ
   * （＝部品から作れる）漢字を返す。出題対象の母集合（アプリ層が N 字サンプリングして使う）。
   *   - 小学生モード：grades = [選択学年] または [1..6]（全学年）
   *   - 大人モード：grades = [8]（小学生以外の常用）
   */
  deckTargetKanji(grades: readonly number[]): string[] {
    const index = this.requireDeckIndex();
    const set = new Set(grades);
    const out: string[] = [];
    for (const k of this.requireKanji().values()) {
      if (set.has(k.grade) && index.has(k.char)) out.push(k.char);
    }
    return out;
  }

  /**
   * 指定漢字の代表分解の構成部品（Part[]・重複あり）を返す（T-029）。アプリ層が選んだ N 字に対して
   * 呼び、山札を組み立てる。分解エントリの無い字は空配列。
   */
  partsForKanji(char: string): Part[] {
    const entry = this.requireDeckIndex().get(char);
    if (entry === undefined) return [];
    const parts = this.requirePartById();
    const out: Part[] = [];
    for (const id of entry.key.split('+')) {
      const part = parts.get(id);
      if (part !== undefined) out.push(part);
    }
    return out;
  }

  /**
   * 漢字 → 代表分解エントリのインデックスを構築する。`primary === 漢字` のエントリを優先し、
   * 無ければ `results` に含むエントリを採用する。同条件では partCount が小さい（単純な）分解を選ぶ。
   */
  private buildDeckEntryIndex(
    kanji: Map<string, KanjiEntry>,
    combine: Map<CombineKey, CombineEntry>
  ): Map<string, CombineEntry> {
    const known = kanji; // 対象は漢字マスタに存在する字のみ
    const primary = new Map<string, CombineEntry>();
    const fallback = new Map<string, CombineEntry>();
    const better = (a: CombineEntry, b: CombineEntry | undefined): boolean =>
      b === undefined || a.partCount < b.partCount;

    for (const entry of combine.values()) {
      if (
        known.has(entry.primary) &&
        better(entry, primary.get(entry.primary))
      ) {
        primary.set(entry.primary, entry);
      }
      for (const char of entry.results) {
        if (known.has(char) && better(entry, fallback.get(char))) {
          fallback.set(char, entry);
        }
      }
    }

    // primary 優先でマージ（primary に無い字だけ fallback で補完）。
    const index = new Map<string, CombineEntry>(fallback);
    for (const [char, entry] of primary) index.set(char, entry);
    return index;
  }

  /** 図鑑収集率の分母＝到達可能な primary 漢字総数 N（機能設計8.1）。 */
  getReachableN(level: Level): number {
    return this.requireReachable().reachableN[level];
  }

  /** 合体辞書 Map の読み取り公開（T-014 が `CombineService` を組み立てるために使う）。 */
  get combineEntries(): ReadonlyMap<CombineKey, CombineEntry> {
    return this.requireCombine();
  }

  /** 漢字マスタ Map の読み取り公開（T-014 が `CombineService` を組み立てるために使う）。 */
  get kanjiEntries(): ReadonlyMap<string, KanjiEntry> {
    return this.requireKanji();
  }

  // ----- 未ロードガード（load() 未呼び出しは利用側のプログラミングエラー） -----

  private requireKanji(): Map<string, KanjiEntry> {
    if (this.kanjiMap === null) throw notLoaded();
    return this.kanjiMap;
  }

  private requireCombine(): Map<CombineKey, CombineEntry> {
    if (this.combineMap === null) throw notLoaded();
    return this.combineMap;
  }

  private requirePool(): Record<Level, Part[]> {
    if (this.poolByLevel === null) throw notLoaded();
    return this.poolByLevel;
  }

  private requireReachable(): ReachableMeta {
    if (this.reachable === null) throw notLoaded();
    return this.reachable;
  }

  private requirePartById(): Map<string, Part> {
    if (this.partById === null) throw notLoaded();
    return this.partById;
  }

  private requireDeckIndex(): Map<string, CombineEntry> {
    if (this.deckEntryByKanji === null) throw notLoaded();
    return this.deckEntryByKanji;
  }
}

/** 未ロードアクセスのエラー。ロード失敗（DictionaryLoadError）とは区別する。 */
function notLoaded(): Error {
  return new Error(
    'DictionaryRepository.load() を await してから利用してください'
  );
}
