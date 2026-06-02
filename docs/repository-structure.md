# リポジトリ構造定義書 (Repository Structure Document)

**プロダクト**：漢字合体ガチャ（仮称）
**バージョン**：v1.0
**インプット**：`docs/product-requirements.md` / `docs/functional-design.md` / `docs/architecture.md`
**前提**：Vite + Svelte 5 + TypeScript の静的Webアプリ。レイヤード（UI→App→Domain→Data）。バックエンド無し。

---

## 1. プロジェクト構造

```
kanji_gacha/
├── public/                        # 静的配信アセット（ビルド時にそのままコピー）
│   └── data/                      # ビルド生成の辞書JSON（git管理・再生成可能）
│       ├── kanji.json             # KanjiEntry[]（char/strokes/readings/meanings/level/freqRank）＋メタ(到達可能字数N)
│       ├── parts.json             # Part[]（id/char/rarity/scopes/weight）
│       ├── combine-dict.json      # CombineEntry[]（key/results/primary/partCount）
│       └── LICENSE.txt            # 辞書データのCC BY-SA表記（生成物の継承ライセンス）
├── src/
│   ├── domain/                    # ドメイン層：純粋ロジック・外部依存なし
│   │   ├── types.ts               # ドメイン型（Part, KanjiEntry, CombineEntry, GameSession, ScoreState ...）
│   │   ├── gacha/
│   │   │   └── GachaService.ts    # 4.3 レアリティ抽選＋weight重み付け
│   │   ├── combine/
│   │   │   ├── CombineService.ts  # 4.1 resolve / 4.5 canCombineAny / findHint
│   │   │   ├── makeKey.ts         # 部品idマルチセットの正規化
│   │   │   └── selectPrimary.ts   # 4.4 代表解選定（ビルド時・プレイ時共用）
│   │   ├── score/
│   │   │   └── ScoreService.ts    # 4.2 画数ベース＋コンボ倍率
│   │   ├── rescue/
│   │   │   └── RescueService.ts   # 3.7 ヒント／捨てて引き直す
│   │   ├── rank/
│   │   │   └── resolveRank.ts     # 4.7 称号ランク（固定閾値）
│   │   └── rng/
│   │       ├── Rng.ts             # RNGインターフェース型
│   │       ├── mulberry32.ts      # 4.6 決定的PRNG
│   │       └── dailySeed.ts       # 4.6 todayYmdJst / dailySeed（JST固定）
│   ├── app/                       # アプリケーション層：進行・状態
│   │   ├── SessionManager.ts      # 5.1 オーケストレーション・RNG生成と注入
│   │   └── stores/
│   │       ├── sessionStore.ts    # GameSession の Svelte store
│   │       └── persistedStore.ts  # 図鑑・ベスト等のビュー
│   ├── data/                      # データ層：辞書ロード・永続化
│   │   ├── DictionaryRepository.ts# 静的JSON取得→Map展開（O(1)判定）
│   │   ├── StorageRepository.ts   # localStorageラッパ＋マイグレーション
│   │   └── migrations.ts          # schemaVersion 移行ロジック
│   ├── ui/                        # UIレイヤー：Svelteコンポーネント・演出
│   │   ├── screens/
│   │   │   ├── HomeScreen.svelte
│   │   │   ├── GameScreen.svelte
│   │   │   ├── ResultScreen.svelte
│   │   │   ├── ZukanScreen.svelte
│   │   │   └── AboutScreen.svelte
│   │   ├── components/
│   │   │   ├── HandView.svelte     # 手札表示・部品選択
│   │   │   ├── PartChip.svelte     # 部品1枚（レアリティ色）
│   │   │   ├── GachaButton.svelte
│   │   │   ├── ScoreBar.svelte     # スコア・コンボ・ガチャ残
│   │   │   └── HintButton.svelte
│   │   └── effects/
│   │       ├── particleField.ts    # Canvas 2D パーティクル（プール管理）
│   │       └── effects.css         # フラッシュ/シェイク/グロウ
│   ├── App.svelte                 # ルートコンポーネント・画面遷移
│   └── main.ts                    # エントリポイント（辞書ロード→マウント）
├── scripts/
│   └── build-data/                # ビルド時データ生成（実行時には含まれない）
│       ├── generate.ts            # KANJIDIC2+KRADFILE → 3つのJSON（機能設計8.1）
│       ├── reachable.ts           # 到達可能primary字数N算出（図鑑分母）
│       ├── verifyMaxParts.ts      # MAX_COMBINE_PARTS 一致検証
│       └── simulateStuckRate.ts   # 詰み率モンテカルロ（KPI 10〜20%検証）
├── data-sources/                  # 元データ（KANJIDIC2/KRADFILE）＋出典・ライセンス
│   ├── README.md                  # 取得元・バージョン・ライセンス明記
│   └── LICENSE-EDRDG.txt          # CC BY-SA 4.0 原本表記
├── tests/
│   ├── unit/                      # src/ と同じ階層をミラー（Vitest）
│   │   └── domain/
│   │       ├── combine/CombineService.test.ts
│   │       ├── score/ScoreService.test.ts
│   │       ├── gacha/GachaService.test.ts
│   │       └── rng/mulberry32.test.ts
│   ├── integration/               # セッション一連・永続化（Vitest）
│   │   └── session-flow.test.ts
│   └── e2e/                        # Playwright
│       ├── play-basic.spec.ts
│       └── daily-reproducibility.spec.ts
├── docs/                          # 永続ドキュメント（PRD/設計/本書/ガイドライン/用語集）
│   └── ideas/                     # 企画・下書き
├── .steering/                     # 作業単位ドキュメント（gitignore）
├── .claude/                       # Claude Code 設定（commands/skills/agents）
├── index.html                     # Viteエントリ
├── vite.config.ts
├── svelte.config.js
├── tsconfig.json
├── eslint.config.js               # no-restricted-globals(src/domain) / import境界
├── .prettierrc
├── package.json
├── package-lock.json
├── _headers                       # CSP等（Cloudflare Pages・環境別）
├── README.md
└── LICENSE                        # アプリ本体コードのライセンス
```

