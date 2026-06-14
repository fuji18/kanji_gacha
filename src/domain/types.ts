/**
 * ドメイン全体で共有する型定義の単一の真実（機能設計3章）。
 * 各レイヤーはこのファイルを参照する。ランタイムコードを持たないため、
 * import 副作用ゼロで循環依存を生まない（development-guidelines 1.3 / 2.3）。
 */

// ===== 列挙系・基本型 =====

/** 部品レアリティ ★1〜★5（機能設計3.1） */
export type Rarity = 1 | 2 | 3 | 4 | 5;

/** 難易度＝学年区分。包含関係 elementary ⊆ juniorhigh ⊆ joyo（機能設計3.1） */
export type Level = 'elementary' | 'juniorhigh' | 'joyo'; // やさ / ふつう / むず

/**
 * ゲーム種別（T-027・企画整理書 §11）。`mode（free/daily）` と直交する軸。
 *  - gachaCount：ガチャ残り回数制（既存・運寄り）。残0＋詰み/手札0で終了。
 *  - timeAttack：持ち時間制（実力寄り）。ガチャ無制限・成功で時間延長・残時間0で終了。 */
export type GameMode = 'gachaCount' | 'timeAttack';

/**
 * 合体辞書キー。構成部品idを昇順ソートして "+" 連結したマルチセット
 * （配置不問・重複可。例 ["ki","ki"] -> "ki+ki"）（機能設計3.1） */
export type CombineKey = string;

/** 乱数源。[0,1) を返す差し替え可能な抽象（機能設計4.6・5.2 の RNG） */
export type Rng = () => number;

// ===== 静的マスタ（ビルド成果物・機能設計3.1） =====

/** 部品マスタ（parts.json）。KRADFILE のラジカルを基盤 */
export interface Part {
  id: string; // 部品ID（例: "ki", "kuchi"）
  char: string; // 表示文字（例: "木", "口"）
  rarity: Rarity; // ★1〜★5
  scopes: Level[]; // 属するプール（汎用度の指標も兼ねる）
  weight: number; // プール内サンプリング重み（床保証の主役。機能設計4.3）
}

/** 漢字マスタ（kanji.json）。KANJIDIC2 由来 */
export interface KanjiEntry {
  char: string; // 漢字（例: "詩"）
  strokes: number; // 画数（スコア基礎点。PRD F4）
  readings: string[]; // 読み（音・訓）
  meanings: string[]; // 意味（日本語1行表示用）
  level: Level; // 学年区分（単一フィールドでレベル判定）
  freqRank?: number; // 頻度順位（代表解の選定・低いほど一般的）
}

/** 合体辞書エントリ（combine-dict.json）。KRADFILE から展開 */
export interface CombineEntry {
  key: CombineKey; // 正規化済みの部品キー
  results: string[]; // 成立する漢字（複数解。char 参照・1要素以上）
  primary: string; // 代表解（複数解時に優先表示・採点する1字。機能設計4.4）
  partCount: number; // 構成部品数（詰み判定の探索上限算出に使用）
}

// ===== 合体結果（機能設計4.1 / 5.1） =====

/** 合体成立時の解決結果。scope 内で動的選定した採点対象を含む（機能設計4.1） */
export interface CombineResolved {
  entry: CombineEntry;
  awarded: KanjiEntry; // 採点・図鑑付与の対象（scope 内で動的選定した primary）
  altInScope: KanjiEntry[]; // scope 内の別解（awarded 以外）。altDiscovered へ記録
}

/** UI 表示用の合体結果。成功時は CombineResolved を内包する（機能設計5.1・新問題A） */
export interface CombineResult {
  success: boolean;
  resolved: CombineResolved | null; // 成功時のみ
  gainedScore: number; // 今回の加点（成功時のみ非0）
}

// ===== 実行時ステート（メモリ・機能設計3.2） =====

/** 手札内の部品インスタンス（同一部品を複数枚持てるため instance で区別） */
export interface HandPart {
  instanceId: string; // 手札内の一意ID
  partId: string; // Part.id 参照
}

