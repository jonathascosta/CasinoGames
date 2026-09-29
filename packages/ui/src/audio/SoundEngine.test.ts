import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine, type SoundName } from './SoundEngine.ts';

const SOUNDS: SoundName[] = [
  'click',
  'chip',
  'chip-stack',
  'dice-shake',
  'dice-bounce',
  'card-slide',
  'card-flip',
  'shuffle',
  'win',
  'big-win',
  'lose',
];

/** Just enough of Web Audio to record what the engine schedules. */
class FakeParam {
  value = 0;
  setValueAtTime(value: number) {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number) {
    // The real API throws for non-positive targets.
    if (!(value > 0)) throw new RangeError('exponential ramp target must be positive');
    this.value = value;
  }
}

class FakeNode {
  readonly connections: FakeNode[] = [];
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  delayTime = new FakeParam();
  threshold = new FakeParam();
  ratio = new FakeParam();
  type = '';
  buffer: unknown = null;
  connect(node: FakeNode) {
    this.connections.push(node);
    return node;
  }
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = 'suspended';
  currentTime = 0;
  sampleRate = 8_000;
  destination = new FakeNode();
  sources: FakeNode[] = [];
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
  createGain = () => new FakeNode();
  createDelay = () => new FakeNode();
  createDynamicsCompressor = () => new FakeNode();
  createBiquadFilter = () => new FakeNode();
  createOscillator = () => this.#source();
  createBufferSource = () => this.#source();
  createBuffer = (_channels: number, length: number) => {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  };
  #source() {
    const node = new FakeNode();
    this.sources.push(node);
    return node;
  }
}

describe('SoundEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeAudioContext.instances = [];
  });

  it('is a silent no-op without Web Audio', () => {
    const sound = new SoundEngine();
    expect(sound.supported).toBe(false);
    expect(() => {
      sound.unlock();
      for (const name of SOUNDS) sound.play(name);
    }).not.toThrow();
  });

  it('synthesises every sound once unlocked', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const sound = new SoundEngine();
    sound.play('chip'); // no context yet: nothing plays before a gesture
    expect(FakeAudioContext.instances).toHaveLength(0);
    sound.unlock();
    const [context] = FakeAudioContext.instances;
    expect(context?.state).toBe('running');
    for (const name of SOUNDS) sound.play(name, { intensity: 0.5 });
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(context!.sources.length).toBeGreaterThan(SOUNDS.length);
    expect(context!.sources.every((source) => source.start.mock.calls.length === 1)).toBe(true);
    expect(context!.sources.every((source) => source.connections.length === 1)).toBe(true);
  });

  it('plays nothing while disabled', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const sound = new SoundEngine({ enabled: false });
    sound.unlock();
    sound.play('win');
    expect(sound.enabled).toBe(false);
  });

  it('never starts audio before a user gesture', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const sound = new SoundEngine({ enabled: false });
    sound.setEnabled(true);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('unlocks on the first gesture, or later when sound is switched on', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const sound = new SoundEngine({ enabled: false });
    const unlock = vi.spyOn(sound, 'unlock');
    const target = new EventTarget();
    sound.unlockOnFirstGesture(target);
    target.dispatchEvent(new Event('pointerdown')); // sound off: nothing created
    expect(FakeAudioContext.instances).toHaveLength(0);
    sound.setEnabled(true); // e.g. the sound toggle's click
    expect(FakeAudioContext.instances).toHaveLength(1);
    target.dispatchEvent(new Event('keydown'));
    target.dispatchEvent(new Event('pointerdown'));
    expect(unlock).toHaveBeenCalledTimes(3);
    target.dispatchEvent(new Event('pointerdown')); // listeners removed by now
    expect(unlock).toHaveBeenCalledTimes(3);
  });
});
