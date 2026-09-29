# Alvo Móvel

_“Moving target”_ · original table game · **status: rules in design**

## Summary

The player rolls two dice; the dealer deals cards from a shoe. The rules, bets
and paytable of Alvo Móvel are being designed and will ship in a later iteration of
the demo, together with its math verification.

## Rules

Not published yet.

## Bets and paytable

<!-- math:start -->

Generated from the game's `mathSummary()` once the game is implemented; never
typed by hand.

<!-- math:end -->

## Mathematics

Every declared RTP will be proven twice before release:

- **Exact**: the real game code is run over every possible draw of the dice and
  of an infinite shoe, and the declared RTP must equal the enumerated value
  exactly (as a fraction).
- **Monte Carlo**: a seeded simulation of at least 2,000,000 rounds (more for
  volatile bets) must land within ±0.15 percentage points of the declared RTP.

Method and conventions: `docs/MATH.md`.
