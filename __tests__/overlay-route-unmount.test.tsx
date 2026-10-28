import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Key, Show } from "sinwan/control-flow";
import { signal } from "sinwan/reactivity";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "../src/overlay";
import { HoverContent, HoverRoot, HoverTrigger } from "./hover-fixture";
import { mountUi, setupDom, teardownDom, wait } from "./helpers";

beforeEach(() => setupDom());
afterEach(() => teardownDom());

const tick = () => Promise.resolve();
const contentCount = () => document.body.querySelectorAll('[data-slot="popover-content"]').length;

function OpenCard() {
  return (
    <PopoverRoot defaultOpen>
      <PopoverTrigger>@sinwan</PopoverTrigger>
      <PopoverContent>Sinwan UI</PopoverContent>
    </PopoverRoot>
  );
}

describe("open overlay removed with its page", () => {
  test("Show removes the portaled popover content", async () => {
    const page = signal(true);
    const view = mountUi(() => (
      <Show when={page.value}>
        <OpenCard />
      </Show>
    ));
    await tick();
    expect(contentCount()).toBe(1);
    page.value = false;
    await tick();
    expect(contentCount()).toBe(0);
    view.unmount();
  });

  test("Key route swap removes the portaled popover content", async () => {
    const route = signal("popover");
    const view = mountUi(() => (
      <Key when={route.value}>{(current) => (current === "popover" ? <OpenCard /> : <p>Progress</p>)}</Key>
    ));
    await tick();
    expect(contentCount()).toBe(1);
    route.value = "progress";
    await tick();
    expect(contentCount()).toBe(0);
    expect(document.body.textContent).toContain("Progress");
    view.unmount();
  });

  test("Key route swap removes a popover opened after mount", async () => {
    const route = signal("popover");
    const view = mountUi(() => (
      <Key when={route.value}>
        {(current) =>
          current === "popover" ? (
            <PopoverRoot>
              <PopoverTrigger>@sinwan</PopoverTrigger>
              <PopoverContent>Sinwan UI</PopoverContent>
            </PopoverRoot>
          ) : (
            <p>Progress</p>
          )
        }
      </Key>
    ));
    await tick();
    view.click('[data-slot="popover-trigger"]');
    await tick();
    expect(contentCount()).toBe(1);
    route.value = "progress";
    await tick();
    expect(contentCount()).toBe(0);
    view.unmount();
  });

  test("Key route swap removes an asChild hover layer opened by hover", async () => {
    const route = signal("hover");
    const view = mountUi(() => (
      <Key when={route.value}>
        {(current) =>
          current === "hover" ? (
            <section>
              <HoverRoot>
                <HoverTrigger asChild>
                  <button type="button">@sinwan</button>
                </HoverTrigger>
                <HoverContent>
                  <p>Sinwan UI</p>
                </HoverContent>
              </HoverRoot>
            </section>
          ) : (
            <p>Progress</p>
          )
        }
      </Key>
    ));
    await tick();
    view.query("button")?.dispatchEvent(new MouseEvent("mouseenter"));
    await wait(150);
    expect(contentCount()).toBe(1);
    route.value = "progress";
    await tick();
    expect(contentCount()).toBe(0);
    view.unmount();
  });
});
