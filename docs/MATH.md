# Math notes

These are the conventions and methods behind every declared figure in this repository. Each game
sheet in [games/](games/) applies them to one game. The code lives in
[`packages/engine/src/math`](../packages/engine/src/math). The two test fixtures,
[`dice-fixture.ts`](../packages/engine/src/fixtures/dice-fixture.ts) and
[`war-fixture.ts`](../packages/engine/src/fixtures/war-fixture.ts), serve as the worked examples
below.

## Conventions

### RTP and house edge

- **RTP of a bet** is Σ payout ÷ Σ stake over every round in which the bet is settled. The payout
  is everything handed back, stake included (0 on a loss, the stake on a push). The stake includes
  any amount added to that bet during the round, such as a raise. The **house edge** is 1 − RTP.
- **RTP of the game** is the same ratio over all bets together.
- Declared RTPs assume the reference strategy stated on the game sheet, which is the optimal
  strategy whenever the game has decisions.

Per-bet figures need care in games with decisions. A bet that is only made in favourable spots can
return more than it takes. In the war fixture the player raises (places a "play" bet equal to the
ante) only when holding 8 or better:

| Figure                                     | War fixture      |
| :----------------------------------------- | :--------------- |
| Ante RTP                                   | 120/169 ≈ 71.01% |
| Play RTP (made in 6/13 of rounds)          | 20/13 ≈ 153.85%  |
| Game RTP                                   | 240/247 ≈ 97.17% |
| House edge per initial wager (loss ÷ ante) | 7/169 ≈ 4.14%    |
| Element of risk (loss ÷ everything staked) | 7/247 ≈ 2.83%    |

For games with decisions, a sheet therefore quotes the game RTP and both house-edge conventions
usual for table games. All of them derive exactly from the `expectedStake` and `expectedPayout`
that `exactReturns` reports.

The fixture's strategy is deliberately simple rather than optimal. Raising with a card of rank r
is worth 2(2r − 14)/13 per unit of ante, against −1 for folding, so optimal play raises on 4 or
better and would give the player an edge of 21/169 ≈ 12.4% of the ante. The fixture exists to
exercise decisions and added stakes, not to be a good game.

### Payouts, odds and breakage

- Odds use "to" notation: at _a_ to _b_, a winning stake _s_ is paid _s_ + ⌊_s_·_a_/_b_⌋ in total.
- Money is integer cents, and the fraction of a cent (breakage) stays with the house.
- Declared RTPs assume exact payouts. Paytables should use odds whose _b_ divides 50·_a_ (3 to 2,
  6 to 5, 9 to 2…), which pay exactly at every multiple of the smallest chip (50¢). The tests stake
  amounts where this holds. With other odds, breakage can only lower the realised RTP, never raise
  it.

### Statistics reported per bet

