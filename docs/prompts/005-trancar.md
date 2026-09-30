# 005 · Trancar

- **Date:** 2026-09-30
- **Scope:** the fourth game and the only one with a decision: fees on decisions in the engine,
  the strategy computed by expected value and tested from scratch, exact tests on an infinite and
  on a six-deck shoe, Monte Carlo runs with a strategy bot and the card counting exposure, the
  game sheet with its strategy card, and the table where the player locks a die.
- **Result:** the commits from `160858c` (`feat(engine): decisions can charge a fee against a
  bet`) up to the one that adds this file.

The prompt, verbatim:

---

Implement the game "Trancar" in packages/engine/src/games/trancar and its screen in apps/lobby, following docs/ARCHITECTURE.md. This is the only game with a player decision, so it must use the 'awaiting-decision' phase of the engine.

## Rules
- Shoe: 6 decks of ranks A–6 (A = 1), 4 suits, 24 cards per deck. Suits are cosmetic.
- Flow: player places the main bet → player rolls both dice → DECISION: "Ficar" (stand) or "Trancar" (lock one die and re-roll the other, exactly once) → dealer deals two cards → compare sums → settle.
- Main bet "Trancar": pays 1:1 if the player's dice sum is strictly greater than the dealer's two-card sum. Ties go to the house.
- Re-roll cost: choosing "Trancar" adds a fee of 40% of the main bet, taken immediately and never returned, regardless of outcome (the 1:1 payout applies to the main bet only).
- Exception: if the initial roll is 1-1 the re-roll is free.
- No side bets in v1. Leave a clear extension point for a "Trancar e Dobrar" option (re-roll and double the bet) — do not implement it.

## Declared math (dealer cards treated as uniform 1–6; player follows the optimal strategy; tests must reproduce)
- Optimal strategy: re-roll the LOW die whenever it is 1 or 2, keeping the high die, EXCEPT: never re-roll a double (other than the free 1-1) and do not re-roll 6-2.
- With the 40% fee and free 1-1: house edge 4.07%. Without the free 1-1 rule: 4.97%. Player re-rolls in about 44–47% of hands.
Write a test that computes the optimal decision for each of the 21 distinct rolls by expected value (not hard-coded), asserts it matches the strategy above, and derives the house edge exactly. Then run the Monte Carlo with the real Shoe and a strategy-bot player.

## UI
- After the roll, the two dice become tappable; tapping a die locks it (padlock icon) and reveals the "Trancar" button with the fee shown explicitly (e.g. "Trancar · +0.40"). "Ficar" is always visible.
- An optional "Strategy hint" toggle (off by default) shows the recommended decision — this is a demo feature for evaluators, keep it clearly labelled.
- Dealer cards deal after the decision. Show sums side by side; winner highlight.
- AutoPlay must use the optimal-strategy bot so the RtpPanel converges to the declared RTP.

## Docs
- docs/games/trancar.md generated from mathSummary(): rules, fee, strategy card (21 rolls), house edge with/without free 1-1, volatility, re-roll frequency.

Commit in logical steps. Finish by running the full test suite and the build.
