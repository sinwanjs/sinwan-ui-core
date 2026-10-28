import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cc } from "sinwan/component";
import { signal } from "sinwan/reactivity";
import {
  getFocusableElements,
  Presence,
  trapFocus,
  UiPortal,
  useControllableState,
} from "../src/core";
import {
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
} from "../src/floating";
import { Slot } from "../src/slot";
import { flattenChildren, isSinwanElement } from "../src/types";
import { asVNode, mountUi, query, setupDom, stubRects, teardownDom, wait, withSetup } from "./helpers";

beforeEach(() => setupDom());
afterEach(() => teardownDom());

function isThunk(value: unknown): value is () => unknown {
  return typeof value === "function";
}

function callProp(value: unknown): unknown {
  if (!isThunk(value)) throw new Error("expected a function prop");
  return value();
}

const settle = async () => {
  await Promise.resolve();
  await wait(0);
};

describe("types helpers", () => {
  test("isSinwanElement and flattenChildren", () => {
    const el = { tag: "div", props: {}, children: [] };
    expect(isSinwanElement(el)).toBe(true);
    expect(isSinwanElement("x")).toBe(false);
    expect(flattenChildren(null)).toEqual([]);
    expect(flattenChildren(true)).toEqual([]);
    expect(flattenChildren([el, false, "a"])).toEqual([el, "a"]);
    expect(flattenChildren(() => el)).toEqual([el]);
    expect(flattenChildren(() => [el, false, "a"])).toEqual([el, "a"]);
  });
});

describe("Slot", () => {
  test("merges props onto single child and chains handlers", () => {
    const calls: string[] = [];
    const child = {
      tag: "button",
      props: { class: "child", onclick: () => calls.push("child"), onfocus: "not-a-handler" },
      children: ["Go"],
    };
    const result = asVNode(
      Slot({
        class: "slot",
        onclick: () => calls.push("slot"),
        onfocus: () => calls.push("focus"),
        onblur: () => calls.push("blur"),
        "data-x": "1",
        children: child,
      }),
    );
    expect(result.tag).toBe("button");
    expect(result.props.class).toBe("child slot");
    expect(result.props["data-x"]).toBe("1");
    callProp(result.props.onclick);
    expect(calls).toEqual(["child", "slot"]);
    callProp(result.props.onblur);
    expect(calls).toEqual(["child", "slot", "blur"]);
    expect(result.children).toEqual(["Go"]);
  });

  test("drops non-string class values", () => {
    const result = asVNode(Slot({ class: 1, children: { tag: "span", props: {}, children: ["x"] } }));
    expect("class" in result.props).toBe(false);
    const empty = asVNode(Slot({ class: 1, children: { tag: "span", props: { class: "" }, children: ["x"] } }));
    expect(empty.props.class).toBeUndefined();
  });

  test("merges getter class props", () => {
    const result = asVNode(Slot({ class: () => "slot", children: { tag: "a", props: { class: () => "child" }, children: [] } }));
    expect(callProp(result.props.class)).toBe("child slot");
  });

  test("merges Computed / Signal class props with slot class", () => {
    const childClass = signal("child-active");
    const result = asVNode(Slot({ class: "slot-base", children: { tag: "a", props: { class: childClass }, children: [] } }));
    expect(callProp(result.props.class)).toBe("child-active slot-base");
    childClass.value = "child-idle";
    expect(callProp(result.props.class)).toBe("child-idle slot-base");
  });

  test("merges string child class with getter slot class", () => {
    const result = asVNode(Slot({ class: () => "slot", children: { tag: "a", props: { class: "child" }, children: [] } }));
    expect(callProp(result.props.class)).toBe("child slot");
  });

  test("getter class merge with non-strings resolves empty", () => {
    const result = asVNode(
      Slot({ class: () => 1, children: { tag: "span", props: { class: () => null }, children: ["x"] } }),
    );
    expect(callProp(result.props.class)).toBeUndefined();
    const arity = asVNode(
      Slot({ class: (value: unknown) => value, children: { tag: "span", props: { class: 2 }, children: [] } }),
    );
    expect(callProp(arity.props.class)).toBeUndefined();
  });

  test("throws without a single element child", () => {
    expect(() => Slot({ children: "text" })).toThrow(/exactly one/);
    expect(() => Slot({ children: () => "text" })).toThrow(/exactly one/);
    expect(() =>
      Slot({
        children: [
          { tag: "a", props: {}, children: [] },
          { tag: "b", props: {}, children: [] },
        ],
      }),
    ).toThrow(/exactly one/);
  });

  test("merges compiler child getters onto the element", () => {
    const child = { tag: "a", props: { class: "child", href: "#" }, children: ["Go"] };
    const fromGetter = asVNode(Slot({ class: "slot", children: () => child }));
    expect(fromGetter.props.class).toBe("child slot");
    expect(fromGetter.props.href).toBe("#");
    const fromNested = asVNode(Slot({ class: "slot", children: () => () => child }));
    expect(fromNested.props.class).toBe("child slot");
  });
});

