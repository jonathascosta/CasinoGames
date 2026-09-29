/**
 * Reads a colour custom property (e.g. --die-face) as a 0xRRGGBB number so
 * canvas renderers follow the CSS theme. Accepts #rgb and #rrggbb.
 */
export function readCssColor(element: Element, property: string, fallback: number): number {
  const raw = getComputedStyle(element).getPropertyValue(property).trim();
  return parseHexColor(raw) ?? fallback;
}

export function parseHexColor(value: string): number | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (match === null) return undefined;
  let hex = match[1]!;
  if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
  return Number.parseInt(hex, 16);
}

/** Multiplies a colour's channels by `factor` (clamped to 0–255). */
export function shade(color: number, factor: number): number {
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((color >> shift) & 0xff) * factor)));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Mixes `color` towards `target` by `amount` (0–1). */
export function mix(color: number, target: number, amount: number): number {
  const channel = (shift: number) => {
    const a = (color >> shift) & 0xff;
    const b = (target >> shift) & 0xff;
    return Math.round(a + (b - a) * amount);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
