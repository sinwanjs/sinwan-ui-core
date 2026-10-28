import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "../src/overlay";
import { HoverContent, HoverRoot, HoverTrigger } from "./hover-fixture";
import { mountUi, query, setupDom, stubFixedRect, teardownDom, wait } from "./helpers";

beforeEach(() => {
  setupDom();
  stubFixedRect();
});
afterEach(() => teardownDom());

const pointerdown = (target: EventTarget) =>
  target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));

describe("close stays closed", () => {
  test("popover pointerdown on trigger, content or exempt layers while open is ignored", async () => {
    let open = false;
    const ui = mountUi(() => (
      <PopoverRoot
        onOpenChange={(v) => {
          open = v;
        }}
      >
        <PopoverTrigger>Pick</PopoverTrigger>
        <PopoverContent>
          <span data-slot="inner">A</span>
        </PopoverContent>
      </PopoverRoot>
    ));
    const trigger = query('[data-slot="popover-trigger"]');
    trigger.click();
    await wait();
    expect(open).toBe(true);
    pointerdown(trigger);
    expect(open).toBe(true);
    pointerdown(query('[data-slot="inner"]'));
    expect(open).toBe(true);
    ui.unmount();
  });

  test("hover layer unmount under cursor does not flap open then closed", async () => {
    let open = false;
    const ui = mountUi(() => (
      <HoverRoot
        onOpenChange={(v) => {
          open = v;
        }}
      >
        <HoverTrigger>Hover</HoverTrigger>
        <HoverContent>card</HoverContent>
      </HoverRoot>
    ));
    const trigger = query('[data-slot="hover-card-trigger"]');
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await wait(150);
    expect(open).toBe(true);
    trigger.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    await wait(250);
    expect(open).toBe(false);
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await wait(50);
    expect(open).toBe(false);
    ui.unmount();
  });

  test("hover layer stays closed after Escape while pointer remains on trigger", async () => {
    let open = false;
    const ui = mountUi(() => (
      <HoverRoot
        onOpenChange={(v) => {
          open = v;
        }}
      >
        <HoverTrigger>Hover</HoverTrigger>
        <HoverContent>card</HoverContent>
      </HoverRoot>
    ));
    const trigger = query('[data-slot="hover-card-trigger"]');
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await wait(150);
    expect(open).toBe(true);
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await wait();
    expect(open).toBe(false);
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await wait(150);
    expect(open).toBe(false);
    trigger.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await wait(150);
    expect(open).toBe(true);
    ui.unmount();
  });

  test("hover layer outside press while pointer is on trigger does not flap", async () => {
    let open = false;
    const ui = mountUi(() => (
      <HoverRoot
        onOpenChange={(v) => {
          open = v;
        }}
      >
        <HoverTrigger>Hover</HoverTrigger>
        <HoverContent>card</HoverContent>
      </HoverRoot>
    ));
    const trigger = query('[data-slot="hover-card-trigger"]');
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await wait(150);
    expect(open).toBe(true);
    pointerdown(document);
    await wait();
    expect(open).toBe(false);
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await wait(150);
    expect(open).toBe(false);
    ui.unmount();
  });
});
