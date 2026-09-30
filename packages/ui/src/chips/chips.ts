import type { Cents } from '@casinogames/engine';
import { h } from '../dom/h.ts';
import { formatChip } from '../format/format.ts';
import './chip.css';

/** The demo's chip values, in cents: 0.50, 1, 5, 25, 100. */
export const CHIP_DENOMINATIONS: readonly Cents[] = [50, 100, 500, 2_500, 10_000];

/**
 * Splits an amount into chips, largest first, as a dealer would stack it.
 * Any remainder smaller than the smallest chip is left out of the picture.
 */
export function breakIntoChips(
  amount: Cents,
  denominations: readonly Cents[] = CHIP_DENOMINATIONS,
): Cents[] {
  const chips: Cents[] = [];
  let rest = amount;
  for (const value of [...denominations].sort((a, b) => b - a)) {
    while (rest >= value) {
      chips.push(value);
      rest -= value;
    }
  }
  return chips;
}

/** The colour family of a chip value: the largest denomination not above it. */
export function chipTone(
  value: Cents,
  denominations: readonly Cents[] = CHIP_DENOMINATIONS,
): string {
  const sorted = [...denominations].sort((a, b) => a - b);
  let tone = sorted[0] ?? value;
  for (const denomination of sorted) if (denomination <= value) tone = denomination;
  return String(tone);
}

/** A single casino chip, drawn entirely in CSS. */
export function createChip(value: Cents): HTMLSpanElement {
  return h(
    'span',
    { class: 'cg-chip', dataset: { tone: chipTone(value) }, 'aria-hidden': 'true' },
    // Printed by the stylesheet, like the rest of the chip: a chip is a
    // picture, and the control it sits on says its value in words.
    h('span', { class: 'cg-chip__label', dataset: { value: formatChip(value) } }),
  );
}
