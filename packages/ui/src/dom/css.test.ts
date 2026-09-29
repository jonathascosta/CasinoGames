import { describe, expect, it } from 'vitest';
import { mix, parseHexColor, readCssColor, shade } from './css.ts';

describe('colour helpers', () => {
  it('parses #rgb and #rrggbb', () => {
    expect(parseHexColor('#fbf6ea')).toBe(0xfbf6ea);
    expect(parseHexColor('#abc')).toBe(0xaabbcc);
    expect(parseHexColor('red')).toBeUndefined();
  });

  it('reads custom properties with a fallback', () => {
    const el = document.createElement('div');
    el.style.setProperty('--die-face', '#123456');
    document.body.append(el);
    expect(readCssColor(el, '--die-face', 0)).toBe(0x123456);
    expect(readCssColor(el, '--missing', 0xabcdef)).toBe(0xabcdef);
    el.remove();
  });

  it('shades and mixes channels', () => {
    expect(shade(0x808080, 0.5)).toBe(0x404040);
    expect(shade(0xffffff, 2)).toBe(0xffffff);
    expect(mix(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });
});
