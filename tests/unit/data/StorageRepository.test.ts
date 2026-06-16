import { describe, it, expect } from 'vitest';
import {
  StorageRepository,
  StorageUnavailableError,
  type StorageLike,
} from '../../../src/data/StorageRepository';
import { STORAGE_KEY } from '../../../src/data/migrations';

// StorageRepository の受け入れ条件（T-013 / PRD F7・F9 / 機能設計3.3・5.2・8.3・11）を固定する。
//  - 図鑑追加→リロード→保持（F7）
//  - レベル別ベスト・デイリーベストの保存/更新（F9・max）
//  - 旧スキーマ（altDiscovered なし）の {} 補完
//  - 破損データの初期化（クラッシュなし）
//  - localStorage 不可/容量超過でフォールバック（保存系 no-op・isPersistent=false）

/** Map ベースのフェイク Storage（正常系）。 */
class MemoryStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** プローブ（書込み）で必ず例外を投げる Storage（localStorage 無効環境の模倣）。 */
class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    return null;
  }
  setItem(): void {
    throw new DOMException('blocked', 'SecurityError');
  }
  removeItem(): void {}
}

/** プローブは通すが本番書込み（state 保存）で容量超過する Storage。 */
class QuotaStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (key === STORAGE_KEY) {
      throw new DOMException('quota', 'QuotaExceededError');
    }
    this.map.set(key, value); // プローブキーは通す
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('StorageRepository 永続化ラウンドトリップ（F7）', () => {
  it('図鑑を保存→別インスタンスで loadState して保持される（リロード相当）', () => {
    const storage = new MemoryStorage();
    const repo = new StorageRepository(storage);
    repo.saveZukan({
      discovered: { 林: { firstAt: '2026-06-04', count: 1 } },
      altDiscovered: {},
    });

    // 「リロード」＝同じ Storage を読む新インスタンス
    const reloaded = new StorageRepository(storage);
    expect(reloaded.loadState().zukan.discovered['林']).toEqual({
      firstAt: '2026-06-04',
      count: 1,
    });
  });

  it('単一キー kg.state.v1 に JSON 全体を書き出す（機能設計8.3）', () => {
    const storage = new MemoryStorage();
    const repo = new StorageRepository(storage);
    repo.saveBest('joyo', 80);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).bestScores.joyo).toBe(80);
  });
});

describe('StorageRepository ベスト/デイリーベスト更新（F9）', () => {
  it('saveBest はより高いスコアでのみ更新（ベスト＝最大値）', () => {
    const storage = new MemoryStorage();
    const repo = new StorageRepository(storage);
    repo.saveBest('elementary', 50);
    repo.saveBest('elementary', 30); // 低い→無視
    expect(repo.loadState().bestScores.elementary).toBe(50);
    repo.saveBest('elementary', 70); // 高い→更新
    expect(repo.loadState().bestScores.elementary).toBe(70);
  });

  it('saveTimeAttackBest は別枠でより高いスコアのみ更新（bestScores と独立・T-027）', () => {
    const storage = new MemoryStorage();
    const repo = new StorageRepository(storage);
    repo.saveBest('elementary', 50); // じっくりベスト
    repo.saveTimeAttackBest('elementary', 80);
    repo.saveTimeAttackBest('elementary', 40); // 低い→無視
    expect(repo.loadState().timeAttackBest.elementary).toBe(80);
    expect(repo.loadState().bestScores.elementary).toBe(50); // 別枠で混ざらない
    repo.saveTimeAttackBest('elementary', 120); // 高い→更新
    expect(repo.loadState().timeAttackBest.elementary).toBe(120);
  });

  it('saveSettings は設定を保存し、別インスタンスで保持される（T-031）', () => {
    const storage = new MemoryStorage();
    const repo = new StorageRepository(storage);
    repo.saveSettings({ hintAlwaysOn: false, furigana: true });
    expect(repo.loadState().settings.furigana).toBe(true);
    // リロード相当
    expect(new StorageRepository(storage).loadState().settings.furigana).toBe(
      true
    );
  });

  it('saveDailyBest は日付ごとに最大値を保持', () => {
    const storage = new MemoryStorage();
    const repo = new StorageRepository(storage);
    repo.saveDailyBest('20260604', 40);
    repo.saveDailyBest('20260604', 25); // 低い→無視
    repo.saveDailyBest('20260605', 10); // 別日→保存
    expect(repo.loadState().dailyBest).toEqual({
      '20260604': 40,
      '20260605': 10,
    });
  });
});

