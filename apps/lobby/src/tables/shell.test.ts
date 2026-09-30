import { describe, expect, it } from 'vitest';
import { GAMES } from '../catalog.ts';
import { loadRules, playerRules } from './shell.ts';

describe("the tables' rules", () => {
  it.each(GAMES.map((game) => game.slug))(
    '%s: shows the players the objective to the settlement of its Rules of Play',
    async (slug) => {
      const rules = await loadRules(slug);
      expect(rules).toMatch(/^# .+ — Rules of Play\n/);
      const part = playerRules(rules);
      expect(part).toMatch(/^From the Rules of Play, sections 2 to 8\./);
      expect(part).toContain('## 2. Objective');
      expect(part).toMatch(/## 8\. Settlement procedure/);
      // Not the document's facts, the live-dealer notes or the rulings.
      expect(part).not.toContain('## 1. Game and document');
      expect(part).not.toContain('## 9.');
      expect(part).not.toContain('## 10.');
      expect(part).not.toContain('player-rules');
    },
  );

  it('shows a document without the markers whole', () => {
    expect(playerRules('# Game\n\nRules.')).toBe('# Game\n\nRules.');
  });
});
