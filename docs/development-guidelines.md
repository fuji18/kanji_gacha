# 開発ガイドライン (Development Guidelines)

**プロダクト**：漢字合体ガチャ（仮称）
**バージョン**：v1.0
**インプット**：`docs/architecture.md` / `docs/repository-structure.md` / `docs/functional-design.md`
**技術前提**：TypeScript 5.x + Svelte 5 + Vite。レイヤード（UI→App→Domain→Data）。バックエンド無し。

---

## 1. コーディング規約

### 1.1 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| 変数 | camelCase・名詞 | `gachaRemaining`, `handParts` |
| 関数 | camelCase・動詞始まり | `resolveCombine`, `selectPrimary`, `drawPart` |
| Boolean | `is`/`has`/`can`/`should` 始まり | `isInScope`, `canCombineAny`, `hasReachedCap` |
| クラス | PascalCase＋役割接尾辞 | `GachaService`, `StorageRepository`, `SessionManager` |
| 型・インターフェース | PascalCase（`I`接頭辞なし） | `KanjiEntry`, `CombineEntry`, `Rng` |
| 定数 | UPPER_SNAKE_CASE | `RARITY_RATES`, `COMBO_STEPS`, `MAX_COMBINE_PARTS` |
| Svelteコンポーネント | PascalCase＋`.svelte` | `GameScreen.svelte`, `HandView.svelte` |

> リポジトリ構造定義書4章の命名規則と一致させる。曖昧名（`utils`/`misc`/`data`/`helper`）は使わない。

### 1.2 フォーマット

- **インデント**：2スペース
- **行長**：最大100文字
- **整形**：Prettier に一任（手動整形しない）。`.prettierrc` を唯一の真実とする
- セミコロンあり・シングルクォート（Prettier設定で固定）

### 1.3 型定義

```typescript
// ✅ 公開関数は引数・戻り値に明示的な型注釈
function onCombineSuccess(s: ScoreState, awarded: KanjiEntry): void { /* ... */ }

// ✅ ユニオンは型エイリアス、拡張するオブジェクトはinterface
type Level = 'elementary' | 'juniorhigh' | 'joyo';
interface KanjiEntry { char: string; strokes: number; /* ... */ }

// ❌ any 禁止。不明な値は unknown で受けて絞り込む
function load(raw: unknown): PersistedState { /* バリデーションして絞る */ }
```

- `any` は原則禁止（ESLintで警告）。外部入力（localStorage・JSON）は `unknown` で受けてスキーマ検証する
- ドメイン型は `src/domain/types.ts` に集約し、各層はそこを参照（循環依存回避）

### 1.4 関数設計

- **単一責務**。1関数20行目標・50行超で分割検討（リポジトリ構造6.3と整合）
- 引数が4個を超えたらオプションオブジェクトにまとめる
- ドメイン関数は**副作用を持たない純粋関数**を基本とする（後述2.1）

### 1.5 コメント（TSDoc）

```typescript
/**
 * 選択した部品集合が有効な漢字を成立させるか判定する。
 * 配置不問・多部品・複数解に対応（機能設計4.1）。
 * @param selected 手札から選んだ部品（2個以上）
 * @param level 現在のレベル（有効辞書スコープ）
 * @returns 成立時は採点対象 awarded を含む CombineResolved、不成立は null
 */
function resolveCombine(selected: HandPart[], level: Level): CombineResolved | null
```

- コメントは「**なぜ**」を書く。「何をしているか」はコードで表現する
- 設計書との対応は `（機能設計4.x）` の形で参照を残す（追跡性）
- `TODO:`/`FIXME:` はIssue番号付きで残す

### 1.6 Svelte 5 Runes 規約

- `$state` はUIの再描画が必要なデータのみに使う。ドメインロジックの内部変数は通常の変数にする
- `$derived` は**副作用なしの純粋な変換**のみ。非同期・外部参照を入れない
- `$effect` は **UIの副作用**（DOM操作・アニメ発火）に限定する。ビジネスロジック（スコア計算・辞書参照）を `$effect` 内に書かない（レイヤー混入＝設計破綻）
- `$props` は型を必ず明示：`let { selected, level }: { selected: HandPart[]; level: Level } = $props()`

---

