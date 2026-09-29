import { defineBets, odds, summarizeMath } from '@casinogames/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInfoModal } from './InfoModal.ts';
import { Modal } from './Modal.ts';
import { createPaytable, createPaytableModal } from './PaytableModal.ts';

const SUMMARY = summarizeMath({
  id: 'sample',
  name: 'Sample Table',
  bets: defineBets([
    {
      id: 'over',
      label: 'Over 7',
      kind: 'main',
      min: 50,
      max: 10_000,
      rtp: 30 / 36,
      standardDeviation: Math.sqrt(35 / 36),
      paytable: [{ id: 'win', label: 'Total 8–12', odds: odds(1), probability: 15 / 36 }],
    },
    {
      id: 'grand',
      label: 'Grand',
      kind: 'side',
      min: 100,
      max: 100,
      rtp: 0.9,
      paytable: [
        { id: 'jackpot', label: 'Double six', jackpot: { jackpotId: 'Grand', share: 1 } },
        { id: 'mini', label: 'Double one', jackpot: { jackpotId: 'Grand', share: 0.1 } },
      ],
    },
  ]),
});

describe('Modal', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.classList.remove('cg-modal-open');
  });

  it('builds its content lazily and opens as a labelled dialog', () => {
    const build = vi.fn(() => document.createTextNode('Body'));
    const modal = new Modal({ title: 'Rules', content: build });
    expect(build).not.toHaveBeenCalled();
    modal.open();
    modal.close();
    modal.open();
    expect(build).toHaveBeenCalledTimes(1);
    expect(modal.isOpen).toBe(true);
    expect(document.body.contains(modal.element)).toBe(true);
    const title = modal.element.querySelector('h2')!;
    expect(modal.element.getAttribute('aria-labelledby')).toBe(title.id);
    expect(document.documentElement.classList.contains('cg-modal-open')).toBe(true);
  });

  it('closes from the close button and the backdrop, and reports it', () => {
    const onClose = vi.fn();
    const modal = new Modal({ title: 'Rules', content: document.createTextNode('x'), onClose });
    modal.open();
    modal.element.querySelector<HTMLButtonElement>('.cg-modal__close')!.click();
    expect(modal.isOpen).toBe(false);
    modal.open();
    modal.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(document.documentElement.classList.contains('cg-modal-open')).toBe(false);
  });

  it('ignores clicks inside the panel', () => {
    const modal = new Modal({ title: 'Rules', content: document.createTextNode('x') });
    modal.open();
    modal.element
      .querySelector('.cg-modal__body')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.isOpen).toBe(true);
  });
});

describe('paytable', () => {
  it('renders every bet from the math summary', () => {
    const table = createPaytable(SUMMARY);
    const sections = table.querySelectorAll('.cg-paytable__bet');
    expect(sections).toHaveLength(2);
    const first = sections[0]!;
    expect(first.querySelector('h3')!.textContent).toBe('Over 7');
    expect(first.querySelector('tbody')!.textContent).toBe('Total 8–121 to 141.667%');
    expect(first.querySelector('dl')!.textContent).toBe(
      'RTP83.33%House edge16.67%Std. deviation0.99Limits0.50 – 100.00',
    );
  });

  it('describes jackpot payouts and omits unknown probabilities', () => {
    const grand = createPaytable(SUMMARY).querySelectorAll('.cg-paytable__bet')[1]!;
    expect(
      [...grand.querySelectorAll('tbody td:nth-child(2)')].map((td) => td.textContent),
    ).toEqual(['Grand jackpot', '10% of Grand jackpot']);
    expect(grand.querySelectorAll('th')).toHaveLength(2);
  });

  it('opens in a modal titled after the game', () => {
    const modal = createPaytableModal(SUMMARY);
    modal.open();
    expect(modal.element.querySelector('h2')!.textContent).toBe('Sample Table · Paytable');
    modal.destroy();
  });
});

describe('createInfoModal', () => {
  it('renders the rules markdown under the dialog title', () => {
    const modal = createInfoModal({ title: 'How to play', markdown: '# Goal\nRoll **high**.' });
    modal.open();
    expect(modal.element.querySelector('.cg-rules')!.innerHTML).toBe(
      '<h3>Goal</h3><p>Roll <strong>high</strong>.</p>',
    );
    modal.destroy();
  });
});
