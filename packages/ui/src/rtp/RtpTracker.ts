import type { BetId, Settlement } from '@casinogames/engine';
import { createStore, type Listener, type Store } from '../state/store.ts';
import type { SafeStorage } from '../storage/storage.ts';

/** RTP measured after `rounds` rounds of a bet. */
export interface RtpSample {
  readonly rounds: number;
  readonly rtp: number;
}

export interface BetTally {
  /** Rounds in which the bet was settled. */
  readonly rounds: number;
  /** Total wagered, in cents. */
  readonly staked: number;
  /** Total returned, in cents, stakes included. */
  readonly returned: number;
  readonly wins: number;
  /** Samples at geometrically spaced round counts (for the convergence chart). */
  readonly history: readonly RtpSample[];
}

export interface RtpStats {
  readonly rounds: number;
  readonly staked: number;
  readonly returned: number;
  readonly bets: Readonly<Record<BetId, BetTally>>;
}

export interface RtpTrackerOptions {
  readonly gameId: string;
  /** Persists the stats per game; omit to keep them in memory. */
  readonly storage?: SafeStorage;
}

const EMPTY: RtpStats = { rounds: 0, staked: 0, returned: 0, bets: {} };
const MAX_SAMPLES = 160;
const SAVE_DELAY_MS = 400;

/**
 * Accumulates what was actually wagered and paid per bet, so the RtpPanel can
 * compare the live RTP with the declared one. History is sampled at round
 * counts growing ~20% at a time: about 3 kB per bet covers a million rounds.
 */
export class RtpTracker {
  readonly #store: Store<RtpStats>;
  readonly #storage: SafeStorage | undefined;
  readonly #key: string;
  #saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor({ gameId, storage }: RtpTrackerOptions) {
    this.#key = `rtp:${gameId}`;
    this.#storage = storage;
    this.#store = createStore(storage?.read(this.#key, parseStats, EMPTY) ?? EMPTY);
  }

  get stats(): RtpStats {
    return this.#store.get();
  }

  /** Adds one settled round. */
  record(settlement: Settlement): void {
    const current = this.#store.get();
    const bets: Record<BetId, BetTally> = { ...current.bets };
    let staked = 0;
    let returned = 0;
    for (const [betId, line] of Object.entries(settlement)) {
      bets[betId] = tally(bets[betId], line.stake, line.payout, line.outcome === 'win');
      staked += line.stake;
      returned += line.payout;
    }
    if (staked === 0) return;
    this.#store.set({
      rounds: current.rounds + 1,
      staked: current.staked + staked,
      returned: current.returned + returned,
      bets,
    });
    this.#scheduleSave();
  }

  reset(): void {
    this.#store.set(EMPTY);
    this.flush();
  }

  subscribe(listener: Listener<RtpStats>): () => void {
    return this.#store.subscribe(listener);
  }

  /** Writes pending changes now (e.g. when the page is hidden). */
  flush(): void {
    if (this.#saveTimer !== undefined) clearTimeout(this.#saveTimer);
    this.#saveTimer = undefined;
    this.#storage?.write(this.#key, this.#store.get());
  }

  #scheduleSave(): void {
    if (this.#storage === undefined || this.#saveTimer !== undefined) return;
    this.#saveTimer = setTimeout(() => {
      this.flush();
    }, SAVE_DELAY_MS);
  }
}

function tally(
  previous: BetTally | undefined,
  stake: number,
  payout: number,
  won: boolean,
): BetTally {
  const rounds = (previous?.rounds ?? 0) + 1;
  const staked = (previous?.staked ?? 0) + stake;
  const returned = (previous?.returned ?? 0) + payout;
  let history = previous?.history ?? [];
  const last = history.at(-1);
  if (last === undefined || rounds >= nextCheckpoint(last.rounds)) {
    history = thin([...history, { rounds, rtp: returned / staked }]);
  }
  return { rounds, staked, returned, wins: (previous?.wins ?? 0) + (won ? 1 : 0), history };
}

/** 1, 2, 3, 4, 5, 6, then about 20% further each time. */
export function nextCheckpoint(rounds: number): number {
  return rounds < 6 ? rounds + 1 : Math.ceil(rounds * 1.2);
}

/** Keeps the sample count bounded by dropping every other interior sample. */
function thin(history: RtpSample[]): RtpSample[] {
  if (history.length <= MAX_SAMPLES) return history;
  return history.filter((_, i) => i === 0 || i === history.length - 1 || i % 2 === 0);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseTally(value: unknown): BetTally | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { rounds, staked, returned, wins, history } = value as Record<string, unknown>;
  if (![rounds, staked, returned, wins].every(isCount) || !Array.isArray(history)) return undefined;
  const samples: RtpSample[] = [];
  for (const sample of history as unknown[]) {
    if (typeof sample !== 'object' || sample === null) return undefined;
    const { rounds: n, rtp } = sample as Record<string, unknown>;
    if (!isCount(n) || typeof rtp !== 'number' || !Number.isFinite(rtp)) return undefined;
    samples.push({ rounds: n, rtp });
  }
  return {
    rounds: rounds as number,
    staked: staked as number,
    returned: returned as number,
    wins: wins as number,
    history: samples,
  };
}

/** Validates stored stats; anything malformed is discarded. */
export function parseStats(value: unknown): RtpStats | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { rounds, staked, returned, bets } = value as Record<string, unknown>;
  if (![rounds, staked, returned].every(isCount)) return undefined;
  if (typeof bets !== 'object' || bets === null) return undefined;
  const parsed: Record<BetId, BetTally> = {};
  for (const [betId, raw] of Object.entries(bets)) {
    const bet = parseTally(raw);
    if (bet === undefined) return undefined;
    parsed[betId] = bet;
  }
  return {
    rounds: rounds as number,
    staked: staked as number,
    returned: returned as number,
    bets: parsed,
  };
}