## 2. プロジェクト固有ルール（最重要）

このゲーム特有の、**破ると設計が崩れる**ルール。レビューで最優先に確認する。

### 2.1 ドメイン層の純粋性とRNG/時刻の注入

`src/domain/` 配下では **`Math.random()` と `Date.now()` を直接呼ばない**。乱数・現在時刻は引数で注入する（機能設計4.6・architecture 2.1）。

```typescript
// ✅ ドメイン層：RNGを引数で受ける
function drawPart(level: Level, pool: Part[], rng: Rng): Part { /* rng() を使う */ }

// ✅ ドメイン層：時刻は nowMs を引数で受ける（todayYmdJst）
function todayYmdJst(nowMs: number): string { /* ... */ }

// ❌ ドメイン層で直接呼ぶのは禁止（デイリー再現性とテストが壊れる）
function drawPart(level: Level, pool: Part[]): Part { const r = Math.random(); /* ... */ }
```

- **RNGの生成・注入はアプリ層**（`SessionManager.start`）で行う：フリー＝`() => Math.random()`、デイリー＝`mulberry32(dailySeed(todayYmdJst(Date.now())))`
- `mulberry32` は外部依存ゼロのためドメイン層に置く。`Math.random` ラップはドメインに置かない（リポジトリ構造2.1）
- **このルールはCIで機械強制**：ESLint `no-restricted-syntax`（`src/domain/**`）が `Math.random()`/`Date.now()` をエラーにする（6.3）

> **理由**：デイリーは「全員が同じガチャ列」を保証する（PRD F8）。ドメインが内部で乱数・時刻を引けば、この決定論的再現と再現テストが成立しなくなる。

### 2.2 「要調整」値とマジックナンバーの扱い

設計で確定していない暫定値（コンボ倍率・ガチャ回数・手札上限・コスト等）は、**名前付き定数として1箇所に集約**し、`要調整` であることを明示する。マジックナンバーをロジックに直書きしない。

```typescript
// src/domain/constants.ts（暫定値の単一の真実。プレイテストで調整）
export const GACHA_COUNT = 10;              // 1プレイのガチャ回数（暫定・要調整 PRD F6）
export const HAND_CAP = 12;                 // 手札上限（暫定・要調整 PRD F1）
export const COMBO_STEPS = [1.0, 1.5, 2.0, 3.0] as const; // コンボ倍率（暫定 PRD F4）
export const MAX_COMBINE_PARTS = 5;         // 詰み判定の探索上限（ビルドで検証 機能設計8.1）
export const RARITY_RATES = { /* レベル別出現率（暫定 機能設計4.3） */ };
```

- 調整値は `// 暫定・要調整` コメントを必ず付ける
- 値を変えたら、影響するテスト（分布・詰み率）を再実行する

**値確定手順（「要調整」コメントを外す条件）**：
1. `npm run verify:data` で詰み率・分布がKPI目標（10〜20%）に収まることを確認
2. PR/CHANGELOGに「暫定値確定」と根拠（モンテカルロ結果）を記録
3. `// 暫定・要調整` コメントを削除し、レビューを経てマージ

### 2.3 レイヤー依存の厳守

| レイヤー | import可 | import禁止 |
|---|---|---|
| `ui/` | `app/`（store・SessionManager）、`domain/types`（**型のみ**・表示用） | `domain/`・`data/` への直接ロジック参照 |
| `app/` | `domain/`・`data/` | `ui/` |
| `domain/` | `domain/` 内のみ | `app/`・`ui/`・`data/`・ブラウザAPI |
| `data/` | ブラウザAPI・`domain/types`（型のみ） | `app/`・`ui/`・ビジネスロジック |

- **CIで強制**：ESLint `no-restricted-imports`＋循環依存検出（`import/no-cycle`／`madge --circular`）（リポジトリ構造5.2/5.3）

### 2.4 エラーハンドリング方針

予期されるエラーは型付きで扱い、無視しない（機能設計11）。

```typescript
// カスタムエラー
class DictionaryLoadError extends Error { name = 'DictionaryLoadError'; }
class StorageUnavailableError extends Error { name = 'StorageUnavailableError'; }
```