---

## 2. ディレクトリ詳細

### 2.1 src/domain/ （ドメイン層）

**役割**：ガチャ・合体・スコア・救済・乱数・称号の**純粋ロジック**。UI・ストレージ・グローバル（`Math.random`/`Date.now`）に依存しない。

**配置ファイル**：機能設計4章のアルゴリズムを1責務1ファイルで実装。型は `types.ts` に集約。

**命名規則**：
- サービスクラス：PascalCase ＋ `Service` 接尾辞（`GachaService.ts`）
- 純粋関数モジュール：camelCase 動詞始まり（`makeKey.ts`, `selectPrimary.ts`, `resolveRank.ts`）

**依存関係**：
- 依存可能：`domain/` 内のみ（型・他の純粋関数）
- 依存禁止：`app/`・`ui/`・`data/`・ブラウザAPI・`Math.random`/`Date.now`（**注入で受ける**）

> この純粋性は ESLint で機械的に強制する（5章・architecture 10.3）。ドメイン層は `Rng.ts` のインターフェース型のみ受け取る。`mulberry32.ts` は**外部依存ゼロの決定的PRNG実装**のため `domain/rng/` に置く。一方、フリープレイ用の `Math.random` ラップ（`() => Math.random()`）は**ブラウザ依存をドメインに持ち込まないため `domain/` には置かず、`src/app/SessionManager.ts` で生成・注入する**。

### 2.2 src/app/ （アプリケーション層）

**役割**：ゲーム進行のオーケストレーションと状態保持。`SessionManager` がドメイン層を呼び、Svelte store を更新する。**RNGの生成と注入**（フリー=`Math.random`ラップ／デイリー=`mulberry32(dailySeed(todayYmdJst(Date.now())))`）はここで行う。

**依存関係**：
- 依存可能：`domain/`・`data/`
- 依存禁止：`ui/`（DOM参照を持たない）

### 2.3 src/data/ （データ層）

**役割**：静的JSON辞書の取得とMap展開、localStorageの読み書きとマイグレーション。

**依存関係**：
- 依存可能：ブラウザのfetch・localStorage、`domain/types.ts`（型のみ）
- 依存禁止：ビジネスロジックの実装、`app/`・`ui/`

### 2.4 src/ui/ （UIレイヤー）

