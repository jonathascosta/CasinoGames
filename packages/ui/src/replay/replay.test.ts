import type { GameEvent } from '@casinogames/engine';
import { describe, expect, it } from 'vitest';
import { replayEvents } from './replay.ts';

const EVENTS: GameEvent[] = [
  { type: 'round-started', bets: { main: 100 } },
  { type: 'dice-rolled', dice: [3, 4] },
  { type: 'bet-settled', betId: 'main', stake: 100, payout: 0, net: -100, outcome: 'lose' },
  { type: 'round-settled', totalStake: 100, totalPayout: 0, net: -100 },
];

describe('replayEvents', () => {
  it('runs handlers in order, awaiting each, and skips unhandled events', async () => {
    const log: string[] = [];
    await replayEvents(EVENTS, {
      'dice-rolled': async (event) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        log.push(`dice ${event.dice.join('+')}`);
      },
      'bet-settled': (event) => {
        log.push(`${event.betId} ${event.outcome}`);
      },
    });
    expect(log).toEqual(['dice 3+4', 'main lose']);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const log: string[] = [];
    await replayEvents(
      EVENTS,
      {
        'round-started': () => {
          log.push('start');
          controller.abort();
        },
        'dice-rolled': () => {
          log.push('dice');
        },
      },
      { signal: controller.signal },
    );
    expect(log).toEqual(['start']);
  });
});
