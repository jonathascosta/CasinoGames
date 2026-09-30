import { describe, expect, it, vi } from 'vitest';
import { DecisionBar, adviceText, trancarLabel } from './decision.ts';

function bar() {
  const decision = new DecisionBar();
  const q = (selector: string) => decision.element.querySelector<HTMLElement>(selector)!;
  const ficar = q('.tr-decision__ficar') as HTMLButtonElement;
  const trancar = q('.tr-decision__trancar') as HTMLButtonElement;
  return { decision, q, ficar, trancar };
}

describe('DecisionBar', () => {
  it('keeps Ficar on the table, live only while a decision is asked for', () => {
    const { decision, ficar, trancar } = bar();
    expect([ficar.hidden, ficar.disabled, trancar.hidden]).toEqual([false, true, true]);
    const onChoose = vi.fn();
    decision.open({ dice: [5, 2], fee: 40, affordable: true, advice: 'trancar-0', onChoose });
    expect(decision.element.dataset.state).toBe('open');
    expect([ficar.disabled, trancar.hidden]).toEqual([false, true]);
    ficar.click();
    expect(onChoose).toHaveBeenCalledWith('ficar');
    decision.close();
    expect([ficar.disabled, trancar.hidden]).toEqual([true, true]);
  });

  it('reveals Trancar with its fee once a die is locked', () => {
    const { decision, trancar } = bar();
    const onChoose = vi.fn();
    decision.open({ dice: [5, 2], fee: 40, affordable: true, advice: 'trancar-0', onChoose });
    trancar.click(); // hidden: nothing locked yet
    expect(onChoose).not.toHaveBeenCalled();
    decision.setLocked(0);
    expect(decision.element.dataset.state).toBe('locked');
    expect(trancar.hidden).toBe(false);
    expect(trancar.textContent).toBe('Trancar · +0.40');
    trancar.click();
    expect(onChoose).toHaveBeenCalledWith('trancar');
    decision.setLocked(null);
    expect(trancar.hidden).toBe(true);
  });

  it('holds Trancar back, and says why, when the fee is not covered', () => {
    const { decision, trancar, q } = bar();
    const onChoose = vi.fn();
    decision.open({ dice: [5, 2], fee: 40, affordable: false, advice: 'trancar-0', onChoose });
    decision.setLocked(1);
    expect(trancar.disabled).toBe(true);
    trancar.click();
    expect(onChoose).not.toHaveBeenCalled();
    expect(q('.tr-decision__note').hidden).toBe(false);
    expect(q('.tr-decision__note').textContent).toBe('Your balance does not cover the 0.40 fee.');
  });

  it('shows the recommended choice while the strategy hint is on, labelled as a demo', () => {
    const { decision, q } = bar();
    const hint = q('[role="switch"]');
    const advice = q('.tr-decision__advice');
    expect(hint.textContent).toContain('Strategy hint');
    expect(q('.tr-decision__demo').title).toBe('A demonstration feature for evaluators');
    expect(decision.hint).toBe(false);
    hint.click();
    expect(decision.hint).toBe(true);
    expect(advice.hidden).toBe(true); // nothing to recommend between rounds
    decision.open({ dice: [2, 6], fee: 40, affordable: true, advice: 'ficar', onChoose: vi.fn() });
    expect(advice.hidden).toBe(false);
    expect(advice.textContent).toBe('Recommended: Ficar, stand on 8');
    hint.click();
    expect(advice.hidden).toBe(true);
    decision.destroy();
    expect(decision.element.isConnected).toBe(false);
  });
});

describe('the words on the decision', () => {
  it('prices Trancar, free on 1-1', () => {
    expect(trancarLabel(40)).toBe('Trancar · +0.40');
    expect(trancarLabel(10_000)).toBe('Trancar · +100.00');
    expect(trancarLabel(0)).toBe('Trancar · free');
  });

  it('says what the reference strategy does with a roll', () => {
    expect(adviceText([6, 1], 'trancar-0', 40)).toBe(
      'Trancar, lock the 6 and re-roll the 1 (+0.40)',
    );
    expect(adviceText([1, 1], 'trancar-0', 0)).toBe(
      'Trancar, lock a 1 and re-roll the other (free)',
    );
    expect(adviceText([2, 2], 'ficar', 40)).toBe('Ficar, stand on 4');
  });
});
