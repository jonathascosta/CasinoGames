# 001 · Foundation

- **Date:** 2026-09-29
- **Scope:** monorepo, engine, UI kit, lobby with routing, CI/CD and documentation. No game rules.
- **Result:** the commits from `0d6b774` (`chore: initialise pnpm workspace…`) up to the one that
  adds this file.

The prompt, verbatim:

---

You are building a client-side demo lobby of four original casino games (2 dice rolled by the player, cards dealt by the dealer). The demo will be sent to game aggregators and live-dealer providers as a portfolio, so code quality, mobile-first UX and verifiable math matter more than features. No backend: everything runs in the browser with virtual chips.

## Stack
- pnpm monorepo, TypeScript strict, Vite, Vitest. Node 20+.
- No UI framework. DOM + CSS for chrome; PixiJS 8 (pinned) only for the dice/card animation layer.
- ESLint + Prettier, Husky pre-commit running lint + typecheck + unit tests.
- Deploy: GitHub Actions → GitHub Pages (static). Add a workflow that builds the lobby on push to main.

## Layout
- packages/engine   — pure TS, ZERO dependencies, no DOM. All game rules and math live here.
- packages/ui       — shared UI kit: chip selector, bet spots, dice roller, card dealer, paytable modal, RTP panel, turbo/autoplay, sound toggle, theme tokens.
- apps/lobby        — the demo site: lobby page + one route per game (/entre-dados, /alvo-movel, /espelho, /trancar).
- docs/             — one game sheet per game (markdown), math notes, and this prompt history.

## Engine design (non-negotiable)
- Everything is deterministic given an injected RNG: `interface Rng { next(): number }` (0 ≤ x < 1). Provide `createSeededRng(seed)` (xoshiro128** or mulberry32) and `createCryptoRng()` (crypto.getRandomValues). Games NEVER call Math.random.
- Card supply: `Shoe` class — N decks of a configurable rank set (e.g. A–6, A–10, A–K) with 4 suits, Fisher–Yates shuffle with the injected RNG, cut card at configurable penetration (default 25% remaining), auto-reshuffle. Expose `remaining()` for the UI.
- Dice: `rollDie(rng)` returns 1–6; `rollDice(rng)` returns [d1, d2].
- Money is in integer cents. Bets are a map `{ [betId]: amountCents }`.
- A game is a state machine so the UI can animate step by step and so games with player decisions work:
  `interface Game { id, name, bets: BetDefinition[], start(bets, rng): RoundState; decide(state, choice): RoundState }`
  `RoundState` has `phase` ('awaiting-decision' | 'settled'), an ordered `events[]` array (e.g. dice-rolled, card-dealt, decision-requested, bet-settled) that the UI replays with animations, and `settlement: { [betId]: { stake, payout, net, outcome } }`.
  `BetDefinition` includes id, label, min/max, whether it is a main or side bet, the paytable, and declared RTP/house edge.
- Every game exports `mathSummary()` returning the declared RTP per bet, so the paytable modal and the game sheet are generated from code, never typed by hand.
- Progressive jackpots are simulated in-memory with a configurable seed amount and contribution rate.

## Shared UI (packages/ui)
- Mobile-first, portrait and landscape, 360px minimum width. Dark felt theme with CSS custom properties; must look premium, not templated.
- Reusable components: ChipRail (0.5/1/5/25/100 chips), BetSpot (tap to add, long-press to clear), DiceRoller (player taps/holds to roll, 3D-ish tumble in Pixi), CardDealer (deal from shoe with slide+flip), Paytable modal (built from BetDefinition), Info modal (rules text from markdown), RtpPanel (rounds played, total wagered, total won, live RTP per bet vs declared RTP, with a convergence sparkline), TurboMode toggle (skips animations) and AutoPlay (N rounds, stops on bankroll 0), Bankroll display, Sound toggle (WebAudio, no external assets).
- Persistence: localStorage only for bankroll, settings and RTP stats; wrap in try/catch and handle absence.

## Testing standard
- Unit tests for Shoe (composition, reshuffle, penetration) and RNG (seeded reproducibility).
- Each game ships an exact-math test where it is enumerable and a Monte Carlo test (≥ 2,000,000 rounds with seeded RNG, infinite-shoe mode) asserting simulated house edge equals the declared value within ±0.15 percentage points.
- CI runs the full suite; Monte Carlo tests may run in a separate `test:math` script if they exceed 60 s.

## Deliverables for this prompt
1. Initialise the repo, commit in small logical commits with conventional-commit messages.
2. Implement packages/engine (RNG, Shoe, dice, Game interface, settlement helper, progressive) with tests.
3. Implement packages/ui with a Storybook-free playground page (apps/lobby/dev.html) showing every component.
4. Implement apps/lobby with a lobby grid of four game cards (placeholders) and routing.
5. Write README.md (purpose, architecture, how to run, how the engine is designed to move server-side unchanged) and docs/ARCHITECTURE.md.
6. Set up GitHub Actions for lint/test/build and Pages deploy.

Do not implement any game rules yet. Ask me before adding any runtime dependency beyond PixiJS.

---

## Follow-up in the same session

> can you take a screenshot to show me how it is looking please?

Answered with screenshots of the lobby, a table page, the dice, the card dealer, the betting
controls and the RTP panel. No code changed.
