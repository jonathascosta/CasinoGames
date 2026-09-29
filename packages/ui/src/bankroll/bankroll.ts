import { isCents, type Cents } from '@casinogames/engine';
import { createStore, type Listener, type Store } from '../state/store.ts';
import type { SafeStorage } from '../storage/storage.ts';

export interface BankrollOptions {
  readonly storage: SafeStorage;
  /** Starting balance and the value reset() restores. Default 1,000.00. */
  readonly initial?: Cents;
}

const KEY = 'bankroll';
const MAX_BALANCE: Cents = 100_000_000_00;

function parseBalance(value: unknown): Cents | undefined {
  return isCents(value) && value >= 0 && value <= MAX_BALANCE ? value : undefined;
}

/**
 * The player's virtual chips, in integer cents, persisted across visits.
 * Stakes are debited when a round (or a raise) is committed and payouts
 * credited on settlement, mirroring a real wallet.
 */
export class Bankroll {
  readonly initial: Cents;
  readonly #balance: Store<Cents>;

  constructor({ storage, initial = 1_000_00 }: BankrollOptions) {
    if (parseBalance(initial) === undefined) {
      throw new RangeError(`initial must be integer cents in [0, ${MAX_BALANCE}]`);
    }
    this.initial = initial;
    this.#balance = createStore(storage.read(KEY, parseBalance, initial));
    this.#balance.subscribe((balance) => storage.write(KEY, balance));
  }

  get balance(): Cents {
    return this.#balance.get();
  }

  canAfford(amount: Cents): boolean {
    return isCents(amount) && amount >= 0 && amount <= this.balance;
  }

  debit(amount: Cents): void {
    assertAmount(amount);
    if (amount > this.balance) {
      throw new RangeError(`Insufficient balance: ${this.balance}¢ < ${amount}¢`);
    }
    this.#balance.set(this.balance - amount);
  }

  credit(amount: Cents): void {
    assertAmount(amount);
    this.#balance.set(Math.min(MAX_BALANCE, this.balance + amount));
  }

  /** Restores the starting balance (the demo's "top up"). */
  reset(): void {
    this.#balance.set(this.initial);
  }

  subscribe(listener: Listener<Cents>): () => void {
    return this.#balance.subscribe(listener);
  }
}

function assertAmount(amount: Cents): void {
  if (!isCents(amount) || amount < 0) {
    throw new RangeError(`Amount must be non-negative integer cents, got ${amount}`);
  }
}
