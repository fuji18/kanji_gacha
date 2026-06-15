# T-028: レベル再編（小学生モードの学年分割・大人モード・名称変更）

| 項目 | 値 |
|---|---|
| フェーズ | Phase 7（レベル・学習拡張） |
| 優先度 | P1 |
| 依存 | T-027（gameMode）/ レベル設計ドキュメント §0 |
| 関連 | docs/ideas/レベル設計と学習機能.md §0 |

## 目的
モード表記を学習対象が分かる名称に変え、小学生モードを学年で細分できるようにする。
- やさしい → **小学生モード**（小1〜小6＋全学年）
- ふつう → **大人モード**（小学生漢字以外のすべて＝KANJIDIC2 grade 8・約1,130字）
- タイムアタックは常用すべて（変更なし）

## スコープ（実装する）
- **データ再生成**：`scripts/build-data/generate.ts` の出力に `grade`（1–6 / 8）を含める。
  `data-sources/kanjidic2-joyo.json` に grade は存在。`public/data/kanji.json` を再生成。
- `domain/types.ts`：`KanjiEntry.grade` を追加。
- `data/DictionaryRepository`：`deckTargetKanji` / `buildDeck` を **grade フィルタ対応**に拡張
  （小学生モードは grade∈{選択学年}、大人モードは grade==8）。
- UI：HomeScreen を「小学生モード → 学年（小1〜小6＋全学年の7択）／大人モード」の導線に。
  モード名称・ラベルを変更。
- ResultScreen 等の表示ラベルを新名称へ。

## 受け入れ条件
- [ ] `kanji.json` が grade を持ち、学年別に対象漢字を取得できる
- [ ] 小学生モードで学年（小1〜小6・全学年）を選んで開始できる
- [ ] 大人モードが「小学生以外すべて（grade8）」の山札になる
- [ ] 既存のタイムアタック（常用）は不変
- [ ] lint / typecheck / unit / build / E2E すべて成功

## スコープ外
- 出題数選択・重複禁止・引き直し返却（T-029）
- 中学の中1〜中3分割（公式基準が無いため非対応）

## テスト
- 単体：DictionaryRepository の grade フィルタ（学年別 deckTargetKanji/buildDeck）
- E2E：小学生モード→学年選択→開始、大人モード開始

## 完了の定義 (DoD)
- [ ] 上記受け入れ条件を満たし、全品質ゲート成功