/** スコア状態 */
export interface ScoreState {
  score: number; // 累計スコア
  comboMultiplier: number; // 現在のコンボ倍率（1.0/1.5/2.0/3.0・暫定）
  comboCount: number; // 連続成功数
}

/** KPI 集計用ログ（ローカルのみ・送信なし。機能設計3.2） */
export interface PlayStats {
  combineSuccess: number; // 合体成功回数
  combineMiss: number; // ミス回数
  hintUsed: number; // ヒント利用回数
  discardUsed: number; // 捨てる利用回数
  endReason: 'stuck' | 'empty_hand' | 'timeup' | null; // 詰み / 手札0 / 時間切れ（PRD 詰み終了率・T-027）
  finalScore: number;
  newDiscoveries: number;
  durationMs: number;
}

/** 1プレイのセッション状態 */
export interface GameSession {
  level: Level;
  mode: 'free' | 'daily';
  gameMode: GameMode; // ガチャ回数制 / タイムアタック（T-027）
  seed: number | null; // daily は dailySeed の整数値（機能設計4.6）。free は null
  gachaRemaining: number; // 残りガチャ回数（初期 GACHA_COUNT・暫定。timeAttack では未使用）
  // タイムアタック専用。終了予定の絶対時刻（epoch ms）。gachaCount では null。
  deadlineAtMs: number | null;
  // タイムアタックの速攻ボーナス判定用。直近の合体成功時刻（epoch ms）。未成功は null。
  lastSuccessAtMs: number | null;
  hand: HandPart[]; // 手札（上限 HAND_CAP・暫定）
  score: ScoreState;
  createdKanji: string[]; // このセッションで作った漢字（重複可）
  newlyDiscovered: string[]; // 今回新規に図鑑追加された漢字
  stats: PlayStats; // 計測ログ（KPI集計用）
  phase: 'playing' | 'ended';
}

/**
 * 1プレイの終了結果（機能設計5.1・問題11）。Result 画面（T-019）が表示し、将来の結果シェア
 * （F11・P1）はレベル・スコア・代表作成漢字からテキストを生成できる。`SessionManager.end` が返す。
 */
export interface GameResult {
  level: Level;
  mode: 'free' | 'daily';
  gameMode: GameMode; // ガチャ回数制 / タイムアタック（再挑戦・ベスト表示用・T-027）
  score: number; // 最終スコア
  rank: string; // 称号（resolveRank の結果）
  createdKanji: string[]; // 作成漢字一覧（重複可・シェアの代表選定にも使う）
  newlyDiscovered: string[]; // 今回新規に図鑑追加された漢字
  reason: 'stuck' | 'empty_hand' | 'timeup'; // 終了理由（KPI と一致）
  durationMs: number; // 所要時間
  isNewBest: boolean; // 今回スコアがモード別ベストを更新したか（新記録明示・PRD F9）
}

// ===== 永続データ（localStorage・機能設計3.3） =====

/** 図鑑状態。採点・コンプ対象は primary 漢字 */
export interface ZukanState {
  // char -> 初回発見日時・累計作成回数
  discovered: Record<string, { firstAt: string; count: number }>;
  // 複数解の非primary字（別解）。MVPでは非表示だがスキーマ予約（機能設計4.4）
  altDiscovered: Record<string, { firstAt: string; count: number }>;
}

/** ユーザー設定（UI設計で拡張） */
export interface Settings {
  hintAlwaysOn: boolean; // やさしいでの常時ヒント等
}

/** localStorage に永続化する全体状態 */
export interface PersistedState {
  zukan: ZukanState;
  bestScores: Record<Level, number>; // レベル別ベスト（じっくりモード）
  timeAttackBest: Record<Level, number>; // レベル別ベスト（タイムアタック・別枠・T-027）
  dailyBest: Record<string /* YYYYMMDD */, number>;
  settings: Settings;
  schemaVersion: number; // マイグレーション用（現行=1）
}
