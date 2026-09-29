import { h } from '../dom/h.ts';
import { renderMarkdown } from '../markdown/markdown.ts';
import { Modal } from './Modal.ts';

export interface InfoModalOptions {
  readonly title: string;
  /** Rules text in Markdown (e.g. a game sheet imported with Vite's ?raw). */
  readonly markdown: string;
}

/** Game rules rendered from Markdown. Headings start at <h3> under the dialog's <h2>. */
export function createInfoModal({ title, markdown }: InfoModalOptions): Modal {
  return new Modal({
    title,
    size: 'lg',
    content: () =>
      h('article', { class: 'cg-rules' }, renderMarkdown(markdown, { headingOffset: 2 })),
  });
}
