import {
  autoUpdate,
  computePosition as fuiComputePosition,
  flip,
  limitShift,
  offset,
  platform as domPlatform,
  shift,
  type FloatingElement,
  type Middleware,
  type Placement as FuiPlacement,
  type ReferenceElement,
  type VirtualElement,
} from "@floating-ui/dom";
import { onMounted, onUnmounted } from "sinwan/component";
import {
  effect,
  signal,
  untrack,
  type Computed,
  type Signal,
} from "sinwan/reactivity";

type SignalOrComputed<T> = Signal<T> | Computed<T>;

export type Placement = "top" | "right" | "bottom" | "left";
export type Align = "start" | "center" | "end";

export type FloatingStyle = Record<string, string>;

export type RectLike = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
};

/** Map sinwan-ui side + align to Floating UI placement (`bottom-start`, …). */
export function toFloatingPlacement(
  placement: Placement = "bottom",
  align: Align = "center",
): FuiPlacement {
  if (align === "center") return placement;
  return `${placement}-${align}` as FuiPlacement;
}

export function basePlacement(placement: FuiPlacement | string): Placement {
  const base = String(placement).split("-")[0] ?? "bottom";
  if (
    base === "top" ||
    base === "right" ||
    base === "bottom" ||
    base === "left"
  ) {
    return base;
  }
  return "bottom";
}

/** LTR-safe RTL probe for Floating UI (Happy-DOM-safe). */
export function readDocumentRtl(): boolean {
  try {
    const root = document.documentElement;
    if (!(root instanceof Element)) return false;
    return getComputedStyle(root).direction === "rtl";
  } catch {
    return false;
  }
}

/**
 * Happy-DOM and some test environments throw in Floating UI's default `isRTL`
 * when the reference is a VirtualElement. Keep LTR-safe fallbacks.
 */
const safePlatform = {
  ...domPlatform,
  isRTL: readDocumentRtl,
};

export type VirtualClientRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  toJSON(): VirtualClientRect;
};

function virtualClientRect(
  x: number,
  y: number,
  width: number,
  height: number,
): VirtualClientRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON() {
      return this;
    },
  };
}

export function createRectReference(rect: RectLike): {
  getBoundingClientRect(): VirtualClientRect;
} {
  return {
    getBoundingClientRect() {
      return virtualClientRect(rect.left, rect.top, rect.width, rect.height);
    },
  };
}

export function createSizeFloating(
  width: number,
  height: number,
): {
  getBoundingClientRect(): VirtualClientRect;
} {
  return {
    getBoundingClientRect() {
      return virtualClientRect(0, 0, width, height);
    },
  };
}

export function createPointReference(
  x: number,
  y: number,
): {
  getBoundingClientRect(): VirtualClientRect;
} {
  return {
    getBoundingClientRect() {
      return virtualClientRect(x, y, 0, 0);
    },
  };
}

function defaultMiddleware(gap: number): Middleware[] {
  return [
    offset(gap),
    flip({ crossAxis: true, fallbackAxisSideDirection: "start" }),
    shift({ padding: 8, limiter: limitShift() }),
  ];
}

type FloatingCoords = {
  top: number;
  left: number;
  placement: FuiPlacement;
};

async function runFloatingCompute(
  reference: ReferenceElement,
  floating: FloatingElement | VirtualElement,
  placement: FuiPlacement,
  gap: number,
): Promise<FloatingCoords> {
  const result = await fuiComputePosition(reference, floating as FloatingElement, {
    placement,
    strategy: "fixed",
    middleware: defaultMiddleware(gap),
    platform: safePlatform,
  });
  return { top: result.y, left: result.x, placement: result.placement };
}

/**
 * Position a floating box relative to an anchor rect using @floating-ui/dom
 * (offset, flip, shift). Falls back to `estimatePosition` if Floating UI fails.
 */
export async function computePosition(
  anchor: RectLike,
  content: { width: number; height: number },
  placement: Placement = "bottom",
  align: Align = "center",
  gap = 8,
): Promise<{ top: number; left: number; placement: FuiPlacement }> {
  try {
    return await runFloatingCompute(
      createRectReference(anchor),
      createSizeFloating(content.width, content.height),
      toFloatingPlacement(placement, align),
      gap,
    );
  } catch {
    const estimated = estimatePosition(anchor, content, placement, align, gap);
    return {
      top: estimated.top,
      left: estimated.left,
      placement: toFloatingPlacement(placement, align),
    };
  }
}

/**
 * Sync estimate for first paint (before Floating UI's async refine).
 * Matches basic offset + align; flip/shift apply on the next Floating UI pass.
 */
