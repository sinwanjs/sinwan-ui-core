/**
 * Portaled layers (Select, nested menus, Dialog) and native `<select>`
 * option lists are not DOM descendants of the layer that opened them.
 * Document pointerdown dismiss must treat those targets as inside the
 * floating UI. Do not match layout slots such as `card-content`.
 */
const DISMISS_EXEMPT_SELECTOR = [
  "[data-slot$='-menu-content']",
  "[data-slot='menubar-content']",
  "[data-slot$='-sub-content']",
  "[data-slot='select-content']",
  "[data-slot='popover-content']",
  "[data-slot='dialog-content']",
  "[data-slot='alert-dialog-content']",
  "[data-slot='sheet-content']",
  "[data-slot='drawer-content']",
  "[data-slot$='-overlay']",
  "select",
  "option",
  "optgroup",
].join(",");

export function isDismissExemptPointerTarget(
  target: EventTarget | null,
): boolean {
  if (target == null) return false;
  let el: Element | null = null;
  if (target instanceof Element) {
    el = target;
  } else if (target instanceof Node) {
    el = target.parentElement;
  }
  if (el == null) return false;
  return el.closest(DISMISS_EXEMPT_SELECTOR) != null;
}
