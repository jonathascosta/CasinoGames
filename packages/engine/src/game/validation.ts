import { EngineError } from './errors.ts';
import { isCents, type Cents } from './money.ts';
import type { BetDefinition, BetId, Bets } from './types.ts';

interface DefinitionIndex {
  readonly byId: ReadonlyMap<BetId, BetDefinition>;
  readonly hasMainBets: boolean;
}

/** Built once per definitions array: validation runs on every round. */
const indexes = new WeakMap<readonly BetDefinition[], DefinitionIndex>();

function indexOf(definitions: readonly BetDefinition[]): DefinitionIndex {
  let index = indexes.get(definitions);
  if (index === undefined) {
    index = {
      byId: new Map(definitions.map((definition) => [definition.id, definition])),
      hasMainBets: definitions.some((definition) => definition.kind === 'main'),
    };
    indexes.set(definitions, index);
  }
  return index;
}

/**
 * Checks a bet map against the game's definitions and returns only the
 * placed bets (zero stakes are dropped). Rules: every id is known, stakes are
 * integer cents within the table limits, at least one bet is placed and, if
 * the game has main bets, at least one of them is (side bets ride on a main
 * bet, as at a real table).
 */
export function validateBets(definitions: readonly BetDefinition[], bets: Bets): Bets {
  const { byId, hasMainBets } = indexOf(definitions);
  const placed: Record<BetId, Cents> = {};
  let count = 0;
  let mainPlaced = false;

  for (const betId of Object.keys(bets)) {
    const stake = bets[betId];
    const definition = byId.get(betId);
    if (definition === undefined) {
      throw new EngineError('UNKNOWN_BET', `Unknown bet "${betId}"`);
    }
    if (!isCents(stake) || stake < 0) {
      throw new EngineError('INVALID_STAKE', `Stake on "${betId}" must be integer cents ≥ 0`);
    }
    if (stake === 0) continue;
    if (stake < definition.min) {
      throw new EngineError('STAKE_BELOW_MIN', `"${betId}" minimum is ${definition.min}¢`);
    }
    if (stake > definition.max) {
      throw new EngineError('STAKE_ABOVE_MAX', `"${betId}" maximum is ${definition.max}¢`);
    }
    placed[betId] = stake;
    count++;
    if (definition.kind === 'main') mainPlaced = true;
  }

  if (count === 0) throw new EngineError('NO_BETS', 'No bets placed');
  if (hasMainBets && !mainPlaced) {
    throw new EngineError('MAIN_BET_REQUIRED', 'Side bets require a main bet');
  }
  return placed;
}

/**
 * Validates a game's bet definitions once, at module load, so a
 * misconfigured paytable fails fast instead of mid-round.
 */
export function defineBets<const T extends readonly BetDefinition[]>(definitions: T): T {
  const ids = new Set<string>();
  for (const bet of definitions) {
    const where = `Bet "${bet.id}"`;
    if (bet.id === '' || ids.has(bet.id)) throw new TypeError(`${where}: id must be unique`);
    ids.add(bet.id);
    if (!isCents(bet.min) || bet.min < 1 || !isCents(bet.max) || bet.max < bet.min) {
      throw new TypeError(`${where}: limits must be integer cents with 1 ≤ min ≤ max`);
    }
    if (!(bet.rtp > 0 && bet.rtp < 2)) throw new TypeError(`${where}: implausible RTP ${bet.rtp}`);
    if (bet.standardDeviation !== undefined && !(bet.standardDeviation > 0)) {
      throw new TypeError(`${where}: standardDeviation must be positive`);
    }
    const entryIds = new Set(bet.paytable.map((entry) => entry.id));
    if (bet.paytable.length === 0 || entryIds.size !== bet.paytable.length) {
      throw new TypeError(`${where}: paytable entries must be present with unique ids`);
    }
  }
  return definitions;
}
