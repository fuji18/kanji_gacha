import type { GameSession, HandPart, Part, Rng } from '../types';
import { DISCARD_COST, HINT_COST } from '../constants';
import type { CombineService } from '../combine/CombineService';
import type { GachaService } from '../gacha/GachaService';

/**
 * 救済サービス（機能設計5.1・PRD F5）。最小限の救済2機能のみを提供する（旧3層救済は廃止）。
 *
 *  1. `useHint`        … レベル別コストを払ってヒント（合体可能な1組）を得る
 *  2. `discardAndDraw` … レベル別コストを払って手札1枚を捨て、補充ガチャを1回引く
 *
 * 純粋性（開発ガイドライン2.1）：乱数 `Rng` は `discardAndDraw` の引数で注入し、依存サービス・
 * 部品プール・補充部品の instanceId 採番はコンストラクタで注入する（`CombineService` が
 * dict/kanji を注入で受けるのと同じ DI パターン）。`Math.random()`/`Date.now()` を直書きしない。
 *
 * `GameSession` は**その場更新**する（`ScoreService` が `ScoreState` を更新する規約に合わせる）。
 * KPI 集計（`stats.hintUsed`/`discardUsed`）はオーケストレータ（T-014 SessionManager）の責務とし、
 * 本サービスは救済メカニクス（コスト・手札・補充）に専念して2機能に限定する。
 */
export class RescueService {
  /**
   * @param combine 合体判定サービス（`findHint` でヒント探索に使う）
   * @param gacha ガチャ抽選サービス（補充ガチャに使う）
   * @param pool セッションレベルの抽選母集合（全部品。scope 絞り込みは `gacha.draw` 内で行う）
   * @param newInstanceId 補充部品に与える手札内一意IDの採番器（純粋性のため注入）
   */
  constructor(
    private readonly combine: CombineService,
    private readonly gacha: GachaService,
    private readonly pool: Part[],
    private readonly newInstanceId: () => string
  ) {}

  /**
   * ヒント：レベル別コストを消費し、合体可能な1組を返す（機能設計5.1・PRD F5）。
   * コスト表は `HINT_COST`（やさ無料／ふつう ガチャ残-1／むず 利用不可）。
   *
   * 「実行できないときは消費もしない」を徹底する：
   *  - むずかしい（`HINT_COST=null`）は利用不可 → `null`（消費なし）
   *  - ガチャ残がコスト未満 → `null`（消費なし）
   *  - 合体可能な組が無い（詰み）→ `null`（価値の無いヒントに**課金しない**）
   *
   * @param s 現在のセッション（成功時のみ `gachaRemaining` をその場で減算）
   * @returns ヒントの部品組（`resolve` で成立を保証）。提供できない場合は `null`
   */
  useHint(s: GameSession): HandPart[] | null {
    const cost = HINT_COST[s.level];
    if (cost === null) return null; // むずかしい：利用不可
    if (s.gachaRemaining < cost) return null; // 残不足：実行不可

    const hint = this.combine.findHint(s.hand, s.level);
    if (hint === null) return null; // 合体可能な組が無い（詰み）→ 課金しない

    s.gachaRemaining -= cost;
    return hint;
  }

  /**
   * 捨てて引き直す（機能設計5.1・7.3・PRD F5）。指定の手札1枚を捨て、レベル別コストを
   * 消費して補充ガチャを1回引く。コスト表は `DISCARD_COST`（やさ0／ふつう-1／むず-2）。
   * 補充ガチャ自体は**通常のガチャ残を消費しない**（`gachaRemaining` の減算はコスト分のみ）。
   * 削除1・追加1で手札枚数は不変のため HAND_CAP には抵触しない。
   *
   * 「実行できないときは消費もしない」を徹底する：
   *  - `instanceId` が手札に無い → no-op（防御）
   *  - ガチャ残がコスト未満 → no-op（消費なし）
   *
   * @param s 現在のセッション（実行時に `hand`・`gachaRemaining` をその場で更新）
   * @param instanceId 捨てる手札部品の instanceId
   * @param rng 補充ガチャに使う乱数源（注入）
   */
  discardAndDraw(s: GameSession, instanceId: string, rng: Rng): void {
    const index = s.hand.findIndex((h) => h.instanceId === instanceId);
    if (index === -1) return; // 対象が手札に無い → no-op

    const cost = DISCARD_COST[s.level];
    if (s.gachaRemaining < cost) return; // 残不足：実行不可

    // 補充部品を先に確定する。pool 不整合で draw が例外を投げてもセッションを変更しない（原子性）。
    // rng は draw 呼び出し内で消費され splice 順とは独立なため、決定性（デイリー再現）は損なわれない。
    const part = this.gacha.draw(s.level, this.pool, rng);

    s.hand.splice(index, 1); // (1) 手札から1枚削除
    s.gachaRemaining -= cost; //    ＋コスト消費（通常ガチャ残は減らさない）
    s.hand.push({ instanceId: this.newInstanceId(), partId: part.id }); // (2) 補充
  }
}