describe("core helpers", () => {
  test("trapFocus cycles tab in both directions and ignores other keys", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const empty = document.createElement("div");
    trapFocus(new KeyboardEvent("keydown", { key: "Tab" }), empty);
    const a = document.createElement("button");
    const b = document.createElement("button");
    const disabled = document.createElement("button");
    disabled.disabled = true;
    const skipped = document.createElement("div");
    skipped.tabIndex = -1;
    root.append(a, disabled, skipped, b);
    expect(getFocusableElements(root)).toEqual([a, b]);

    a.focus();
    trapFocus(new KeyboardEvent("keydown", { key: "Enter" }), root);
    const backward = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true });
    trapFocus(backward, root);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(b);

    const forward = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    trapFocus(forward, root);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);

    const middle = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    trapFocus(middle, root);
    expect(middle.defaultPrevented).toBe(false);
  });

  test("useControllableState reads controlled getters, plain values and local state", async () => {
    withSetup(() => {
      const plain = useControllableState({ value: 7, defaultValue: 0 });
      expect(plain[0].value).toBe(7);
      const local = useControllableState({ defaultValue: 9 });
      local[1]((prev) => prev + 1);
      expect(local[0].value).toBe(10);
    });

    const external = signal(3);
    const changes: number[] = [];
    let api: ReturnType<typeof useControllableState<number>> | undefined;
    const Probe = cc(() => {
      api = useControllableState<number>({
        value: () => external.value,
        defaultValue: 0,
        onChange: (value) => changes.push(value),
      });
      return <span data-slot="controllable">{api[0].value}</span>;
    });
    const Local = cc(() => {
      useControllableState({ defaultValue: 1 });
      return null;
    });
    const view = mountUi(() => (
      <>
        <Probe />
        <Local />
      </>
    ));
    api![1](4);
    api![1]((prev) => prev + 2);
    expect(changes).toEqual([4, 5]);
    expect(api![0].value).toBe(3);
    external.value = 9;
    await wait(40);
    expect(api![0].value).toBe(9);
    view.unmount();
  });

  test("UiPortal mounts into body, an element or a container getter", () => {
    const target = document.createElement("section");
    document.body.appendChild(target);
    const view = mountUi(() => (
      <>
        <UiPortal>
          <span data-slot="portal-body">body</span>
        </UiPortal>
        <UiPortal container={target}>
          <span data-slot="portal-element">element</span>
        </UiPortal>
        <UiPortal container={() => target}>
          <span data-slot="portal-getter">getter</span>
        </UiPortal>
      </>
    ));
    expect(query('[data-slot="portal-body"]').parentElement).toBe(document.body);
    expect(query('[data-slot="portal-element"]').parentElement).toBe(target);
    expect(query('[data-slot="portal-getter"]').parentElement).toBe(target);
    view.unmount();
  });

  test("Presence clears a pending exit when unmounted", async () => {
    const present = signal(true);
    const view = mountUi(() => (
      <Presence present={present.value} exitMs={50}>
        <span data-slot="presence-unmount" />
      </Presence>
    ));
    present.value = false;
    await Promise.resolve();
    view.unmount();
    await wait(60);
    expect(document.querySelector('[data-slot="presence-unmount"]')).toBeNull();
  });
});

