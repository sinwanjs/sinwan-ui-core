import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cc } from "sinwan/component";
import { signal } from "sinwan/reactivity";
import {
  createMenuSubApi,
  createMenuSubTriggerHandlers,
  isInsideMenuSubContent,
  MenuSubContentLayer,
  type MenuSubApi,
} from "../src/menu-sub";
import { Presence, UiPortal } from "../src/core";
import { flush, mountUi, query, setupDom, stubFixedRect, teardownDom, wait } from "./helpers";

beforeEach(() => {
  setupDom();
  stubFixedRect();
});
afterEach(() => teardownDom());

function mountSub(options: Parameters<typeof createMenuSubApi>[0], layerClass?: string) {
  let api: MenuSubApi | undefined;
  const Sub = cc(() => {
    const sub = createMenuSubApi(options);
    api = sub;
    return (
      <>
        <button
          type="button"
          data-slot="test-sub-trigger"
          ref={(el: HTMLElement | null) => {
            sub.triggerEl.value = el;
          }}
        />
        <MenuSubContentLayer api={sub} slot="test-sub-content" class={layerClass}>
          <span data-slot="sub-item">Item</span>
        </MenuSubContentLayer>
      </>
    );
  });
  const view = mountUi(() => <Sub />);
  return {
    ...view,
    api: () => {
      if (!api) throw new Error("menu sub api not created");
      return api;
    },
  };
}

describe("isInsideMenuSubContent", () => {
  test("matches elements inside any *-sub-content layer", () => {
    expect(isInsideMenuSubContent(null)).toBe(false);
    expect(isInsideMenuSubContent(document.createTextNode("x"))).toBe(false);
    const layer = document.createElement("div");
    layer.setAttribute("data-slot", "context-menu-sub-content");
    const item = document.createElement("button");
    layer.appendChild(item);
    document.body.appendChild(layer);
    expect(isInsideMenuSubContent(item)).toBe(true);
    expect(isInsideMenuSubContent(document.body)).toBe(false);
  });
});

describe("createMenuSubApi", () => {
  test("uncontrolled sub opens, reports changes and closes after the hover delay", async () => {
    const changes: boolean[] = [];
    const view = mountSub({ controlled: false, readOpen: () => false, onOpenChange: (open) => changes.push(open) });
    expect(view.query('[data-slot="test-sub-content"]')).toBeNull();
    view.api().setOpen(true);
    await flush();
    const content = query('[data-slot="test-sub-content"]');
    expect(content.getAttribute("data-state")).toBe("open");
    expect(content.getAttribute("data-side")).toBe("right");
    expect(content.style.position).toBe("fixed");

    content.dispatchEvent(new MouseEvent("mouseleave"));
    content.dispatchEvent(new MouseEvent("mouseenter"));
    await wait(120);
    expect(view.api().open.value).toBe(true);

    content.dispatchEvent(new MouseEvent("mouseleave"));
    await wait(120);
    expect(view.api().open.value).toBe(false);
    expect(content.getAttribute("data-state")).toBe("closed");
    expect(changes).toEqual([true, false]);
    view.api().requestClose(5);
    view.unmount();
    await wait(10);
    expect(changes).toEqual([true, false]);
  });

  test("controlled sub follows readOpen and only reports changes", async () => {
    const open = signal(true);
    const changes: boolean[] = [];
    const view = mountSub({
      controlled: true,
      defaultOpen: false,
      readOpen: () => open.value,
      onOpenChange: (next) => changes.push(next),
    });
    expect(view.api().open.value).toBe(true);
    view.api().setOpen(false);
    expect(changes).toEqual([false]);
    expect(view.api().open.value).toBe(true);
    open.value = false;
    await flush();
    expect(view.api().open.value).toBe(false);
    view.unmount();
  });

  test("defaultOpen renders the layer immediately", () => {
    const view = mountSub({ controlled: false, defaultOpen: true, readOpen: () => false });
    expect(query('[data-slot="test-sub-content"]').getAttribute("data-state")).toBe("open");
    view.unmount();
  });

  test("closing the parent closes an open sub, runs its exit and unmounts it", async () => {
    const parentOpen = signal(true);
    const changes: boolean[] = [];
    const view = mountSub({
      controlled: false,
      readOpen: () => false,
      onOpenChange: (open) => changes.push(open),
      parentOpen: () => parentOpen.value,
    });
    view.api().setOpen(true);
    await flush();
    view.api().requestClose(5);
    parentOpen.value = false;
    await flush();
    expect(view.api().open.value).toBe(false);
    expect(query('[data-slot="test-sub-content"]').getAttribute("data-state")).toBe("closed");
    expect(changes).toEqual([true, false]);
    await wait(250);
    expect(view.query('[data-slot="test-sub-content"]')).toBeNull();
    expect(changes).toEqual([true, false]);

    parentOpen.value = true;
    await flush();
    expect(view.api().open.value).toBe(false);
    view.unmount();
  });

  test("a sub inside the parent's own Presence and portal unmounts when the parent closes", async () => {
    const parentOpen = signal(true);
    let api: MenuSubApi | undefined;
    const Sub = cc(() => {
      const sub = createMenuSubApi({
        controlled: false,
        defaultOpen: true,
        readOpen: () => false,
        parentOpen: () => parentOpen.value,
      });
      api = sub;
      return (
        <MenuSubContentLayer api={sub} slot="test-sub-content">
          <span data-slot="sub-item">Item</span>
        </MenuSubContentLayer>
      );
    });
    const view = mountUi(() => (
      <Presence present={parentOpen.value}>
        <UiPortal>
          <div data-slot="test-parent-content">
            <Sub />
          </div>
        </UiPortal>
      </Presence>
    ));
    expect(query('[data-slot="test-sub-content"]').getAttribute("data-state")).toBe("open");
    parentOpen.value = false;
    await flush();
    expect(api?.open.value).toBe(false);
    await wait(450);
    expect(view.query('[data-slot="test-parent-content"]')).toBeNull();
    expect(view.query('[data-slot="test-sub-content"]')).toBeNull();
    view.unmount();
  });

  test("a closed parent does not report a change for an already closed sub", async () => {
    const parentOpen = signal(true);
    const changes: boolean[] = [];
    const view = mountSub({
      controlled: false,
      readOpen: () => false,
      onOpenChange: (open) => changes.push(open),
      parentOpen: () => parentOpen.value,
    });
    parentOpen.value = false;
    await flush();
    expect(changes).toEqual([]);
    view.unmount();
  });

  test("a controlled sub asks its owner to close when the parent closes", async () => {
    const parentOpen = signal(true);
    const open = signal(true);
    const view = mountSub({
      controlled: true,
      readOpen: () => open.value,
      onOpenChange: (next) => {
        open.value = next;
      },
      parentOpen: () => parentOpen.value,
    });
    expect(view.api().open.value).toBe(true);
    parentOpen.value = false;
    await flush();
    expect(open.value).toBe(false);
    view.unmount();
  });

  test("the parent watcher stops after unmount", async () => {
    const parentOpen = signal(true);
    const changes: boolean[] = [];
    const view = mountSub({
      controlled: false,
      defaultOpen: true,
      readOpen: () => false,
      onOpenChange: (open) => changes.push(open),
      parentOpen: () => parentOpen.value,
    });
    view.unmount();
    parentOpen.value = false;
    await flush();
    expect(changes).toEqual([]);
  });
});

