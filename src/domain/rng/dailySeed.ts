/**
 * 日付シード（機能設計4.6・F8）。日付を決定的PRNGのシードに変換し、サーバー無しで
 * 全プレイヤーに同一のデイリーを提供する。
 *
 * ドメイン純粋性のため `Date.now()` は呼ばず、現在時刻 `nowMs` は引数で注入する。
 */

import type { Level } from '../types';

/** JST のオフセット（UTC+9）をミリ秒で表したもの。 */
const JST_OFFSET_MS = 9 * 3600 * 1000;

/** 日替わりレベルの巡回順（包含順・易→難）。 */
const DAILY_LEVELS: Level[] = ['elementary', 'juniorhigh', 'joyo'];

/**
 * 現在時刻（epoch ミリ秒）を JST 基準の YYYYMMDD 文字列に変換する。
 * クライアントの locale / タイムゾーンに依存させないため、UTC 時刻に +9h して
 * `getUTC*` で読む（問題5）。日付の切り替わりは JST 0:00（= UTC 前日15:00）。
 *
 * @param nowMs 現在時刻（`Date.now()` 等で取得した epoch ミリ秒。呼び出し側が注入）
 * @returns 例 "20260603"
 */
export function todayYmdJst(nowMs: number): string {
  const jst = new Date(nowMs + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * YYYYMMDD 文字列を数値シードに変換する（例 "20260603" -> 20260603）。
 * 同一日付・同一シードなので、`mulberry32(dailySeed(...))` で全員同じ乱数列になる。
 *
 * @param dateYmd `todayYmdJst` が返す YYYYMMDD 文字列
 * @returns 10進整数のシード
 */
export function dailySeed(dateYmd: string): number {
  return parseInt(dateYmd, 10);
}

/**
 * 日付シードから「今日のお題」の対象レベルを決める（機能設計4.6・F8・暫定 `seed % 3`）。
 * 日付が変われば（JST 0:00 基準で seed が変わり）レベルも巡回する。全プレイヤー同一日付＝同一レベル。
 *
 * @param seed `dailySeed(...)` の整数シード
 * @returns その日の対象レベル
 */
export function dailyLevel(seed: number): Level {
  return DAILY_LEVELS[seed % DAILY_LEVELS.length];
}
