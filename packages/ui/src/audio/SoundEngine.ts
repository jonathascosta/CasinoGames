import { createSeededRng, type Rng } from '@casinogames/engine';

export type SoundName =
  | 'click'
  | 'chip'
  | 'chip-stack'
  | 'dice-shake'
  | 'dice-bounce'
  | 'card-slide'
  | 'card-flip'
  | 'shuffle'
  | 'win'
  | 'big-win'
  | 'lose';

export interface SoundOptions {
  /** 0–1: scales the level of impact sounds such as dice bounces. */
  readonly intensity?: number;
}

interface Voice {
  readonly context: AudioContext;
  readonly out: AudioNode;
  readonly fx: AudioNode;
  readonly noise: AudioBuffer;
  readonly rng: Rng;
}

/**
 * Every sound in the demo is synthesised with the Web Audio API: filtered
 * noise for chips, dice and cards, and short triangle-wave arpeggios for
 * wins. No audio files are shipped.
 *
 * The AudioContext is created lazily and resumed on the first user gesture
 * (browsers block audio before one). Where Web Audio is missing, every call
 * is a no-op. Pitch and timing variations use a seeded Rng, not Math.random.
 */
export class SoundEngine {
  #enabled: boolean;
  #gestureSeen = false;
  #voice: Voice | null = null;
  readonly #rng = createSeededRng('sound-variation');
  readonly #volume: number;