**役割**：画面・コンポーネント・演出。store購読でリアクティブに描画。演出はstoreイベント契機で発火し**ロジックをブロックしない**。

**配置**：
- `screens/`：画面単位（Home/Game/Result/Zukan/About）
- `components/`：再利用部品（手札・部品チップ・ボタン・スコアバー）
- `effects/`：Canvas 2D（`particleField.ts`）＋CSS（`effects.css`）

**命名規則**：Svelteコンポーネントは PascalCase ＋ `.svelte`（`GameScreen.svelte`）。

**依存関係**：
- 依存可能：`app/`（store・SessionManager）
- 依存禁止：`domain/`・`data/` への直接アクセス

### 2.5 scripts/build-data/ （ビルド時データ生成）

**役割**：KANJIDIC2+KRADFILE から3つのJSONを生成し、到達可能字数N・MAX_COMBINE_PARTS・詰み率を検証（機能設計8.1）。**実行時アプリには含まれない**（Node.js・ビルド/CI専用）。

**依存関係**：`data-sources/` を入力、`public/data/` を出力。`domain/` の純粋関数（`selectPrimary` 等）を再利用してよい（ビルド時/プレイ時の整合）。

> **import経路（重要）**：Vite本体の `tsconfig.json` は `include: ["src"]` のため `scripts/` はコンパイル対象外。`scripts/build-data/` から `src/domain/` を import する際は、専用の `tsconfig.scripts.json`（`include` に `scripts/` と `src/domain/` を指定）を用意し、`tsx`（または `ts-node --project tsconfig.scripts.json`）で実行する。Vite本体の `tsconfig.json` は変更しない。

### 2.6 public/data/ ・ data-sources/ （データとライセンス）

- `public/data/*.json`：**生成物**（再生成可能）。git管理してビルド再現性を担保
- `public/data/LICENSE.txt`：自作合体辞書を含む生成物の **CC BY-SA 表記**（継承義務）
- `data-sources/`：元データと出典・バージョン・ライセンス原本（CC BY-SA 4.0）。**ライセンス遵守の起点**

### 2.7 src/App.svelte・src/main.ts（エントリポイント）

- `main.ts`：`DictionaryRepository.load()` を await してから `App.svelte` をマウントする。辞書ロード失敗時はエラーUI（機能設計11節）を表示しマウントを中断する
- `App.svelte`：画面遷移（Home/Game/Result/Zukan/About）を管理するルートコンポーネント。storeを購読し、現在フェーズに応じた画面をレンダリングする

---

## 3. ファイル配置規則

### 3.1 ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| ドメインサービス | `src/domain/<機能>/` | PascalCase+Service | `GachaService.ts` |
| 純粋関数 | `src/domain/<機能>/` | camelCase 動詞始まり | `makeKey.ts` |
| ドメイン型 | `src/domain/` | `types.ts` に集約 | `types.ts` |
| アプリ進行 | `src/app/` | PascalCase | `SessionManager.ts` |
| store | `src/app/stores/` | camelCase+Store | `sessionStore.ts` |
| リポジトリ | `src/data/` | PascalCase+Repository | `StorageRepository.ts` |
| 画面 | `src/ui/screens/` | PascalCase+Screen.svelte | `GameScreen.svelte` |
| 部品 | `src/ui/components/` | PascalCase.svelte | `HandView.svelte` |
| 演出 | `src/ui/effects/` | camelCase.ts / .css | `particleField.ts` |
| ビルドスクリプト | `scripts/build-data/` | camelCase.ts | `generate.ts` |

### 3.2 テストファイル

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| ユニット（ドメイン/app/data） | `tests/unit/`（src構造をミラー） | `[対象].test.ts` | `CombineService.test.ts` |
| UIコンポーネント | `tests/unit/ui/components/` | `PascalCase.test.ts` | `HandView.test.ts` |
| 統合 | `tests/integration/` | `[シナリオ].test.ts` | `session-flow.test.ts` |
| E2E | `tests/e2e/` | `[シナリオ].spec.ts` | `daily-reproducibility.spec.ts` |

