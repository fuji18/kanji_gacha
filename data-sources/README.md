# data-sources/ — 辞書生成の元データ

`scripts/build-data/generate.ts`（`npm run gen:data`）の入力。ここから
`public/data/*.json`（配信アセット）を**再現可能に**生成する。
本ディレクトリはライセンス遵守の起点（repository-structure 9 章）。

## 収録ファイル

| ファイル              | 由来                     | バージョン | ライセンス   | 内容                                                        |
| --------------------- | ------------------------ | ---------- | ------------ | ----------------------------------------------------------- |
| `kanjidic2-joyo.json` | KANJIDIC2 (EDRDG)        | 2024 系列  | CC BY-SA 4.0 | 常用漢字2,136字の `char/strokes/grade/freq/on/kun/meanings` |
| `kanjivg-decomp.json` | KanjiVG (Ulrich Apel ら) | 2024 系列  | CC BY-SA 3.0 | 漢字→部品分解（**深さ1段階に正規化済み**）                  |

ライセンス原本：

- `LICENSE-EDRDG.txt` … KANJIDIC2 / KRADFILE（EDRDG）
- `LICENSE-KANJIVG.txt` … KanjiVG

## 重要：本家配布元の代替について

機能設計 8.1 は **KANJIDIC2 + KRADFILE**（いずれも edrdg.org 配布・CC BY-SA）を
元データとして想定している。しかし本リポジトリのビルド/CI 実行環境では、
ネットワーク許可リストにより **edrdg.org への直接アクセスが遮断**されている。

そのため、入手可能で**同等のライセンス（CC BY-SA）系**データを採用した：

- **漢字情報**：KANJIDIC2 由来（読み・意味・画数・学年・頻度）。
- **部品分解**：KRADFILE の代替として **KanjiVG** の合体ツリーを採用。
  各漢字について、`element` を持つ最浅ノード境界まで展開して
  **深さ1段階**（直接部品のみ）の部品リストに正規化している（機能設計 8.1 手順2）。

両者とも CC BY-SA であり、生成物（`public/data/*.json`）は SA 継承により
CC BY-SA 4.0 で提供する（`public/data/LICENSE.txt`）。

## 再生成の手順（オフライン）

```bash
npm run gen:data   # data-sources/*.json -> public/data/*.json + LICENSE.txt
```

## 元データの更新（オンライン環境でのみ）

蒸留済みの本ファイルは、上流の KANJIDIC2 / KanjiVG から下記の方針で抽出している
（実行には edrdg.org / KanjiVG への到達が必要なため、許可リストのある環境で行う）：

1. 常用漢字 = KANJIDIC2 の grade ∈ {1..6, 8}（計2,136字）に限定。
2. 各漢字の読み・意味・画数・頻度（freq）を抽出（KANJIDIC2 由来フィールドのみ）。
3. KanjiVG の分解ツリーを、`element` 境界まで展開した深さ1段階の部品リストへ正規化。

> 蒸留済み JSON をコミットしておくことで、ネットワーク非依存で `gen:data` を
> 再現できる（CI のオフライン実行・ビルド再現性の担保）。