  constructor(options: { enabled?: boolean; volume?: number } = {}) {
    this.#enabled = options.enabled ?? true;
    this.#volume = options.volume ?? 0.55;
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  get supported(): boolean {
    return audioContextClass() !== undefined;
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    // Only start audio once the user has interacted with the page.
    if (enabled && this.#gestureSeen) this.unlock();
  }

  /** Creates or resumes the AudioContext; call from a user gesture. */
  unlock(): void {
    this.#gestureSeen = true;
    if (!this.#enabled) return;
    const voice = this.#ensureVoice();
    if (voice?.context.state === 'suspended') void voice.context.resume();
  }

  /**
   * Unlocks audio on pointer and key presses anywhere on the page until a
   * context is running (it may be created later, when sound is switched on).
   * Returns a function that removes the listeners.
   */
  unlockOnFirstGesture(target: EventTarget = globalThis): () => void {
    const onGesture = () => {
      this.unlock();
      if (this.#voice !== null) remove();
    };
    const remove = () => {
      target.removeEventListener('pointerdown', onGesture, true);
      target.removeEventListener('keydown', onGesture, true);
    };
    target.addEventListener('pointerdown', onGesture, true);
    target.addEventListener('keydown', onGesture, true);
    return remove;
  }

  /** Plays a sound; silent until unlock() has run from a user gesture. */
  play(name: SoundName, options: SoundOptions = {}): void {
    if (!this.#enabled) return;
    // Never create the context here: before a gesture the browser refuses to
    // start it and logs a warning.
    const voice = this.#voice;
    if (voice?.context.state !== 'running') return;
    const t = voice.context.currentTime + 0.005;
    const intensity = clamp(options.intensity ?? 1, 0, 1);
    SOUNDS[name](voice, t, intensity);
  }

  dispose(): void {
    void this.#voice?.context.close();
    this.#voice = null;
  }

  #ensureVoice(): Voice | null {
    if (this.#voice !== null) return this.#voice;
    const AudioContextClass = audioContextClass();
    if (AudioContextClass === undefined) return null;
    try {
      const context = new AudioContextClass();
      const master = context.createGain();
      master.gain.value = this.#volume;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 4;
      master.connect(compressor).connect(context.destination);

      // A short feedback delay adds sparkle to wins.
      const fx = context.createGain();
      fx.gain.value = 0.3;
      const delay = context.createDelay(1);
      delay.delayTime.value = 0.13;
      const feedback = context.createGain();
      feedback.gain.value = 0.32;
      fx.connect(delay).connect(feedback).connect(delay);
      delay.connect(master);

      this.#voice = { context, out: master, fx, noise: noiseBuffer(context), rng: this.#rng };
    } catch {
      return null;
    }
    return this.#voice;
  }
}

const SOUNDS: Readonly<Record<SoundName, (voice: Voice, t: number, intensity: number) => void>> = {
  click(v, t) {
    tone(v, t, { type: 'sine', frequency: 1400, duration: 0.035, gain: 0.07 });
  },
  chip(v, t) {
    clack(v, t, 3200, 0.5);
    clack(v, t + 0.045 + v.rng.next() * 0.02, 2700, 0.32);
  },
  'chip-stack'(v, t) {
    for (let i = 0; i < 3; i++) clack(v, t + i * 0.038, 2600 + i * 250, 0.35);
  },
  'dice-shake'(v, t) {
    let at = t;
    for (let i = 0; i < 4; i++) {
      at += 0.018 + v.rng.next() * 0.03;
      noise(v, at, {
        duration: 0.02,
        type: 'bandpass',
        frequency: 2000 + v.rng.next() * 1800,
        q: 3,
        gain: 0.22,
      });
    }
  },
  'dice-bounce'(v, t, intensity) {
    noise(v, t, {
      duration: 0.045,
      type: 'lowpass',
      frequency: 1900,
      q: 0.8,
      gain: 0.55 * intensity,
    });
    tone(v, t, {
      type: 'sine',
      frequency: 170,
      endFrequency: 85,
      duration: 0.09,
      gain: 0.3 * intensity,
    });
  },
  'card-slide'(v, t) {
    noise(v, t, {
      duration: 0.17,
      type: 'bandpass',
      frequency: 900,
      endFrequency: 3200,
      q: 1.1,
      gain: 0.22,
      attack: 0.03,
    });
  },
  'card-flip'(v, t) {
    noise(v, t, { duration: 0.03, type: 'highpass', frequency: 2600, q: 0.7, gain: 0.28 });
    tone(v, t + 0.01, { type: 'triangle', frequency: 900, duration: 0.04, gain: 0.05 });
  },
  shuffle(v, t) {
    let at = t;
    for (let i = 0; i < 14; i++) {
      at += 0.024 + v.rng.next() * 0.02;
      noise(v, at, {
        duration: 0.018,
        type: 'bandpass',
        frequency: 2400 + v.rng.next() * 900,
        q: 2,
        gain: 0.18,
      });
    }
  },
  win(v, t) {
    arpeggio(v, t, [523.25, 659.25, 783.99, 1046.5], 0.075, 0.5, 0.16);
  },
  'big-win'(v, t) {
    arpeggio(v, t, [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093], 0.07, 0.7, 0.15);
    for (const frequency of [523.25, 659.25, 783.99]) {
      tone(v, t + 0.5, { type: 'triangle', frequency, duration: 1.1, gain: 0.07, attack: 0.04 });
    }
  },
  lose(v, t) {
    tone(v, t, {
      type: 'sine',
      frequency: 210,
      endFrequency: 130,
      duration: 0.26,
      gain: 0.08,
      attack: 0.01,
    });
  },
};

function clack(v: Voice, t: number, frequency: number, gain: number): void {
  noise(v, t, { duration: 0.032, type: 'bandpass', frequency, q: 2.4, gain });
  tone(v, t, { type: 'triangle', frequency: frequency * 0.75, duration: 0.045, gain: gain * 0.22 });
}

function arpeggio(
  v: Voice,
  t: number,
  notes: readonly number[],
  spacing: number,
  duration: number,
  gain: number,
): void {
  notes.forEach((frequency, i) => {
    tone(v, t + i * spacing, {
      type: 'triangle',
      frequency,
      duration,
      gain,
      attack: 0.008,
      send: true,
    });
  });
}

interface ToneOptions {
  readonly type: OscillatorType;
  readonly frequency: number;
  readonly endFrequency?: number;
  readonly duration: number;
  readonly gain: number;
  readonly attack?: number;
  /** Also feed the delay bus. */
  readonly send?: boolean;
}

function tone(v: Voice, t: number, options: ToneOptions): void {
  const { context } = v;
  const oscillator = context.createOscillator();
  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(options.frequency, t);
  if (options.endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, t + options.duration);
  }
  const envelope = decayEnvelope(
    context,
    t,
    options.attack ?? 0.002,
    options.duration,
    options.gain,
  );
  oscillator.connect(envelope).connect(v.out);
  if (options.send === true) envelope.connect(v.fx);
  oscillator.start(t);
  oscillator.stop(t + options.duration + 0.05);
}

interface NoiseOptions {
  readonly duration: number;
  readonly type: BiquadFilterType;
  readonly frequency: number;
  readonly endFrequency?: number;
  readonly q: number;
  readonly gain: number;
  readonly attack?: number;
}

function noise(v: Voice, t: number, options: NoiseOptions): void {
  const { context } = v;
  const source = context.createBufferSource();
  source.buffer = v.noise;
  const filter = context.createBiquadFilter();
  filter.type = options.type;
  filter.Q.value = options.q;
  filter.frequency.setValueAtTime(options.frequency, t);
  if (options.endFrequency !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(options.endFrequency, t + options.duration);
  }
  const envelope = decayEnvelope(
    context,
    t,
    options.attack ?? 0.001,
    options.duration,
    options.gain,
  );
  source.connect(filter).connect(envelope).connect(v.out);
  // Start at a varying offset so repeated hits do not sound identical.
  source.start(t, v.rng.next() * 0.5);
  source.stop(t + options.duration + 0.05);
}

function decayEnvelope(
  context: AudioContext,
  t: number,
  attack: number,
  duration: number,
  peak: number,
): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  return gain;
}

function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = context.sampleRate;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  const rng = createSeededRng('white-noise');
  for (let i = 0; i < length; i++) data[i] = rng.next() * 2 - 1;
  return buffer;
}

function audioContextClass(): typeof AudioContext | undefined {
  const scope = globalThis as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
