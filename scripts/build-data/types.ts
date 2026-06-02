/**
 * ビルド時データ生成・検証で用いる型定義（機能設計 3.1 のミラー）。
 *
 * ドメイン型（T-005）が未着手のため、ビルド側に自己完結の型を置く。
 * T-005 着手時に `src/domain/` の正式な型へ統合する前提（重複を一時的に許容）。
 */

/** レアリティ（★1〜★5） */
export type Rarity = 1 | 2 | 3 | 4 | 5;

/** 学年区分（包含関係 elementary ⊆ juniorhigh ⊆ joyo） */
export type Level = 'elementary' | 'juniorhigh' | 'joyo';

/** 部品マスタ（parts.json） */
export interface Part {
  /** 部品ID（本実装では表示文字をそのまま採用） */
  id: string;
  /** 表示文字（例: "木", "口"） */
  char: string;
  /** レアリティ */
  rarity: Rarity;
  /** 属するプール（汎用度の指標も兼ねる） */
  scopes: Level[];
  /** プール内サンプリング重み（床保証の素案・機能設計 4.3） */
  weight: number;
}

/** 漢字マスタ（kanji.json） */
export interface KanjiEntry {
  /** 漢字（例: "詩"） */
  char: string;
  /** 画数（スコア基礎点） */
  strokes: number;
  /** 読み（音・訓） */
  readings: string[];
  /** 意味（1行表示用） */
  meanings: string[];
  /** 学年区分 */
  level: Level;
  /** 頻度順位（低いほど一般的・代表解の選定に使用） */
  freqRank?: number;
}

/** 合体キー：構成部品idを昇順ソートして "+" 連結（配置不問・重複可のマルチセット） */
export type CombineKey = string;

/** 合体辞書エントリ（combine-dict.json） */
export interface CombineEntry {
  /** 正規化済みの部品キー */
  key: CombineKey;
  /** 成立する漢字（複数解。char 参照） */
  results: string[];
  /** 代表解（複数解時に優先表示・採点する1字） */
  primary: string;
  /** 構成部品数（詰み判定の探索上限算出に使用） */
  partCount: number;
}
