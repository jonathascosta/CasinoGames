# 004 · Mirror

- **Date:** 2026-09-30
- **Scope:** the third game: engine rules and math with a progressive jackpot, exact tests on an
  infinite and on a six-deck shoe, Monte Carlo runs with the meter's economics, game sheet and the
  playable table with its meter in the lobby.
- **Result:** the commits from `fee3ac6` (`feat(engine): progressive lines paying fixed odds…`)
  up to the one that adds this file.

The prompt, verbatim:

---

Implement the game "Espelho" in packages/engine/src/games/espelho and its screen in apps/lobby, following docs/ARCHITECTURE.md.

## Rules
- Shoe: 6 decks of ranks A–6 (A = 1), 4 suits, 24 cards per deck. Suits matter only for a side bet.
- Flow: player places all bets → player rolls both dice (the player's "hand") → dealer deals two cards (the dealer's "hand") → compare → settle.
- Hand ranking (same rules for dice and cards):
    1. Pair beats non-pair; higher pair beats lower pair.
    2. Among non-pairs: higher sum wins; if sums tie, higher single value wins; if still tied, it is a tie.
- Main bet "Espelho": pays 1:1 if the player's hand ranks higher. Ties go to the house (player loses).
- Side bets:
  "Empate" — hands rank exactly equal: pays 17:1.
  "Somas Iguais" — dice sum equals cards sum: pays 7:1.
  "Par vs Par" — both hands are pairs: pays 30:1.
  "Espelho Perfeito" — both hands are the same pair: pays 200:1.
  "6-6 vs 6-6" — progressive jackpot: both hands are double six. Fixed pay 1000:1 in the demo, plus a simulated progressive meter seeded at 5,000 units and fed by 1% of all main-bet wagers; the meter is paid on top of the fixed pay and resets to seed.

## Declared math (exact enumeration: 36 dice outcomes × 24 × 24 card outcomes; tests must reproduce)
- Espelho: player wins 47.45%, tie 5.09%, house edge 5.09%.
- Empate: P = 5.09%, house edge 8.33%.
- Somas Iguais: P = 11.27%, house edge 9.85%.
- Par vs Par: P = 2.78%, house edge 13.89%.
- Espelho Perfeito: P = 0.46%, house edge 6.94%.
- 6-6 vs 6-6: P = 0.077%, house edge 22.76% on the fixed pay (report the meter separately).

## UI
- Split-screen "mirror" layout: dice on the bottom half, cards on the top half, both hands evaluated with the same visual label (PAIR 4s / SUM 9 HIGH 6).
- The comparison result animates as a tilt of the mirror toward the winner.
- Progressive meter visible at the top of the felt and in the lobby card.

## Docs
- docs/games/espelho.md generated from mathSummary(), with volatility and progressive economics (contribution rate, average cycle in rounds, expected meter at hit).

Commit in logical steps. Finish by running the full test suite and the build.

---

Asked how the meter should pay relative to the stake (as written, the whole meter goes to any
winning stake, which makes the bet player-favourable below a stake of about 17.00), the answer,
verbatim:

---

Option A with three changes: meter funded by the side bet itself, meter decremented pro-rata (not reset) on a hit, and RTP reported seed-excluded. Full spec:

