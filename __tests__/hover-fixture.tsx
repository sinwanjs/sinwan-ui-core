import { cc, inject, onUnmounted, type SinwanNode } from "sinwan/component";
import { PopoverContent, PopoverKey, PopoverRoot } from "../src/overlay";
import { Slot } from "../src/slot";

const OPEN_DELAY_MS = 100;
const CLOSE_DELAY_MS = 120;

function usePopover() {
  const api = inject(PopoverKey);
  if (!api) throw new Error("hover fixture must be used within <HoverRoot />");
  return api;
}

export const HoverRoot = PopoverRoot;

/**
 * Minimal hover-card behaviour composed from the public overlay API, mirroring
 * how registry components drive `PopoverKey` (open delay, delayed close, reopen lock).
 */
export const HoverTrigger = cc<{ children?: SinwanNode; asChild?: boolean }>(({ children, asChild }) => {
  const api = usePopover();
  let openTimer: number | undefined;
  const clearOpenTimer = () => {
    window.clearTimeout(openTimer);
    openTimer = undefined;
  };
  const show = () => {
    if (api.isHoverOpenBlocked()) return;
    api.cancelClose();
    clearOpenTimer();
    openTimer = window.setTimeout(() => {
      openTimer = undefined;
      if (api.isHoverOpenBlocked()) return;
      api.setOpen(true);
    }, OPEN_DELAY_MS);
  };
  onUnmounted(clearOpenTimer);
  const handlers = {
    onmouseenter: () => {
      api.setPointerOverTrigger(true);
      show();
    },
    onmouseleave: () => {
      api.setPointerOverTrigger(false);
      clearOpenTimer();
      api.requestClose(CLOSE_DELAY_MS);
    },
    ref: (el: HTMLElement | null) => {
      api.triggerEl.value = el;
    },
  };
  if (asChild) return <Slot {...handlers}>{children}</Slot>;
  return (
    <button type="button" data-slot="hover-card-trigger" {...handlers}>
      {children}
    </button>
  );
});

export const HoverContent = cc<{ children?: SinwanNode }>(({ children }) => {
  const api = usePopover();
  return (
    <PopoverContent
      sideOffset={4}
      onmouseenter={() => {
        api.cancelClose();
        api.setOpen(true);
      }}
      onmouseleave={() => {
        api.requestClose(CLOSE_DELAY_MS);
      }}
    >
      {children}
    </PopoverContent>
  );
});
