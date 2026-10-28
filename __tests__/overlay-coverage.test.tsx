import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { signal } from "sinwan/reactivity";
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "../src/overlay";
import { mountUi, setupDom, teardownDom } from "./helpers";

beforeEach(() => setupDom());
afterEach(() => teardownDom());

describe("overlay primitives — controlled collapsible", () => {
  test("follows the open prop and reports trigger toggles without local state", async () => {
    const open = signal(false);
    const changes: boolean[] = [];
    const view = mountUi(() => (
      <CollapsibleRoot
        open={open.value}
        onOpenChange={(next) => {
          changes.push(next);
        }}
      >
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>
          <p>Body</p>
        </CollapsibleContent>
      </CollapsibleRoot>
    ));
    const root = view.query('[data-slot="collapsible"]');
    expect(root?.getAttribute("data-state")).toBe("closed");
    expect(view.query('[data-slot="collapsible-content"]')).toBeNull();

    view.click('[data-slot="collapsible-trigger"]');
    await Promise.resolve();
    expect(changes).toEqual([true]);
    expect(root?.getAttribute("data-state")).toBe("closed");

    open.value = true;
    await Promise.resolve();
    expect(root?.getAttribute("data-state")).toBe("open");
    expect(view.query('[data-slot="collapsible-content"]')?.textContent).toBe("Body");

    view.click('[data-slot="collapsible-trigger"]');
    await Promise.resolve();
    expect(changes).toEqual([true, false]);
    expect(root?.getAttribute("data-state")).toBe("open");
    view.unmount();
  });
});