| Statistic             | Definition                                                                                                                                                                                                                                                  |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `probability`         | Per paytable entry: exact chance per round that this entry decides the bet (enumerable games)                                                                                                                                                               |
| `frequency`           | Chance that the bet is made in a round (1 for bets placed up front)                                                                                                                                                                                         |
| `hitFrequency`        | Chance that the bet wins, given that it is made                                                                                                                                                                                                             |
| `pushFrequency`       | Chance that the stake is simply returned, given that the bet is made                                                                                                                                                                                        |
| `maxExposure`         | Largest net win per unit staked, from the fixed-odds entries: the house's worst case per unit                                                                                                                                                               |
| `breakdown`           | For a bet whose lines name the condition they are paid under (Alvo Móvel's target): per value, its chance and the hit frequency, RTP and house edge given it                                                                                                |
| `progressive`         | For a bet with a progressive meter (Espelho's 6-6 vs 6-6): its terms, and the RTP excluding the seed, the RTP at the seed, the break-even meter, the cycle, the seed's cost and the exposure at the seed                                                    |
| `finiteShoe`          | Exact figures on the table's own shoe, when every round deals the same cards (Espelho): RTP and hit frequency                                                                                                                                               |
| `standardDeviation` σ | Standard deviation of (payout − RTP·stake) in a round where the bet is made, per unit of average stake; for a fixed stake, the ordinary σ of the net result per unit staked. Game sheets call it the volatility index; `exactReturns` also gives σ² exactly |

The exact enumerator and the simulator use the same definitions, so their figures are directly
comparable.

## Randomness

- Production draws come from `crypto.getRandomValues` (`createCryptoRng`). Tests, simulations and
  replays use `createSeededRng`: xoshiro128\*\* 1.1 seeded through SplitMix64, and checked against
  the reference C implementation.
- Both sources return _k_/2³² for a uniform 32-bit _k_. `randomInt(rng, n)` rejects the incomplete
  top bucket (2³² mod _n_ values) and redraws, so each integer in [0, _n_) has probability exactly
  1/_n_. A die is `1 + randomInt(rng, 6)`.
- Shuffles are Fisher–Yates with `randomInt`, so every ordering is equally likely given an ideal
  source. A seeded generator's 128-bit state cannot reach every ordering of a multi-deck shoe. That
  makes no difference to statistics, but it is one reason real play never uses the seeded
  generator.
- Uniformity is checked with chi-square tests at _p_ > 0.001 on seeded streams: `randomInt`, die
  faces and totals, the first card after 52,000 shuffles, and 240,000 infinite-shoe draws. The
  seeds are fixed, so these tests are deterministic and cannot flake.

## Card sources: finite and infinite shoes

- **Declared figures use an infinite shoe.** Each card is drawn independently and uniformly from
  one deck's composition. This makes every game with dice and cards exactly enumerable, and it is
  the usual basis for published table-game figures.
- **Tables deal from a finite shoe**: N decks, with a cut card at 75% penetration. Removing cards
  shifts the odds slightly from round to round. Each game sheet reports the finite-shoe RTP,
  simulated with the real `Shoe`, whenever it differs materially. For bets that depend on specific
  cards, the sheet also states whether card counting could gain an edge at the configured
  penetration. The [Entre Dados sheet](games/entre-dados.md#card-counting) is the worked example:
  its counting exposure is computed exactly, as a hypergeometric sum over the rounds of a shoe,
  and asserted by a test.
- **When the finite shoe changes the long run.** One card per round, with a fixed number of rounds
  per shoe (Entre Dados), leaves the long-run RTP equal to the infinite shoe's. Several cards per
  round do not: within a round the cards are drawn without replacement, and the number of rounds a
  shoe deals depends on its cards. The [Alvo Móvel sheet](games/alvo-movel.md#the-six-deck-shoe)
  is the worked example. It computes the first round after a shuffle exactly (a recursion over the
  values drawn from a full shoe), simulates the long run, and publishes both per bet and per
  target.
- **When the finite shoe's figures are exact.** Several cards per round, but always the same number
  and a fixed number of rounds per shoe (Espelho: two cards, 54 rounds), put every round's cards at
  fixed positions of a uniformly shuffled shoe: a uniform draw from the full shoe, however deep it
  has been dealt. The first round's exact figures are then the long-run figures. The
  [Espelho sheet](games/espelho.md#card-source) proves them by running the game over every pair of
  cards a full shoe can deal, declares them in the bets (`finiteShoe`), and confirms them by
  simulating the real shoe.

## Exact method

`exactReturns(createGame, bets, strategy?)` runs the real game over **every possible sequence of
draws** and weighs each result by its exact probability:

1. The game receives an `IntegerRng` whose draws come from a script. When the game asks for a draw
   past the end of the script, enumeration branches on every value 0…*n*−1 of that draw, each with
   probability 1/_n_ of its parent, and replays the round.
2. Every complete path yields the round's settlement and its probability, a `Fraction` of BigInts.
3. Exact first and second moments of stake and payout per bet give RTP, frequencies and σ.

```ts
const report = exactReturns(
  () => createWarFixture(new Shoe({ decks: Infinity })),
  { ante: 100 },
  raiseOnEightOrBetter,
);
report.outcomes; // 2,704 = 52 player cards × 52 dealer cards
report.bets.ante!.rtp.toString(); // '120/169'
report.total.rtp.toString(); // '240/247'
```

Because the shipped game code runs on every branch, the result checks the implementation itself,
not a separate model of the rules. Each exact test asserts the fraction (`'120/169'`) and that
`rtp.toNumber()` equals the declared `rtp` bit for bit. `Fraction.toNumber()` is correctly rounded,
as is the JavaScript literal `120 / 169`, so the two always agree when the fractions do.

Enumeration applies to sources with no hidden state between draws: dice and infinite shoes. A
shuffled finite shoe has far too many orderings. The work grows with the product of the draw
ranges: 36 paths for two dice, 36 × 52³ for two dice and three cards. `maxOutcomes` (default
5,000,000) guards against runaway trees. The enumerator also fails loudly if a replay draws a
different number of values, which would mean the game is not deterministic.

| Fixture | Paths | Exact RTP per bet                     | Game RTP |
| :------ | ----: | :------------------------------------ | :------- |
| Dice    |    36 | Over 7: 5/6 · Doubles (9 to 2): 11/12 | 7/8      |
| War     | 2,704 | Ante: 120/169 · Play: 20/13           | 240/247  |

## Monte Carlo method

Each game ships a seeded simulation with its reference strategy. The test asserts |simulated RTP −
declared RTP| ≤ 0.15 percentage points for every bet. The fixtures deal from an infinite shoe.
Entre Dados deals from its real six-deck shoe: one card per round and a fixed number of rounds per
shoe keep its long-run RTP equal to the infinite-shoe figure, and the run checks the shoe's
reshuffles and cut card along the way.

Where the real shoe returns different figures, as in Alvo Móvel, the check against the declared
RTP runs on an infinite shoe, the source the figures assume, through the production game. A second
seeded run on the real shoe then measures each bet's shift, sized to the precision wanted rather
than to the ±0.15 pp tolerance, bounds it, and prints the table the game sheet publishes. Where the
real shoe's figures are exact (Espelho), the second run checks it against them.

Some bets are too volatile for ±0.15 pp at any practical size: Espelho Perfeito (200 to 1, σ 13.6)
would need about 0.9 billion rounds and 6-6 vs 6-6 (σ 33 with its meter at the seed) about 5.4
billion. A suite is sized by the bets it can hold to ±0.15 pp within 200 million rounds; the others
are held to 3.29 of their own standard errors, and their exact tests are the proof.

### Sizing the run

A fixed round count does not give a fixed confidence. The standard error of a simulated RTP is
σ/√*n*:

- Even money (σ = 1) over 2,000,000 rounds has a standard error of 0.071 pp. ±0.15 pp is then only
  2.1 standard errors, so a _correct_ implementation would fail on about 3.4% of seeds.
- A volatile side bet with σ = 5 has a standard error of 0.35 pp at 2,000,000 rounds, which makes
  a ±0.15 pp assertion meaningless.

The suites therefore size each run so that the tolerance is 3.29 standard errors, a 99.9%
two-sided confidence (`roundsForTolerance`):

> _n_ = max(2,000,000, ⌈(3.29 · σ / 0.0015)²⌉), divided by the bet's `frequency` when the bet is
> not made every round.

σ is taken from the exact report, so the suite sizes itself.

| Bet                                    |     σ | Rounds needed |
| :------------------------------------- | ----: | ------------: |
| Any even-money bet                     | 1.000 |     4,810,712 |
| Dice fixture, Over 7                   | 0.986 |     4,677,081 |
| Dice fixture, Doubles (9 to 2)         | 2.050 |    20,211,669 |
| War fixture, Ante                      | 0.938 |     4,235,501 |
| War fixture, Play (made in 6/13)       | 0.796 |     6,599,310 |
| Entre Dados, Triplo (30 to 1)          | 5.094 |   124,852,059 |
| Alvo Móvel, Primeira Carta (9 to 1)    | 2.886 |    40,055,852 |
| Alvo Móvel, six-deck shift to ±0.07 pp | 2.886 |   183,929,931 |
| Espelho, Par vs Par (30 to 1)          | 5.094 |   124,852,059 |
| Espelho, six-deck run to ±0.3 pp       | 5.094 |    31,213,015 |

A run covers all bets of a game at once, sized by its most demanding bet. The dice suite plays
20,211,669 rounds. The war suite plays 9,176,919: the ante's requirement divided by the play bet's
frequency. The Entre Dados suite plays 124,852,059 rounds, sized by Triplo. The Alvo Móvel suite
on an infinite shoe plays 40,055,852 rounds, sized by Primeira Carta; its six-deck run plays
183,929,931, enough to measure each shift to ±0.07 pp at 3.29 standard errors. The Espelho suite on
an infinite shoe plays 124,852,059 rounds, sized by Par vs Par; its six-deck run plays 31,213,015.
The suites run in parallel; on a CI runner the whole `pnpm test:math` takes about six minutes.

### What it catches

The seed is fixed, so the outcome of each test is deterministic. At this sizing, a declared RTP
that is wrong by 0.3 pp or more fails with a probability of at least 99.95%. Smaller errors may
pass, which is why the exact test is the primary proof.

The Monte Carlo test covers what enumeration cannot:

- It exercises the production draw path, `next()` with rejection sampling, instead of the
  enumerator's integer script.
- It reuses one game object for millions of rounds, so state leaking between rounds shows up. The
  enumerator creates a fresh game for every path.

### Standard errors when stakes vary

When decisions add stake, RTP is a ratio of two random sums. The simulator estimates it as
Σ payout ÷ Σ stake and uses the delta method for its standard error:
SE = √(Σ(payout − RTP·stake)² / (_n_ − 1)) ÷ mean stake ÷ √*n*. For a fixed stake this reduces to
the usual σ/√*n*.

## The RTP panel's band

The RTP panel's sparkline shades a band of declared RTP ± 1.96·σ/√*n*, where _n_ is the number of
rounds of the bet played so far. At any point, the live RTP should fall inside it 95% of the time.
For an even-money bet the band is ±6.2 pp after 1,000 rounds and ±0.62 pp after 100,000. It shows
players that early swings are expected and that convergence is slow. The panel needs the bet's
`standardDeviation` for this, which is one reason bet definitions declare it.

## Progressive jackpots

`ProgressiveJackpot` models a pool with seed _J₀_ and contribution rate _c_:

- Every qualifying stake _s_ adds _c_·_s_ to the pool. Amounts are tracked in millionths of a cent,
  so nothing is rounded away.
- An award pays ⌊share × pool⌋ in whole cents. The remainder stays in the pool, and the house tops
  the pool back up to _J₀_ if it fell below.
- Money is conserved exactly, and a test checks it:
  **awarded = _J₀_ + contributed + seed funding − current pool**.

**Long-run RTP.** Take a bet with a full-pool jackpot (share 1) and no cap. Let _p_ be the chance of
hitting it in a round. Each hit pays _J₀_ plus everything contributed since the previous hit, so
over many rounds the jackpot returns _p_·_J₀_ + _c_·_s_ per round. The bet's long-run RTP is
therefore

> RTP = RTP₀ + _c_,

where RTP₀ is the RTP computed as if the jackpot always paid exactly its seed. For example, a side
bet that returns 88% with the jackpot valued at its seed, and contributes 4% of every stake,
returns 92% in the long run.

The formula stops holding with partial awards or when the pool reaches its cap:

- With partial awards, the house tops up less often, so seed funding per round falls below
  _p_·_J₀_.
- With a cap, the effective contribution rate falls below _c_.

In those cases the declared RTP comes from simulating the pool itself. The conservation identity
keeps that accounting exact.

**A meter fed by its own bet and paid in proportion to the stake.** Espelho's 6-6 vs 6-6 pays fixed
odds plus stake ÷ _F_ of the meter, _F_ being the stake that wins it all; 10% of every stake on the
bet feeds the meter, and a hit leaves the rest of it there (topped up to the seed if it fell
below). Let _p_ be the chance of the hit and RTP₀ the fixed pays' RTP.

- **Return excluding the seed.** Every contribution leaves the meter as part of some share, so over
  the long run the players get back RTP₀ + _c_: 77.24% + 10% = 87.24%. This is the declared RTP;
  the seed and the top-ups are the house's money.
- **Return at a meter _M_.** A hit pays _M_ ÷ _F_ per unit staked whatever the stake, so one round
  returns RTP₀ + _p_·_M_ ÷ _F_, and the bet breaks even at _M_\* = (1 − RTP₀)·_F_ ÷ _p_: 7,375.00.
- **The meter at a hit.** If every cycle starts at the seed, it averages _J₀_ + _c_·_s̄_ ÷ _p_ for a
  mean stake _s̄_. That is exact at a constant _F_, where each hit takes the whole meter. Smaller
  stakes leave part of the meter behind, so it settles higher; the Monte Carlo suites measure it.
- **The seed's cost.** At a constant _F_ the house re-seeds _J₀_ after every hit: _p_·_J₀_ per
  round, 15.43% of the stake for Espelho, more than the 12.76% the bet holds excluding the seed.

The exact test checks the fixed pays with the meter at zero and one round's return with the meter
frozen at a value; the conservation identity checks the rest, to the millionth of a cent.

## Checklist for every game

1. Declare `rtp` (as an exact fraction such as `120 / 169`), `standardDeviation` and per-entry
   `probability` in the bet definitions.
2. Exact test: `exactReturns` equals the declared fraction for every bet and for the game, under
   the reference strategy.
3. Monte Carlo test: seeded, rounds sized as above, every bet within ±0.15 pp and every hit and
   push frequency within 3.29 binomial standard errors, on the card source the declared figures
   assume.
4. Finite shoe: simulate the real `Shoe` with its cut card and report the difference if it is
   material (Alvo Móvel publishes it per bet and per target; Espelho declares its exact six-deck
   figures); when a bet depends on the composition, measure its card counting exposure.
5. Register the game in `packages/engine/src/games`, run `pnpm docs:sheets`, and commit the
   regenerated sheet. CI's `pnpm docs:check` keeps it in sync from then on.
