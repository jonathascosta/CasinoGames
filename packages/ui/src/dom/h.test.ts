import { describe, expect, it, vi } from 'vitest';
import { Disposer, h, svg } from './h.ts';
import { icon } from './icons.ts';

describe('h', () => {
  it('builds elements with attributes, dataset and children', () => {
    const el = h(
      'button',
      { class: 'cg-btn', type: 'button', disabled: true, hidden: false, dataset: { bet: 'main' } },
      'Add ',
      5,
      null,
      h('span', null, 'chips'),
    );
    expect(el.outerHTML).toBe(
      '<button class="cg-btn" type="button" disabled="" data-bet="main">Add 5<span>chips</span></button>',
    );
  });

  it('inserts strings as text, never as markup', () => {
    const el = h('p', null, '<img src=x onerror=alert(1)>');
    expect(el.children).toHaveLength(0);
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('creates namespaced SVG', () => {
    const path = svg('path', { d: 'M0 0' });
    expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(icon('close').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Disposer', () => {
  it('removes listeners and runs callbacks in reverse order', () => {
    const el = h('div');
    const onClick = vi.fn();
    const order: string[] = [];
    const disposer = new Disposer()
      .listen(el, 'click', onClick)
      .add(() => order.push('first'))
      .add(() => order.push('second'));
    el.click();
    disposer.dispose();
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['second', 'first']);
  });
});
