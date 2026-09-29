import { createStore, type Listener, type Store } from '../state/store.ts';

export type AutoPlayStopReason = 'completed' | 'stopped' | 'insufficient-funds' | 'error';

export interface AutoPlayState {
  readonly running: boolean;
  /** Rounds requested for the current (or last) run. */
  readonly total: number;
  readonly played: number;
  readonly lastStop: AutoPlayStopReason | null;
}

export interface AutoPlayControllerOptions {
  /** Plays one complete round (stake, animations, settlement). */
  readonly playRound: () => Promise<void>;
  /** False when the next round cannot start, e.g. the balance cannot cover the bet. */
  readonly canContinue: () => boolean;
}

/**
 * Runs rounds back to back. It stops after the requested number of rounds,
 * as soon as the balance can no longer cover the bet (checked before every
 * round, so it never plays into a negative balance), when the player asks,
 * or if a round fails. A stop request lets the current round finish.
 */
export class AutoPlayController {
  readonly #options: AutoPlayControllerOptions;
  readonly #state: Store<AutoPlayState>;
  /** Aborted by stop(); one per run. */
  #run: AbortController | null = null;

  constructor(options: AutoPlayControllerOptions) {
    this.#options = options;
    this.#state = createStore<AutoPlayState>({
      running: false,
      total: 0,
      played: 0,
      lastStop: null,
    });
  }

  get state(): AutoPlayState {
    return this.#state.get();
  }

  async start(rounds: number): Promise<AutoPlayStopReason> {
    if (!Number.isInteger(rounds) || rounds < 1) {
      throw new RangeError(`rounds must be a positive integer, got ${rounds}`);
    }
    if (this.state.running) throw new Error('Autoplay is already running');
    const run = new AbortController();
    this.#run = run;
    this.#state.set({ running: true, total: rounds, played: 0, lastStop: null });

    let reason: AutoPlayStopReason = 'completed';
    try {
      for (let played = 0; played < rounds; played++) {
        if (run.signal.aborted) {
          reason = 'stopped';
          break;
        }
        if (!this.#options.canContinue()) {
          reason = 'insufficient-funds';
          break;
        }
        await this.#options.playRound();
        this.#state.update((state) => ({ ...state, played: played + 1 }));
      }
    } catch (error) {
      reason = 'error';
      console.error('Autoplay stopped by an error', error);
    } finally {
      this.#run = null;
      this.#state.update((state) => ({ ...state, running: false, lastStop: reason }));
    }
    return reason;
  }

  /** Stops after the round in progress. */
  stop(): void {
    this.#run?.abort();
  }

  subscribe(listener: Listener<AutoPlayState>): () => void {
    return this.#state.subscribe(listener);
  }
}