describe('StorageRepository 移行・破損', () => {
  it('旧スキーマ（altDiscovered なし）を読み込むと {} 補完される', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        zukan: { discovered: { 好: { firstAt: '2026-01-01', count: 3 } } },
        bestScores: { elementary: 10, juniorhigh: 0, joyo: 0 },
        dailyBest: {},
        settings: { hintAlwaysOn: false },
        // schemaVersion / altDiscovered なし
      })
    );
    const repo = new StorageRepository(storage);
    const state = repo.loadState();
    expect(state.zukan.altDiscovered).toEqual({});
    expect(state.zukan.discovered['好'].count).toBe(3);
    expect(state.schemaVersion).toBe(1);
  });

  it('破損 JSON はクラッシュせず既定で初期化し、書き戻す', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{ this is not valid json );');
    const repo = new StorageRepository(storage);
    expect(repo.loadState()).toEqual(
      new StorageRepository(new MemoryStorage()).loadState()
    );
    // 破損回復として既定が書き戻されている
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).schemaVersion).toBe(1);
    expect(repo.isPersistent).toBe(true);
  });

  it('初回起動（キー無し）は既定状態を返す', () => {
    const repo = new StorageRepository(new MemoryStorage());
    expect(repo.loadState().bestScores).toEqual({
      elementary: 0,
      juniorhigh: 0,
      joyo: 0,
    });
  });

  it('引数なし（既定 localStorage）でも動作する（テスト環境の localStorage を使用）', () => {
    // happy-dom の localStorage を解決する既定経路を実行する。
    globalThis.localStorage.clear();
    const repo = new StorageRepository();
    expect(repo.isPersistent).toBe(true);
    repo.saveBest('joyo', 55);
    expect(new StorageRepository().loadState().bestScores.joyo).toBe(55);
    globalThis.localStorage.clear();
  });
});

describe('StorageRepository 利用不可フォールバック（機能設計11）', () => {
  it('storage=null（明示メモリ動作）でも保存系がクラッシュしない', () => {
    const repo = new StorageRepository(null);
    expect(repo.isPersistent).toBe(false);
    expect(repo.storageError).toBeInstanceOf(StorageUnavailableError);
    expect(() => repo.saveBest('joyo', 100)).not.toThrow();
    // メモリ上は更新される（読みは継続）が永続化はされない
    expect(repo.loadState().bestScores.joyo).toBe(100);
  });

  it('プローブで例外（無効環境）なら isPersistent=false・StorageUnavailableError', () => {
    const repo = new StorageRepository(new ThrowingStorage());
    expect(repo.isPersistent).toBe(false);
    expect(repo.storageError).toBeInstanceOf(StorageUnavailableError);
    expect(repo.loadState().dailyBest).toEqual({}); // 既定を返す
    expect(() => repo.saveDailyBest('20260604', 10)).not.toThrow();
  });

  it('localStorage プロパティアクセス自体が例外でも null 解決でフォールバック（プライバシーモード）', () => {
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      'localStorage'
    );
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    try {
      const repo = new StorageRepository(); // 既定解決経路で getter が throw
      expect(repo.isPersistent).toBe(false);
      expect(repo.storageError).toBeInstanceOf(StorageUnavailableError);
      expect(() => repo.saveBest('joyo', 1)).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });

  it('保存時の容量超過でメモリ動作へ降格する（保存系 no-op 化・クラッシュなし）', () => {
    const storage = new QuotaStorage();
    const repo = new StorageRepository(storage);
    expect(repo.isPersistent).toBe(true); // プローブは通る
    expect(() => repo.saveBest('joyo', 90)).not.toThrow();
    // 降格後はメモリ値を保持し、永続化はされていない
    expect(repo.isPersistent).toBe(false);
    expect(repo.storageError).toBeInstanceOf(StorageUnavailableError);
    expect(repo.loadState().bestScores.joyo).toBe(90); // メモリ更新は反映
    expect(storage.getItem(STORAGE_KEY)).toBeNull(); // 永続化されていない
  });
});
