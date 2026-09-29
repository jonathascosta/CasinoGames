import { svg } from './h.ts';

/**
 * Line icons drawn for this kit on a 24×24 grid (no third-party icon set).
 * They inherit `currentColor` and are hidden from assistive technology; the
 * control that holds one provides the accessible name.
 */
export type IconName =
  | 'back'
  | 'close'
  | 'info'
  | 'paytable'
  | 'chart'
  | 'sound-on'
  | 'sound-off'
  | 'turbo'
  | 'autoplay'
  | 'reset'
  | 'play'
  | 'stop';

const PATHS: Readonly<Record<IconName, readonly string[]>> = {
  back: ['M15 5l-7 7 7 7'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5.5', 'M12 7.6v.2'],
  paytable: [
    'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M8 9h8',
    'M8 12.5h8',
    'M8 16h5',
  ],
  chart: ['M4 20h16', 'M5 15l4-4 3.5 2.5L19 6', 'M15.5 6H19v3.5'],
  'sound-on': [
    'M4 9.5h3.5L12 5.5v13l-4.5-4H4z',
    'M15.5 9a4.2 4.2 0 0 1 0 6',
    'M18 6.5a7.8 7.8 0 0 1 0 11',
  ],
  'sound-off': ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M16 9.5l5 5', 'M21 9.5l-5 5'],
  turbo: ['M13 3L5.5 13.5H11L10 21l8.5-10.5H13z'],
  autoplay: [
    'M5.2 11.2A7 7 0 0 1 17.4 7.6',
    'M17.8 3.8v4h-4',
    'M18.8 12.8A7 7 0 0 1 6.6 16.4',
    'M6.2 20.2v-4h4',
  ],
  reset: ['M5 12a7 7 0 1 0 2.1-5', 'M4.6 3.6v4h4'],
  play: ['M8 5l11 7-11 7z'],
  stop: [
    'M8.5 7h7a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 15.5v-7A1.5 1.5 0 0 1 8.5 7z',
  ],
};

export function icon(name: IconName): SVGSVGElement {
  return svg(
    'svg',
    {
      class: `cg-icon cg-icon--${name}`,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    ...PATHS[name].map((d) => svg('path', { d })),
  );
}
