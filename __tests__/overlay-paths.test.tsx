import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogRoot,
  DialogTrigger,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "../src/overlay";
import { flush, mountUi, query, setupDom, stubFixedRect, teardownDom, wait } from "./helpers";

beforeEach(() => {
  setupDom();
  stubFixedRect();
});
afterEach(() => teardownDom());

const escape = () =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

describe("dialog", () => {
  test("asChild trigger/close, data attributes, Escape handling and focus restore", async () => {
    let escapes = 0;
    let open = false;
    const ui = mountUi(() => (
      <DialogRoot
        onOpenChange={(v) => {
          open = v;
        }}
      >
        <DialogTrigger asChild>
          <button type="button" data-slot="custom-trigger">
            Open
          </button>
        </DialogTrigger>
        <DialogOverlay />
        <DialogContent
          class="panel"
          data-side="right"
          data-size="sm"
          data-vaul-drawer-direction="bottom"
          data-slot="sheet-content"
          data-extra="yes"
          onEscapeKeyDown={(event) => {
            escapes += 1;
            if (escapes === 1) event.preventDefault();
          }}
        >
          <DialogClose asChild>
            <button type="button" data-slot="custom-close">
              Close
            </button>
          </DialogClose>
          <button type="button" data-slot="last">
            Last
          </button>
        </DialogContent>
      </DialogRoot>
    ));
    const trigger = query('[data-slot="custom-trigger"]');
    trigger.focus();
    ui.click('[data-slot="custom-trigger"]');
    await flush();
    expect(open).toBe(true);
    const content = query('[data-slot="sheet-content"]');
    expect(content.getAttribute("role")).toBe("dialog");
    expect(content.getAttribute("data-side")).toBe("right");
    expect(content.getAttribute("data-size")).toBe("sm");
    expect(content.getAttribute("data-vaul-drawer-direction")).toBe("bottom");
    expect(content.getAttribute("data-extra")).toBe("yes");
    expect(content.className).toBe("panel");
    expect(document.activeElement).toBe(content);

    query('[data-slot="last"]').focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(query('[data-slot="custom-close"]'));

    content.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(open).toBe(true);

    escape();
    expect(escapes).toBe(1);
    expect(open).toBe(true);
    escape();
    expect(escapes).toBe(2);
    expect(open).toBe(false);
    await wait(300);
    expect(ui.query('[data-slot="sheet-content"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await wait(300);
    ui.click('[data-slot="custom-trigger"]');
    await flush();
    ui.click('[data-slot="custom-close"]');
    expect(open).toBe(false);
    ui.unmount();
  });

  test("Escape is ignored while the dialog is closed", () => {
    let escapes = 0;
    const ui = mountUi(() => (
      <DialogRoot>
        <DialogContent
          onEscapeKeyDown={() => {
            escapes += 1;
          }}
        >
          Body
        </DialogContent>
      </DialogRoot>
    ));
    escape();
    expect(escapes).toBe(0);
    ui.unmount();
  });

  test("Escape without a handler closes the dialog", async () => {
    let open = true;
    const ui = mountUi(() => (
      <DialogRoot
        defaultOpen
        onOpenChange={(v) => {
          open = v;
        }}
      >
        <DialogContent>Body</DialogContent>
      </DialogRoot>
    ));
    escape();
    expect(open).toBe(false);
    ui.unmount();
  });
});

describe("collapsible", () => {
  test("asChild trigger toggles and the root reports changes", () => {
    const changes: boolean[] = [];
    const ui = mountUi(() => (
      <CollapsibleRoot class="root" onOpenChange={(v) => changes.push(v)}>
        <CollapsibleTrigger asChild class="trigger">
          <button type="button" data-slot="custom-collapsible">
            Toggle
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>Body</CollapsibleContent>
      </CollapsibleRoot>
    ));
    expect(query('[data-slot="collapsible"]').className).toBe("root");
    expect(query('[data-slot="custom-collapsible"]').className).toBe("trigger");
    ui.click('[data-slot="custom-collapsible"]');
    expect(changes).toEqual([true]);
    ui.unmount();
  });
});

describe("popover", () => {
  test("Escape, outside pointerdown when closed, and placement props", async () => {
    let open = false;
    const ui = mountUi(() => (
      <PopoverRoot
        placement="top"
        align="start"
        onOpenChange={(v) => {
          open = v;
        }}
      >
        <PopoverTrigger class="trigger">P</PopoverTrigger>
        <PopoverContent side="left" align="end" sideOffset={2}>
          C
        </PopoverContent>
      </PopoverRoot>
    ));
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(open).toBe(false);
    ui.click('[data-slot="popover-trigger"]');
    await flush();
    expect(query('[data-slot="popover-trigger"]').getAttribute("aria-expanded")).toBe("true");
    expect(query('[data-slot="popover-content"]').getAttribute("data-side")).toBe("left");
    const outsideText = document.createTextNode("outside");
    document.body.appendChild(outsideText);
    escape();
    expect(open).toBe(false);
    ui.unmount();
  });
});

describe("tooltip", () => {
  test("provider renders nothing without children", () => {
    const ui = mountUi(() => <TooltipProvider delayDuration={0} />);
    expect(ui.root.textContent).toBe("");
    ui.unmount();
  });

  test("trigger shows on hover/focus, hides on leave/blur, and asChild merges handlers", async () => {
    const changes: boolean[] = [];
    const ui = mountUi(() => (
      <TooltipProvider>
        <TooltipRoot onOpenChange={(v) => changes.push(v)}>
          <TooltipTrigger class="tip-trigger">T</TooltipTrigger>
          <TooltipContent class="tip" side="bottom" sideOffset={4}>
            tip
          </TooltipContent>
        </TooltipRoot>
        <TooltipRoot>
          <TooltipTrigger asChild>
            <button type="button" data-slot="custom-tip">
              C
            </button>
          </TooltipTrigger>
          <TooltipContent>custom tip</TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
    ));
    const trigger = query('[data-slot="tooltip-trigger"]');
    trigger.dispatchEvent(new MouseEvent("mouseenter"));
    await flush();
    const content = query('[data-slot="tooltip-content"]');
    expect(content.getAttribute("role")).toBe("tooltip");
    expect(content.getAttribute("data-state")).toBe("open");
    expect(content.className).toBe("tip");
    trigger.dispatchEvent(new MouseEvent("mouseleave"));
    await wait(300);
    trigger.dispatchEvent(new Event("focus"));
    trigger.dispatchEvent(new Event("blur"));
    expect(changes).toEqual([true, false, true, false]);

    const custom = query('[data-slot="custom-tip"]');
    custom.dispatchEvent(new MouseEvent("mouseenter"));
    await flush();
    expect(document.body.textContent).toContain("custom tip");
    custom.dispatchEvent(new MouseEvent("mouseleave"));
    ui.unmount();
  });
});