export function estimatePosition(
  anchor: RectLike,
  content: { width: number; height: number },
  placement: Placement = "bottom",
  align: Align = "center",
  gap = 8,
): { top: number; left: number } {
  let top = 0;
  let left = 0;
  switch (placement) {
    case "top":
      top = anchor.top - content.height - gap;
      break;
    case "bottom":
      top = anchor.bottom + gap;
      break;
    case "left":
      left = anchor.left - content.width - gap;
      top = anchor.top;
      break;
    case "right":
      left = anchor.right + gap;
      top = anchor.top;
      break;
  }
  if (placement === "top" || placement === "bottom") {
    if (align === "start") left = anchor.left;
    else if (align === "end") left = anchor.right - content.width;
    else left = anchor.left + (anchor.width - content.width) / 2;
  } else {
    if (align === "start") top = anchor.top;
    else if (align === "end") top = anchor.bottom - content.height;
    else top = anchor.top + (anchor.height - content.height) / 2;
  }
  const maxLeft = window.innerWidth - content.width - 8;
  const maxTop = window.innerHeight - content.height - 8;
  return {
    top: Math.max(8, Math.min(top, maxTop)),
    left: Math.max(8, Math.min(left, maxLeft)),
  };
}

export type UseAnchorPositionOptions = {
  open: SignalOrComputed<boolean>;
  trigger: SignalOrComputed<HTMLElement | null>;
  content?: SignalOrComputed<HTMLElement | null>;
  placement?: Placement;
  align?: Align;
  gap?: number;
  fallbackSize?: { width: number; height: number };
  extra?: (anchor: DOMRect) => Record<string, string>;
};

export type FloatingPosition = {
  style: Signal<FloatingStyle>;
  ready: Signal<boolean>;
  /** Resolved base side after Floating UI flip (for `data-side`). */
  side: Signal<Placement>;
  present: { readonly value: boolean };
};

function applyFixedStyle(
  style: Signal<FloatingStyle>,
  top: number,
  left: number,
  extra?: Record<string, string>,
): void {
  untrack(() => {
    style.value = {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: "50",
      ...extra,
    };
  });
}

/**
 * Floating UI's `autoUpdate` walks overflow ancestors with `getComputedStyle`.
 * That throws (`parameter 1 is not of type 'Element'`) for disconnected nodes,
 * VirtualElement-like objects, and some iframe/preview browsing contexts.
 */
function bindAutoUpdate(
  reference: ReferenceElement,
  floating: HTMLElement,
  update: () => void,
): (() => void) | undefined {
  if (!floating.isConnected) return undefined;
  try {
    return autoUpdate(reference, floating, update, { layoutShift: false });
  } catch {
    return undefined;
  }
}

function readContentRect(
  content: HTMLElement | null | undefined,
): DOMRect | undefined {
  if (content == null || typeof content.getBoundingClientRect !== "function") {
    return undefined;
  }
  try {
    return content.getBoundingClientRect();
  } catch {
    return undefined;
  }
}

/**
 * Anchor a fixed layer to a trigger with @floating-ui/dom.
 * `present` places synchronously for the first paint, then Floating UI refines
 * with flip/shift and `autoUpdate` while open.
 */
