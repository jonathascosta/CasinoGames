import { defineBets } from '../../game/validation.ts';
import { DOBROS_ODDS, ENTRE_ODDS, EXATO_ODDS, OLHO_DE_BOI_ODDS, TRIPLO_ODDS } from './rules.ts';

/**
 * The bets of Entre Dados and their declared math, with the card treated as
 * uniform over ace to six (an infinite shoe). Every figure is an exact
 * fraction:
 *  - entre-dados.test.ts enumerates the 36 rolls × 6 card values through the
 *    game and requires each RTP, probability and σ to match;
 *  - entre-dados.math.test.ts plays a seeded Monte Carlo run against the
 *    real six-deck shoe and requires every RTP within ±0.15 pp.
 */
export const ENTRE_DADOS_BETS = defineBets([
  {
    id: 'entre',
    label: 'Entre',
    kind: 'main',
    min: 50,
    max: 25_000,
    // Loses 1/27 per unit staked: only the spread-2 line is below fair odds.
    rtp: 26 / 27,
    standardDeviation: Math.sqrt(3641) / 54,
    description:
      'Wins when the card falls strictly between the two dice, at odds set by the spread ' +
      '(high die minus low die). A pair or dice one apart push.',
    paytable: [
      { id: 'spread-2', label: 'Spread 2, card between', odds: ENTRE_ODDS[2], probability: 1 / 27 },
      { id: 'spread-3', label: 'Spread 3, card between', odds: ENTRE_ODDS[3], probability: 1 / 18 },
      { id: 'spread-4', label: 'Spread 4, card between', odds: ENTRE_ODDS[4], probability: 1 / 18 },
      { id: 'spread-5', label: 'Spread 5, card between', odds: ENTRE_ODDS[5], probability: 1 / 27 },
      { id: 'push', label: 'Spread 1, or a pair', push: true, probability: 4 / 9 },
    ],
  },
  {
    id: 'exato',
    label: 'Exato',
    kind: 'side',
    min: 50,
    max: 2_500,
    rtp: 11 / 12,
    standardDeviation: Math.sqrt(275) / 12,
    description: 'Wins when the card equals either die.',
    paytable: [
      { id: 'match', label: 'Card matches a die', odds: EXATO_ODDS, probability: 11 / 36 },
    ],
  },
  {
    id: 'olho-de-boi',
    label: 'Olho de Boi',
    kind: 'side',
    min: 50,
    max: 2_500,
    rtp: 23 / 27,
    standardDeviation: Math.sqrt(13754) / 27,
    description: "Bull's eye: wins when the dice are two apart and the card is the value between.",
    paytable: [
      {
        id: 'bullseye',
        label: 'Spread 2, card is the middle value',
        odds: OLHO_DE_BOI_ODDS,
        probability: 1 / 27,
      },
    ],
  },
  {
    id: 'dobros',
    label: 'Dobros',
    kind: 'side',
    min: 50,
    max: 2_500,
    rtp: 5 / 6,
    standardDeviation: Math.sqrt(125) / 6,
    description: 'Wins when the dice show a pair.',
    paytable: [{ id: 'pair', label: 'The dice are a pair', odds: DOBROS_ODDS, probability: 1 / 6 }],
  },
  {
    id: 'triplo',
    label: 'Triplo',
    kind: 'side',
    min: 50,
    max: 2_500,
    rtp: 31 / 36,
    standardDeviation: Math.sqrt(33635) / 36,
    description: 'Wins when the dice show a pair and the card matches it.',
    paytable: [
      {
        id: 'triple',
        label: 'A pair, and the card matches it',
        odds: TRIPLO_ODDS,
        probability: 1 / 36,
      },
    ],
  },
]);
