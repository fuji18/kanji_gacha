import type {
  Level,
  PersistedState,
  Settings,
  ZukanState,
} from '../domain/types';

/**
 * 永続データの現行スキーマ版（機能設計3.3・8.3）。`altDiscovered` を含む版を 1 とする。
 * フィールド追加など互換性に影響する変更時にインクリメントし、`migrate` に変換段を足す。
 */
export const CURRENT_SCHEMA_VERSION = 1;

/** localStorage キー（単一キー設計・機能設計8.3）。 */
export const STORAGE_KEY = 'kg.state.v1';

const LEVELS: Level[] = ['elementary', 'juniorhigh', 'joyo'];

/** 図鑑の発見レコード（char -> 初回日時・累計回数）。 */
type DiscoveryMap = Record<string, { firstAt: string; count: number }>;

/** 新規ユーザーの既定状態（fresh）。破損・不能時の初期化にも使う。 */
export function defaultState(): PersistedState {
  return {
    zukan: { discovered: {}, altDiscovered: {} },
    bestScores: { elementary: 0, juniorhigh: 0, joyo: 0 },
    timeAttackBest: { elementary: 0, juniorhigh: 0, joyo: 0 },
    dailyBest: {},
    weakKanji: {},
    settings: {
      hintAlwaysOn: false,
      furigana: false,
      tutorialDone: false,
      largeText: false,
      tts: true, // 読み上げは既定で有効（T-032）
      reducedEffects: false, // 演出は既定でふつう（T-056）
      slowTts: false, // よみあげ速度は既定でふつう（T-056）
    },
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

/**
 * 任意の保存値を**最新スキーマの `PersistedState`** に正規化する純粋関数（機能設計5.2・問題6/新問題C）。
 *
 *  - `schemaVersion` を見て旧版から順次変換（v0：`altDiscovered` を `{}` 補完）。
 *  - 欠損・型不整合のトップレベルは既定値で補完（防御的）。
 *  - オブジェクトでない等、復元不能な破損は `throw`（呼び出し側 `loadState` が既定で初期化する）。
 *
 * localStorage には依存しない（移行ロジックを単体テスト可能に保つ）。
 *
 * @param parsed `JSON.parse` 済みの保存値（信頼しない）
 * @returns 最新スキーマに揃えた `PersistedState`
 * @throws 復元不能な破損（非オブジェクト等）
 */
export function migrate(parsed: unknown): PersistedState {
  if (!isRecord(parsed)) {
    throw new Error('保存データが不正です（オブジェクトではありません）');
  }

  // v0（schemaVersion 未設定）は altDiscovered を持たないが、normalizeZukan が常に {} 補完するため
  // 現状は版による分岐が不要。将来フィールドを破壊的変更する版では parsed.schemaVersion を見て
  // 段階移行をここに追加する（旧 < 現 なら順次変換・機能設計5.2）。
  const base = defaultState();
  return {
    zukan: normalizeZukan(parsed.zukan),
    bestScores: normalizeBestScores(parsed.bestScores, base.bestScores),
    // T-027：旧データ（timeAttackBest 無し）は base の {0,0,0} で補完される（後方互換・版上げ不要）。
    timeAttackBest: normalizeBestScores(
      parsed.timeAttackBest,
      base.timeAttackBest
    ),
    dailyBest: normalizeNumberMap(parsed.dailyBest),
    // T-035：旧データ（weakKanji 無し）は {} 補完される（後方互換・版上げ不要）。数値以外は除外。
    weakKanji: normalizeNumberMap(parsed.weakKanji),
    settings: normalizeSettings(parsed.settings, base.settings),
    // 「常に最新スキーマを返す」契約に従い、未知の将来版も含め常に現行版へ確定する
    // （将来版を保持して書き戻すと、後日その版の移行段が走らず“偽の最新”になるため）。
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

// ----- フィールド正規化（欠損・型不整合は既定へ） -----

function normalizeZukan(raw: unknown): ZukanState {
  if (!isRecord(raw)) return { discovered: {}, altDiscovered: {} };
  return {
    discovered: normalizeDiscovery(raw.discovered),
    // 新問題C：旧スキーマ（v0）は altDiscovered を持たないため {} で補完する。
    altDiscovered: normalizeDiscovery(raw.altDiscovered),
  };
}

function normalizeDiscovery(raw: unknown): DiscoveryMap {
  if (!isRecord(raw)) return {};
  const out: DiscoveryMap = {};
  for (const [char, v] of Object.entries(raw)) {
    if (
      isRecord(v) &&
      typeof v.firstAt === 'string' &&
      typeof v.count === 'number'
    ) {
      out[char] = { firstAt: v.firstAt, count: v.count };
    }
  }
  return out;
}

function normalizeBestScores(
  raw: unknown,
  fallback: Record<Level, number>
): Record<Level, number> {
  if (!isRecord(raw)) return { ...fallback };
  const out: Record<Level, number> = { ...fallback };
  for (const level of LEVELS) {
    if (typeof raw[level] === 'number') out[level] = raw[level];
  }
  return out;
}

function normalizeNumberMap(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, v] of Object.entries(raw)) {
    if (typeof v === 'number') out[key] = v;
  }
  return out;
}

function normalizeSettings(raw: unknown, fallback: Settings): Settings {
  if (!isRecord(raw)) return { ...fallback };
  return {
    hintAlwaysOn:
      typeof raw.hintAlwaysOn === 'boolean'
        ? raw.hintAlwaysOn
        : fallback.hintAlwaysOn,
    furigana:
      typeof raw.furigana === 'boolean' ? raw.furigana : fallback.furigana,
    tutorialDone:
      typeof raw.tutorialDone === 'boolean'
        ? raw.tutorialDone
        : fallback.tutorialDone,
    largeText:
      typeof raw.largeText === 'boolean' ? raw.largeText : fallback.largeText,
    tts: typeof raw.tts === 'boolean' ? raw.tts : fallback.tts,
    // T-056：旧データ（フィールド無し）は既定 false で補完（後方互換・版上げ不要）。
    reducedEffects:
      typeof raw.reducedEffects === 'boolean'
        ? raw.reducedEffects
        : fallback.reducedEffects,
    slowTts: typeof raw.slowTts === 'boolean' ? raw.slowTts : fallback.slowTts,
  };
}

/** プレーンなレコード（非 null オブジェクト・非配列）か判定する型ガード。 */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
