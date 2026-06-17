# T-051: プラットフォームレジストリ登録（kanji-gattai）

| 項目 | 値 |
|---|---|
| フェーズ | Phase 8 |
| 優先度 | P0 |
| 依存 | T-049, T-050 |
| 関連 | fujioha_platform `apps/game/src/content/{config.ts,games/*.json}` |

## 背景
ハブ `apps/game` は `src/content/games/<id>.json` から `url` で各ゲームに外部リンクする。
当ゲームの枠は既に `kanji-drop.json`（`url:null`, `status:"draft"`, `tag:"wip"`）として存在するが、
id・サブドメインを **`kanji-gattai`（漢字合体）** に統一する方針。よって既存エントリを
リネームしたうえで実URL・published へ更新する **fujioha_platform 側のPR** が必要。

## 目的
ハブのゲーム一覧に当ゲームが「公開」カードとして表示され、クリックで遊べる状態にする。

## スコープ（fujioha_platform リポジトリへのPR）
- 既存 `apps/game/src/content/games/kanji-drop.json` を **`kanji-gattai.json` にリネーム**し、
  `id` を `"kanji-gattai"` に変更（ファイル名と id を一致させる）。
- 内容を更新:
  `url:"https://kanji-gattai.fujioha.com"`、`status:"published"`、`tag:null`（または `"new"`）、
  `publishedAt`（公開日 YYYY-MM-DD）、`time`、`genre/genreEn`、`hue`、`image:"/games/kanji-gattai.png"` を設定。
- カタログ用サムネ `apps/game/public/games/kanji-gattai.png` を追加（旧 `kanji-drop.png` があれば置換/削除）。
- 命名統一の確認: レジストリ id・サブドメイン・(可能なら)リポジトリ名を `kanji-gattai` で一致させる。
- `apps/game` で `npm run typecheck`（zod スキーマ検証）が通ること。

## 受け入れ条件
- [ ] `kanji-gattai.json`（id=`kanji-gattai`）が `status:"published"` かつ実 `url` を持つ
- [ ] 旧 `kanji-drop.json` が残っていない
- [ ] サムネ画像が追加され、カードに表示される
- [ ] `npm run typecheck` がスキーマ検証を通過
- [ ] ハブ一覧に当ゲームのカードが表示され、新規タブ(noopener)で開く

## スコープ外
- 当ゲーム本体の実装（T-049/T-050 で完了している前提）

## テスト
- ハブをローカルビルドし、カード表示とリンク先を目視確認

## 完了の定義 (DoD)
- [ ] fujioha_platform にPRがマージされ、ハブ本番にカードが出てプレイ導線が通る
