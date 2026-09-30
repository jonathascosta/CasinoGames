import { describe, expect, it } from 'vitest';
import { RangeStrip } from './range-strip.ts';

function cells(strip: RangeStrip): HTMLElement[] {
  return [...strip.element.querySelectorAll<HTMLElement>('.ds-strip__cell')];
}

const roles = (strip: RangeStrip) => cells(strip).map((cell) => cell.dataset.role ?? '-');
const band = (strip: RangeStrip) => strip.element.querySelector<HTMLElement>('.ds-strip__band')!;
const caption = (strip: RangeStrip) => strip.element.querySelector('.ds-strip__caption')!;

describe('RangeStrip', () => {
  it('shows the six card values, ace to six', () => {
    const strip = new RangeStrip();
    expect(cells(strip).map((cell) => cell.textContent)).toEqual(['A', '2', '3', '4', '5', '6']);
    expect(strip.element.dataset.state).toBe('idle');
    expect(band(strip).hidden).toBe(true);
    expect(caption(strip).getAttribute('aria-live')).toBe('polite');
  });

  it('marks the dice, lights the values between them and prints the odds over them', () => {
    const strip = new RangeStrip();
    strip.showRoll([5, 2]);
    expect(roles(strip)).toEqual(['out', 'die', 'between', 'between', 'die', 'out']);
    expect(band(strip).hidden).toBe(false);
    expect(band(strip).textContent).toBe('pays 2 to 1');
    expect(band(strip).style.gridColumn).toBe('3 / 5');
    expect(caption(strip).textContent).toBe('Spread 3 · Between pays 2 to 1 on 3 or 4');
    expect(cells(strip)[2]!.getAttribute('aria-label')).toBe('3: between the dice');
    expect(cells(strip)[1]!.getAttribute('aria-label')).toBe('2: on a die, wins Match');
  });

  it('marks the Bullseye card on a spread of 2', () => {
    const strip = new RangeStrip();
    strip.showRoll([3, 5]);
    expect(cells(strip).map((cell) => cell.dataset.bullseye !== undefined)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(caption(strip).textContent).toBe(
      'Spread 2 · Between pays 4 to 1 on 4 · Bullseye needs a 4',
    );
  });

  it('says when Between pushes', () => {
    const strip = new RangeStrip();
    strip.showRoll([4, 4]);
    expect(band(strip).hidden).toBe(true);
    expect(roles(strip)).toEqual(['out', 'out', 'out', 'die', 'out', 'out']);
    expect(caption(strip).textContent).toBe('A pair of 4s · Between pushes · Triple needs a 4');
    strip.showRoll([4, 3]);
    expect(caption(strip).textContent).toBe('Spread 1 · Between pushes');
    strip.showRoll([1, 6]);
    expect(caption(strip).textContent).toBe('Spread 5 · Between pays 1 to 2 on 2, 3, 4 or 5');
  });

  it('pulses while the card waits, then marks the card by outcome', () => {
    const strip = new RangeStrip();
    strip.showRoll([2, 6]);
    strip.anticipate();
    expect(strip.element.dataset.state).toBe('waiting');
    strip.showCard(4, 'win');
    expect(strip.element.dataset.state).toBe('revealed');
    expect(cells(strip)[3]!.dataset.hit).toBe('win');
    expect(strip.caption).toBe('Card 4 · Between wins');
    strip.reset('Next round');
    expect(roles(strip)).toEqual(['-', '-', '-', '-', '-', '-']);
    expect(cells(strip)[3]!.dataset.hit).toBeUndefined();
    expect(strip.caption).toBe('Next round');
  });
});