> **テスト配置方針**：ユニット〜統合は **`tests/` に集約**し、コロケーション（`src/`直下への併置）はしない。`vitest.config.ts` の `include` も `tests/**/*.{test,spec}.ts` に揃える。Svelteコンポーネントのテストは **`@testing-library/svelte`** を用い、拡張子は `.test.ts` に統一する（`.svelte.ts` は使わない）。UIテストに数値カバレッジ目標は設けず、主要操作はE2E（Playwright）で担保する（ドメイン層90%＋E2Eの二段構え・architecture 8章）。

### 3.3 設定ファイル（プロジェクトルート）

| 種別 | ファイル |
|---|---|
| ビルド | `vite.config.ts`（vite-plugin-pwa設定含む）/ `svelte.config.js` |
| 型 | `tsconfig.json`（実行時src用）/ `tsconfig.scripts.json`（ビルドスクリプト用・2.5） |
| 静的解析 | `eslint.config.js`（`no-restricted-syntax`でドメイン純粋性・import境界・`ignores`）/ `.prettierrc` |
| 配信ヘッダ | `_headers`（CSP・環境別） |

> **`_headers` の環境別管理（architecture 6.2）**：単一の `_headers` をベースに、Phase進行でCSPを段階開放する（Phase1=`default-src 'self'`／Phase2=`connect-src`追加／ネイティブ=広告ドメイン許可）。ステージング/本番で出し分ける場合はCIのデプロイ環境で切り替える。
> **PWA生成物**：`vite-plugin-pwa` 有効時、本番ビルドで `sw.js`/`workbox-*.js` が `dist/` に生成される（除外は8.1の `dist/` でカバー）。

---

## 4. 命名規則（まとめ）

- **ディレクトリ**：レイヤー/複数機能は複数形・kebab-case（`screens/`, `components/`, `stores/`）。単一機能は単数形（`gacha/`, `combine/`）
- **クラスファイル**：PascalCase＋役割接尾辞（`*Service.ts`, `*Repository.ts`, `SessionManager.ts`）
- **純粋関数ファイル**：camelCase・動詞始まり（`makeKey.ts`, `selectPrimary.ts`）
- **Svelteコンポーネント**：PascalCase＋`.svelte`
- **定数**：UPPER_SNAKE_CASE（`RARITY_RATES`, `COMBO_STEPS`, `MAX_COMBINE_PARTS`。`src/domain/` 内の定数モジュール or 各サービス内）

---

## 5. 依存関係のルール

### 5.1 レイヤー間の依存（一方向）

```
ui/        （Svelte画面・演出）
  ↓ OK
app/       （SessionManager・store）
  ↓ OK
domain/    （純粋ロジック）        data/（辞書・永続化）
  ↑ NG（下位→上位は禁止）           ↑ app からのみ呼ぶ
```

**禁止される依存**：
- `domain/` → `app/`・`ui/`・`data/`・ブラウザAPI（❌）
- `data/` → `app/`・`ui/`・ビジネスロジック（❌）
- `app/` → `ui/`（❌）

### 5.2 ドメイン層の純粋性をCIで強制

ESLint flat config（`eslint.config.js`）で `files: ['src/domain/**/*.ts']` スコープの設定ブロックを置く。`Math.random()`/`Date.now()` は**メソッド呼び出し単位**で禁止する必要があるため、`no-restricted-globals`（識別子そのものを禁じる＝`Math.floor`等まで巻き込む）ではなく **`no-restricted-syntax`（ASTセレクタ）** を使う。

```js
// eslint.config.js の src/domain/ 専用ブロック（architecture 10.3）
{
  files: ['src/domain/**/*.ts'],
  rules: {
    // Math.random() / Date.now() の呼び出しをメソッド単位で禁止（Math.floor等は許可）
    'no-restricted-syntax': [
      'error',
      { selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
        message: 'domain層でMath.random()は禁止。RNGを引数で注入すること' },
      { selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
        message: 'domain層でDate.now()は禁止。タイムスタンプを引数で受け取ること' },
    ],
    // 上位/横レイヤーのimport禁止
    'no-restricted-imports': ['error', { patterns: ['**/app/**','**/ui/**','**/data/**'] }],
  },
}
```

