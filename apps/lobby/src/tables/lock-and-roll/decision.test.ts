import { describe, expect, it, vi } from 'vitest';
import { DecisionBar, adviceText, lockLabel } from './decision.ts';

function bar() {
  const decision = new DecisionBar();
  const q = (selector: string) => decision.element.querySelector<HTMLElement>(selector)!;
  const stand = q('.lr-decision__stand') as HTMLButtonElement;
  const lock = q('.lr-decision__lock') as HTMLButtonElement;
  return { decision, q, stand, lock };
}

describe('DecisionBar', () => {
  it('keeps Stand on the table, live only while a decision is asked for', () => {
    const { decision, stand, lock } = bar();
    expect([stand.hidden, stand.disabled, lock.hidden]).toEqual([false, true, true]);
    const onChoose = vi.fn();
    decision.open({ dice: [5, 2], fee: 40, affordable: true, advice: 'lock-0', onChoose });
    expect(decision.element.dataset.state).toBe('open');
    expect([stand.disabled, lock.hidden]).toEqual([false, true]);
    stand.click();
    expect(onChoose).toHaveBeenCalledWith('stand');
    decision.close();
    expect([stand.disabled, lock.hidden]).toEqual([true, true]);
  });

  it('reveals Lock with its fee once a die is locked', () => {
    const { decision, lock } = bar();
    const onChoose = vi.fn();
    decision.open({ dice: [5, 2], fee: 40, affordable: true, advice: 'lock-0', onChoose });
    lock.click(); // hidden: nothing locked yet
    expect(onChoose).not.toHaveBeenCalled();
    decision.setLocked(0);
    expect(decision.element.dataset.state).toBe('locked');
    expect(lock.hidden).toBe(false);
    expect(lock.textContent).toBe('Lock · +0.40');
    lock.click();
    expect(onChoose).toHaveBeenCalledWith('lock');
    decision.setLocked(null);
    expect(lock.hidden).toBe(true);
  });

  it('holds Lock back, and says why, when the Lock fee is not covered', () => {
    const { decision, lock, q } = bar();
    const onChoose = vi.fn();
    decision.open({ dice: [5, 2], fee: 40, affordable: false, advice: 'lock-0', onChoose });
    decision.setLocked(1);
    expect(lock.disabled).toBe(true);
    lock.click();
    expect(onChoose).not.toHaveBeenCalled();
    expect(q('.lr-decision__note').hidden).toBe(false);
    expect(q('.lr-decision__note').textContent).toBe(
      'Your balance does not cover the 0.40 Lock fee.',
    );
  });

  it('shows the recommended choice while the strategy hint is on, labelled as a demo', () => {
    const { decision, q } = bar();
    const hint = q('[role="switch"]');
    const advice = q('.lr-decision__advice');
    expect(hint.textContent).toContain('Strategy hint');
    expect(q('.lr-decision__demo').title).toBe('A demonstration feature for evaluators');
    expect(decision.hint).toBe(false);
    hint.click();
    expect(decision.hint).toBe(true);
    expect(advice.hidden).toBe(true); // nothing to recommend between rounds
    decision.open({ dice: [2, 6], fee: 40, affordable: true, advice: 'stand', onChoose: vi.fn() });
    expect(advice.hidden).toBe(false);
    expect(advice.textContent).toBe('Recommended: Stand on 8');
    hint.click();
    expect(advice.hidden).toBe(true);
    decision.destroy();
    expect(decision.element.isConnected).toBe(false);
  });
});

describe('the words on the decision', () => {
  it('prices Lock, free on 1-1', () => {
    expect(lockLabel(40)).toBe('Lock · +0.40');
    expect(lockLabel(10_000)).toBe('Lock · +100.00');
    expect(lockLabel(0)).toBe('Lock · free');
  });

  it('says what the reference strategy does with a roll', () => {
    expect(adviceText([6, 1], 'lock-0', 40)).toBe('Lock the 6 and re-roll the 1 (+0.40)');
    expect(adviceText([1, 1], 'lock-0', 0)).toBe('Lock a 1 and re-roll the other (free)');
    expect(adviceText([2, 2], 'stand', 40)).toBe('Stand on 4');
  });
});
