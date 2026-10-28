import { cc, onMounted, onUnmounted, type SinwanNode } from "sinwan/component";
import { Portal as SinwanPortal, Show } from "sinwan/control-flow";
import { effect, signal, untrack, type Signal } from "sinwan/reactivity";

export type PresenceProps = {
  present?: boolean;
  exitMs?: number;
  children?: SinwanNode;
};

const DEFAULT_EXIT_MS = 200;

/** Keep children mounted through CSS exit (`data-state=closed`) before unmount. */
export const Presence = cc<PresenceProps>((props) => {
  const mounted = signal(untrack(() => Boolean(props.present)));
  let exitTimer: number | undefined;

  function clearExitTimer() {
    if (exitTimer !== undefined) {
      window.clearTimeout(exitTimer);
      exitTimer = undefined;
    }
  }

  effect(() => {
    const next = Boolean(props.present);
    untrack(() => {
      if (next) {
        clearExitTimer();
        mounted.value = true;
        return;
      }
      if (!mounted.value) return;
      clearExitTimer();
      const delay = props.exitMs ?? DEFAULT_EXIT_MS;
      if (delay <= 0) {
        mounted.value = false;
        return;
      }
      exitTimer = window.setTimeout(() => {
        exitTimer = undefined;
        mounted.value = false;
      }, delay);
    });
  });

  onUnmounted(clearExitTimer);

  return (
    <Show when={mounted.value} fallback={null}>
      {props.children}
    </Show>
  );
});

export type UiPortalProps = {
  children?: SinwanNode;
  container?: HTMLElement | null | (() => HTMLElement | null);
};

export const UiPortal = cc<UiPortalProps>(({ children, container }) => {
  return (
    <SinwanPortal
      mount={() => {
        if (typeof container === "function") return container();
        return container ?? document.body;
      }}
    >
      {children}
    </SinwanPortal>
  );
});

function readOptionValue<T>(value: unknown): T {
  if (typeof value === "function" && value.length === 0) {
    return (value as () => T)();
  }
  return value as T;
}

export function useControllableState<T>(options: {
  value?: T | (() => T);
  defaultValue: T;
  onChange?: (value: T) => void;
}): [Signal<T>, (value: T | ((prev: T) => T)) => void] {
  const isControlled = "value" in options;
  const read = (): T =>
    isControlled ? readOptionValue<T>(options.value) : options.defaultValue;
  const state = signal<T>(isControlled ? read() : options.defaultValue);

  const setState = (value: T | ((prev: T) => T)) => {
    const current = isControlled ? read() : state.value;
    const next =
      typeof value === "function" ? (value as (prev: T) => T)(current) : value;
    if (!isControlled) state.value = next;
    options.onChange?.(next);
  };

  onMounted(() => {
    const sync = () => {
      if (!isControlled) return;
      const v = read();
      if (v !== undefined && v !== state.value) state.value = v;
    };
    sync();
    const id = window.setInterval(sync, 16);
    onUnmounted(() => window.clearInterval(id));
  });

  return [state, setState];
}

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const selector =
    'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
  );
}

export function trapFocus(event: KeyboardEvent, root: HTMLElement): void {
  if (event.key !== "Tab") return;
  const focusables = getFocusableElements(root);
  if (focusables.length === 0) return;
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export {
  basePlacement,
  computePosition,
  createPointReference,
  createRectReference,
  createSizeFloating,
  estimatePosition,
  readDocumentRtl,
  toFloatingPlacement,
  useAnchorPosition,
  usePointPosition,
  type Align,
  type FloatingPosition,
  type FloatingStyle,
  type Placement,
  type RectLike,
  type UseAnchorPositionOptions,
  type UsePointPositionOptions,
} from "./floating";

export { signal, Show, SinwanPortal };
