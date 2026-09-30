import { describe, expect, it } from 'vitest';
import { handStep } from './card-view.ts';

describe('handStep', () => {
  it('spaces cards two thirds of a card apart while the hand fits', () => {
    expect(handStep(300, 800, 60, 1)).toBeCloseTo(39.6, 10);
    expect(handStep(300, 800, 60, 4)).toBeCloseTo(39.6, 10);
  });

  it('overlaps a long hand so it stays clear of the edge and of the shoe', () => {
    // Centre 300 on an 800-wide table: the left edge is nearer than the shoe.
    const step = handStep(300, 800, 60, 20);
    expect(step).toBeLessThan(39.6);
    expect(300 - (19 / 2) * step - 30).toBeCloseTo(60 * 0.2, 10);
    // Towards the shoe, the tighter side decides: 800 − 1.8 × 60 = 692 on the right.
    expect(handStep(560, 800, 60, 8) * 3.5 + 560 + 30).toBeLessThanOrEqual(692 + 1e-9);
  });

  it('never packs cards closer than a fifth of a card, and ignores unmeasured tables', () => {
    expect(handStep(100, 200, 60, 30)).toBe(12);
    expect(handStep(0, 0, 60, 5)).toBeCloseTo(39.6, 10);
  });
});
