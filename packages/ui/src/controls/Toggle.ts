import { Disposer, h } from '../dom/h.ts';
import { icon, type IconName } from '../dom/icons.ts';
import type { SoundEngine } from '../audio/SoundEngine.ts';
import type { Motion } from '../motion/motion.ts';
import type { Settings } from '../settings/settings.ts';
import type { Store } from '../state/store.ts';
import './toggle.css';

export interface ToggleOptions {
  /** Accessible name, also shown as text when `showLabel` is set. */
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Icons for the on and off states. */
  readonly icons: { readonly on: IconName; readonly off: IconName };
  readonly showLabel?: boolean;
  /**
   * Subscribes to an external source of truth; the returned function is
   * called on destroy.
   */
  readonly bind?: (update: (checked: boolean) => void) => () => void;
}

/** An icon switch (role="switch"), used for turbo mode and sound. */
export class Toggle {
  readonly element: HTMLButtonElement;
  readonly #options: ToggleOptions;
  readonly #disposer = new Disposer();
  #checked: boolean;

  constructor(options: ToggleOptions) {
    this.#options = options;
    this.#checked = options.checked;
    this.element = h('button', {
      type: 'button',
      class: `cg-toggle${options.showLabel === true ? ' cg-toggle--labelled' : ''}`,
      role: 'switch',
      'aria-label': options.label,
      title: options.label,
    });
    this.#disposer.listen(this.element, 'click', () => {
      this.checked = !this.#checked;
      this.#options.onChange(this.#checked);
    });
    if (options.bind !== undefined) {
      this.#disposer.add(
        options.bind((checked) => {
          this.checked = checked;
        }),
      );
    }
    this.#render();
  }

  get checked(): boolean {
    return this.#checked;
  }

  /** Updates the display without firing onChange. */
  set checked(checked: boolean) {
    this.#checked = checked;
    this.#render();
  }

  destroy(): void {
    this.#disposer.dispose();
    this.element.remove();
  }

  #render(): void {
    const { icons, label, showLabel } = this.#options;
    this.element.setAttribute('aria-checked', String(this.#checked));
    this.element.replaceChildren(icon(this.#checked ? icons.on : icons.off));
    if (showLabel === true) this.element.append(h('span', { class: 'cg-toggle__label' }, label));
  }
}

/** Turbo toggle bound to the settings store (both directions). */
export function createTurboToggle(
  settings: Store<Settings>,
  options: { showLabel?: boolean } = {},
): Toggle {
  return bindToggle(settings, 'turbo', {
    label: 'Turbo mode',
    icons: { on: 'turbo', off: 'turbo' },
    ...options,
  });
}

/** Sound toggle bound to the settings store (both directions). */
export function createSoundToggle(
  settings: Store<Settings>,
  options: { showLabel?: boolean } = {},
): Toggle {
  return bindToggle(settings, 'sound', {
    label: 'Sound',
    icons: { on: 'sound-on', off: 'sound-off' },
    ...options,
  });
}

function bindToggle(
  settings: Store<Settings>,
  key: keyof Settings,
  options: Omit<ToggleOptions, 'checked' | 'onChange' | 'bind'>,
): Toggle {
  return new Toggle({
    ...options,
    checked: settings.get()[key],
    onChange: (checked) => {
      settings.update((current) => ({ ...current, [key]: checked }));
    },
    bind: (update) => settings.subscribe((value) => update(value[key])),
  });
}

/**
 * Applies settings to the page services: turbo drives the motion policy,
 * sound enables the synthesiser. Returns the unsubscribe function.
 */
export function applySettings(
  settings: Store<Settings>,
  services: { readonly motion?: Motion; readonly sound?: SoundEngine },
): () => void {
  const apply = ({ turbo, sound }: Settings) => {
    if (services.motion !== undefined) services.motion.turbo = turbo;
    services.sound?.setEnabled(sound);
  };
  apply(settings.get());
  return settings.subscribe(apply);
}
