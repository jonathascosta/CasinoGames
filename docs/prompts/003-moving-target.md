# 003 · Moving Target

- **Date:** 2026-09-30
- **Scope:** the second game: engine rules and math, exact tests with a memoised recursion, Monte
  Carlo runs on an infinite and on the real six-deck shoe with the finite shoe's shift, game sheet
  and the playable table.
- **Result:** the commits from `c48a812` (`feat(engine): paytable lines paid under a condition…`)
  up to the one that adds this file.

The prompt, verbatim:

---

Implement the game "Alvo Móvel" in packages/engine/src/games/alvo-movel and its screen in apps/lobby, following docs/ARCHITECTURE.md.

## Rules
- Shoe: 6 decks of ranks A–10 only (A = 1, cards worth face value; no J/Q/K), 4 suits, 40 cards per deck.
- Flow: player places all bets → player rolls both dice; the sum (2–12) is the TARGET for this round → dealer deals cards one at a time, adding them up, and stops as soon as the running total is ≥ target → settle.
- Main bet "Acerta": wins if the dealer's final total equals the target exactly. Payout depends on the target:
    target 2 → 7.5:1, 3 → 7:1, 4 → 6:1, 5 → 5.5:1, 6 → 5:1, 7 → 4.5:1, 8 → 4:1, 9 → 3.5:1, 10 → 3:1, 11 → 5:1, 12 → 5:1.
- Side bets:
  "Primeira Carta" — the dealer hits the target with the very first card: pays 9:1.
  "Três ou Mais" — the dealer needs 3 or more cards to reach/pass the target: pays 4:1.

## Declared math (infinite-shoe, each value 1–10 equally likely; tests must reproduce)
P(hit) per target: 2: 11.00%, 3: 12.10%, 4: 13.31%, 5: 14.64%, 6: 16.11%, 7: 17.72%, 8: 19.49%, 9: 21.44%, 10: 23.58%, 11: 15.94%, 12: 16.53%.
- Acerta: house edge per target 6.5 / 3.2 / 6.8 / 4.8 / 3.4 / 2.6 / 2.6 / 3.5 / 5.7 / 4.4 / 0.8 %; weighted by the dice distribution the overall house edge is 3.85%.
- Primeira Carta: P = 9.17%, house edge 8.33%.
- Três ou Mais: P = 17.92%, house edge ≈ 10.4%.
Implement the exact probabilities with a memoised recursion in the test (not hard-coded numbers), compare to the table above, then run the Monte Carlo with the real 6-deck Shoe and report how much the finite shoe shifts each edge (write the result into the game sheet).

## UI
- The target must be the hero of the screen: big number that "locks in" after the roll, with the paytable row for that target highlighted.
- Cards deal one by one with a running total; the last card is the reveal. In Turbo mode deal instantly.
- Show a card counter for "Três ou Mais".

## Docs
- docs/games/alvo-movel.md generated from mathSummary(), including the per-target table, volatility and max exposure.

Commit in logical steps. Finish by running the full test suite and the build.
