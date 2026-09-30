# 006 · Release 0.1.0

- **Date:** 2026-09-30
- **Scope:** finishing the demo for game aggregators: the rename to English under the Roll & Deal
  name, the lobby's cards and house controls, the RTP stats page, the game sheets PDF, Lighthouse
  at 90 or more on every page with the keyboard and reduced motion supported throughout, the
  pitch, and the release tagged `v0.1.0`.
- **Result:** the commits from `3b5eaad` (`feat(ui): storage schema v2, discarding what older
  versions stored`) up to the one that adds this file, released as `v0.1.0`.

The prompt, verbatim:

---

Finalise the demo for submission to game aggregators. Step 0 is a full rename to English and must be completed and committed before anything else.

0. Rename everything to English. The Portuguese names were working titles.
   Portfolio / lobby name: "Roll & Deal".
   Games:  Entre-Dados → "Dice Spread" (id dice-spread, route /dice-spread)
           Alvo Móvel  → "Moving Target" (id moving-target, route /moving-target)
           Espelho     → "Mirror" (id mirror, route /mirror)
           Trancar     → "Lock & Roll" (id lock-and-roll, route /lock-and-roll)
   Bets:   Dice Spread:   Entre → "Between" (main), Exato → "Match", Olho de Boi → "Bullseye", Dobros → "Doubles", Triplo → "Triple"
           Moving Target: Acerta → "Exact Hit" (main), Primeira Carta → "First Card", Três ou Mais → "3+ Cards"
           Mirror:        Espelho → "Mirror" (main), Empate → "Tie", Somas Iguais → "Equal Sums", Par vs Par → "Pair vs Pair", Espelho Perfeito → "Perfect Mirror", 6-6 vs 6-6 → "Double Sixes" (progressive)
           Lock & Roll:   Trancar → "Lock & Roll" (main); decisions Ficar → "Stand", Trancar → "Lock"; the re-roll fee is the "Lock fee".
   Scope of the rename: package folders and file names (git mv), TypeScript identifiers, bet ids, game ids, routes, localStorage keys, i18n strings, rules text, tests and test names, docs/games/*.md (regenerate from mathSummary()), README, ARCHITECTURE.md, commit messages going forward. Remove the EN/PT language toggle and all PT strings; the UI is English only. Bump the localStorage schema version so stored stats keyed by old ids are discarded cleanly (do not attempt to migrate). Grep the repo for every old name (accent-insensitive) and confirm zero hits before committing. Run the full test suite, including test:math, after the rename.
1. Lobby: four cards with live progressive meter (Mirror), declared RTP badge, "Play" and "Game sheet" buttons; a top bar with bankroll, reset bankroll, RTP stats reset.
2. Global RTP page (/stats) aggregating RtpPanel data across games, with declared-vs-observed per bet and total rounds.
3. Generate docs/GAME-SHEETS.pdf from the four markdown game sheets (use a script in tools/, run in CI).
4. Lighthouse mobile score ≥ 90 on performance and accessibility; all interactions keyboard-accessible; reduced-motion respected.
5. Add docs/PITCH.md: one paragraph per game, the "dice + cards" positioning under the Roll & Deal name, RNG and live-dealer applicability, and the server-side migration plan (engine unchanged, RNG swapped for a certified server RNG, wallet API to be defined).
6. Tag the release v0.1.0 and confirm the GitHub Pages URL works on a phone.
