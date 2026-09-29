import { svg } from '../dom/h.ts';
import { formatCount, formatPercent } from '../format/format.ts';
import type { RtpSample } from './RtpTracker.ts';

export interface SparklineOptions {
  readonly samples: readonly RtpSample[];
  readonly declared: number;
  /** When known, draws the 95% band declared ± 1.96·σ/√n. */
  readonly standardDeviation?: number;
  readonly width?: number;
  readonly height?: number;
}

const Z_95 = 1.96;

/**
 * Live RTP against rounds played (log scale), with the declared RTP as a
 * dashed line and, when σ is known, the band the live figure should stay in
 * 95% of the time. Watching the band narrow around the line is the point:
 * convergence, not luck.
 */
export function renderSparkline(options: SparklineOptions): SVGSVGElement {
  const { samples, declared, standardDeviation } = options;
  const width = options.width ?? 160;
  const height = options.height ?? 44;
  const pad = 3;
  const last = samples.at(-1);

  const root = svg('svg', {
    class: 'cg-sparkline',
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: 'img',
    'aria-label':
      last === undefined
        ? `No rounds yet; declared RTP ${formatPercent(declared)}`
        : `Live RTP ${formatPercent(last.rtp)} after ${formatCount(last.rounds)} rounds; ` +
          `declared ${formatPercent(declared)}`,
  });
  if (last === undefined) return root;

  const maxLog = Math.max(1, Math.log10(Math.max(10, last.rounds)));
  const x = (rounds: number) =>
    pad + (Math.log10(Math.max(1, rounds)) / maxLog) * (width - pad * 2);
  // Vertical span: at least ±3 pp, enough for the samples after the first few rounds.
  const settled = samples.filter((sample) => sample.rounds >= 10);
  const deviation = Math.max(0.03, ...settled.map((sample) => Math.abs(sample.rtp - declared)));
  const span = Math.min(0.6, deviation * 1.15);
  const y = (rtp: number) => {
    const clamped = Math.max(declared - span, Math.min(declared + span, rtp));
    return height / 2 - ((clamped - declared) / span) * (height / 2 - pad);
  };

  if (standardDeviation !== undefined) {
    const steps = 32;
    const first = samples[0]!.rounds;
    const upper: string[] = [];
    const lower: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const rounds = first * (last.rounds / first) ** (i / steps);
      const half = (Z_95 * standardDeviation) / Math.sqrt(rounds);
      upper.push(`${x(rounds).toFixed(1)},${y(declared + half).toFixed(1)}`);
      lower.unshift(`${x(rounds).toFixed(1)},${y(declared - half).toFixed(1)}`);
    }
    root.append(
      svg('polygon', { class: 'cg-sparkline__band', points: [...upper, ...lower].join(' ') }),
    );
  }

  root.append(
    svg('line', {
      class: 'cg-sparkline__declared',
      x1: pad,
      x2: width - pad,
      y1: y(declared).toFixed(1),
      y2: y(declared).toFixed(1),
    }),
    svg('polyline', {
      class: 'cg-sparkline__series',
      points: samples.map((s) => `${x(s.rounds).toFixed(1)},${y(s.rtp).toFixed(1)}`).join(' '),
    }),
    svg('circle', {
      class: 'cg-sparkline__last',
      cx: x(last.rounds).toFixed(1),
      cy: y(last.rtp).toFixed(1),
      r: 2.5,
    }),
  );
  return root;
}