| 事象 | 方針 | プレイヤー表示 |
|---|---|---|
| 辞書ロード失敗 | 起動中断＋リトライ導線 | 「データの読み込みに失敗しました。再読み込みしてください」 |
| localStorage不可/容量超過 | メモリ動作で継続、保存系のみ無効化 | 「記録を保存できない設定です。今回の図鑑は保存されません」 |
| 保存データのスキーマ不整合 | `schemaVersion` で移行、失敗時は初期化 | 「保存データを更新しました」 |
| 多部品で不成立（ミス） | コンボリセットのみ。**重いペナルティにしない**（PRDリスク7.2） | 赤シェイク/✕ |

- ゲームロジックのミス（無効合体）は「例外」ではなく**正常系の戻り値**（`null`）で扱う。例外はインフラ的失敗にのみ使う

### 2.5 セキュリティ・ライセンス

- 機密情報・APIキーをコードに書かない（MVPは外部サービス無し）。将来BE導入時も鍵は環境変数
- 個人情報を収集しない。外部送信を追加する変更は要レビュー（CSP・プライバシー影響を確認）
- データ由来のクレジット表記（About画面）を削らない（PRD F10・CC BY-SA）

### 2.6 パフォーマンス指針

- 辞書は起動時に `Map` 展開しO(1)判定（機能設計9）。線形検索を新たに増やさない
- 演出（Canvas/CSS）と判定（ロジック）を分離。判定は演出完了を待たない
- パーティクルはオブジェクトプールで再利用しフレーム内割当を抑える（architecture 2.3）

---

## 3. Git運用ルール

### 3.1 ブランチ戦略（Git Flow）

```
main (本番デプロイ可能・タグでバージョン管理)
└── develop (開発統合・CI実行)
    ├── feature/<機能>   例: feature/combine-engine
    ├── fix/<内容>       例: fix/daily-seed-timezone
    └── refactor/<対象>
```

- `main`/`develop` への直接コミット禁止。すべてPR経由
- マージ方針：feature→develop は **squash merge**、develop→main は **merge commit**
- 個人開発でもPR・CIを通す（品質ゲートとして機能させる）

### 3.2 コミットメッセージ（Conventional Commits）

```
<type>(<scope>): <subject>
```

**type**：`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore`

**scope（本プロジェクト）**：
- `gacha` GachaService/抽選 ／ `combine` CombineService/makeKey/selectPrimary ／ `score` ScoreService/resolveRank
- `rescue` ヒント・捨てる ／ `zukan` 図鑑・収集率 ／ `daily` シード/todayYmdJst/mulberry32
- `session` SessionManager/進行 ／ `ui` 画面・コンポーネント・演出 ／ `data` Dictionary/Storage Repository・migrations
- `dict` scripts/build-data（辞書生成） ／ `infra` GitHub Actions・ESLint/Vite等の設定

```
feat(combine): 多部品合体と複数解のprimary選定を実装

- makeKeyで部品idマルチセットを正規化（配置不問）
- resolveCombineでscope内からawardedを動的選定（機能設計4.1/4.4）

Closes #12
```

### 3.3 プルリクエスト

**作成前チェック**：
- [ ] `npm run lint` / `typecheck` / `test` / `build` がパス
- [ ] ドメイン層に `Math.random`/`Date.now` 直書きがない
- [ ] 暫定値は定数化されている

**PRテンプレート**：
```markdown
## 変更の種類
- [ ] feat / fix / refactor / docs / chore

## 何を / なぜ / どう変えたか
-

## 上流ドキュメント整合
- 対応するPRD/機能設計の項番:

## テスト
- [ ] ユニット追加 / [ ] 詰み率・分布に影響する場合は再検証
- [ ] 手動確認

## レビューで特に見てほしい点
-

Closes #
```

- **小さなPR**を心がける（1PR=1関心事、変更300行以内目安）

---

## 4. テスト戦略

### 4.1 テストピラミッドとカバレッジ

```
   E2E (Playwright)  少
  統合 (Vitest)      中
 ユニット (Vitest)   多 ← ドメイン層に厚く
```

