import { Disposer, h } from '../dom/h.ts';
import { icon } from '../dom/icons.ts';
import './modal.css';

export interface ModalOptions {
  readonly title: string;
  /** Built lazily on first open. */
  readonly content: Node | (() => Node);
  readonly onClose?: () => void;
  readonly size?: 'md' | 'lg';
}

let nextId = 0;

/**
 * A native <dialog> shown with showModal(): the browser provides the focus
 * trap, Escape to close, an inert page behind and focus restoration. Clicking
 * the backdrop also closes it. On phones it becomes a bottom sheet.
 */
export class Modal {
  readonly element: HTMLDialogElement;
  readonly #options: ModalOptions;
  readonly #body: HTMLDivElement;
  readonly #disposer = new Disposer();
  #built = false;

  constructor(options: ModalOptions) {
    this.#options = options;
    const titleId = `cg-modal-title-${++nextId}`;
    const close = h(
      'button',
      {
        type: 'button',
        class: 'cg-btn cg-btn--icon cg-btn--ghost cg-modal__close',
        'aria-label': 'Close',
      },
      icon('close'),
    );
    this.#body = h('div', { class: 'cg-modal__body' });
    this.element = h(
      'dialog',
      { class: 'cg-modal', dataset: { size: options.size ?? 'md' }, 'aria-labelledby': titleId },
      h(
        'div',
        { class: 'cg-modal__panel' },
        h('header', { class: 'cg-modal__header' }, h('h2', { id: titleId }, options.title), close),
        this.#body,
      ),
    );

    this.#disposer.listen(close, 'click', () => {
      this.close();
    });
    // A click whose target is the dialog itself landed on the backdrop.
    this.#disposer.listen(this.element, 'click', (event) => {
      if (event.target === this.element) this.close();
    });
    this.#disposer.listen(this.element, 'close', () => {
      document.documentElement.classList.remove('cg-modal-open');
      this.#options.onClose?.();
    });
  }

  get isOpen(): boolean {
    return this.element.open;
  }

  open(): void {
    if (this.isOpen) return;
    if (!this.#built) {
      const { content } = this.#options;
      this.#body.append(typeof content === 'function' ? content() : content);
      this.#built = true;
    }
    if (!this.element.isConnected) document.body.append(this.element);
    document.documentElement.classList.add('cg-modal-open');
    if (typeof this.element.showModal === 'function') {
      this.element.showModal();
    } else {
      this.element.setAttribute('open', '');
    }
    this.#body.scrollTop = 0;
  }

  close(): void {
    if (!this.isOpen) return;
    if (typeof this.element.close === 'function') {
      this.element.close();
    } else {
      this.element.removeAttribute('open');
      this.element.dispatchEvent(new Event('close'));
    }
  }

  destroy(): void {
    this.close();
    this.#disposer.dispose();
    this.element.remove();
  }
}
