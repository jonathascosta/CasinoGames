import { EngineError } from './errors.ts';
import { isCents, winnings, type Cents, type Odds } from './money.ts';

/** The sign of a bet's net result. */
export type Outcome = 'win' | 'lose' | 'push';

/**
 * How one bet ended. `payout` is everything handed back to the player, stake
 * included: 0 on a loss, the stake on a push, stake + winnings on a win. A
 * fee charged against the bet during the round (a re-roll, say) is never
 * returned. RTP is therefore Σ (payout − fee) ÷ Σ stake.
 */
export interface SettlementLine {
  readonly stake: Cents;
  readonly payout: Cents;
  /** Fees charged against the bet during the round; present only when there were any. */
  readonly fee?: Cents;
  /** payout − stake − fee: what the bet made or cost the player. */
  readonly net: Cents;
  readonly outcome: Outcome;
  /** The paytable entry that decided the bet, when there is one. */
  readonly entryId?: string;
}

/** Settlement lines per bet id. */
export type Settlement = Readonly<Record<string, SettlementLine>>;

const outcomeOf = (net: Cents): Outcome => (net > 0 ? 'win' : net < 0 ? 'lose' : 'push');

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
  const outcome = outcomeOf(net);
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

/**
 * The line with `fee` charged against it: the net and the outcome take the
 * fee into account, so a bet that wins less than its fee is a loss. A zero
 * fee returns the line unchanged.
 */
export function withFee(line: SettlementLine, fee: Cents): SettlementLine {
  if (!isCents(fee) || fee < 0) {
    throw new EngineError('INVALID_STAKE', `A fee must be a non-negative integer of cents`);
  }
  if (line.fee !== undefined) {
    throw new EngineError('INVALID_STAKE', 'This line already carries its fee');
  }
  if (fee === 0) return line;
  const net = line.net - fee;
  return { ...line, fee, net, outcome: outcomeOf(net) };
}

export interface SettlementTotals {
  readonly stake: Cents;
  readonly payout: Cents;
  readonly fee: Cents;
  /** payout − stake − fee. */
  readonly net: Cents;
}

export function settlementTotals(settlement: Settlement): SettlementTotals {
  let stake = 0;
  let payout = 0;
  let fee = 0;
  for (const betId in settlement) {
    const line = settlement[betId]!;
    stake += line.stake;
    payout += line.payout;
    fee += line.fee ?? 0;
  }
  return { stake, payout, fee, net: payout - stake - fee };
}