describe("createMenuSubTriggerHandlers", () => {
  function mountTrigger() {
    const changes: boolean[] = [];
    const view = mountSub({ controlled: false, readOpen: () => false, onOpenChange: (open) => changes.push(open) });
    const handlers = createMenuSubTriggerHandlers(view.api());
    return { view, handlers, changes };
  }

  test("hover opens and a click after hover keeps the sub open", async () => {
    const { view, handlers, changes } = mountTrigger();
    handlers.onMouseEnter();
    handlers.onClick();
    handlers.onClick();
    await flush();
    expect(view.api().open.value).toBe(true);
    expect(changes).toEqual([true]);
    view.unmount();
  });

  test("a click opens a closed sub and cancels a pending hover close", async () => {
    const { view, handlers } = mountTrigger();
    handlers.onClick();
    handlers.onMouseLeave();
    handlers.onClick();
    await wait(120);
    expect(view.api().open.value).toBe(true);
    handlers.onMouseLeave();
    await wait(120);
    expect(view.api().open.value).toBe(false);
    view.unmount();
  });

  test("ArrowRight opens the sub; other keys are ignored", () => {
    const { view, handlers } = mountTrigger();
    const other = new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true });
    handlers.onKeyDown(other);
    expect(other.defaultPrevented).toBe(false);
    expect(view.api().open.value).toBe(false);
    const right = new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true });
    handlers.onKeyDown(right);
    expect(right.defaultPrevented).toBe(true);
    expect(view.api().open.value).toBe(true);
    view.unmount();
  });
});

describe("MenuSubContentLayer", () => {
  test("applies only the passed class", () => {
    const view = mountSub({ controlled: false, defaultOpen: true, readOpen: () => false }, "registry-sub-class");
    expect(query('[data-slot="test-sub-content"]').className).toBe("registry-sub-class");
    view.unmount();
  });

  test("renders no class attribute when none is passed", () => {
    const view = mountSub({ controlled: false, defaultOpen: true, readOpen: () => false });
    expect(query('[data-slot="test-sub-content"]').hasAttribute("class")).toBe(false);
    view.unmount();
  });
});
