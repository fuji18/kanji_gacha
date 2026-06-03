# T-003: データ生成パイプライン

| 項目 | 値 |
|---|---|
| フェーズ | Phase 0 |
| 優先度 | P0 |
| 依存 | — |
| 関連 | PRD F2 / 機能設計 8.1 / repository-structure 2.5,9 |

## 目的
KANJIDIC2 + KRADFILE から、実行時に使う3つのJSON辞書を生成する。

## スコープ（実装する）
- `data-sources/` に元データ配置＋出典・バージョン・ライセンス原本（CC BY-SA 4.0）と `README.md`
- `scripts/build-data/generate.ts`：
  - KRADFILEから部品分解、**分解深さ1段階に統一**、部品idへ正規化
  - 部品idマルチセットを昇順ソートして `CombineKey` 生成、複数解は `results` に集約
  - KANJIDIC2で `strokes`/`readings`/`meanings`/`level`/`freqRank` を突合
  - `selectPrimary`（T-007のドメイン関数を再利用）で `primary` 確定
  - **常用漢字2,136字まで**に絞り込み
- 出力：`public/data/{parts.json,kanji.json,combine-dict.json}` ＋ `public/data/LICENSE.txt`（生成物のCC BY-SA表記）
- `npm run gen:data`（`tsx --tsconfig tsconfig.scripts.json`）

## 受け入れ条件
- [x] 3つのJSONが生成され、圧縮後合計 約100KB以内（実測 gzip 約91KB）
- [x] `combine-dict.json` のkeyが配置不問で正規化されている（例 `木+木`→林）
- [x] 複数解が `results` 配列で保持される（16件・例 `⻌+豕`→逐/遂）
- [x] 常用外の漢字が含まれない（results/primary ⊆ kanji.json をテストで保証）
- [x] `public/data/LICENSE.txt` にCC BY-SA表記がある

## スコープ外
- 到達可能N・MAX_PARTS・詰み率の検証（T-004）

## テスト
- 既知の合体（林・明・好・詩・樹）が辞書に存在することのアサート

## 完了の定義 (DoD)
- [x] `npm run gen:data` で再現可能に生成、ライセンス整備

## 補足（元データの代替）
機能設計は KANJIDIC2 + KRADFILE を想定するが、ビルド/CI 環境のネットワーク
許可リストで edrdg.org が遮断されているため、同等の CC BY-SA データ（KANJIDIC2
由来の漢字情報 ＋ KRADFILE 代替の **KanjiVG** 分解）を `data-sources/` に蒸留して
同梱し、オフラインで再現生成する構成とした。詳細は `data-sources/README.md`。