describe("floating position helpers", () => {
  test("computePosition places across sides", async () => {
    const bottom = await computePosition(
      { top: 10, left: 10, bottom: 30, right: 50, width: 40, height: 20 },
      { width: 100, height: 40 },
    );
    expect(bottom.placement).toBe("bottom");
    expect(Number.isFinite(bottom.top)).toBe(true);
    const left = await computePosition(
      { top: 100, left: 200, bottom: 120, right: 240, width: 40, height: 20 },
      { width: 80, height: 40 },
      "left",
      "start",
    );
    expect(left.left).toBeLessThan(200);
  });

  test("computePosition falls back to the estimate when Floating UI throws", async () => {
    const original = window.getComputedStyle;
    Object.defineProperty(window, "getComputedStyle", {
      configurable: true,
      value: () => {
        throw new TypeError("parameter 1 is not of type 'Element'.");
      },
    });
    const originalWidth = document.documentElement.clientWidth;
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      get() {
        throw new Error("layout unavailable");
      },
    });
    try {
      const pos = await computePosition(
        { top: 80, left: 100, bottom: 100, right: 140, width: 40, height: 20 },
        { width: 50, height: 20 },
        "bottom",
        "start",
        8,
      );
      expect(pos).toEqual({ top: 108, left: 100, placement: "bottom-start" });
    } finally {
      Object.defineProperty(window, "getComputedStyle", { configurable: true, value: original });
      Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: originalWidth });
    }
  });

  test("toFloatingPlacement, basePlacement and estimatePosition cover sides", () => {
    expect(toFloatingPlacement()).toBe("bottom");
    expect(toFloatingPlacement("top", "start")).toBe("top-start");
    expect(basePlacement("bottom-end")).toBe("bottom");
    expect(basePlacement("left")).toBe("left");
    expect(basePlacement("weird")).toBe("bottom");
    const anchor = { top: 80, left: 100, bottom: 100, right: 140, width: 40, height: 20 };
    const size = { width: 50, height: 20 };
    expect(estimatePosition(anchor, size)).toEqual({ top: 108, left: 95 });
    expect(estimatePosition(anchor, size, "bottom", "start", 8).top).toBe(108);
    expect(estimatePosition(anchor, size, "top", "end", 8)).toEqual({ top: 52, left: 90 });
    expect(estimatePosition(anchor, size, "left", "center", 8).left).toBe(42);
    expect(estimatePosition(anchor, size, "right", "start", 8)).toEqual({ top: 80, left: 148 });
    expect(estimatePosition(anchor, size, "left", "end", 8).top).toBe(80);
    expect(estimatePosition(anchor, size, "right", "center", 8).top).toBe(80);
  });

  test("virtual references and RTL probe", () => {
    const ref = createRectReference({ top: 80, left: 100, bottom: 100, right: 140, width: 40, height: 20 });
    expect(ref.getBoundingClientRect().width).toBe(40);
    expect(ref.getBoundingClientRect().toJSON().left).toBe(100);
    const size = createSizeFloating(12, 34).getBoundingClientRect();
    expect(size.height).toBe(34);
    expect(size.toJSON().width).toBe(12);
    const point = createPointReference(9, 11).getBoundingClientRect();
    expect(point.x).toBe(9);
    expect(point.toJSON().bottom).toBe(11);

    expect(readDocumentRtl()).toBe(false);
    document.documentElement.setAttribute("style", "direction: rtl");
    expect(readDocumentRtl()).toBe(true);
    const original = globalThis.getComputedStyle;
    Object.assign(globalThis, {
      getComputedStyle: () => {
        throw new Error("boom");
      },
    });
    try {
      expect(readDocumentRtl()).toBe(false);
    } finally {
      Object.assign(globalThis, { getComputedStyle: original });
    }
    const root = document.documentElement;
    Object.defineProperty(document, "documentElement", { configurable: true, value: null });
    try {
      expect(readDocumentRtl()).toBe(false);
    } finally {
      Object.defineProperty(document, "documentElement", { configurable: true, value: root });
    }
  });

  test("useAnchorPosition places on open, refines, and stops when closed", async () => {
    stubRects((el) => (el.getAttribute("data-slot") === "anchor" ? new DOMRect(100, 80, 40, 20) : null));
    const open = signal(false);
    const trigger = signal<HTMLElement | null>(null);
    const extraCalls: number[] = [];
    let ready = false;
    const Probe = cc(() => {
      const position = useAnchorPosition({
        open,
        trigger,
        placement: "bottom",
        align: "start",
        gap: 8,
        fallbackSize: { width: 50, height: 20 },
        extra: (anchor) => {
          extraCalls.push(anchor.width);
          return { "--anchor-width": `${anchor.width}px` };
        },
      });
      return (
        <div
          data-slot="probe"
          data-present={position.present.value ? "true" : undefined}
          data-ready={() => {
            ready = position.ready.value;
            return ready ? "true" : undefined;
          }}
          style={position.style.value}
        />
      );
    });
    const { unmount } = mountUi(() => <Probe />);
    const probe = query('[data-slot="probe"]');
    expect(probe.hasAttribute("data-present")).toBe(false);
    const anchorEl = document.createElement("button");
    anchorEl.setAttribute("data-slot", "anchor");
    document.body.appendChild(anchorEl);
    trigger.value = anchorEl;
    open.value = true;
    await settle();
    expect(probe.style.top).toBe("108px");
    expect(probe.style.left).toBe("100px");
    expect(extraCalls.length).toBeGreaterThan(0);
    expect(ready).toBe(true);
    open.value = false;
    await settle();
    expect(ready).toBe(false);
    unmount();
  });

  test("useAnchorPosition defaults when no placement or size is given", async () => {
    const open = signal(true);
    const trigger = signal<HTMLElement | null>(null);
    const Probe = cc(() => {
      const position = useAnchorPosition({ open, trigger });
      return <div data-slot="defaults" data-side={position.side.value} style={position.style.value} />;
    });
    const { unmount } = mountUi(() => <Probe />);
    const el = document.createElement("button");
    document.body.appendChild(el);
    trigger.value = el;
    await settle();
    expect(query('[data-slot="defaults"]').getAttribute("data-side")).toBe("bottom");
    unmount();
  });

  test("usePointPosition tracks pointer coordinates", async () => {
    const open = signal(false);
    const point = signal({ x: 0, y: 0 });
    let present = false;
    const Probe = cc(() => {
      const position = usePointPosition({ open, point, fallbackSize: { width: 30, height: 30 } });
      return (
        <div
          data-slot="point"
          data-present={() => {
            present = position.present.value;
            return present ? "true" : undefined;
          }}
          style={position.style.value}
        />
      );
    });
    const { unmount } = mountUi(() => <Probe />);
    expect(present).toBe(false);
    point.value = { x: 42, y: 84 };
    open.value = true;
    await settle();
    const el = query('[data-slot="point"]');
    expect(present).toBe(true);
    expect(el.style.top).toBe("84px");
    expect(el.style.left).toBe("42px");
    open.value = false;
    await settle();
    unmount();
  });

  test("autoUpdate and refine tolerate disconnected, broken and throwing content", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const disconnected = document.createElement("div");
    const connected = document.createElement("div");
    document.body.appendChild(connected);
    const throwingRect = document.createElement("div");
    Object.defineProperty(throwingRect, "getBoundingClientRect", {
      value: () => {
        throw new Error("rect");
      },
    });
    const noRect = document.createElement("div");
    Object.defineProperty(noRect, "getBoundingClientRect", { value: undefined });

    const open = signal(true);
    const triggerEl = signal<HTMLElement | null>(trigger);
    const content = signal<HTMLElement | null>(disconnected);
    const pointAt = signal({ x: 4, y: 8 });
    const Probe = cc(() => {
      const anchor = useAnchorPosition({ open, trigger: triggerEl, content });
      const point = usePointPosition({ open, point: pointAt, content });
      return (
        <div
          data-slot="auto-update-probe"
          data-anchor={anchor.present.value ? "yes" : "no"}
          data-point={point.present.value ? "yes" : "no"}
        />
      );
    });
    const { root, unmount } = mountUi(() => <Probe />);
    await settle();

    content.value = throwingRect;
    await settle();
    content.value = noRect;
    await settle();

    const original = window.getComputedStyle;
    Object.defineProperty(window, "getComputedStyle", {
      configurable: true,
      value: () => {
        throw new TypeError("parameter 1 is not of type 'Element'.");
      },
    });
    try {
      content.value = connected;
      await settle();
    } finally {
      Object.defineProperty(window, "getComputedStyle", { configurable: true, value: original });
    }

    content.value = null;
    await settle();
    content.value = connected;
    await settle();
    connected.style.width = "41px";
    window.dispatchEvent(new Event("resize"));
    await wait(20);

    open.value = false;
    await settle();
    expect(root.querySelector("[data-slot=auto-update-probe]")?.getAttribute("data-anchor")).toBe("no");
    expect(root.querySelector("[data-slot=auto-update-probe]")?.getAttribute("data-point")).toBe("no");
    unmount();
  });

  test("stale refines are ignored after close and unmount", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const open = signal(true);
    const triggerEl = signal<HTMLElement | null>(trigger);
    const pointAt = signal({ x: 1, y: 2 });
    const Probe = cc(() => {
      useAnchorPosition({ open, trigger: triggerEl });
      usePointPosition({ open, point: pointAt });
      return null;
    });
    const first = mountUi(() => <Probe />);
    open.value = false;
    await settle();
    open.value = true;
    await Promise.resolve();
    first.unmount();
    await settle();

    const second = mountUi(() => <Probe />);
    pointAt.value = { x: 3, y: 4 };
    triggerEl.value = document.createElement("span");
    await settle();
    second.unmount();
  });
});
