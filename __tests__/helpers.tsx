import { Window } from "happy-dom";
import {
  cc,
  createComponentInstance,
  getCurrentInstance,
  setCurrentInstance,
  type SinwanElement,
  type SinwanNode,
} from "sinwan/component";
import { mount } from "sinwan/renderer";

let windowRef: Window | null = null;

type MediaQueryListener = () => void;

let matchMediaChangeListeners: MediaQueryListener[] = [];
/** Controls `(prefers-color-scheme: dark)` for ThemeProvider tests. */
let matchMediaPrefersDark = true;

export function setMatchMediaPrefersDark(value: boolean): void {
  matchMediaPrefersDark = value;
}

export function triggerMatchMediaChange(): void {
  for (const listener of [...matchMediaChangeListeners]) listener();
}

export function matchMediaListenerCount(): number {
  return matchMediaChangeListeners.length;
}

function matchMedia(query: string) {
  return {
    matches: query.includes("prefers-color-scheme: dark") && matchMediaPrefersDark,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: MediaQueryListener) => {
      matchMediaChangeListeners.push(listener);
    },
    removeEventListener: (_type: string, listener: MediaQueryListener) => {
      matchMediaChangeListeners = matchMediaChangeListeners.filter((l) => l !== listener);
    },
    dispatchEvent: () => false,
  };
}

export function setupDom(): Window {
  const win = new Window({ url: "https://example.test/" });
  windowRef = win;
  matchMediaChangeListeners = [];
  matchMediaPrefersDark = true;
  Object.assign(win, { matchMedia });
  Object.assign(globalThis, {
    window: win,
    document: win.document,
    HTMLElement: win.HTMLElement,
    Element: win.Element,
    Node: win.Node,
    Text: win.Text,
    Comment: win.Comment,
    DocumentFragment: win.DocumentFragment,
    DOMRect: win.DOMRect,
    Event: win.Event,
    KeyboardEvent: win.KeyboardEvent,
    MouseEvent: win.MouseEvent,
    FocusEvent: win.FocusEvent,
    PointerEvent: win.PointerEvent,
    CustomEvent: win.CustomEvent,
    ResizeObserver: win.ResizeObserver,
    MutationObserver: win.MutationObserver,
    getComputedStyle: win.getComputedStyle.bind(win),
    requestAnimationFrame: win.requestAnimationFrame.bind(win),
    cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
    matchMedia,
    localStorage: win.localStorage,
  });
  return win;
}

export function teardownDom(): void {
  document.body.innerHTML = "";
  windowRef?.happyDOM.close();
  windowRef = null;
  matchMediaChangeListeners = [];
}

/** `getBoundingClientRect()` returns `rectFor(el)`, or the DOM's own rect when it returns null. */
export function stubRects(rectFor: (el: HTMLElement) => DOMRect | null): void {
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function getRect(this: HTMLElement) {
    return rectFor(this) ?? original.call(this);
  };
}

export function stubFixedRect(x = 10, y = 10, width = 80, height = 32): void {
  stubRects(() => new DOMRect(x, y, width, height));
}

export function withSetup<T>(run: () => T): T {
  const prev = getCurrentInstance();
  const inst = createComponentInstance(
    cc(() => null),
    {},
    null,
  );
  setCurrentInstance(inst);
  try {
    return run();
  } finally {
    setCurrentInstance(prev);
  }
}

export function asVNode(node: SinwanNode): SinwanElement {
  if (typeof node === "object" && node !== null && !Array.isArray(node) && "tag" in node) {
    return node;
  }
  throw new Error("expected SinwanElement");
}

export const wait = (ms = 40): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

export function query<T extends Element = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

export type MountedUi = {
  root: HTMLElement;
  unmount: () => void;
  click: (selector: string) => void;
  query: (selector: string) => HTMLElement | null;
};

/**
 * Mount a JSX tree so provide/inject and lifecycle hooks run in order.
 * Queries search the whole body so portaled layers are found.
 */
export function mountUi(ui: () => SinwanNode): MountedUi {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const App = cc(() => ui());
  const app = mount(App, root);
  return {
    root,
    unmount: () => {
      app.unmount();
      root.remove();
    },
    click: (selector: string) => {
      query(selector).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    },
    query: (selector: string) => document.querySelector<HTMLElement>(selector),
  };
}
