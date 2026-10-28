import {
  cc,
  inject,
  onMounted,
  onUnmounted,
  provide,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { computed, signal, type Computed, type Signal } from "sinwan/reactivity";
import { Slot } from "./slot";

import {
  Presence,
  UiPortal,
  useAnchorPosition,
  trapFocus,
  type Align,
  type Placement,
} from "./core";
import { isDismissExemptPointerTarget } from "./dismiss";

export type OpenApi = {
  open: Signal<boolean> | Computed<boolean>;
  setOpen: (value: boolean) => void;
  triggerEl: ReturnType<typeof signal<HTMLElement | null>>;
  requestClose: (delayMs?: number) => void;
  cancelClose: () => void;
  isHoverOpenBlocked: () => boolean;
  setPointerOverTrigger: (over: boolean) => void;
};

type OpenProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const REOPEN_LOCK_MS = 280;

function createOpenState(props: OpenProps): OpenApi {
  const openLocal = signal(props.defaultOpen ?? false);
  const open =
    "open" in props ? computed(() => Boolean(props.open)) : openLocal;
  const set = (next: boolean) => {
    if (!("open" in props)) openLocal.value = next;
  };
  let closeTimer: number | undefined;
  let pointerOverTrigger = false;
  let hoverOpenBlocked = false;
  let reopenLockUntil = 0;

  function cancelClose() {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  }

  function setOpen(value: boolean) {
    cancelClose();
    if (value) {
      if (Date.now() < reopenLockUntil) return;
    } else {
      if (pointerOverTrigger) hoverOpenBlocked = true;
      reopenLockUntil = Date.now() + REOPEN_LOCK_MS;
    }
    set(value);
    props.onOpenChange?.(value);
  }

  function requestClose(delayMs = 0) {
    cancelClose();
    closeTimer = window.setTimeout(() => {
      closeTimer = undefined;
      setOpen(false);
    }, delayMs);
  }

  function isHoverOpenBlocked() {
    return hoverOpenBlocked;
  }

  function setPointerOverTrigger(over: boolean) {
    pointerOverTrigger = over;
    if (!over) hoverOpenBlocked = false;
  }

  onUnmounted(cancelClose);

  return {
    open,
    setOpen,
    triggerEl: signal<HTMLElement | null>(null),
    requestClose,
    cancelClose,
    isHoverOpenBlocked,
    setPointerOverTrigger,
  };
}

// ─── Dialog ─────────────────────────────────────────────────

export const DialogKey: InjectionKey<OpenApi> = Symbol("sinwan-ui.dialog");

export type DialogRootProps = {
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const DialogRoot = cc<DialogRootProps>((props) => {
  const api = createOpenState(props);
  provide(DialogKey, api);
  return <>{props.children}</>;
});

export const DialogTrigger = cc<{
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
}>(({ children, class: className, asChild }) => {
  const api = inject(DialogKey)!;
  const onClick = () => {
    api.setOpen(true);
  };
  const ref = (el: HTMLElement | null) => {
    api.triggerEl.value = el;
  };
  if (asChild) {
    return (
      <Slot class={className} onclick={onClick} ref={ref}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type="button"
      class={className}
      data-slot="dialog-trigger"
      onclick={onClick}
      ref={ref}
    >
      {children}
    </button>
  );
});

export const DialogClose = cc<{
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
}>(({ children, class: className, asChild }) => {
  const api = inject(DialogKey)!;
  const onClick = () => {
    api.setOpen(false);
  };
  if (asChild) {
    return (
      <Slot class={className} onclick={onClick}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type="button"
      class={className}
      data-slot="dialog-close"
      onclick={onClick}
    >
      {children}
    </button>
  );
});

export const DialogOverlay = cc<{ class?: string }>(({ class: className }) => {
  const api = inject(DialogKey)!;
  function dismiss() {
    api.setOpen(false);
  }
  function overlayState() {
    return api.open.value ? "open" : "closed";
  }
  return (
    <Presence
      present={api.open.value}
    >
      <UiPortal>
        <div
          data-slot="dialog-overlay"
          data-state={overlayState}
          class={className}
          onclick={dismiss}
        />
      </UiPortal>
    </Presence>
  );
});

export const DialogContent = cc<{
  children?: SinwanNode;
  class?: string;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
  "data-side"?: string;
  "data-size"?: string;
  "data-vaul-drawer-direction"?: string;
  "data-slot"?: string;
  [key: `data-${string}`]: string | undefined;
}>(
  ({
    children,
    class: className,
    onEscapeKeyDown,
    "data-side": dataSide,
    "data-size": dataSize,
    "data-vaul-drawer-direction": dataDrawerDirection,
    "data-slot": dataSlot = "dialog-content",
    ...dataAttrs
  }) => {
    const api = inject(DialogKey)!;
    let contentEl: HTMLElement | null = null;
    let previousFocus: HTMLElement | null = null;

    onMounted(() => {
      function onKey(e: KeyboardEvent) {
        if (!api.open.value) return;
        if (e.key === "Escape") {
          onEscapeKeyDown?.(e);
          if (!e.defaultPrevented) api.setOpen(false);
        }
        if (contentEl) trapFocus(e, contentEl);
      }
      function cleanup() {
        document.removeEventListener("keydown", onKey);
      }
      document.addEventListener("keydown", onKey);
      onUnmounted(cleanup);
    });

    function contentState() {
      return api.open.value ? "open" : "closed";
    }
    return (
      <Presence
        present={api.open.value}
      >
        <UiPortal>
          <div
            {...dataAttrs}
            role="dialog"
            aria-modal="true"
            data-slot={dataSlot}
            data-state={contentState}
            data-side={dataSide}
            data-size={dataSize}
            data-vaul-drawer-direction={dataDrawerDirection}
            class={className}
            ref={function contentRef(el: HTMLElement | null) {
              contentEl = el;
              if (el) {
                previousFocus = document.activeElement as HTMLElement | null;
                el.focus?.();
              } else if (previousFocus) {
                previousFocus.focus?.();
              }
            }}
            tabIndex={-1}
            onclick={function stopBubble(e: MouseEvent) {
              e.stopPropagation();
            }}
          >
            {children}
          </div>
        </UiPortal>
      </Presence>
    );
  },
);

// ─── Collapsible ────────────────────────────────────────────

export const CollapsibleKey: InjectionKey<{
  open: Signal<boolean> | Computed<boolean>;
  setOpen: (v: boolean) => void;
}> = Symbol("sinwan-ui.collapsible");

export const CollapsibleRoot = cc<{
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  class?: string;
}>((props) => {
  const openLocal = signal(props.defaultOpen ?? false);
  const open =
    "open" in props ? computed(() => Boolean(props.open)) : openLocal;
  const set = (next: boolean) => {
    if (!("open" in props)) openLocal.value = next;
  };
  provide(CollapsibleKey, {
    open,
    setOpen: function setOpen(v: boolean) {
      set(v);
      props.onOpenChange?.(v);
    },
  });
  return (
    <div
      data-slot="collapsible"
      data-state={function stateAttr() {
        return open.value ? "open" : "closed";
      }}
      class={props.class}
    >
      {props.children}
    </div>
  );
});

export const CollapsibleTrigger = cc<{
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
}>(({ children, class: className, asChild }) => {
  const api = inject(CollapsibleKey)!;
  const toggle = () => {
    api.setOpen(!api.open.value);
  };
  if (asChild) {
    return (
      <Slot class={className} onclick={toggle}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type="button"
      class={className}
      data-slot="collapsible-trigger"
      aria-expanded={function expanded() {
        return api.open.value;
      }}
      onclick={toggle}
    >
      {children}
    </button>
  );
});

export const CollapsibleContent = cc<{
  children?: SinwanNode;
  class?: string;
}>(({ children, class: className }) => {
  const api = inject(CollapsibleKey)!;
  function stateAttr() {
    return api.open.value ? "open" : "closed";
  }
  function bindContent(el: HTMLElement | null) {
    if (el == null) return;
    const node = el;
    function measure() {
      const inner = node.firstElementChild;
      const height =
        inner instanceof HTMLElement ? inner.scrollHeight : node.scrollHeight;
      node.style.setProperty(
        "--radix-collapsible-content-height",
        `${height}px`,
      );
    }
    measure();
    requestAnimationFrame(measure);
  }
  return (
    <Presence
      present={api.open.value}
    >
      <div
        data-slot="collapsible-content"
        data-state={stateAttr}
        class={className}
        ref={bindContent}
      >
        {children}
      </div>
    </Presence>
  );
});

// ─── Popover / floating ─────────────────────────────────────

export const PopoverKey: InjectionKey<
  OpenApi & { placement: Placement; align: Align }
> = Symbol("sinwan-ui.popover");

export const PopoverRoot = cc<{
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  align?: Align;
}>((props) => {
  const api = createOpenState(props);
  provide(PopoverKey, {
    ...api,
    placement: props.placement ?? "bottom",
    align: props.align ?? "center",
  });
  return <>{props.children}</>;
});

export const PopoverTrigger = cc<{
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
}>(({ children, class: className, asChild }) => {
  const api = inject(PopoverKey)!;
  function onClick() {
    api.setOpen(!api.open.value);
  }
  const ref = (el: HTMLElement | null) => {
    api.triggerEl.value = el;
  };
  if (asChild) {
    return (
      <Slot class={className} onclick={onClick} ref={ref}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type="button"
      class={className}
      data-slot="popover-trigger"
      aria-expanded={function expanded() {
        return api.open.value;
      }}
      onclick={onClick}
      ref={ref}
    >
      {children}
    </button>
  );
});

export const PopoverContent = cc<{
  children?: SinwanNode;
  class?: string;
  side?: Placement;
  align?: Align;
  sideOffset?: number;
  onmouseenter?: (event: MouseEvent) => void;
  onmouseleave?: (event: MouseEvent) => void;
}>(
  ({
    children,
    class: className,
    side,
    align,
    sideOffset = 8,
    onmouseenter,
    onmouseleave,
  }) => {
    const api = inject(PopoverKey)!;
    const contentEl = signal<HTMLElement | null>(null);
    const { style, side: resolvedSide } = useAnchorPosition({
      open: api.open,
      trigger: api.triggerEl,
      content: contentEl,
      placement: side ?? api.placement,
      align: align ?? api.align,
      gap: sideOffset,
      fallbackSize: { width: 240, height: 160 },
    });

    onMounted(() => {
      function onDoc(e: MouseEvent) {
        if (!api.open.value) return;
        const t = e.target;
        if (
          (t instanceof Node && api.triggerEl.value?.contains(t)) ||
          isDismissExemptPointerTarget(t)
        ) {
          return;
        }
        api.setOpen(false);
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
          api.setOpen(false);
        }
      }
      document.addEventListener("pointerdown", onDoc);
      document.addEventListener("keydown", onKey);
      onUnmounted(() => {
        document.removeEventListener("pointerdown", onDoc);
        document.removeEventListener("keydown", onKey);
      });
    });

    function popoverState() {
      return api.open.value ? "open" : "closed";
    }
    return (
      <Presence
        present={api.open.value}
      >
        <UiPortal>
          <div
            data-slot="popover-content"
            data-state={popoverState}
            data-side={resolvedSide.value}
            class={className}
            style={style.value}
            role="dialog"
            onmouseenter={onmouseenter}
            onmouseleave={onmouseleave}
            ref={(el: HTMLElement | null) => {
              contentEl.value = el;
            }}
          >
            {children}
          </div>
        </UiPortal>
      </Presence>
    );
  },
);

// ─── Tooltip ────────────────────────────────────────────────

export const TooltipKey: InjectionKey<OpenApi> = Symbol("sinwan-ui.tooltip");

export const TooltipProvider = cc<{
  children?: SinwanNode;
  delayDuration?: number;
}>(({ children, delayDuration }) => {
  void delayDuration;
  return children ?? null;
});

export const TooltipRoot = cc<{
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>((props) => {
  const api = createOpenState(props);
  provide(TooltipKey, api);
  return <>{props.children}</>;
});

export const TooltipTrigger = cc<{
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
}>(({ children, class: className, asChild }) => {
  const api = inject(TooltipKey)!;
  const show = () => {
    api.setOpen(true);
  };
  const hide = () => {
    api.setOpen(false);
  };
  const ref = (el: HTMLElement | null) => {
    api.triggerEl.value = el;
  };
  const handlers = {
    onmouseenter: show,
    onmouseleave: hide,
    onfocus: show,
    onblur: hide,
    ref,
  };
  if (asChild) {
    return (
      <Slot class={className} {...handlers}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type="button"
      class={className}
      data-slot="tooltip-trigger"
      {...handlers}
    >
      {children}
    </button>
  );
});

export const TooltipContent = cc<{
  children?: SinwanNode;
  class?: string;
  side?: Placement;
  sideOffset?: number;
}>(({ children, class: className, side = "top", sideOffset = 8 }) => {
  const api = inject(TooltipKey)!;
  const contentEl = signal<HTMLElement | null>(null);
  const { style, side: resolvedSide } = useAnchorPosition({
    open: api.open,
    trigger: api.triggerEl,
    content: contentEl,
    placement: side,
    align: "center",
    gap: sideOffset,
    fallbackSize: { width: 120, height: 32 },
  });

  function tooltipState() {
    return api.open.value ? "open" : "closed";
  }
  return (
    <Presence
      present={api.open.value}
    >
      <UiPortal>
        <div
          role="tooltip"
          data-slot="tooltip-content"
          data-state={tooltipState}
          data-side={resolvedSide.value}
          class={className}
          style={style.value}
          ref={(el: HTMLElement | null) => {
            contentEl.value = el;
          }}
        >
          {children}
        </div>
      </UiPortal>
    </Presence>
  );
});
