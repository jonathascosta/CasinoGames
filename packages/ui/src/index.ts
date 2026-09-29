/**
 * @casinogames/ui — the shared table kit. DOM + CSS chrome components, and a
 * PixiJS layer (loaded on demand) for the dice and card animations.
 * Import '@casinogames/ui/theme.css' once per page.
 */
export { Disposer, append, h, svg, type AttributeValue, type Child, type Props } from './dom/h.ts';
export { icon, type IconName } from './dom/icons.ts';
export {
  formatCents,
  formatChip,
  formatCount,
  formatPercent,
  formatPoints,
} from './format/format.ts';
