/**
 * A few lines of DOM helpers so components stay readable without a
 * framework. Content is always inserted as text nodes: no innerHTML, so
 * nothing rendered through here can inject markup.
 */
export type Child = Node | string | number | null | undefined | false;

export type AttributeValue = string | number | boolean | null | undefined;

export interface Props {
  readonly class?: string;
  readonly dataset?: Readonly<Record<string, string>>;
  /** Any other attribute; `true` renders a boolean attribute, falsy values are skipped. */
  readonly [attribute: string]: AttributeValue | Readonly<Record<string, string>>;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props) applyProps(element, props);
  append(element, ...children);
  return element;
}

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  if (props) applyProps(element, props);
  append(element, ...children);
  return element;
}

export function append(parent: Node, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

function applyProps(element: Element, props: Props): void {
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (typeof value === 'object') {
      if (name === 'dataset') Object.assign((element as HTMLElement).dataset, value);
      continue;
    }
    element.setAttribute(name, value === true ? '' : String(value));
  }
}

type EventMapFor<T> = T extends Window
  ? WindowEventMap
  : T extends Document
    ? DocumentEventMap
    : T extends HTMLElement
      ? HTMLElementEventMap
      : T extends SVGElement
        ? SVGElementEventMap
        : Record<string, Event>;

/** Collects listeners and teardown callbacks so destroy() cannot leak. */
export class Disposer {
  #callbacks: (() => void)[] = [];

  listen<T extends EventTarget, K extends keyof EventMapFor<T> & string>(
    target: T,
    type: K,
    listener: (event: EventMapFor<T>[K]) => void,
    options?: AddEventListenerOptions,
  ): this {
    const handler = listener as unknown as EventListener;
    target.addEventListener(type, handler, options);
    this.#callbacks.push(() => {
      target.removeEventListener(type, handler, options);
    });
    return this;
  }

  add(callback: () => void): this {
    this.#callbacks.push(callback);
    return this;
  }

  dispose(): void {
    for (const callback of this.#callbacks.splice(0).reverse()) callback();
  }
}
