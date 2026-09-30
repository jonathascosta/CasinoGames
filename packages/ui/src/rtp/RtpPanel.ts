import {
  progressiveRtpAtMeter,
  type BetMath,
  type Cents,
  type MathSummary,
} from '@casinogames/engine';
import { Disposer, h } from '../dom/h.ts';
import { icon } from '../dom/icons.ts';
import { formatCents, formatCount, formatPercent, formatPoints } from '../format/format.ts';
import type { Store } from '../state/store.ts';
import {
  liveRtp,
  type BetTally,
  type RtpSample,
  type RtpStats,
  type RtpTracker,
} from './RtpTracker.ts';
import { renderSparkline } from './sparkline.ts';
import './rtp-panel.css';

export interface RtpPanelOptions {
  readonly tracker: RtpTracker;
  /** Declared figures per bet (labels, RTP, σ), in display order. */
  readonly math: MathSummary;
  /** Starts collapsed. Default false. */
  readonly collapsed?: boolean;
  /**
   * Live progressive meters by jackpot id: a progressive bet then shows its
   * RTP at the current meter beside the declared one, which excludes the seed.
   */
  readonly meters?: Readonly<Record<string, Store<Cents>>>;
}

/**
 * Live RTP monitor: rounds, wagered, won, and per bet the live RTP next to
 * the declared value with a convergence sparkline. It makes the math visible:
 * anyone can play a few hundred rounds (or autoplay) and watch each bet
 * settle into its band. In a game whose choices cost a fee (Lock & Roll's
 * re-roll), the fees show beside the totals and count against the return,
 * as they do in the declared RTP.
 */
export class RtpPanel {
  readonly element: HTMLDetailsElement;
  readonly #options: RtpPanelOptions;
  readonly #body: HTMLDivElement;
  readonly #headline: HTMLSpanElement;
  /** Whether the game's choices can cost a fee: its figures and the live RTP count them. */
  readonly #fees: boolean;
  readonly #disposer = new Disposer();
  #frame = 0;

  constructor(options: RtpPanelOptions) {
    this.#options = options;
    this.#fees = options.math.decisions?.figures.some((rules) => rules.averageFee > 0) ?? false;
    this.#headline = h('span', { class: 'cg-rtp__headline cg-num' });
    this.#body = h('div', { class: 'cg-rtp__body' });
    const reset = h(
      'button',
      { type: 'button', class: 'cg-btn cg-btn--ghost cg-rtp__reset' },
      icon('reset'),
      'Reset stats',
    );
    this.element = h(
      'details',
      { class: 'cg-rtp cg-panel', open: options.collapsed !== true },
      h(
        'summary',
        { class: 'cg-rtp__summary' },
        icon('chart'),
        h('span', { class: 'cg-rtp__title' }, 'RTP monitor'),
        this.#headline,
      ),
      this.#body,
      h(
        'footer',
        { class: 'cg-rtp__footer' },
        h(
          'p',
          { class: 'cg-rtp__note' },
          this.#fees
            ? 'Live RTP = (total won − fees) ÷ total wagered: a fee is never returned, and it is ' +
                'not a wager. The shaded band is where it should sit 95% of the time after n ' +
                'rounds (declared ± 1.96·σ/√n).'
            : 'Live RTP = total won ÷ total wagered. The shaded band is where it should sit 95% ' +
                'of the time after n rounds (declared ± 1.96·σ/√n).',
        ),
        reset,
      ),
    );
    this.#disposer.listen(reset, 'click', () => {
      options.tracker.reset();
    });
    // Rounds can settle far faster than frames (turbo autoplay, batch runs):
    // render at most once per animation frame.
    const schedule = () => {
      this.#frame ||= requestAnimationFrame(() => {
        this.#frame = 0;
        this.#render(options.tracker.stats);
      });
    };
    this.#disposer.add(options.tracker.subscribe(schedule));
    for (const meter of Object.values(options.meters ?? {})) {
      this.#disposer.add(meter.subscribe(schedule));
    }
    this.#disposer.add(() => {
      cancelAnimationFrame(this.#frame);
    });
    this.#render(options.tracker.stats);
  }

  destroy(): void {
    this.#disposer.dispose();
    this.element.remove();
  }

  #render(stats: RtpStats): void {
    this.#headline.textContent =
      stats.rounds === 0
        ? 'No rounds yet'
        : `${formatPercent(liveRtp(stats))} · ${formatCount(stats.rounds, 'round')}`;
    const fees = this.#fees || stats.fees > 0;
    this.#body.replaceChildren(
      h(
        'dl',
        { class: 'cg-rtp__totals' },
        total('Rounds', formatCount(stats.rounds)),
        total('Wagered', formatCents(stats.staked)),
        total('Won', formatCents(stats.returned)),
        fees ? total('Fees', formatCents(stats.fees)) : null,
        total('Net', formatCents(stats.returned - stats.staked - stats.fees, { sign: true })),
      ),
      h(
        'ul',
        { class: 'cg-rtp__bets' },
        ...this.#options.math.bets.map((bet) =>
          renderBet(bet, stats.bets[bet.betId], {
            shoe: this.#options.math.finiteShoe,
            meter:
              bet.progressive === undefined
                ? undefined
                : this.#options.meters?.[bet.progressive.jackpotId]?.get(),
          }),
        ),
      ),
    );
  }
}

