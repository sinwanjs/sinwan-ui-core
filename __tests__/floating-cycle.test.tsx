import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogRoot,
  DialogTrigger,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "../src/overlay";
import { flush, mountUi, query, setupDom, stubFixedRect, teardownDom, wait } from "./helpers";

beforeEach(() => {
  setupDom();
  stubFixedRect();
});
afterEach(() => teardownDom());

const EXIT_CLASS = "duration-200 data-closed:!fill-mode-forwards";

function TestDialog(props: { onOpenChange: (open: boolean) => void }) {
  return (
    <DialogRoot onOpenChange={props.onOpenChange}>
      <DialogTrigger>Open</DialogTrigger>
      <DialogOverlay class={EXIT_CLASS} />
      <DialogContent class={EXIT_CLASS}>
        <DialogClose>Close</DialogClose>
      </DialogContent>
    </DialogRoot>
  );
}

describe("floating open/close cycles", () => {
  test("dialog close removes overlay and can reopen", async () => {
    let open = false;
    const ui = mountUi(() => (
      <TestDialog
        onOpenChange={(v) => {
          open = v;
        }}
      />
    ));
    for (let i = 0; i < 4; i++) {
      ui.click('[data-slot="dialog-trigger"]');
      await wait();
      expect(open).toBe(true);
      expect(ui.query('[data-slot="dialog-overlay"]')).toBeTruthy();
      ui.click('[data-slot="dialog-close"]');
      await wait(350);
      expect(open).toBe(false);
      expect(ui.query('[data-slot="dialog-overlay"]')).toBeNull();
      expect(ui.query('[data-slot="dialog-content"]')).toBeNull();
    }
    ui.unmount();
  });

  test("popover asChild open/close/open", async () => {
    let open = false;
    const ui = mountUi(() => (
      <PopoverRoot
        onOpenChange={(v) => {
          open = v;
        }}
      >
        <PopoverTrigger asChild>
          <button type="button">Open</button>
        </PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </PopoverRoot>
    ));
    for (let i = 0; i < 5; i++) {
      query("button").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await wait();
      expect(open).toBe(true);
      expect(ui.query('[data-slot="popover-content"]')).toBeTruthy();
      document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
      await wait(300);
      expect(open).toBe(false);
    }
    ui.unmount();
  });

  test("dialog overlay close does not reopen from trigger click-through", async () => {
    let open = false;
    const ui = mountUi(() => (
      <TestDialog
        onOpenChange={(v) => {
          open = v;
        }}
      />
    ));
    ui.click('[data-slot="dialog-trigger"]');
    await wait();
    expect(open).toBe(true);
    const overlay = query('[data-slot="dialog-overlay"]');
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
    expect(open).toBe(false);
    expect(ui.query('[data-slot="dialog-overlay"]')).toBe(overlay);
    expect(overlay.getAttribute("data-state")).toBe("closed");
    ui.click('[data-slot="dialog-trigger"]');
    await wait();
    expect(open).toBe(false);
    expect(overlay.getAttribute("data-state")).toBe("closed");
    await wait(300);
    expect(ui.query('[data-slot="dialog-overlay"]')).toBeNull();
    ui.click('[data-slot="dialog-trigger"]');
    await wait();
    expect(open).toBe(true);
    ui.unmount();
  });

  test("trigger click closes popover without reopen race", async () => {
    let open = false;
    let changes = 0;
    const ui = mountUi(() => (
      <PopoverRoot
        onOpenChange={(v) => {
          open = v;
          changes++;
        }}
      >
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </PopoverRoot>
    ));
    const trigger = query('[data-slot="popover-trigger"]');
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait();
    expect(open).toBe(true);
    const before = changes;
    trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait();
    expect(open).toBe(false);
    expect(changes).toBe(before + 1);
    ui.unmount();
  });

  test("dialog overlay and content keep the passed exit classes and closed state until unmount", async () => {
    let open = false;
    const ui = mountUi(() => (
      <TestDialog
        onOpenChange={(v) => {
          open = v;
        }}
      />
    ));
    ui.click('[data-slot="dialog-trigger"]');
    await wait();
    const overlay = query('[data-slot="dialog-overlay"]');
    const panel = query('[data-slot="dialog-content"]');
    expect(overlay.className).toBe(EXIT_CLASS);
    expect(panel.className).toBe(EXIT_CLASS);
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
    expect(open).toBe(false);
    expect(ui.query('[data-slot="dialog-overlay"]')).toBe(overlay);
    expect(ui.query('[data-slot="dialog-content"]')).toBe(panel);
    expect(overlay.getAttribute("data-state")).toBe("closed");
    expect(panel.getAttribute("data-state")).toBe("closed");
    expect(panel.className).toBe(EXIT_CLASS);
    await wait(250);
    expect(ui.query('[data-slot="dialog-overlay"]')).toBeNull();
    ui.unmount();
  });

  test("popover outside dismiss keeps content mounted with closed state until unmount", async () => {
    let open = false;
    const ui = mountUi(() => (
      <PopoverRoot
        onOpenChange={(v) => {
          open = v;
        }}
      >
        <PopoverTrigger>Menu</PopoverTrigger>
        <PopoverContent class={EXIT_CLASS}>Body</PopoverContent>
      </PopoverRoot>
    ));
    ui.click('[data-slot="popover-trigger"]');
    await wait();
    const panel = query('[data-slot="popover-content"]');
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    await flush();
    expect(open).toBe(false);
    expect(ui.query('[data-slot="popover-content"]')).toBe(panel);
    expect(panel.getAttribute("data-state")).toBe("closed");
    expect(panel.className).toBe(EXIT_CLASS);
    await wait(250);
    expect(ui.query('[data-slot="popover-content"]')).toBeNull();
    ui.unmount();
  });
});
