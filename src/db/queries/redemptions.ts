import { db } from "../client";
import { getDrink } from "../../lib/drinks";
import { getUserNet } from "./ledger";

export type RedemptionRow = {
  id: number;
  drink: string;
  qty: number;
  unit_cost: number;
  cost: number;
  created_at: number;
};

/** Float tolerance — credits can be fractional (e.g. 1.5), so a balance that is
 *  cost-exact can land a hair below cost after summation. */
const EPSILON = 1e-9;

export function getUserRedeemed(userId: number): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(cost), 0) AS spent FROM redemptions WHERE user_id = ?")
    .get(userId) as { spent: number };
  return row.spent;
}

export function getUserRedemptions(userId: number): RedemptionRow[] {
  return db
    .prepare(
      `SELECT id, drink, qty, unit_cost, cost, created_at
       FROM redemptions WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(userId) as RedemptionRow[];
}

export type RedeemResult =
  | { ok: true; cost: number; balance: number }
  | { ok: false; error: string };

/** Redeem `qty` bottles of a drink, deducting credits from the available
 *  balance. Atomic: the balance is re-read inside the transaction so a stale
 *  client number can never overspend. */
export function redeemDrink(
  userId: number,
  drinkKey: string,
  qty: number,
): RedeemResult {
  const drink = getDrink(drinkKey);
  if (!drink) return { ok: false, error: "未知饮料" };
  if (!Number.isInteger(qty) || qty < 1) {
    return { ok: false, error: "兑换数量需为正整数" };
  }

  const cost = drink.cost * qty;
  const run = db.transaction((): RedeemResult => {
    const balance = getUserNet(userId);
    if (balance + EPSILON < cost) {
      return {
        ok: false,
        error: `可用额度不足（需 ${cost.toFixed(1)}，余 ${balance.toFixed(1)}）`,
      };
    }
    db.prepare(
      `INSERT INTO redemptions (user_id, drink, qty, unit_cost, cost, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(userId, drink.key, qty, drink.cost, cost, Date.now());
    return { ok: true, cost, balance: balance - cost };
  });
  return run();
}
