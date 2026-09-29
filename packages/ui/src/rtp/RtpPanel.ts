import type { BetMath, MathSummary } from '@casinogames/engine';
import { Disposer, h } from '../dom/h.ts';
import { icon } from '../dom/icons.ts';
import { formatCents, formatCount, formatPercent, formatPoints } from '../format/format.ts';
import type { BetTally, RtpSample, RtpStats, RtpTracker } from './RtpTracker.ts';
import { renderSparkline } from './sparkline.ts';
import './rtp-panel.css';

export interface RtpPanelOptions {
  readonly tracker: RtpTracker;
  /** Declared figures per bet (labels, RTP, σ), in display order. */
  readonly math: MathSummary;
  /** Starts collapsed. Default false. */
  readonly collapsed?: boolean;
}

/**
 * Live RTP monitor: rounds, wagered, won, and per bet the live RTP next to
 * the declared value with a convergence sparkline. It makes the math visible:
 * anyone can play a few hundred rounds (or autoplay) and watch each bet
 * settle into its band.
 */
export class RtpPanel {
  readonly element: HTMLDetailsElement;
  readonly #options: RtpPanelOptions;
  readonly #body: HTMLDivElement;
  readonly #headline: HTMLSpanElement;
  readonly #disposer = new Disposer();
  #frame = 0;

  constructor(options: RtpPanelOptions) {
    this.#options = options;
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
          'Live RTP = total won ÷ total wagered. The shaded band is where it should sit 95% of the time after n rounds (declared ± 1.96·σ/√n).',
        ),
        reset,
      ),
    );
    this.#disposer.listen(reset, 'click', () => {
      options.tracker.reset();
    });
    // Rounds can settle far faster than frames (turbo autoplay, batch runs):
    // render at most once per animation frame.
    this.#disposer.add(
      options.tracker.subscribe(() => {
        this.#frame ||= requestAnimationFrame(() => {
          this.#frame = 0;
          this.#render(options.tracker.stats);
        });
      }),
    );
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
    const liveRtp = stats.staked === 0 ? Number.NaN : stats.returned / stats.staked;
    this.#headline.textContent =
      stats.rounds === 0
        ? 'No rounds yet'
        : `${formatPercent(liveRtp)} · ${formatCount(stats.rounds)} rounds`;
    this.#body.replaceChildren(
      h(
        'dl',
        { class: 'cg-rtp__totals' },
        total('Rounds', formatCount(stats.rounds)),
        total('Wagered', formatCents(stats.staked)),
        total('Won', formatCents(stats.returned)),
        total('Net', formatCents(stats.returned - stats.staked, { sign: true })),
      ),
      h(
        'ul',
        { class: 'cg-rtp__bets' },
        ...this.#options.math.bets.map((bet) => renderBet(bet, stats.bets[bet.betId])),
      ),
    );
  }
}

function total(label: string, value: string): HTMLElement {
  return h('div', null, h('dt', null, label), h('dd', { class: 'cg-num' }, value));
}

function renderBet(bet: BetMath, tally: BetTally | undefined): HTMLElement {
  const rounds = tally?.rounds ?? 0;
  const live =
    tally === undefined || tally.staked === 0 ? Number.NaN : tally.returned / tally.staked;
  const samples: RtpSample[] = [...(tally?.history ?? [])];
  if (tally !== undefined && (samples.at(-1)?.rounds ?? 0) < rounds)
    samples.push({ rounds, rtp: live });

  return h(
    'li',
    { class: 'cg-rtp__bet' },
    h(
      'div',
      { class: 'cg-rtp__bet-name' },
      h('strong', null, bet.label),
      h('span', { class: 'cg-num' }, `${formatCount(rounds)} rounds`),
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
    ),
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