export function useAnchorPosition(
  options: UseAnchorPositionOptions,
): FloatingPosition {
  const initialSide = options.placement ?? "bottom";
  const style = signal<FloatingStyle>({
    position: "fixed",
    top: "0px",
    left: "0px",
    zIndex: "50",
  });
  const ready = signal(false);
  const side = signal<Placement>(initialSide);
  let generation = 0;
  let stopAutoUpdate: (() => void) | undefined;

  const clearAutoUpdate = () => {
    stopAutoUpdate?.();
    stopAutoUpdate = undefined;
  };

  const readContent = (): HTMLElement | null | undefined =>
    options.content?.value;

  const contentSize = (): { width: number; height: number } => {
    const measured = readContentRect(readContent());
    return {
      width:
        measured && measured.width > 0
          ? measured.width
          : (options.fallbackSize?.width ?? 0),
      height:
        measured && measured.height > 0
          ? measured.height
          : (options.fallbackSize?.height ?? 0),
    };
  };

  const refineWithFloatingUi = (
    trigger: HTMLElement,
    floating: HTMLElement | VirtualElement,
    gen: number,
  ): void => {
    const placement = options.placement ?? "bottom";
    const align = options.align ?? "center";
    const gap = options.gap ?? 8;
    void runFloatingCompute(
      trigger,
      floating,
      toFloatingPlacement(placement, align),
      gap,
    )
      .then((result) => {
        if (gen !== generation) return;
        if (!options.open.value) return;
        const anchor = trigger.getBoundingClientRect();
        applyFixedStyle(style, result.top, result.left, options.extra?.(anchor));
        untrack(() => {
          side.value = basePlacement(result.placement);
          ready.value = true;
        });
      })
      .catch(() => {
        /* estimate already applied synchronously */
      });
  };

  const place = (): boolean => {
    const trigger = options.trigger.value;
    if (!options.open.value || !trigger) {
      untrack(() => {
        ready.value = false;
      });
      clearAutoUpdate();
      return false;
    }

    const placement = options.placement ?? "bottom";
    const align = options.align ?? "center";
    const gap = options.gap ?? 8;
    const size = contentSize();
    const anchor = trigger.getBoundingClientRect();
    const estimated = estimatePosition(anchor, size, placement, align, gap);
    applyFixedStyle(style, estimated.top, estimated.left, options.extra?.(anchor));
    untrack(() => {
      side.value = placement;
      ready.value = true;
    });

    const gen = ++generation;
    const content = readContent();
    const floating: HTMLElement | VirtualElement =
      content ?? createSizeFloating(size.width, size.height);
    refineWithFloatingUi(trigger, floating, gen);

    clearAutoUpdate();
    if (content) {
      stopAutoUpdate = bindAutoUpdate(trigger, content, () => {
        refineWithFloatingUi(trigger, content, generation);
      });
    }

    return true;
  };

  const present = (): boolean => {
    if (!options.open.value) {
      untrack(() => {
        ready.value = false;
      });
      clearAutoUpdate();
      return false;
    }
    return place();
  };

  onMounted(() => {
    const stop = effect(() => {
      options.open.value;
      options.trigger.value;
      readContent();
      untrack(() => {
        place();
      });
    });
    onUnmounted(() => {
      stop();
      clearAutoUpdate();
      generation += 1;
    });
  });

  return {
    style,
    ready,
    side,
    present: {
      get value() {
        return present();
      },
    },
  };
}

export type UsePointPositionOptions = {
  open: SignalOrComputed<boolean>;
  point: SignalOrComputed<{ x: number; y: number }>;
  content?: SignalOrComputed<HTMLElement | null>;
  fallbackSize?: { width: number; height: number };
};

/** Position a layer at a pointer coordinate (context menu) via Floating UI. */
export function usePointPosition(
  options: UsePointPositionOptions,
): FloatingPosition {
  const style = signal<FloatingStyle>({
    position: "fixed",
    top: "0px",
    left: "0px",
    zIndex: "50",
  });
  const ready = signal(false);
  const side = signal<Placement>("bottom");
  let generation = 0;
  let stopAutoUpdate: (() => void) | undefined;

  const clearAutoUpdate = () => {
    stopAutoUpdate?.();
    stopAutoUpdate = undefined;
  };

  const readContent = (): HTMLElement | null | undefined =>
    options.content?.value;

  const refinePoint = (
    reference: VirtualElement,
    floating: HTMLElement | VirtualElement,
    gen: number,
  ): void => {
    void runFloatingCompute(reference, floating, "bottom-start", 0)
      .then((result) => {
        if (gen !== generation) return;
        if (!options.open.value) return;
        applyFixedStyle(style, result.top, result.left);
        untrack(() => {
          side.value = basePlacement(result.placement);
          ready.value = true;
        });
      })
      .catch(() => {
        /* sync point already applied */
      });
  };

  const place = (): boolean => {
    if (!options.open.value) {
      untrack(() => {
        ready.value = false;
      });
      clearAutoUpdate();
      return false;
    }
    const { x, y } = options.point.value;
    applyFixedStyle(style, y, x);
    untrack(() => {
      ready.value = true;
    });

    const content = readContent();
    const measured = readContentRect(content);
    const size = {
      width:
        measured && measured.width > 0
          ? measured.width
          : (options.fallbackSize?.width ?? 0),
      height:
        measured && measured.height > 0
          ? measured.height
          : (options.fallbackSize?.height ?? 0),
    };
    const gen = ++generation;
    const reference = createPointReference(x, y);
    const floating: HTMLElement | VirtualElement =
      content ?? createSizeFloating(size.width, size.height);
    refinePoint(reference, floating, gen);

    clearAutoUpdate();
    if (content) {
      stopAutoUpdate = bindAutoUpdate(reference, content, () => {
        refinePoint(reference, content, generation);
      });
    }

    return true;
  };

  const present = (): boolean => {
    if (!options.open.value) {
      untrack(() => {
        ready.value = false;
      });
      clearAutoUpdate();
      return false;
    }
    return place();
  };

  onMounted(() => {
    const stop = effect(() => {
      options.open.value;
      options.point.value;
      readContent();
      untrack(() => {
        place();
      });
    });
    onUnmounted(() => {
      stop();
      clearAutoUpdate();
      generation += 1;
    });
  });

  return {
    style,
    ready,
    side,
    present: {
      get value() {
        return present();
      },
    },
  };
}
