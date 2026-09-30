# 002 · Entre Dados

- **Date:** 2026-09-30
- **Scope:** the first game: engine rules and math, exact and Monte Carlo tests, game sheet and the
  playable table.
- **Result:** the commits from `1ccced3` (`feat(engine): push lines, hit frequency…`) up to the
  one that adds this file.

The prompt, verbatim:

---

Implement the game "Entre-Dados" in packages/engine/src/games/entre-dados and its screen in apps/lobby, following the architecture in docs/ARCHITECTURE.md.

## Rules
- Shoe: 6 decks of ranks A,2,3,4,5,6 (A = 1), 4 suits each (24 cards per deck). Suits are cosmetic.
- Flow: player places all bets → player rolls both dice → dealer deals one card → settle.
- Main bet "Entre": wins if the card value is STRICTLY between the two dice values.
  Payout depends on the spread (high die − low die):
    spread 2 → 4:1, spread 3 → 2:1, spread 4 → 1:1, spread 5 → 1:2 (pays half).
  Spread 1 → push (stake returned). Doubles (spread 0) → push.
  Card equal to either die, or outside the range → lose.
- Side bets (all optional, settled on the same roll/card):
  "Exato"  — card equals one of the dice: pays 2:1.
  "Olho de Boi" — spread is exactly 2 AND the card is the middle value: pays 22:1.
  "Dobros" — dice are a pair: pays 4:1.
  "Triplo" — dice are a pair AND the card equals that value: pays 30:1.

## Declared math (the tests must reproduce these; card distribution treated as uniform 1–6)
- Entre: house edge 3.70% (RTP 96.30%).
- Exato: P = 30.56%, house edge 8.33%.
- Olho de Boi: P = 3.70%, house edge 14.81%.
- Dobros: P = 16.67%, house edge 16.67%.
- Triplo: P = 2.78%, house edge 13.89%.
Write an exact enumeration test (36 dice outcomes × 6 card values) for every bet, plus the Monte Carlo test against the real Shoe.

## UI
- Bet spots laid out on a felt: Entre in the centre, four side bets around it, with the paytable printed on the felt (spread → payout).
- After the roll, highlight the winning card range on a 1–6 strip before the card is revealed; the reveal is the moment of tension.
- Reuse RtpPanel, TurboMode, AutoPlay, Paytable and Info modals from packages/ui.

## Docs
- docs/games/entre-dados.md game sheet generated from mathSummary(): rules, paytable, RTP and house edge per bet, hit frequency, max exposure per unit staked, volatility index (std dev of net result per unit staked, computed in the test and written to the sheet).

Commit in logical steps. Finish by running the full test suite and the build.

---
