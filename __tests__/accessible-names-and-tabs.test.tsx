import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cc, provide, type SinwanNode } from "sinwan/component";
import { Show } from "sinwan/control-flow";
import { signal } from "sinwan/reactivity";
import {
  RadioGroupItem,
  RadioGroupRoot,
  SwitchRoot,
  TabsContent,
  TabsKey,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from "../src/controls";
import { DirectionProvider } from "../src/direction";
import { DialogContent, DialogDescription, DialogRoot, DialogTitle } from "../src/overlay";
import { flush, mountUi, query, setupDom, teardownDom } from "./helpers";

beforeEach(() => setupDom());
afterEach(() => teardownDom());

const tabs = () => [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const tabState = () => tabs().map((tab) => `${tab.textContent}:${tab.getAttribute("aria-selected")}:${tab.tabIndex}`);
const press = (el: Element | null | undefined, key: string) => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  el?.dispatchEvent(event);
  return event;
};

describe("aria-* attributes reach the element", () => {
  test("switch, radio group and tab list forward aria-* and keep them live", async () => {
    const label = signal("Inventory: email");
    const { unmount } = mountUi(() => (
      <>
        <SwitchRoot aria-label={label.value} aria-describedby="email-help" />
        <RadioGroupRoot aria-label="Payment method">
          <RadioGroupItem value="bank">Bank</RadioGroupItem>
        </RadioGroupRoot>
        <TabsRoot defaultValue="monthly">
          <TabsList aria-label="Billing period">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </TabsRoot>
      </>
    ));
    const toggle = query('[role="switch"]');
    expect([toggle.getAttribute("aria-label"), toggle.getAttribute("aria-describedby"), toggle.getAttribute("aria-checked")]).toEqual(["Inventory: email", "email-help", "false"]);
    expect(query('[role="radiogroup"]').getAttribute("aria-label")).toBe("Payment method");
    expect(query('[role="tablist"]').getAttribute("aria-label")).toBe("Billing period");
    label.value = "Inventory: push";
    await flush();
    expect(toggle.getAttribute("aria-label")).toBe("Inventory: push");
    unmount();
  });

  test("a forwarded aria-* never replaces the state the primitive owns", () => {
    const { unmount } = mountUi(() => <SwitchRoot checked aria-checked="false" />);
    expect(query('[role="switch"]').getAttribute("aria-checked")).toBe("true");
    unmount();
  });
});

describe("tabs (WAI-ARIA tabs pattern, automatic activation)", () => {
  test("tabs and panels are linked by id, and only the active tab is a tab stop", async () => {
    const { unmount } = mountUi(() => (
      <TabsRoot defaultValue="add ons">
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="add ons">Add-ons</TabsTrigger>
        </TabsList>
        <TabsContent value="usage">Usage panel</TabsContent>
        <TabsContent value="add ons">Add-ons panel</TabsContent>
      </TabsRoot>
    ));
    await flush();
    expect(tabState()).toEqual(["Usage:false:-1", "Add-ons:true:0"]);
    expect(query('[role="tablist"]').getAttribute("aria-orientation")).toBe("horizontal");
    const [usage, addOns] = tabs();
    const panel = query('[role="tabpanel"]');
    expect(addOns?.id).toMatch(/^sinwan-ui-tabs-\d+-trigger-add_ons$/);
    expect(addOns?.getAttribute("aria-controls")).toBe(panel.id);
    expect(usage?.getAttribute("aria-controls")).toBeNull();
    expect([panel.getAttribute("aria-labelledby"), panel.tabIndex, panel.textContent]).toEqual([addOns?.id ?? "", 0, "Add-ons panel"]);
    unmount();
  });

  test("arrows move focus and selection, wrap and skip disabled tabs; Home and End jump", async () => {
    const changes: string[] = [];
    const { unmount } = mountUi(() => (
      <TabsRoot onValueChange={(value) => changes.push(value)}>
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b" disabled>
            B
          </TabsTrigger>
          <TabsTrigger value="c">C</TabsTrigger>
          <TabsTrigger value="d">D</TabsTrigger>
        </TabsList>
      </TabsRoot>
    ));
    await flush();
    // Nothing selected yet: the first enabled tab is the tab stop.
    expect(tabState()).toEqual(["A:false:0", "B:false:-1", "C:false:-1", "D:false:-1"]);

    const event = press(tabs()[0], "ArrowRight");
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(tabState()).toEqual(["A:false:-1", "B:false:-1", "C:true:0", "D:false:-1"]);
    expect(document.activeElement?.textContent).toBe("C");

    press(tabs()[2], "End");
    await flush();
    expect(document.activeElement?.textContent).toBe("D");
    press(tabs()[3], "ArrowRight");
    await flush();
    expect(document.activeElement?.textContent).toBe("A");
    press(tabs()[0], "ArrowLeft");
    await flush();
    expect(document.activeElement?.textContent).toBe("D");
    press(tabs()[3], "Home");
    await flush();
    expect(changes).toEqual(["c", "d", "a", "d", "a"]);

    const other = press(tabs()[0], "ArrowDown");
    expect(other.defaultPrevented).toBe(false);
    expect(changes).toHaveLength(5);
    unmount();
  });

  test("vertical tabs use Up and Down; left and right swap in RTL", async () => {
    const vertical = mountUi(() => (
      <TabsRoot defaultValue="a" orientation="vertical">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </TabsRoot>
    ));
    expect(query('[role="tablist"]').getAttribute("aria-orientation")).toBe("vertical");
    expect(press(tabs()[0], "ArrowRight").defaultPrevented).toBe(false);
    press(tabs()[0], "ArrowDown");
    await flush();
    expect(document.activeElement?.textContent).toBe("B");
    press(tabs()[1], "ArrowUp");
    await flush();
    expect(document.activeElement?.textContent).toBe("A");
    vertical.unmount();

    const rtl = mountUi(() => (
      <DirectionProvider dir="rtl">
        <TabsRoot defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
          </TabsList>
        </TabsRoot>
      </DirectionProvider>
    ));
    press(tabs()[0], "ArrowLeft");
    await flush();
    expect(document.activeElement?.textContent).toBe("B");
    press(tabs()[1], "ArrowRight");
    await flush();
    expect(document.activeElement?.textContent).toBe("A");
    rtl.unmount();
  });

  test("a removed tab leaves the keyboard order", async () => {
    const shown = signal(true);
    const { unmount } = mountUi(() => (
      <TabsRoot defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <Show when={shown.value}>
            <TabsTrigger value="b">B</TabsTrigger>
          </Show>
          <TabsTrigger value="c">C</TabsTrigger>
        </TabsList>
      </TabsRoot>
    ));
    await flush();
    shown.value = false;
    await flush();
    press(tabs()[0], "ArrowRight");
    await flush();
    expect(document.activeElement?.textContent).toBe("C");
    unmount();
  });

  test("a tab list outside a root, and tabs under a hand-made context, still render", () => {
    const Provider = cc((props: { children?: SinwanNode }) => {
      const value = signal("a");
      provide(TabsKey, { value, setValue: (next: string) => (value.value = next) });
      return <>{props.children}</>;
    });
    const { unmount } = mountUi(() => (
      <>
        <TabsList aria-label="Alone" />
        <Provider>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsContent value="a">Panel</TabsContent>
        </Provider>
      </>
    ));
    expect(query('[aria-label="Alone"]').getAttribute("aria-orientation")).toBe("horizontal");
    const tab = query('[role="tab"]');
    expect([tab.getAttribute("tabindex"), tab.id, query('[role="tabpanel"]').id]).toEqual([null, "", ""]);
    expect(press(tab, "ArrowRight").defaultPrevented).toBe(false);
    unmount();
  });
});

describe("dialogs are named by their title", () => {
  test("content is labelled by its title and described by its description", async () => {
    const { unmount } = mountUi(() => (
      <DialogRoot defaultOpen>
        <DialogContent>
          <DialogTitle class="title">Notification settings</DialogTitle>
          <DialogDescription>Choose where each kind reaches you.</DialogDescription>
        </DialogContent>
      </DialogRoot>
    ));
    await flush();
    const content = query('[data-slot="dialog-content"]');
    const title = query('[data-slot="dialog-title"]');
    const description = query('[data-slot="dialog-description"]');
    expect([content.getAttribute("role"), content.getAttribute("aria-modal")]).toEqual(["dialog", "true"]);
    expect(title.id).toMatch(/^sinwan-ui-dialog-\d+-title$/);
    expect([title.tagName, title.className, description.tagName]).toEqual(["H2", "title", "P"]);
    expect(content.getAttribute("aria-labelledby")).toBe(title.id);
    expect(content.getAttribute("aria-describedby")).toBe(description.id);
    unmount();
  });

  test("an alert dialog has its role; ids and labels given by the app win", async () => {
    const { unmount } = mountUi(() => (
      <DialogRoot defaultOpen>
        <DialogContent role="alertdialog" data-slot="alert-dialog-content" aria-describedby="custom-help">
          <DialogTitle id="limit-title" data-slot="alert-dialog-title">
            You've reached a plan limit
          </DialogTitle>
          <DialogDescription data-slot="alert-dialog-description">5 of 5 branches used.</DialogDescription>
        </DialogContent>
      </DialogRoot>
    ));
    await flush();
    const content = query('[data-slot="alert-dialog-content"]');
    expect(content.getAttribute("role")).toBe("alertdialog");
    expect(content.getAttribute("aria-labelledby")).toBe("limit-title");
    expect(query('[data-slot="alert-dialog-title"]').id).toBe("limit-title");
    expect(content.getAttribute("aria-describedby")).toBe("custom-help");
    unmount();
  });

  test("a title that goes away stops naming the dialog; one outside a dialog has no id", async () => {
    const shown = signal(true);
    const { unmount } = mountUi(() => (
      <>
        <DialogRoot defaultOpen>
          <DialogContent>
            <Show when={shown.value}>
              <DialogTitle>Title</DialogTitle>
            </Show>
          </DialogContent>
        </DialogRoot>
        <DialogTitle data-slot="loose-title">Loose</DialogTitle>
      </>
    ));
    await flush();
    const content = query('[data-slot="dialog-content"]');
    expect(content.getAttribute("aria-labelledby")).not.toBeNull();
    shown.value = false;
    await flush();
    expect(content.getAttribute("aria-labelledby")).toBeNull();
    expect(query('[data-slot="loose-title"]').hasAttribute("id")).toBe(false);
    unmount();
  });
});