## Rule
- Bet "6-6 vs 6-6": min 0.50, max 25.00 (SIDE_MAX). Stake s.
- Contribution: 10% of s (CONTRIB_RATE = 0.10) is added to the meter the moment the bet is accepted, every round, whether or not it hits. The contribution is part of the stake (the player pays s; 0.10·s goes to the meter, 0.90·s to the house pool). It is NOT taken from the Espelho main bet — remove the 1%-of-main-bet funding entirely so the main bet's declared 94.91% RTP is untouched.
- Hit condition: player rolls 6-6 AND dealer's two cards are both 6s. P = (1/36)·(1/36) = 1/1296 = 0.07716% (infinite shoe; the finite 6-deck shoe shifts the second-card probability slightly, report the shoe figure separately in the sheet).
- Payout on hit: fixed 1000:1 on s, plus a meter share = (s / SIDE_MAX) × meter (the whole meter at max stake). Payout is in integer cents; floor the meter share.
- After a hit: meter -= paid share. If meter < seed, top it up to seed (operator-funded). Do NOT reset to seed unconditionally — with pro-rata pay a 0.50 stake takes 2% of the meter and resetting would discard the other 98%.
- Seed: 5,000.00 (SEED). Persist meter in localStorage with the other stats; on load, if absent or below seed, set to seed.

## Declared math (tests must reproduce, not hard-code)
- Fixed component RTP = 1001 / 1296 = 77.24% (house edge 22.76%).
- Contribution component = 10.0 pp (all contributions are eventually paid out through the meter; seed excluded).
- RTP excluding seed = 77.24% + 10.0% = 87.24% (house edge 12.76%). This is the headline figure for the paytable badge and the game sheet.
- RTP at a given meter value M (single-round expectation, seed included): 77.24% + M / (SIDE_MAX × 1296) = 77.24% + M / 32,400. At seed: 77.24% + 15.43% = 92.67%. Contribution is NOT added here — the meter value already embodies past contributions.
- Break-even meter (bet becomes player-favourable): M* = 0.2276 × 32,400 ≈ 7,375. Report it in the sheet and show it in the RtpPanel next to the live meter.
- Expected meter growth per cycle: CONTRIB_RATE × 1296 × (mean side-bet stake per round) = 129.6 × mean stake. At mean stake 1.00 the meter at hit averages ≈ 5,130; at constant max stake ≈ 8,240. Compute this in the sheet script from the stats, don't hard-code.
- Operator seed cost ≈ SEED / 1296 per round at max stake (≈ 3.86 per round); document it as a cost line, not as RTP.

## Tests
1. Exact enumeration: P(hit) = 1/1296 and fixed RTP = 1001/1296 for the infinite-shoe model.
2. Pro-rata invariance: for stakes 0.50, 1.00, 5.00, 25.00 with the meter frozen at M, payout/stake is identical (fixed 1000 + M/25 per unit).
3. Accounting invariant over any simulated run: meter_end = meter_start + Σ contributions − Σ meter shares paid + Σ top-ups; and Σ(stakes) = Σ(contributions) + Σ(house pool).
4. Break-even: rtpAtMeter(7,375) ≈ 100% ± 0.01 pp; rtpAtMeter(SEED) = 92.67% ± 0.01 pp.
5. Monte Carlo (≥ 5,000,000 rounds, seeded RNG, real Shoe, mixed stakes): observed RTP excluding seed → 87.24% ± 0.3 pp, using a long run so enough hits occur (expected ≈ 3,858 hits); count top-ups separately and confirm they are excluded from the seed-excluded RTP.

## RtpPanel / UI
- "Wagered" includes the full stake s (contribution included). "Won" includes fixed pay + meter share. Show two declared RTPs for this bet: "87.24% (excl. seed)" as the badge, and "at current meter: xx.xx%" live, plus "break-even meter 7,375".
- Meter display: current value, seed, and contribution rate on the bet spot tooltip.
- Lobby card shows the live meter.

## Game sheet fields for this bet
P(hit) infinite shoe and 6-deck shoe; fixed RTP; contribution rate; RTP excl. seed; RTP at seed; break-even meter; expected meter at hit as a function of mean stake; seed cost per round; max exposure per round = 1000 × SIDE_MAX + meter (state the meter as unbounded but list the value at seed); volatility index computed with the meter at seed.

Constants (SEED, CONTRIB_RATE, SIDE_MAX, fixed odds) live in one config object so they can be retuned without touching rules. Update docs/games/espelho.md and the paytable text accordingly.
