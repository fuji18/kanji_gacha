# ゲーム画面：ビジュアルモック生成＆UI/UX改善プロンプト

漢字合体ガチャのゲーム画面を「流行りのモバイルゲームUI × 和風」で刷新するためのプロンプト集。

- **パート1**：生成AIにビジュアルモック（1枚絵）を描かせる画像生成プロンプト
- **パート2**：快適にプレイするための UI/UX 改善を提案・実装させるプロンプト

> 当ゲームの実要素（山札・手札の部品札・合体・段階ヒント・学習カード・おみくじ巻物ガチャ・
> 残り時間バー）とブランド配色（朱/藍/金/和紙/墨）・既存トークンに紐付けてある。

---

## 共通：ブランド・前提

| 要素 | 値 |
|---|---|
| 和紙（base/surface） | `#F5F1E6` |
| 墨（text/on-surface） | `#2B2B2B` |
| 朱（primary accent） | `#C0392B` |
| 藍（secondary） | `#2C3E6B` |
| 金（highlight） | `#B8860B` / `#D4AF37` |
| 見出しフォント | 筆文字（Yuji Syuku 系） |
| 漢字フォント | 明朝系 |
| 端末 | モバイル縦持ち・片手操作前提（9:19.5 / 1080×2340） |
| 技術 | Vite + Svelte 5 + 既存 Material/和風トークン |

---

# パート1：ビジュアルモック生成プロンプト（画像生成）

画像モデルは漢字グリフを正確に描けない。**「文字は装飾扱い・レイアウト/質感重視」**を前提にする
（最終的な文字は実装で差し替え）。対象：Midjourney v6 / DALL·E 3 / Nano Banana / SDXL 等。

## ① 共通スタイルブロック（両シーンの先頭に置く）

```
Mobile game UI mockup, vertical phone screen, single screen, high-fidelity app design,
"wafu" modern Japanese aesthetic fused with trendy juicy mobile game UI.

Art direction: washi rice-paper background texture with subtle fibers, sumi-e ink-brush
accents, delicate gold-leaf (kintsugi) details, faint asanoha and seigaiha patterns,
a small vermilion hanko seal as accent. Clean spacious bento-card layout, large rounded
tactile buttons, soft layered drop shadows, gentle glow, light glassmorphism, polished
and premium, satisfying "juicy" feel. Subtle floating particles: gold sparkles and a few
sakura petals, faint ink splash bursts.

Color palette (strict): washi paper #F5F1E6 base, sumi ink #2B2B2B text, vermilion
#C0392B primary accent, indigo #2C3E6B secondary, gold #B8860B and #D4AF37 highlights.
Typography vibe: brush-calligraphy display headings, elegant mincho for kanji.
Japanese kanji rendered as decorative ink-brush glyph shapes (not required to be legible).

Layout: top status bar (HUD), central play stage, a horizontal tray of cards near the
bottom, large action buttons at the very bottom. crisp, uncluttered, 4k, soft studio
lighting, dribbble / behance quality UI concept.
```

## ② シーンA — 達成型（山札・収集・学習）

```
[共通スタイルブロック] +

Scene: a kanji-combining puzzle game in "deck" study mode.
- Top HUD: a stack-of-cards icon with remaining count, a progress bar (collection rate)
  with gold fill, a score number with a glowing combo meter, tiny toggle icons
  (furigana, large text, sound).
- Center stage: two ink-brush kanji-part cards merging into one new kanji, glowing seam of
  gold light where they fuse, ink-splash burst. A small floating "learning card" panel
  shows the new kanji big with reading, meaning and animated stroke-order lines.
- Bottom tray: a horizontal row of washi part cards (rounded paper tiles with brush
  radicals), one card has a gold rare-glow aura.
- Bottom actions: a big primary button shaped like a rolled "emakimono" scroll labeled
  GACHA, a secondary "redraw" button, a softly glowing "hint" lantern button.
Calm, focused, learning-friendly mood, warm washi tones.
--ar 9:20 --style raw
```

## ③ シーンB — タイムアタック（緊張感・スピード）

```
[共通スタイルブロック] +

Scene: same game in fast "time-attack" mode, energetic and tense.
- Top: a large draining countdown time bar gradient vermilion #C0392B to gold #D4AF37,
  big bold timer, an oversized COMBO counter with gold flame/ink-flare flourish, rising
  score popping with "+score" gold numerals.
- Center stage: rapid kanji-part fusion with motion energy — dynamic sumi ink speed-streaks,
  gold spark trails, a satisfying impact flash as a new kanji forms.
- Bottom tray: horizontal row of washi part cards mid-shuffle, slight motion blur.
- Bottom action: a single bold unlimited "emakimono scroll" GACHA button pulsing with glow.
High-energy but still elegant wafu, indigo #2C3E6B night-washi background accent,
dramatic gold rim light, particles and ink bursts.
--ar 9:20 --style raw
```