| 種別 | ツール | カバレッジ目標 |
|---|---|---|
| ユニット | Vitest | **ドメイン層90%以上**（ロジックの中核・architecture 8.1） |
| 統合 | Vitest | 主要フロー（セッション一連・永続化） |
| E2E | Playwright | 主要シナリオ100%（基本プレイ・デイリー再現） |
| UIコンポーネント | Vitest + @testing-library/svelte **v5.x（Svelte 5対応）** | 数値目標なし（E2Eで担保） |

> **Svelte 5対応の前提**：UIテストは `@testing-library/svelte` v5.x ＋ vitest の `environment: 'happy-dom'`（or jsdom）＋ `@sveltejs/vite-plugin-svelte` を設定する。runes（`$state`/`$derived`）を持つコンポーネントの更新は非同期になるため `waitFor`/`tick()` を使う（Svelte 4と挙動が異なる）。

> **カバレッジ強制（宣言だけでは止まらない）**：「ドメイン90%」は `vitest.config.ts` の per-directory thresholds で強制する。
> ```ts
> // vitest.config.ts
> test: { coverage: { provider: 'v8', include: ['src/**/*.ts'],
>   thresholds: { 'src/domain/**': { lines: 90, functions: 90, branches: 90 }, lines: 70 } } }
> ```

### 4.2 ビルド時検証ゲート（CIで必須）

本プロジェクト特有の品質ゲート。**失敗したらマージ不可**とする（機能設計8.1・architecture 8.2）。

- **詰み率モンテカルロ**：各レベルの詰み終了率が**KPI 10〜20%**に収まる
- **到達可能字数N**：図鑑分母Nが算出でき、到達不能字を含まない
- **`MAX_COMBINE_PARTS` 一致**：辞書実最大partCountと定数が一致
- **デイリー再現性**：同一日付で同一ガチャ列（E2E）

### 4.3 テストの書き方（Given-When-Then）・命名

```typescript
describe('CombineService', () => {
  it('resolve_配置違いの同一部品_同じ漢字を成立させる', () => {
    // Given
    const svc = new CombineService(dict, kanji);
    // When
    const r = svc.resolve([part('言'), part('寺')], 'juniorhigh');
    // Then
    expect(r?.awarded.char).toBe('詩');
  });

  it('resolve_2部品未満_nullを返す', () => {
    expect(new CombineService(dict, kanji).resolve([part('木')], 'elementary')).toBeNull();
  });
});
```

- 命名：`[対象]_[条件]_[期待結果]`。`test1`/`works` のような名前は禁止
- ドメイン純粋関数は外部依存なしで素直にテスト可能。RNGは固定シードの `mulberry32` を注入して決定的に検証

### 4.4 モック方針

- データ層（`DictionaryRepository`/`StorageRepository`）はインターフェースでモック化
- ドメインロジックは実装を使う（モックしない）
- RNGはモックでなく**固定シードの実物**（`mulberry32(1)`）を使い、決定性を担保

---

## 5. コードレビュー基準

### 5.1 観点チェック

- **プロジェクト固有（最優先）**：ドメイン純粋性／レイヤー依存／暫定値の定数化／ライセンス表記の維持
- **機能性**：要件（PRD項番）を満たすか、エッジ（詰み・手札0・複数解）を考慮したか
- **可読性**：命名・TSDoc・設計書参照
- **保守性**：重複排除・単一責務・影響範囲
- **パフォーマンス**：O(1)判定の維持・演出と判定の分離

### 5.2 コメントの書き方

- 建設的に・代替案を添えて。優先度を明示：`[必須]` `[推奨]` `[提案]` `[質問]`
- 良い点も書く（`✨`/`👍`）

```
[必須] domain/gacha/GachaService.ts: Math.random() を直接使用しています。
       RNGを引数注入に変更してください（2.1・デイリー再現性が壊れます）。
[推奨] combine: マジックナンバー 12 は HAND_CAP を参照しましょう。
```

---

## 6. 品質自動化（CI/CD）

