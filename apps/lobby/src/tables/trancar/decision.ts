import {
  diceTotal,
  lockedDie,
  otherDie,
  type Cents,
  type DicePair,
  type DieIndex,
  type TrancarChoice,
} from '@casinogames/engine';
import { Toggle, formatCents, h } from '@casinogames/ui';

/** What the table asks the bar for after a roll. */
export interface DecisionRequest {
  readonly dice: DicePair;
  /** The re-roll's fee: 0 when it is free (1-1). */
  readonly fee: Cents;
  /** Whether the balance covers the fee. */
  readonly affordable: boolean;
  /** The reference strategy's choice, which the strategy hint shows. */
  readonly advice: TrancarChoice;
  /** Ficar, or Trancar with the die locked on the dice. */
  readonly onChoose: (choice: 'ficar' | 'trancar') => void;
}

/** "Trancar · +0.40", or "Trancar · free" on 1-1. */
export function trancarLabel(fee: Cents): string {
  return fee === 0 ? 'Trancar · free' : `Trancar · +${formatCents(fee)}`;
}

/** The reference strategy's choice on a roll, in words. */
export function adviceText(dice: DicePair, advice: TrancarChoice, fee: Cents): string {
  const locked = lockedDie(advice);
  if (locked === null) return `Ficar, stand on ${diceTotal(dice)}`;
  const price = fee === 0 ? 'free' : `+${formatCents(fee)}`;
  const kept = dice[locked];
  const other = dice[otherDie(locked)];
  return kept === other
    ? `Trancar, lock a ${kept} and re-roll the other (${price})`
    : `Trancar, lock the ${kept} and re-roll the ${other} (${price})`;
}

/**
 * The decision after the roll. Ficar is always on the table and live while
 * a decision is asked for; Trancar appears once a die is locked (the dice
 * themselves are the lock buttons), with its fee on it. The strategy hint,
 * off by default and labelled as a demonstration feature, shows the
 * reference strategy's choice for the roll: what autoplay plays.
 */
export class DecisionBar {
  readonly element: HTMLElement;
  readonly #ficar: HTMLButtonElement;
  readonly #trancar: HTMLButtonElement;
  /** The fee part of Trancar's label, which wraps under the name on narrow screens. */
  readonly #fee: HTMLElement;
  readonly #note: HTMLElement;
  readonly #hint: Toggle;
  readonly #advice: HTMLElement;
  #request: DecisionRequest | null = null;
  #locked: DieIndex | null = null;

  constructor() {
    this.#ficar = h('button', { type: 'button', class: 'cg-btn tr-decision__ficar' }, 'Ficar');
    this.#fee = h('span', { class: 'tr-decision__fee' });
    this.#trancar = h(
      'button',
      { type: 'button', class: 'cg-btn cg-btn--primary tr-decision__trancar', hidden: true },
      h('span', { class: 'tr-decision__name' }, 'Trancar'),
      h('span', { class: 'tr-decision__dot' }, ' · '),
      this.#fee,
    );
    this.#note = h('p', { class: 'tr-decision__note', hidden: true });
    this.#advice = h('p', { class: 'tr-decision__advice', 'aria-live': 'polite', hidden: true });
    this.#hint = new Toggle({
      label: 'Strategy hint',
      checked: false,
      showLabel: true,
      icons: { on: 'hint', off: 'hint' },
      onChange: () => {
        this.#render();
      },
    });
    this.element = h(
      'div',
      { class: 'tr-decision', dataset: { state: 'closed' } },
      h(
        'div',
        { class: 'tr-decision__choices', role: 'group', 'aria-label': 'Your decision' },
        this.#ficar,
        this.#trancar,
      ),
      h(
        'div',
        { class: 'tr-decision__help' },
        this.#hint.element,
        h(
          'span',
          { class: 'tr-decision__demo', title: 'A demonstration feature for evaluators' },
          'Demo',
        ),
      ),
      this.#advice,
      this.#note,
    );
    this.#ficar.addEventListener('click', () => {
      this.#request?.onChoose('ficar');
    });
    this.#trancar.addEventListener('click', () => {
      if (this.#locked !== null && this.#request?.affordable === true) {
        this.#request.onChoose('trancar');
      }
    });
    this.#render();
  }

  /** Whether the strategy hint is on. */
  get hint(): boolean {
    return this.#hint.checked;
  }

  /** Asks for the decision on a roll. */
  open(request: DecisionRequest): void {
    this.#request = request;
    this.#locked = null;
    this.#render();
  }

  /** The die locked on the dice, or null: Trancar shows once a die is locked. */
  setLocked(index: DieIndex | null): void {
    this.#locked = index;
    this.#render();
  }

  /** No decision is asked for. */
  close(): void {
    this.#request = null;
    this.#locked = null;
    this.#render();
  }

  destroy(): void {
    this.#hint.destroy();
    this.element.remove();
  }

  #render(): void {
    const request = this.#request;
    const open = request !== null;
    this.element.dataset.state = !open ? 'closed' : this.#locked === null ? 'open' : 'locked';
    this.#ficar.disabled = !open;
    this.#trancar.hidden = !open || this.#locked === null;
    this.#fee.textContent = trancarLabel(request?.fee ?? 0).replace(/^Trancar · /, '');
    this.#trancar.disabled = request?.affordable !== true;
    const short = open && this.#locked !== null && !request.affordable;
    this.#note.hidden = !short;
    this.#note.textContent = short
      ? `Your balance does not cover the ${formatCents(request.fee)} fee.`
      : '';
    this.#advice.hidden = !open || !this.#hint.checked;
    this.#advice.textContent =
      open && this.#hint.checked
        ? `Recommended: ${adviceText(request.dice, request.advice, request.fee)}`
        : '';
  }
}