> `no-restricted-globals` は `window`/`document`/`localStorage` 等の**グローバル変数そのもの**を禁じる用途に使う（ドメイン層でのブラウザAPI参照禁止の補助）。`Math.random`/`Date.now` のような**プロパティ呼び出し**には効かないため `no-restricted-syntax` を用いる。
>
> 乱数・時刻は必ず引数注入（`Rng`型・タイムスタンプ）。これによりデイリーの決定論的再現とユニットテストが成立する（機能設計4.6）。

### 5.3 循環依存の回避

- 共通型は `src/domain/types.ts` に集約し、サービス間は型経由で参照
- ドメインサービスが相互参照しそうな場合は、共通の純粋関数（`makeKey`・`selectPrimary`）に切り出す
- **機械的検出**：循環依存は `eslint-plugin-import` の `import/no-cycle` ルール（またはCIでの `madge --circular src`）で自動検出する。手動確認に頼らない

---

## 6. スケーリング戦略

### 6.1 将来モードの追加（極／お題／連鎖 等）

- 新モードは `src/domain/modes/<mode>/` にロジックを追加し、既存サービスを再利用する
- 「極モード」の常用外辞書は **別アセット**（`public/data/joyo-plus.json` 等）として遅延ロードし、初期バンドル・初期辞書を太らせない（architecture 7.1）

### 6.2 Phase2（ランキング）・ネイティブ化

- ランキングは `src/data/` に薄い `RankingApiRepository.ts` を**後付け**（ドメイン層は無変更）
- ネイティブ化（Capacitor）時は `src/` を再利用。ネイティブ固有コードは `src/platform/`（新設）に隔離する

### 6.3 ファイルサイズの目安

- 1ファイル300行以下推奨。300〜500行でリファクタ検討、500行超で分割を強く推奨
- 演出（`particleField.ts`）が肥大化したら効果種別ごとに分割

---

## 7. 特殊ディレクトリ

### 7.1 .steering/
作業単位ドキュメント。`[YYYYMMDD]-[task-name]/` に `requirements.md` / `design.md` / `tasklist.md`（CLAUDE.md準拠）。**gitignore 対象**。

### 7.2 .claude/
Claude Code 設定（`commands/` `skills/` `agents/`）。リポジトリにコミットしチームで共有。

### 7.3 data-sources/
KANJIDIC2/KRADFILE 元データと出典・ライセンス。CC BY-SA 4.0 遵守の起点。バージョンを README に固定記載し、ビルド再現性を担保。

---

## 8. 除外設定

### 8.1 .gitignore
```
node_modules/
dist/
coverage/
.steering/
*.log
.DS_Store
.env*
dev-dist/        # vite-plugin-pwa の開発時SW生成物
```
- `public/data/*.json` は**生成物だが git 管理する**（ビルド再現性・CDN配信のため）。再生成は `scripts/build-data/` で可能
- `data-sources/` の元データ（KANJIDIC2/KRADFILE）は **git 管理する**（ビルド再現性のため）。容量が問題化した場合のみ `data-sources/README.md` の取得手順に切替え、git管理外にする（その際だけ `.gitignore` に追加）
- PWA本番SW（`sw.js`/`workbox-*.js`）は `dist/` 配下に生成されるため `dist/` 除外でカバーされる

### 8.2 整形・lintの除外

- **Prettier**：`.prettierignore` に下記を指定
- **ESLint v9（flat config）**：専用の `.eslintignore` は非推奨。`eslint.config.js` の `ignores` フィールドに同等パターンを指定する

```
dist/
node_modules/
coverage/
public/data/        # 生成JSON（整形・lint対象外）
.steering/
```

---

## 9. ライセンス・データ取り扱い（重要）

| 対象 | ライセンス | 配置 |
|---|---|---|
| アプリ本体コード（`src/`） | プロプライエタリ可 | `LICENSE` |
| 辞書元データ（KANJIDIC2/KRADFILE） | CC BY-SA 4.0 | `data-sources/LICENSE-EDRDG.txt` |
| 生成物（`public/data/*.json`・自作合体辞書を含む） | **CC BY-SA 4.0 継承** | `public/data/LICENSE.txt` |

- アプリ内About画面のクレジット表記（PRD F10）と、リポジトリ内のライセンスファイルを**二重で整備**する
- 生成物は改変データに該当するため、SA（継承）義務によりCC BY-SAで提供する（整理書5.2）
