import { onUnmounted, type SinwanNode } from "sinwan/component";
import { computed, effect, signal, untrack, type Computed, type Signal } from "sinwan/reactivity";
import { Presence, UiPortal } from "./core";
import { useAnchorPosition } from "./floating";

export type MenuSubApi = {
  open: Signal<boolean> | Computed<boolean>;
  setOpen: (value: boolean) => void;
  triggerEl: Signal<HTMLElement | null>;
  cancelClose: () => void;
  requestClose: (delayMs?: number) => void;
};

export type MenuSubOptions = {
  controlled: boolean;
  defaultOpen?: boolean;
  readOpen: () => boolean;
  onOpenChange?: (open: boolean) => void;
  /** Open state of the menu or submenu that contains this submenu; the sub closes when it turns false. */
  parentOpen?: () => boolean;
};

export type MenuSubTriggerHandlers = {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
};

export function createMenuSubApi(options: MenuSubOptions): MenuSubApi {
  const openLocal = signal(options.defaultOpen ?? false);
  const open = options.controlled ? computed(options.readOpen) : openLocal;
  const set = (next: boolean) => {
    if (!options.controlled) openLocal.value = next;
  };
  const triggerEl = signal<HTMLElement | null>(null);
  let closeTimer: number | undefined;
  function cancelClose() {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  }
  function setOpen(value: boolean) {
    cancelClose();
    set(value);
    options.onOpenChange?.(value);
  }
  function requestClose(delayMs = 100) {
    cancelClose();
    closeTimer = window.setTimeout(() => {
      closeTimer = undefined;
      setOpen(false);
    }, delayMs);
  }
  const parentOpen = options.parentOpen;
  if (parentOpen) {
    effect(() => {
      if (parentOpen()) return;
      untrack(() => {
        if (open.value) setOpen(false);
      });
    });
  }
  onUnmounted(cancelClose);
  return {
    open,
    setOpen,
    triggerEl,
    cancelClose,
    requestClose,
  };
}

/** Hover, click and ArrowRight open the sub (never toggle it closed); leaving starts the hover close delay. */
export function createMenuSubTriggerHandlers(api: MenuSubApi): MenuSubTriggerHandlers {
  function openSub() {
    api.cancelClose();
    if (!api.open.value) api.setOpen(true);
  }
  return {
    onMouseEnter: openSub,
    onMouseLeave: () => api.requestClose(),
    onClick: openSub,
    onKeyDown: (event) => {
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      openSub();
    },
  };
}

export function isInsideMenuSubContent(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("[data-slot$='-sub-content']") != null
  );
}

export type MenuSubContentLayerProps = {
  api: MenuSubApi;
  slot: string;
  class?: string;
  children?: SinwanNode;
};

export function MenuSubContentLayer(props: MenuSubContentLayerProps) {
  const contentEl = signal<HTMLElement | null>(null);
  const { style, side } = useAnchorPosition({
    open: props.api.open,
    trigger: props.api.triggerEl,
    content: contentEl,
    placement: "right",
    align: "start",
    gap: 4,
    fallbackSize: { width: 128, height: 120 },
  });
  function subState() {
    return props.api.open.value ? "open" : "closed";
  }
  return (
    <Presence
      present={props.api.open.value}
    >
      <UiPortal>
        <div
          data-slot={props.slot}
          data-state={subState}
          data-side={side.value}
          class={props.class}
          style={style.value}
          onmouseenter={() => props.api.cancelClose()}
          onmouseleave={() => props.api.requestClose()}
          ref={(el: HTMLElement | null) => {
            contentEl.value = el;
          }}
        >
          {props.children}
        </div>
      </UiPortal>
    </Presence>
  );
}