### 6.1 npm スクリプト

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "gen:data": "tsx --tsconfig tsconfig.scripts.json scripts/build-data/generate.ts",
    "verify:data": "tsx --tsconfig tsconfig.scripts.json scripts/build-data/simulateStuckRate.ts"
  }
}
```

### 6.2 GitHub Actions（CI）

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm ci
      - run: npm run lint          # ドメイン純粋性・import境界・循環依存も検出
      - run: npm run typecheck
      - run: npm run gen:data      # 辞書生成 → public/data/*.json を出力（後続の入力）
      - run: npm run verify:data   # gen:data の出力を検証（詰み率・N・MAX_PARTS）。順序変更禁止
      - run: npm run test          # ユニット＋カバレッジ（vitest.config.ts の thresholds で90%強制）
      - run: npm run build         # Viteビルド（public/data/*.json をアセットに同梱）
      - run: npx playwright install --with-deps chromium  # E2Eのブラウザ（CI必須）
      - run: npm run test:e2e      # デイリー再現性ほか
```

- `main`/`develop` への push と全PRでCI必須。**失敗時はマージ不可**

### 6.3 ESLint によるドメイン純粋性の強制

```js
// eslint.config.js（src/domain/ 専用ブロック）
{
  files: ['src/domain/**/*.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      { selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
        message: 'domain層でMath.random()は禁止。RNGを引数で注入すること（2.1）' },
      { selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
        message: 'domain層でDate.now()は禁止。タイムスタンプを引数で受け取ること（2.1）' },
    ],
    'no-restricted-imports': ['error', { patterns: ['**/app/**','**/ui/**','**/data/**'] }],
  },
}
```

### 6.4 Pre-commit（Husky + lint-staged）

> **Svelteのlint/format前提**：`*.svelte` を `eslint --fix`/`prettier --write` に通すには **`eslint-plugin-svelte`（Svelte 5 runes対応の2.x系）** と **`prettier-plugin-svelte` 3.x** が必要。`eslint.config.js` に `eslint-plugin-svelte` の flat 設定を、`.prettierrc` に `"plugins": ["prettier-plugin-svelte"]` を追加する。

```jsonc
// package.json
{
  "lint-staged": {
    "*.{ts,svelte}": ["eslint --fix", "prettier --write"]
  }
}
```
```bash
# .husky/pre-commit
npx lint-staged
npm run typecheck
```

> pre-commitは**変更ファイルのみ**の `lint-staged` を基本とする。`typecheck`（全体 `tsc --noEmit`）はプロジェクト肥大化でコミットが遅くなるため、重くなったらCIに委譲する。`.svelte` の型は `tsc` だけでは不完全な場合があり、必要に応じ `svelte-check` を併用する。

---

## 7. 開発環境セットアップ

### 7.1 必要なツール

| ツール | バージョン | 備考 |
|---|---|---|
| Node.js | v24.11.0 | devcontainerに同梱（CLAUDE.md） |
| npm | 11.x | Node同梱 |

### 7.2 手順

```bash
# 1. クローン
git clone <URL> && cd kanji_gacha

# 2. 依存インストール
npm ci

# 3. 辞書データ生成（KANJIDIC2/KRADFILE → public/data/*.json）
#    data-sources/ に元データを配置（取得手順は data-sources/README.md）
npm run gen:data

# 4. 開発サーバー起動
npm run dev

# 5. E2Eテスト用ブラウザのインストール（E2E実行前に1回）
npx playwright install --with-deps

# 6. pre-commitフックの有効化（npm ci の prepare で自動。手動なら npx husky）
```

### 7.3 推奨エディタ設定

- VS Code 拡張：Svelte for VS Code、ESLint、Prettier
- 保存時整形（Prettier）・ESLint自動修正を有効化

---

## 8. 実装完了前チェックリスト

**コード品質**
- [ ] 命名が規約に沿う／単一責務／マジックナンバーは定数化（要調整は明示）
- [ ] `any` を使っていない（外部入力は `unknown`＋検証）
- [ ] TSDoc・設計書参照コメントがある

**プロジェクト固有（必須）**
- [ ] `src/domain/` に `Math.random`/`Date.now` 直書きがない（RNG/時刻は注入）
- [ ] レイヤー依存・循環依存ルールを守っている
- [ ] エラーは型付きで扱い、ミスは正常系の戻り値で処理

**テスト**
- [ ] ユニット追加（ドメインは固定シードで決定的）
- [ ] 調整値・プール・出現率を変えた場合は詰み率/分布を再検証

**ツール**
- [ ] lint / typecheck / test / build がパス
- [ ] ライセンス表記・クレジットを壊していない