## ④ ネガティブプロンプト（SDXL等）

```
photorealistic photo, real people, hands, cluttered UI, tiny unreadable text everywhere,
western medieval fantasy, neon cyberpunk, garish saturated colors, low contrast, blurry,
watermark, logo text in latin gibberish, 3D render of physical objects, skeuomorphic wood,
flat boring corporate UI, distorted broken layout
```

### 微調整
- もっと「流行り」→ `bold oversized typography, vibrant accent pops, micro-interaction glow, TikTok-era casual game polish`
- もっと渋い和風 → `muted, restrained, tea-ceremony elegance, more negative space`、金を減らす

---

# パート2：UI/UX改善プロンプト（快適なプレイのための変更）

ビジュアルだけでなく**操作の快適さ**を上げるためのプロンプト。設計レビュー＋実装提案を
出させる用途（Claude / v0 / コーディングAI 向け）。

## ② 改善プロンプト本体（そのまま貼って使う）

```
あなたはモバイルカジュアル学習ゲームの UX デザイナー兼フロントエンド実装者です。
対象は「漢字合体ガチャ」（Vite + Svelte 5、和風×Material、縦持ち・片手操作前提の
静的Webゲーム）。目的は **「ストレスなく、サクサク気持ちよく遊べる」体験への改善**。
見た目の刷新ではなく、操作の快適さ・分かりやすさ・手応えを上げる変更を提案・実装してください。

## 守る前提
- 既存のブランドトークン（朱/藍/金/和紙/墨・筆文字/明朝）と配色を踏襲する
- 外部依存を増やさない。パフォーマンス（初回表示・操作応答）を劣化させない
- 既存のアクセシビリティ設定（ふりがな・文字拡大・読み上げ）を尊重・強化する
- ui→app→domain/data の依存方向と既存コンポーネント構成を壊さない

## 快適さの評価軸（この観点で現状を診断し、改善案を出す）
1. 親指リーチ：主要操作（ガチャ・合体・ヒント・引き直し）が画面下部の到達しやすい位置にあるか
2. タップ標的：主要ボタンは最小 48x48px、誤タップしない間隔があるか
3. 即時フィードバック：タップ後 100ms 以内に視覚/触覚/音の反応があるか（合体成功・ミス・重複）
4. アニメーション：150–300ms・自然なイージング、過剰演出はスキップ/短縮できるか
5. レイアウト安定：手札増減・カード出現で画面がガタつかない（CLS=0、高さ予約）
6. 状態の明確さ：山札残り・残り時間・収集率・コンボが一目で分かるか
7. エラー寛容：重複合体や不成立を「失敗」でなく軽い気づき（例：もう作ったよ）として返すか
8. 導線の短さ：1プレイ 1〜2 分のループで無駄タップ・待ちが無いか
9. 可読性：本文/数字のコントラスト（WCAG AA）、文字拡大時も崩れないか
10. モーション配慮：prefers-reduced-motion を尊重しているか
11. セーフエリア：ノッチ/ホームインジケータ（env(safe-area-inset-*)）を考慮しているか
12. 待ち時間マスキング：ガチャ/データ読み込みの体感待ちを演出で隠せているか

## 出力フォーマット
1. 現状診断：上記12軸ごとに「良/要改善」と根拠（具体的なコンポーネント名・箇所）
2. 改善提案：効果が高く実装が軽い順に並べ、各項目に
   - 何を・なぜ（快適さへの効果）・どのコンポーネントを・どう変えるか
   - Before/After を一言で
3. 即実装できる Top3 を Svelte/CSS の具体差分（パッチ）として提示
4. 計測方法：改善を検証する観点（タップ数・操作応答・体感）

まず現状診断から始め、推測が要る箇所は仮定を明示してください。
```

## ③ 軽量版（クイック監査だけ欲しいとき）

```
「漢字合体ガチャ」のゲーム画面を片手モバイルプレイの快適さ観点で監査し、
「親指リーチ／タップ標的48px／即時フィードバック／レイアウト安定／可読性／
reduced-motion／セーフエリア」の7点について、要改善箇所と最小修正案を
効果順に5件、各1〜2行で挙げてください。既存の和風トークンは踏襲します。
```

---

## 当ゲーム固有メモ（プロンプトに足せる文脈）

- 主な画面：`src/ui/screens/GameScreen.svelte`（手札 `PartChip`、`GachaButton`＝おみくじ巻物
  `EmakimonoReveal`、`HintButton` 段階ヒント、学習カード `StrokeKanji`＋`SpeakButton`、
  達成型の山札/収集率、タイムアタックの `TimeBar`／コンボ）。
- 既存設定：ふりがな（T-031）・文字拡大（T-037）・読み上げ（T-032）。
- 制約：重複漢字は作れない（軽い「もう作ったよ」表示）、引き直しは部品を山札に戻す。
- 1プレイ 1〜2 分でサクサク進む手応えが狙い（タイムアタックは T-027）。
