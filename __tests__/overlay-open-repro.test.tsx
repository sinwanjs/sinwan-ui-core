import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { signal } from "sinwan/reactivity";
import { DialogClose, DialogContent, DialogOverlay, DialogRoot, DialogTrigger } from "../src/overlay";
import { HoverContent, HoverRoot, HoverTrigger } from "./hover-fixture";
import { mountUi, query, setupDom, stubFixedRect, teardownDom, wait } from "./helpers";

beforeEach(() => {
  setupDom();
  stubFixedRect();
});
afterEach(() => teardownDom());

describe("overlay open sync", () => {
  test("controlled dialog getter open/close", async () => {
    const open = signal(false);
    const ui = mountUi(() => (
      <DialogRoot
        open={open.value}
        onOpenChange={(v) => {
          open.value = v;
        }}
      >
        <DialogTrigger>Open</DialogTrigger>
        <DialogOverlay />
        <DialogContent>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </DialogRoot>
    ));
    expect(ui.query('[data-slot="dialog-content"]')).toBeNull();
    open.value = true;
    await wait(80);
    expect(ui.query('[data-slot="dialog-content"]')).toBeTruthy();
    open.value = false;
    await wait(300);
    expect(ui.query('[data-slot="dialog-content"]')).toBeNull();
    ui.click('[data-slot="dialog-trigger"]');
    await wait(80);
    expect(open.value).toBe(true);
    expect(ui.query('[data-slot="dialog-content"]')).toBeTruthy();
    ui.click('[data-slot="dialog-close"]');
    await wait(300);
    expect(open.value).toBe(false);
    expect(ui.query('[data-slot="dialog-content"]')).toBeNull();
    ui.click('[data-slot="dialog-trigger"]');
    await wait(80);
    expect(open.value).toBe(true);
    ui.unmount();
  });

  test("hover layer stays open when moving toward content", async () => {
    const ui = mountUi(() => (
      <HoverRoot>
        <HoverTrigger>Hover</HoverTrigger>
        <HoverContent>card</HoverContent>
      </HoverRoot>
    ));
    const trigger = query('[data-slot="hover-card-trigger"]');
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await wait(150);
    expect(ui.query('[data-slot="popover-content"]')).toBeTruthy();
    trigger.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    await wait(10);
    const content = query('[data-slot="popover-content"]');
    content.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await wait(200);
    expect(ui.query('[data-slot="popover-content"]')).toBeTruthy();
    content.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    await wait(350);
    expect(ui.query('[data-slot="popover-content"]')).toBeNull();
    ui.unmount();
  });
});
