import { EngineError } from './errors.ts';
import { isCents, winnings, type Cents, type Odds } from './money.ts';

/** The sign of a bet's net result. */
export type Outcome = 'win' | 'lose' | 'push';

/**
 * How one bet ended. `payout` is everything handed back to the player, stake
 * included: 0 on a loss, the stake on a push, stake + winnings on a win. RTP
 * is therefore Σ payout ÷ Σ stake.
 */
export interface SettlementLine {
  readonly stake: Cents;
  readonly payout: Cents;
  /** payout − stake. */
  readonly net: Cents;
  readonly outcome: Outcome;
  /** The paytable entry that decided the bet, when there is one. */
  readonly entryId?: string;
}

/** Settlement lines per bet id. */
export type Settlement = Readonly<Record<string, SettlementLine>>;

/**
 * The general case: the bet returns `payout` in total. The outcome is derived
 * from the net, so a surrender returning half the stake is a (partial) loss.
 */
export function settleWithPayout(stake: Cents, payout: Cents, entryId?: string): SettlementLine {
  if (!isCents(stake) || stake <= 0) {
    throw new EngineError(
      'INVALID_STAKE',
      `Stake must be a positive integer of cents, got ${stake}`,
    );
  }
  if (!isCents(payout) || payout < 0) {
    throw new EngineError(
      'INVALID_STAKE',
      `Payout must be a non-negative integer of cents, got ${payout}`,
    );
  }
  const net = payout - stake;
  const outcome: Outcome = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
  return entryId === undefined
    ? { stake, payout, net, outcome }
    : { stake, payout, net, outcome, entryId };
}

/** A win at fixed odds: the stake plus winnings (breakage rounded down). */
export function settleWin(stake: Cents, odds: Odds, entryId?: string): SettlementLine {
  return settleWithPayout(stake, stake + winnings(stake, odds), entryId);
}

export function settleLoss(stake: Cents, entryId?: string): SettlementLine {
  return settleWithPayout(stake, 0, entryId);
}

export function settlePush(stake: Cents, entryId?: string): SettlementLine {
  return settleWithPayout(stake, stake, entryId);
}

export interface SettlementTotals {
  readonly stake: Cents;
  readonly payout: Cents;
  readonly net: Cents;
}

export function settlementTotals(settlement: Settlement): SettlementTotals {
  let stake = 0;
  let payout = 0;
  for (const line of Object.values(settlement)) {
    stake += line.stake;
    payout += line.payout;
  }
  return { stake, payout, net: payout - stake };
}
