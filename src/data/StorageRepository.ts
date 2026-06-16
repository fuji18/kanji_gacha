import type {
  Level,
  PersistedState,
  Settings,
  ZukanState,
} from '../domain/types';
import { defaultState, migrate, STORAGE_KEY } from './migrations';

/**
 * localStorage が利用不可（プライバシーモードでアクセス例外・書込み不可・容量超過）を表す
 * カスタムエラー（機能設計11 / development-guidelines 2.4）。
 *
 * このエラーで全体を止めない：`StorageRepository` は内部で捕捉し `isPersistent=false` に倒して
 * メモリ動作にフォールバックする。UI（T-015）は `isPersistent` を見て警告を表示する。
 */
export class StorageUnavailableError extends Error {
  override readonly name = 'StorageUnavailableError';
}

/** localStorage の最小インターフェース。テストでフェイクを注入できるよう `Storage` 全体に依存しない。 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 書込み可否プローブ用キー。set→remove が通れば永続化可能とみなす。 */
const PROBE_KEY = 'kg.__probe__';

/** `globalThis.localStorage` を安全に取得する。アクセス自体が例外になる環境では null を返す。 */
function resolveLocalStorage(): StorageLike | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null; // プライバシーモード等でプロパティアクセスが throw する場合
  }
}

/**
 * 永続化リポジトリ（機能設計3.3・5.2・8.3 / PRD F7・F9）。単一キー `kg.state.v1` に
 * `PersistedState` を JSON 保存し、読込時は `migrate` で常に最新スキーマへ正規化して返す。
 *
 * localStorage 不可・容量超過は `StorageUnavailableError` を内部保持してメモリ動作に
 * フォールバックする（保存系 no-op・読みは既定/メモリ値・クラッシュしない・機能設計11）。
 *
 * 書込みは単一キー `kg.state.v1` への state 全体 JSON 出力（1 回の `setItem`）であり、
 * 各 save が即時 persist でも I/O は最小（機能設計9 の「書き込み集約」を単一キーで満たす）。
 *
 * 保存系は機能設計5.2 の 3 メソッド（`saveZukan`/`saveBest`/`saveDailyBest`）に限定する。
 * `settings` は `loadState`（移行）で読めるが書き込み口は持たない。設定変更UI（T-016/T-017）の
 * 着手時に `saveSettings` を追加する想定。
 *
 * `data/` 層として `domain/types` の型のみ参照し、ロジック層には依存しない。`Storage` は注入で
 * 差し替え可能（DictionaryRepository の fetch 注入と同じ思想）。
 */
export class StorageRepository {
  private readonly storage: StorageLike | null;
  private persistent: boolean;
  private error: StorageUnavailableError | null = null;
  private state: PersistedState;

  /**
   * @param storage 注入する Storage（既定は `globalThis.localStorage`）。null で明示的にメモリ動作。
   */
  constructor(storage: StorageLike | null = resolveLocalStorage()) {
    this.storage = storage;
    this.persistent = this.probe(storage);
    this.state = this.readState();
  }

  /** 永続化が有効か（false ならメモリ動作中＝保存されない）。UI 警告判定に使う。 */
  get isPersistent(): boolean {
    return this.persistent;
  }

  /** 利用不可の原因（永続化が無効な場合の型付きエラー）。有効時は null。 */
  get storageError(): StorageUnavailableError | null {
    return this.error;
  }

  /** 常に最新スキーマの状態を返す（構築時に読込・移行済みのキャッシュ）。 */
  loadState(): PersistedState {
    return this.state;
  }

  /** 図鑑状態を保存する（F7）。 */
  saveZukan(zukan: ZukanState): void {
    this.state.zukan = zukan;
    this.persist();
  }

  /** レベル別ベストを保存する（F9）。既存より高い場合のみ更新（ベスト＝最大値・同点は書込み抑制）。 */
  saveBest(level: Level, score: number): void {
    if (score <= this.state.bestScores[level]) return;
    this.state.bestScores[level] = score;
    this.persist();
  }

  /** タイムアタックのレベル別ベストを保存する（T-027・別枠）。最大値のみ更新（同点は抑制）。 */
  saveTimeAttackBest(level: Level, score: number): void {
    if (score <= this.state.timeAttackBest[level]) return;
    this.state.timeAttackBest[level] = score;
    this.persist();
  }

  /** デイリーベストを保存する（F9）。同日内の最大値を保持する（同点は書込み抑制）。 */
  saveDailyBest(date: string, score: number): void {
    if (score <= (this.state.dailyBest[date] ?? 0)) return;
    this.state.dailyBest[date] = score;
    this.persist();
  }

  /** にがて漢字の簡易SRS重みを保存する（T-035）。マップ全体を置き換える（更新は呼び出し側で算出済み）。 */
  saveWeakKanji(weak: Record<string, number>): void {
    this.state.weakKanji = { ...weak };
    this.persist();
  }

  /** ユーザー設定を保存する（T-031 ふりがな等）。 */
  saveSettings(settings: Settings): void {
    this.state.settings = { ...settings };
    this.persist();
  }

  // ----- 内部 -----

  /** 書込み可否を確認する。null・例外なら不可（`StorageUnavailableError` を記録）。 */
  private probe(storage: StorageLike | null): boolean {
    if (storage === null) {
      this.error = new StorageUnavailableError('localStorage を利用できません');
      return false;
    }
    try {
      storage.setItem(PROBE_KEY, '1');
      storage.removeItem(PROBE_KEY);
      return true;
    } catch (cause) {
      this.error = new StorageUnavailableError(
        'localStorage に書き込めません（無効化/容量超過）',
        { cause }
      );
      return false;
    }
  }

  /**
   * 保存値を読み込み、最新スキーマへ移行して返す。非 persistent は既定。破損・移行不能は
   * 既定で初期化し、可能なら既定を書き戻す（破損回復・機能設計11）。
   */
  private readState(): PersistedState {
    if (!this.persistent || this.storage === null) return defaultState();
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) return defaultState(); // 初回起動

    try {
      return migrate(JSON.parse(raw));
    } catch {
      // 破損・変換不能：初期化する。書き戻しは best-effort（失敗してもメモリ継続）。
      const fresh = defaultState();
      this.tryWrite(fresh);
      return fresh;
    }
  }

  /** 現在の state 全体を単一キーへ書き出す（persistent 時のみ）。 */
  private persist(): void {
    if (!this.persistent) return;
    this.tryWrite(this.state);
  }

  /** 書込みを試み、容量超過等で失敗したらメモリ動作へ降格する（保存系 no-op 化）。 */
  private tryWrite(state: PersistedState): void {
    // 呼び出し元（persist / readState）は persistent を確認済みで、persistent なら storage は非 null。
    try {
      this.storage!.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (cause) {
      this.persistent = false;
      this.error = new StorageUnavailableError(
        'localStorage への保存に失敗しました（容量超過の可能性）',
        { cause }
      );
    }
  }
}
