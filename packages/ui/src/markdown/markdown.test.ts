import { describe, expect, it } from 'vitest';
import { isSafeHref, renderMarkdown } from './markdown.ts';

function html(source: string, headingOffset = 0): string {
  const div = document.createElement('div');
  div.append(renderMarkdown(source, { headingOffset }));
  return div.innerHTML;
}

describe('renderMarkdown blocks', () => {
  it('renders headings, shifted by the offset', () => {
    expect(html('# Rules\n### Bets ###')).toBe('<h1>Rules</h1><h3>Bets</h3>');
    expect(html('# Rules', 2)).toBe('<h3>Rules</h3>');
    expect(html('##### Deep', 3)).toBe('<h6>Deep</h6>');
  });

  it('joins paragraph lines and honours hard breaks', () => {
    expect(html('one\ntwo\n\nthree  \nfour\\\nfive')).toBe(
      '<p>one two</p><p>three<br>four<br>five</p>',
    );
  });

  it('renders tight and loose lists, nesting and ordered starts', () => {
    expect(html('- a\n- b\n  - b1\n  - b2\n- c')).toBe(
      '<ul><li>a</li><li>b<ul><li>b1</li><li>b2</li></ul></li><li>c</li></ul>',
    );
    expect(html('3. three\n4. four')).toBe('<ol start="3"><li>three</li><li>four</li></ol>');
    expect(html('- a\n\n- b')).toBe('<ul><li><p>a</p></li><li><p>b</p></li></ul>');
    expect(html('- item\n  continued\nlazy')).toBe('<ul><li>item continued lazy</li></ul>');
  });

  it('renders blockquotes, code fences and rules', () => {
    expect(html('> **Note** quoted\n> more')).toBe(
      '<blockquote><p><strong>Note</strong> quoted more</p></blockquote>',
    );
    expect(html('```ts\nconst a = 1 < 2;\n```')).toBe(
      '<pre><code class="language-ts">const a = 1 &lt; 2;</code></pre>',
    );
    expect(html('a\n\n---\n\nb')).toBe('<p>a</p><hr><p>b</p>');
  });

  it('renders GFM tables with alignment and escaped pipes', () => {
    const table = html('| Outcome | Pays |\n|:--|--:|\n| Any `7` | 4 to 1 |\n| a \\| b | x |');
    expect(table).toBe(
      '<div class="cg-md-table"><table><thead><tr><th style="text-align: left">Outcome</th>' +
        '<th style="text-align: right">Pays</th></tr></thead><tbody>' +
        '<tr><td style="text-align: left">Any <code>7</code></td><td style="text-align: right">4 to 1</td></tr>' +
        '<tr><td style="text-align: left">a | b</td><td style="text-align: right">x</td></tr>' +
        '</tbody></table></div>',
    );
  });

  it('keeps a readable width for text columns that would wrap, not for labels or numbers', () => {
    const table = html(
      '| Roll | Play | Chance |\n|:--|:--|--:|\n| 2-1 | Lock the 2, re-roll the 1 | 5.56% |\n' +
        '| 6-6 | Stand | 2.78% |',
    );
    const cells = (tag: string) =>
      [...new DOMParser().parseFromString(table, 'text/html').querySelectorAll(tag)].map((cell) =>
        cell.classList.contains('cg-md-table__prose'),
      );
    expect(cells('th')).toEqual([false, true, false]);
    expect(cells('td')).toEqual([false, true, false, false, true, false]);
    expect(table).toContain(
      '<td class="cg-md-table__prose" style="text-align: left">Lock the 2, re-roll the 1</td>',
    );
  });

  it('drops HTML comments (generated-section markers)', () => {
    expect(html('<!-- math:start -->\nText\n<!-- math:end -->')).toBe('<p>Text</p>');
  });
});

describe('renderMarkdown inline', () => {
  it('renders emphasis, strong, code and escapes', () => {
    expect(html('*em* **strong** _em_ __strong__ `a*b*` \\*literal\\*')).toBe(
      '<p><em>em</em> <strong>strong</strong> <em>em</em> <strong>strong</strong> ' +
        '<code>a*b*</code> *literal*</p>',
    );
    expect(html('**bold with *nested* em**')).toBe(
      '<p><strong>bold with <em>nested</em> em</strong></p>',
    );
  });

  it('leaves snake_case identifiers and lone markers alone', () => {
    expect(html('use house_edge_total and 2 * 3 * 4')).toBe(
      '<p>use house_edge_total and 2 * 3 * 4</p>',
    );
  });

  it('renders safe links and marks external ones', () => {
    expect(html('[sheet](./games/mirror.md) [site](https://example.com "Title")')).toBe(
      '<p><a href="./games/mirror.md">sheet</a> ' +
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a></p>',
    );
  });
});

describe('renderMarkdown safety', () => {
  it('shows raw HTML as text instead of parsing it', () => {
    const div = document.createElement('div');
    div.append(renderMarkdown('<img src=x onerror="alert(1)"> <script>alert(2)</script>'));
    expect(div.querySelector('img, script')).toBeNull();
    expect(div.textContent).toContain('<script>alert(2)</script>');
  });

  it('refuses dangerous link targets', () => {
    expect(html('[x](javascript:alert(1))')).toBe('<p><span>x</span>)</p>');
    expect(html('[x](data:text/html,hi)')).toBe('<p><span>x</span></p>');
    for (const href of ['javascript:alert(1)', 'JaVaScRiPt:1', 'vbscript:x', '//evil.test', '']) {
      expect(isSafeHref(href)).toBe(false);
    }
    for (const href of ['https://a.test', 'mailto:a@b.c', '/x', '#top', 'docs/x.md']) {
      expect(isSafeHref(href)).toBe(true);
    }
  });
});
