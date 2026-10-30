import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { signal } from "sinwan/reactivity";
import { RadioGroupItem, RadioGroupRoot } from "../src/controls";
import { DirectionProvider } from "../src/direction";
import { flush, mountUi, setupDom, teardownDom } from "./helpers";

beforeEach(() => setupDom());
afterEach(() => teardownDom());

const radios = () => [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
const state = () => radios().map((r) => `${r.textContent}:${r.getAttribute("aria-checked")}:${r.tabIndex}`);
const press = (el: Element | null | undefined, key: string) => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  el?.dispatchEvent(event);
  return event;
};

describe("radio group keyboard (WAI-ARIA radio group pattern)", () => {
  test("only the checked radio is a tab stop", async () => {
    const { unmount } = mountUi(() => (
      <RadioGroupRoot defaultValue="b">
        <RadioGroupItem value="a">A</RadioGroupItem>
        <RadioGroupItem value="b">B</RadioGroupItem>
        <RadioGroupItem value="c">C</RadioGroupItem>
      </RadioGroupRoot>
    ));
    await flush();
    expect(state()).toEqual(["A:false:-1", "B:true:0", "C:false:-1"]);
    unmount();
  });

  test("with nothing checked, the first enabled radio is the tab stop", async () => {
    const { unmount } = mountUi(() => (
      <RadioGroupRoot>
        <RadioGroupItem value="a" disabled>A</RadioGroupItem>
        <RadioGroupItem value="b">B</RadioGroupItem>
        <RadioGroupItem value="c">C</RadioGroupItem>
      </RadioGroupRoot>
    ));
    await flush();
    expect(state()).toEqual(["A:false:-1", "B:false:0", "C:false:-1"]);
    unmount();
  });

  test("arrow keys move focus and selection, wrap, and skip disabled radios", async () => {
    const changes: string[] = [];
    const { unmount } = mountUi(() => (
      <RadioGroupRoot defaultValue="a" onValueChange={(v) => changes.push(v)}>
        <RadioGroupItem value="a">A</RadioGroupItem>
        <RadioGroupItem value="b" disabled>B</RadioGroupItem>
        <RadioGroupItem value="c">C</RadioGroupItem>
      </RadioGroupRoot>
    ));
    const event = press(radios()[0], "ArrowDown");
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(state()).toEqual(["A:false:-1", "B:false:-1", "C:true:0"]);
    expect(document.activeElement?.textContent).toBe("C");

    press(radios()[2], "ArrowRight");
    await flush();
    expect(state()[0]).toBe("A:true:0");
    expect(document.activeElement?.textContent).toBe("A");

    press(radios()[0], "ArrowUp");
    await flush();
    expect(state()[2]).toBe("C:true:0");

    press(radios()[2], "ArrowLeft");
    await flush();
    expect(state()[0]).toBe("A:true:0");
    expect(changes).toEqual(["c", "a", "c", "a"]);
    unmount();
  });

  test("other keys are left alone", () => {
    const { unmount } = mountUi(() => (
      <RadioGroupRoot defaultValue="a">
        <RadioGroupItem value="a">A</RadioGroupItem>
        <RadioGroupItem value="b">B</RadioGroupItem>
      </RadioGroupRoot>
    ));
    const event = press(radios()[0], "Tab");
    expect(event.defaultPrevented).toBe(false);
    expect(state()[0]).toBe("A:true:0");
    unmount();
  });

  test("controlled groups report the move and follow the value prop", async () => {
    const value = signal("a");
    const { unmount } = mountUi(() => (
      <RadioGroupRoot value={value.value} onValueChange={(v) => (value.value = v)}>
        <RadioGroupItem value="a">A</RadioGroupItem>
        <RadioGroupItem value="b">B</RadioGroupItem>
      </RadioGroupRoot>
    ));
    press(radios()[0], "ArrowDown");
    await flush();
    expect(value.value).toBe("b");
    expect(state()).toEqual(["A:false:-1", "B:true:0"]);
    unmount();
  });

  test("right-to-left swaps ArrowLeft and ArrowRight", async () => {
    const { unmount } = mountUi(() => (
      <DirectionProvider dir="rtl">
        <RadioGroupRoot defaultValue="a">
          <RadioGroupItem value="a">A</RadioGroupItem>
          <RadioGroupItem value="b">B</RadioGroupItem>
          <RadioGroupItem value="c">C</RadioGroupItem>
        </RadioGroupRoot>
      </DirectionProvider>
    ));
    press(radios()[0], "ArrowLeft");
    await flush();
    expect(state()[1]).toBe("B:true:0");
    press(radios()[1], "ArrowRight");
    await flush();
    expect(state()[0]).toBe("A:true:0");
    unmount();
  });

  test("a group whose radios are all disabled ignores arrows", () => {
    const { unmount } = mountUi(() => (
      <RadioGroupRoot>
        <RadioGroupItem value="a" disabled>A</RadioGroupItem>
      </RadioGroupRoot>
    ));
    const event = press(radios()[0], "ArrowDown");
    expect(event.defaultPrevented).toBe(true);
    expect(state()).toEqual(["A:false:-1"]);
    unmount();
  });

  test("an arrow from a radio outside the enabled list goes to the first or last", async () => {
    const { unmount } = mountUi(() => (
      <RadioGroupRoot>
        <RadioGroupItem value="a" disabled>A</RadioGroupItem>
        <RadioGroupItem value="b">B</RadioGroupItem>
        <RadioGroupItem value="c">C</RadioGroupItem>
      </RadioGroupRoot>
    ));
    press(radios()[0], "ArrowDown");
    await flush();
    expect(state()[1]).toBe("B:true:0");
    press(radios()[0], "ArrowUp");
    await flush();
    expect(state()[2]).toBe("C:true:0");
    unmount();
  });

  test("an unmounted radio leaves the group", async () => {
    const showB = signal(true);
    const { unmount } = mountUi(() => (
      <RadioGroupRoot defaultValue="a">
        <RadioGroupItem value="a">A</RadioGroupItem>
        {() => (showB.value ? <RadioGroupItem value="b">B</RadioGroupItem> : null)}
        <RadioGroupItem value="c">C</RadioGroupItem>
      </RadioGroupRoot>
    ));
    showB.value = false;
    await flush();
    press(radios()[0], "ArrowDown");
    await flush();
    expect(state()).toEqual(["A:false:-1", "C:true:0"]);
    unmount();
  });
});