function total(label: string, value: string): HTMLElement {
  return h('div', null, h('dt', null, label), h('dd', { class: 'cg-num' }, value));
}

/** What a bet's card adds under its figures: the table's shoe, and a progressive's meter. */
interface BetExtras {
  readonly shoe: string | undefined;
  readonly meter: Cents | undefined;
}

function renderBet(bet: BetMath, tally: BetTally | undefined, extras: BetExtras): HTMLElement {
  const rounds = tally?.rounds ?? 0;
  const live = tally === undefined ? Number.NaN : liveRtp(tally);
  const samples: RtpSample[] = [...(tally?.history ?? [])];
  if (tally !== undefined && (samples.at(-1)?.rounds ?? 0) < rounds)
    samples.push({ rounds, rtp: live });

  const notes = renderNotes(bet, extras);
  return h(
    'li',
    { class: notes === null ? 'cg-rtp__bet' : 'cg-rtp__bet cg-rtp__bet--noted' },
    h(
      'div',
      { class: 'cg-rtp__bet-name' },
      h('strong', null, bet.label),
      h('span', { class: 'cg-num' }, formatCount(rounds, 'round')),
    ),
    h(
      'div',
      { class: 'cg-rtp__figure' },
      h('span', { class: 'cg-rtp__label' }, 'Live'),
      h('strong', { class: 'cg-num' }, formatPercent(live)),
      h(
        'span',
        { class: 'cg-rtp__delta cg-num' },
        Number.isNaN(live) ? '' : formatPoints(live - bet.rtp),
      ),
    ),
    h(
      'div',
      { class: 'cg-rtp__figure' },
      h('span', { class: 'cg-rtp__label' }, 'Declared'),
      h('strong', { class: 'cg-num' }, formatPercent(bet.rtp)),
      bet.progressive === undefined ? null : h('span', { class: 'cg-rtp__delta' }, 'excl. seed'),
    ),
    notes,
    h(
      'div',
      { class: 'cg-rtp__chart' },
      renderSparkline({
        samples,
        declared: bet.rtp,
        ...(bet.standardDeviation === undefined
          ? {}
          : { standardDeviation: bet.standardDeviation }),
      }),
    ),
  );
}

/**
 * The figures that qualify the declared one: a progressive bet's RTP at the
 * meter as it stands and its break-even meter, and the exact figure on the
 * table's own shoe when the game declares one.
 */
function renderNotes(bet: BetMath, { shoe, meter }: BetExtras): HTMLElement | null {
  const notes: string[] = [];
  if (bet.progressive !== undefined && meter !== undefined) {
    notes.push(
      `At the current meter (${formatCents(meter)}): ` +
        formatPercent(progressiveRtpAtMeter(bet.progressive, meter)),
      `Break-even meter ${formatCents(Math.round(bet.progressive.breakEvenMeter))}`,
    );
  }
  if (bet.finiteShoe !== undefined && shoe !== undefined) {
    notes.push(`On the ${shoe}: ${formatPercent(bet.finiteShoe.rtp)}`);
  }
  return notes.length === 0
    ? null
    : h('p', { class: 'cg-rtp__notes cg-num' }, ...notes.map((note) => h('span', null, note)));
}
