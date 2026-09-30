# 007 · Submission documents

- **Date:** 2026-09-30
- **Scope:** the documentation reformatted for table-game distributors and gaming laboratories:
  a Rules of Play and a Math Report per game, generated from the code with every figure traced to
  the engine or to a test, `docs/results.json`, the submission pack PDF, the CI check and the
  verification guide.
- **Result:** the commits from `47bab22` (`test(engine): record the figures the submission
  documents quote`) up to the one that adds this file.

The prompt, verbatim:

---

Reformat the documentation for submission to table-game distributors (Galaxy Gaming, AGS, Light & Wonder) and gaming labs. Replace docs/games/*.md with two documents per game, generated from code, plus a combined PDF. Do not change any game rule, paytable or constant; if the code and the current sheets disagree, stop and report it.

## Document 1 — Rules of Play (docs/rules/<game>.md)
Audience: a pit manager or live-dealer trainer. Plain English, no code, no probabilities beyond the paytable.
Sections, in this order:
1. Game name, version (from package.json), document date, author, revision history table.
2. Objective — two sentences.
3. Equipment — dice (two standard six-sided, rolled by the player), shoe composition (number of decks, ranks used, suits, card values), cut-card / penetration, and a note on which elements are cosmetic (suits where they don't matter).
4. Table layout — describe every bet spot and the paytable printed on the felt; reference the demo screen layout.
5. Wagers — one subsection per bet: when it can be placed, minimum/maximum, what wins, what pushes, what loses, exact payout odds. Main bet first, side bets after, progressive last.
6. Sequence of play — numbered steps from "player places wagers" to "dealer settles", including the exact dealer procedure (deal order, when to stop drawing, how to compare hands) and, for Lock & Roll, the player decision, its timing, the lock fee and the free 1-1 rule.
7. Hand ranking / comparison rules (Mirror, Lock & Roll) stated unambiguously with three worked examples each, including a tie.
8. Settlement procedure — order in which bets are paid, how the lock fee is collected, how the progressive meter is paid and reset/decremented.
9. Physical and live-dealer adaptation notes — how the game runs on a real table (dice cup, dealer calls, shoe handling, meter display) and what differs from the RNG version.
10. Irregularities — dice off the table, cocked die, exposed card, mis-deal, insufficient cards before the cut card: state the ruling for each.
Length target: 2–4 pages per game.

## Document 2 — Math Report (docs/math/<game>.md)
Audience: a gaming-lab mathematician or a distributor's analyst. Every number must come from the engine's mathSummary() or from the test suite; add a generator script in tools/ that writes these files and fails if any figure is hand-typed (compare against a generated JSON of results). Include the git commit hash and the names of the tests that reproduce each figure.
Sections, in this order:
1. Cover — game, version, date, author, commit hash, revision history.
2. Summary table — for every wager: RTP, house edge, hit frequency, standard deviation per unit staked, max payout multiple, max exposure per round at max bet.
3. Game model — formal description: sample space (dice outcomes × card outcomes), card-supply model used for the analysis (infinite shoe / uniform ranks) and why, player decision model where applicable.
4. Per-wager analysis — one subsection per bet with: winning conditions expressed formally; method (exact enumeration, memoised recursion, or Monte Carlo); full outcome table (outcome, probability, payout, return contribution); total return; house edge; variance and standard deviation; hit frequency. For Moving Target include the per-target table and the dice-weighted aggregate. For Lock & Roll include the 21-roll decision table with EV of stand vs lock-high vs lock-low, the resulting optimal strategy, re-roll frequency, and house edge with and without the free 1-1 rule; state clearly that the declared edge assumes optimal play and report the edge under naive "never lock" and "always lock low die" strategies as well.
5. Progressive analysis (Mirror only) — seed, contribution rate, fixed-pay RTP, contribution RTP, RTP excluding seed, RTP at seed, break-even meter, expected meter at hit as a function of mean stake, operator seed cost per round, meter decrement/top-up rule.
6. Finite-shoe effects — observed shift in each edge with the real 6-deck shoe at the configured penetration versus the infinite-shoe model, from the Monte Carlo tests.
7. Simulation verification — rounds simulated, RNG and seed, observed RTP per wager vs theoretical, 95% confidence interval, pass/fail.
8. Assumptions and limitations — independence of dice and cards, no card counting effect (state why with A–6/A–10 shoes it is negligible or quantify it), rounding of payouts to cents, no player error modelled.
9. Appendix — full enumeration tables where they fit (Dice Spread, Mirror) and pointers to the test files for the rest.

## Output
- tools/generate-docs.ts produces docs/rules/*.md, docs/math/*.md, docs/results.json, and docs/SUBMISSION-PACK.pdf (cover page, then for each game: Rules of Play followed by Math Report). Reuse the existing PDF pipeline.
- Run it in CI; fail the build if generated docs are out of date with the committed ones.
- Add docs/README.md explaining the two documents, how they are generated, and a one-paragraph "how to verify" for reviewers (clone, run test:math, compare to results.json).
- Delete the old docs/games/*.md after the new ones are generated and cross-checked; update every link.

Before writing, ask me one question only if something in the current sheets is ambiguous for the Rules of Play irregularities section; otherwise use standard casino rulings and flag them in a "to confirm" list at the end of each Rules of Play.
