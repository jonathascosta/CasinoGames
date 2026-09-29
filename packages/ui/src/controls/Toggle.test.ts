import { describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../audio/SoundEngine.ts';
import { Motion } from '../motion/motion.ts';
import { DEFAULT_SETTINGS } from '../settings/settings.ts';
import { createStore } from '../state/store.ts';
import { Toggle, applySettings, createSoundToggle, createTurboToggle } from './Toggle.ts';

describe('Toggle', () => {
  it('is a switch that flips and reports its state', () => {
    const onChange = vi.fn();
    const toggle = new Toggle({
      label: 'Turbo mode',
      checked: false,
      onChange,
      icons: { on: 'turbo', off: 'turbo' },
    });
    expect(toggle.element.getAttribute('role')).toBe('switch');
    expect(toggle.element.getAttribute('aria-checked')).toBe('false');
    toggle.element.click();
    expect(onChange).toHaveBeenCalledWith(true);
    expect(toggle.element.getAttribute('aria-checked')).toBe('true');
  });

  it('stays in sync with the settings store in both directions', () => {
    const settings = createStore(DEFAULT_SETTINGS);
    const turbo = createTurboToggle(settings);
    const sound = createSoundToggle(settings, { showLabel: true });
    turbo.element.click();
    expect(settings.get().turbo).toBe(true);
    settings.update((s) => ({ ...s, sound: false }));
    expect(sound.checked).toBe(false);
    expect(sound.element.textContent).toBe('Sound');
    sound.destroy();
    settings.update((s) => ({ ...s, sound: true }));
    expect(sound.checked).toBe(false);
  });
});

describe('applySettings', () => {
  it('drives the motion policy and the sound engine', () => {
    const settings = createStore(DEFAULT_SETTINGS);
    const motion = new Motion({ reducedMotion: false, root: null });
    const sound = new SoundEngine();
    applySettings(settings, { motion, sound });
    expect(motion.turbo).toBe(false);
    settings.set({ turbo: true, sound: false });
    expect(motion.level).toBe('none');
    expect(sound.enabled).toBe(false);
  });
});
