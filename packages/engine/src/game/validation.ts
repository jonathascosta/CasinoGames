import { EngineError } from './errors.ts';
import { isCents, type Cents } from './money.ts';
import type { BetDefinition, BetId, Bets } from './types.ts';

interface DefinitionIndex {
  readonly byId: ReadonlyMap<BetId, BetDefinition>;
  readonly hasMainBets: boolean;
}

/** Built once per definitions array: validation runs on every round. */
const indexes = new WeakMap<readonly BetDefinition[], DefinitionIndex>();

/**
 * Results for frozen bet maps, which cannot change. A simulation validates
 * the same map every round, so it freezes it once and validation is free.
 */
const frozenResults = new WeakMap<readonly BetDefinition[], WeakMap<Bets, Bets>>();

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
 * bet, as at a real table). The result is a new object; for a frozen bet map
 * it is a frozen object computed once.
 */
export function validateBets(definitions: readonly BetDefinition[], bets: Bets): Bets {
  if (!Object.isFrozen(bets)) return check(definitions, bets);
  let results = frozenResults.get(definitions);
  if (results === undefined) frozenResults.set(definitions, (results = new WeakMap()));
  let placed = results.get(bets);
  if (placed === undefined) results.set(bets, (placed = Object.freeze(check(definitions, bets))));
  return placed;
}

function check(definitions: readonly BetDefinition[], bets: Bets): Record<BetId, Cents> {
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
    let total = 0;
    for (const entry of bet.paytable) {
      if (entry.probability === undefined) continue;
      if (!(entry.probability > 0 && entry.probability <= 1)) {
        throw new TypeError(`${where}: entry "${entry.id}" probability must be in (0, 1]`);
      }
      total += entry.probability;
    }
    if (total > 1 + 1e-9) {
      throw new TypeError(`${where}: entry probabilities add up to more than 1`);
    }
    checkConditions(where, bet);
    checkProgressive(where, bet);
    const shoe = bet.finiteShoe;
    if (
      shoe !== undefined &&
      !(shoe.rtp > 0 && shoe.rtp < 2 && shoe.hitFrequency > 0 && shoe.hitFrequency <= 1)
    ) {
      throw new TypeError(`${where}: implausible finite-shoe figures`);
    }
  }
  return definitions;
}

/**
 * A progressive bet (BetDefinition.progressive): one fixed-odds line pays
 * its meter, a stake up to the table maximum wins at most the whole meter,
 * and the declared RTP is the fixed pays' RTP plus the contribution rate.
 */
function checkProgressive(where: string, bet: BetDefinition): void {
  const terms = bet.progressive;
  if (terms === undefined) return;
  const lines = bet.paytable.filter(
    (entry) => 'jackpot' in entry && entry.jackpot.jackpotId === terms.jackpotId,
  );
  const [line] = lines;
  if (line === undefined || lines.length !== 1 || !('odds' in line)) {
    throw new TypeError(
      `${where}: exactly one fixed-odds line must pay the ${terms.jackpotId} meter`,
    );
  }
  if (line.jackpot?.fullShareStake !== terms.fullShareStake) {
    throw new TypeError(`${where}: the line and the terms disagree on the full-share stake`);
  }
  if (!Number.isSafeInteger(terms.fullShareStake) || terms.fullShareStake < bet.max) {
    throw new TypeError(
      `${where}: the full-share stake must be integer cents, at least the maximum`,
    );
  }
  if (!Number.isSafeInteger(terms.seed) || terms.seed < 0) {
    throw new TypeError(`${where}: the seed must be integer cents`);
  }
  if (!(terms.contributionRate >= 0 && terms.contributionRate < 1)) {
    throw new TypeError(`${where}: the contribution rate must be in [0, 1)`);
  }
  if (!(terms.hitProbability > 0 && terms.hitProbability <= 1)) {
    throw new TypeError(`${where}: the hit probability must be in (0, 1]`);
  }
  if (line.probability !== undefined && line.probability !== terms.hitProbability) {
    throw new TypeError(`${where}: the line and the terms disagree on the hit probability`);
  }
  if (Math.abs(bet.rtp - (terms.fixedRtp + terms.contributionRate)) > 1e-12) {
    throw new TypeError(`${where}: the RTP must be the fixed pays' RTP plus the contribution rate`);
  }
}

/**
 * Lines paid under a condition (PaytableEntry.given): all of a bet's lines or
 * none name one, with a single name, a plausible chance that is the same for
 * lines sharing a value, and line probabilities that fit inside it.
 */
function checkConditions(where: string, bet: BetDefinition): void {
  const given = bet.paytable.filter((entry) => entry.given !== undefined);
  if (given.length === 0) return;
  if (given.length !== bet.paytable.length) {
    throw new TypeError(`${where}: either every paytable line names its condition or none does`);
  }
  const name = bet.paytable[0]?.given?.name ?? '';
  const values = new Map<string, { probability: number; lines: number }>();
  for (const entry of bet.paytable) {
    const condition = entry.given!;
    const line = `${where}: entry "${entry.id}"`;
    if (condition.name === '' || condition.name !== name) {
      throw new TypeError(`${line}: every line of a bet names the same condition`);
    }
    if (!(condition.probability > 0 && condition.probability <= 1)) {
      throw new TypeError(`${line}: the condition's probability must be in (0, 1]`);
    }
    const value = values.get(condition.value) ?? { probability: condition.probability, lines: 0 };
    if (value.probability !== condition.probability) {
      throw new TypeError(`${line}: lines under ${name} ${condition.value} disagree on its chance`);
    }
    value.lines += entry.probability ?? 0;
    if (value.lines > condition.probability + 1e-12) {
      throw new TypeError(`${line}: more likely than ${name} ${condition.value} itself`);
    }
    values.set(condition.value, value);
  }
  let total = 0;
  for (const { probability } of values.values()) total += probability;
  if (total > 1 + 1e-9) {
    throw new TypeError(`${where}: the chances of the ${name} values add up to more than 1`);
  }
}
