import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { signal } from "sinwan/reactivity";
import {
  AccordionContent,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
  CheckboxRoot,
  RadioGroupItem,
  RadioGroupRoot,
  SwitchRoot,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
  ToggleGroupItem,
  ToggleGroupRoot,
  ToggleRoot,
} from "../src/controls";
import { Presence } from "../src/core";
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  DialogClose,
  DialogContent,
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
import { flush, mountUi, query, setupDom, stubRects, teardownDom, wait, withSetup } from "./helpers";

beforeEach(() => setupDom());
afterEach(() => teardownDom());

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe("primitives overlays", () => {
  test("dialog tree renders", () => {
    const { root, click, unmount } = mountUi(() => (
      <DialogRoot defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogClose>X</DialogClose>
          Body
        </DialogContent>
      </DialogRoot>
    ));
    expect(root.querySelector('[data-slot="dialog-trigger"]')).toBeTruthy();
    click('[data-slot="dialog-close"]');
    unmount();
  });

  test("collapsible content stays mounted closed then unmounts", async () => {
    const { root, click, unmount } = mountUi(() => (
      <CollapsibleRoot defaultOpen>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>
          <p>Hidden</p>
        </CollapsibleContent>
      </CollapsibleRoot>
    ));
    const content = query('[data-slot="collapsible-content"]');
    await nextFrame();
    expect(root.querySelector('[data-slot="collapsible-trigger"]')).toBeTruthy();
    expect(content.getAttribute("data-state")).toBe("open");
    expect(content.style.getPropertyValue("--radix-collapsible-content-height")).toMatch(/px$/);
    click('[data-slot="collapsible-trigger"]');
    await flush();
    expect(document.querySelector('[data-slot="collapsible-content"]')).toBe(content);
    expect(content.getAttribute("data-state")).toBe("closed");
    await wait(250);
    expect(document.querySelector('[data-slot="collapsible-content"]')).toBeNull();
    click('[data-slot="collapsible-trigger"]');
    await wait(10);
    expect(query('[data-slot="collapsible-content"]').getAttribute("data-state")).toBe("open");
    unmount();
  });

  test("collapsible content measures height without an inner element", async () => {
    const { click, unmount } = mountUi(() => (
      <CollapsibleRoot defaultOpen>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden</CollapsibleContent>
      </CollapsibleRoot>
    ));
    const content = query('[data-slot="collapsible-content"]');
    await nextFrame();
    expect(content.style.getPropertyValue("--radix-collapsible-content-height")).toMatch(/px$/);
    click('[data-slot="collapsible-trigger"]');
    unmount();
  });

  test("popover and tooltip roots", () => {
    const { unmount } = mountUi(() => (
      <>
        <PopoverRoot>
          <PopoverTrigger>P</PopoverTrigger>
          <PopoverContent>C</PopoverContent>
        </PopoverRoot>
        <TooltipProvider>
          <TooltipRoot>
            <TooltipTrigger>T</TooltipTrigger>
            <TooltipContent>tip</TooltipContent>
          </TooltipRoot>
        </TooltipProvider>
      </>
    ));
    unmount();
  });

  test("popover positions beside trigger when opened", async () => {
    stubRects((el) => {
      const slot = el.getAttribute("data-slot");
      if (slot === "popover-trigger") return new DOMRect(200, 150, 80, 32);
      return slot === "popover-content" ? new DOMRect(0, 0, 120, 80) : null;
    });
    const { click, unmount } = mountUi(() => (
      <PopoverRoot>
        <PopoverTrigger>P</PopoverTrigger>
        <PopoverContent>C</PopoverContent>
      </PopoverRoot>
    ));
    click('[data-slot="popover-trigger"]');
    await flush();
    const content = query('[data-slot="popover-content"]');
    expect(content.style.top).toBe("190px");
    expect(content.style.left).toBe("180px");
    expect(content.getAttribute("data-side")).toBe("bottom");
    await nextFrame();
    expect(content.style.top).not.toBe("0px");
    unmount();
  });

  test("popover content forwards hover keep-alive handlers", async () => {
    let entered = 0;
    let left = 0;
    const { click, unmount } = mountUi(() => (
      <PopoverRoot defaultOpen>
        <PopoverTrigger>P</PopoverTrigger>
        <PopoverContent
          onmouseenter={() => {
            entered += 1;
          }}
          onmouseleave={() => {
            left += 1;
          }}
        >
          C
        </PopoverContent>
      </PopoverRoot>
    ));
    await wait();
    const content = query('[data-slot="popover-content"]');
    content.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    content.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(entered).toBe(1);
    expect(left).toBe(1);
    click('[data-slot="popover-trigger"]');
    unmount();
  });
});

describe("primitives controls", () => {
  test("tabs accordion checkbox switch radio toggle", () => {
    let tab = "a";
    let checked = false;
    let pressed = false;
    const { click, unmount } = mountUi(() => (
      <>
        <TabsRoot
          defaultValue="a"
          onValueChange={(v) => {
            tab = v;
          }}
        >
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
          </TabsList>
          <TabsContent value="a">A panel</TabsContent>
        </TabsRoot>
        <AccordionRoot defaultValue="1">
          <AccordionItem value="1">
            <AccordionTrigger>Item</AccordionTrigger>
            <AccordionContent>Body</AccordionContent>
          </AccordionItem>
        </AccordionRoot>
        <CheckboxRoot
          defaultChecked={false}
          onCheckedChange={(v) => {
            checked = v;
          }}
        >
          ✓
        </CheckboxRoot>
        <SwitchRoot defaultChecked={false} />
        <RadioGroupRoot defaultValue="x">
          <RadioGroupItem value="x">X</RadioGroupItem>
          <RadioGroupItem value="y">Y</RadioGroupItem>
        </RadioGroupRoot>
        <ToggleRoot
          defaultPressed={false}
          onPressedChange={(v) => {
            pressed = v;
          }}
        >
          Bold
        </ToggleRoot>
        <ToggleGroupRoot type="multiple" defaultValue={["a"]}>
          <ToggleGroupItem value="a">A</ToggleGroupItem>
        </ToggleGroupRoot>
        {Presence({ present: true, children: "yes" })}
        {Presence({ present: false, children: "no" })}
      </>
    ));
    click('[data-slot="tabs-trigger"][data-state="inactive"]');
    expect(tab).toBe("b");
    click('[data-slot="checkbox"]');
    expect(checked).toBe(true);
    click('[data-slot="toggle"]');
    expect(pressed).toBe(true);
    click('[data-slot="switch"]');
    click('[data-slot="radio-group-item"][data-state="unchecked"]');
    unmount();
  });

  test("toggle group root forwards aria-* attributes and keeps them live", async () => {
    const label = signal("Billing period");
    const { unmount } = mountUi(() => (
      <ToggleGroupRoot
        type="single"
        defaultValue="monthly"
        aria-label={label.value}
        aria-describedby="billing-help"
      >
        <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
      </ToggleGroupRoot>
    ));
    const group = query('[data-slot="toggle-group"]');
    expect(group?.getAttribute("role")).toBe("group");
    expect(group?.getAttribute("aria-label")).toBe("Billing period");
    expect(group?.getAttribute("aria-describedby")).toBe("billing-help");
    label.value = "Payment frequency";
    await flush();
    expect(group?.getAttribute("aria-label")).toBe("Payment frequency");
    unmount();
  });

  test("accordion content stays mounted closed then unmounts", async () => {
    const { click, unmount } = mountUi(() => (
      <AccordionRoot type="single" collapsible defaultValue="1">
        <AccordionItem value="1">
          <AccordionTrigger>Item</AccordionTrigger>
          <AccordionContent>
            <p>Body</p>
          </AccordionContent>
        </AccordionItem>
      </AccordionRoot>
    ));
    const content = query('[data-slot="accordion-content"]');
    await nextFrame();
    expect(content.getAttribute("data-state")).toBe("open");
    expect(content.style.getPropertyValue("--radix-accordion-content-height")).toMatch(/px$/);
    click('[data-slot="accordion-trigger"]');
    await flush();
    expect(document.querySelector('[data-slot="accordion-content"]')).toBe(content);
    expect(content.getAttribute("data-state")).toBe("closed");
    await wait(250);
    expect(document.querySelector('[data-slot="accordion-content"]')).toBeNull();
    click('[data-slot="accordion-trigger"]');
    await wait(10);
    expect(query('[data-slot="accordion-content"]').getAttribute("data-state")).toBe("open");
    unmount();
  });

  test("accordion content measures height without an inner element", async () => {
    const { unmount } = mountUi(() => (
      <AccordionRoot defaultValue="1">
        <AccordionItem value="1">
          <AccordionTrigger>Item</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </AccordionRoot>
    ));
    await nextFrame();
    expect(
      query('[data-slot="accordion-content"]').style.getPropertyValue("--radix-accordion-content-height"),
    ).toMatch(/px$/);
    unmount();
  });

  test("multiple accordion, vertical tabs and disabled items", () => {
    const values: Array<string | string[]> = [];
    const { root, click, unmount } = mountUi(() => (
      <>
        <AccordionRoot
          type="multiple"
          defaultValue={["1"]}
          onValueChange={(v) => {
            values.push(v);
          }}
        >
          <AccordionItem value="1">
            <AccordionTrigger>One</AccordionTrigger>
          </AccordionItem>
          <AccordionItem value="2">
            <AccordionTrigger>Two</AccordionTrigger>
          </AccordionItem>
        </AccordionRoot>
        <TabsRoot defaultValue="a" orientation="vertical">
          <TabsList data-variant="line">
            <TabsTrigger value="a" disabled>
              A
            </TabsTrigger>
          </TabsList>
        </TabsRoot>
        <RadioGroupRoot defaultValue="y" name="plan">
          <RadioGroupItem value="x" disabled>
            X
          </RadioGroupItem>
        </RadioGroupRoot>
        <SwitchRoot disabled />
        <ToggleRoot disabled />
        <ToggleGroupRoot
          type="multiple"
          defaultValue={["b"]}
          onValueChange={(v) => {
            values.push(v);
          }}
        >
          <ToggleGroupItem value="a">A</ToggleGroupItem>
          <ToggleGroupItem value="b">B</ToggleGroupItem>
        </ToggleGroupRoot>
      </>
    ));
    const groupItems = root.querySelectorAll('[data-slot="toggle-group-item"]');
    groupItems[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    groupItems[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(values.splice(0)).toEqual([["b", "a"], ["a"]]);
    const triggers = root.querySelectorAll('[data-slot="accordion-trigger"]');
    triggers[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    triggers[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(values).toEqual([[], ["2"]]);
    expect(query('[data-slot="tabs"]').getAttribute("data-orientation")).toBe("vertical");
    expect(query('[data-slot="tabs"]').hasAttribute("data-vertical")).toBe(true);
    click('[data-slot="tabs-trigger"]');
    click('[data-slot="radio-group-item"]');
    expect(query('[data-slot="radio-group-item"]').getAttribute("data-state")).toBe("unchecked");
    click('[data-slot="switch"]');
    click('[data-slot="toggle"]');
    expect(query('[data-slot="switch"]').getAttribute("data-state")).toBe("unchecked");
    expect(query('[data-slot="toggle"]').getAttribute("data-state")).toBe("off");
    unmount();
  });
});

describe("primitives presence via withSetup", () => {
  test("Presence branches", () => {
    withSetup(() => {
      expect(Presence({ present: true, children: "yes" })).toBeTruthy();
      expect(Presence({ present: false, children: "no" })).toBeTruthy();
    });
  });

  test("Presence keeps children mounted while exiting then unmounts", async () => {
    const open = signal(true);
    const { root, unmount } = mountUi(() => (
      <Presence present={open.value} exitMs={40}>
        <div data-slot="presence-child" data-state={open.value ? "open" : "closed"} />
      </Presence>
    ));
    const child = query('[data-slot="presence-child"]');
    expect(child.getAttribute("data-state")).toBe("open");
    open.value = false;
    await flush();
    expect(root.querySelector('[data-slot="presence-child"]')).toBe(child);
    expect(child.getAttribute("data-state")).toBe("closed");
    open.value = true;
    await flush();
    expect(child.getAttribute("data-state")).toBe("open");
    open.value = false;
    await wait(80);
    expect(root.querySelector('[data-slot="presence-child"]')).toBeNull();
    unmount();
  });

  test("Presence unmounts immediately when exitMs is 0", async () => {
    const open = signal(true);
    const { root, unmount } = mountUi(() => (
      <Presence present={open.value} exitMs={0}>
        <div data-slot="presence-zero" />
      </Presence>
    ));
    expect(root.querySelector('[data-slot="presence-zero"]')).toBeTruthy();
    open.value = false;
    await flush();
    expect(root.querySelector('[data-slot="presence-zero"]')).toBeNull();
    unmount();

    const lingering = signal(true);
    const pending = mountUi(() => (
      <Presence present={lingering.value}>
        <div data-slot="presence-pending" />
      </Presence>
    ));
    lingering.value = false;
    await Promise.resolve();
    pending.unmount();
  });
});

describe("primitive controlled getter props", () => {
  test("checkbox toggle and toggle-group stay live via getters", async () => {
    const checked = signal(false);
    const pressed = signal(false);
    const group = signal<string | string[]>("");
    const { root, unmount } = mountUi(() => (
      <>
        <CheckboxRoot checked={checked.value} />
        <CheckboxRoot checked={true} />
        <ToggleRoot pressed={pressed.value} />
        <ToggleRoot pressed={true} />
        <ToggleGroupRoot value={group.value}>
          <ToggleGroupItem value="a">A</ToggleGroupItem>
          <ToggleGroupItem value="b">B</ToggleGroupItem>
        </ToggleGroupRoot>
        <ToggleGroupRoot type="multiple" value={["a"]}>
          <ToggleGroupItem value="a">A</ToggleGroupItem>
        </ToggleGroupRoot>
        <ToggleGroupRoot />
      </>
    ));
    const settle = async () => {
      await Promise.resolve();
      await wait(0);
    };

    const checkboxes = root.querySelectorAll('[data-slot="checkbox"]');
    expect(checkboxes[0]?.getAttribute("data-state")).toBe("unchecked");
    expect(checkboxes[1]?.getAttribute("data-state")).toBe("checked");
    checked.value = true;
    await settle();
    expect(checkboxes[0]?.getAttribute("data-state")).toBe("checked");

    const toggles = root.querySelectorAll('[data-slot="toggle"]');
    expect(toggles[0]?.getAttribute("data-state")).toBe("off");
    expect(toggles[1]?.getAttribute("data-state")).toBe("on");
    pressed.value = true;
    await settle();
    expect(toggles[0]?.getAttribute("data-state")).toBe("on");

    const groups = root.querySelectorAll('[data-slot="toggle-group"]');
    const items = groups[0]!.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items[0]?.getAttribute("data-state")).toBe("off");
    group.value = "a";
    await settle();
    expect(items[0]?.getAttribute("data-state")).toBe("on");
    group.value = ["b"];
    await settle();
    expect(items[0]?.getAttribute("data-state")).toBe("off");
    expect(items[1]?.getAttribute("data-state")).toBe("on");
    group.value = ["a", "b"];
    await settle();
    expect(items[0]?.getAttribute("data-state")).toBe("on");
    expect(items[1]?.getAttribute("data-state")).toBe("on");
    expect(groups[1]?.querySelector('[data-slot="toggle-group-item"]')?.getAttribute("data-state")).toBe("on");
    unmount();
  });

  test("checkbox indeterminate is mixed and click selects", async () => {
    let nextValue = false;
    const mixed = signal(true);
    const { root, click, unmount } = mountUi(() => (
      <>
        <CheckboxRoot
          checked={false}
          indeterminate={mixed.value}
          onCheckedChange={(value) => {
            nextValue = value;
          }}
        />
        <CheckboxRoot checked={false} indeterminate={true} />
        <CheckboxRoot checked={false} indeterminate={false} disabled />
      </>
    ));
    const boxes = root.querySelectorAll('[data-slot="checkbox"]');
    expect(boxes[0]?.getAttribute("data-state")).toBe("indeterminate");
    expect(boxes[0]?.getAttribute("aria-checked")).toBe("mixed");
    expect(boxes[1]?.getAttribute("data-state")).toBe("indeterminate");
    click('[data-slot="checkbox"]');
    expect(nextValue).toBe(true);
    mixed.value = false;
    await Promise.resolve();
    await wait(0);
    boxes[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    unmount();
  });
});

describe("controlled control roots", () => {
  test("tabs switch radio accordion and single toggle-group stay live", async () => {
    const tab = signal("a");
    const plan = signal("x");
    const enabled = signal(false);
    const openItem = signal("1");
    const align = signal("a");
    const { click, root, unmount } = mountUi(() => (
      <>
        <TabsRoot
          value={tab.value}
          onValueChange={(v) => {
            tab.value = v;
          }}
        >
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsRoot>
        <SwitchRoot
          checked={enabled.value}
          onCheckedChange={(v) => {
            enabled.value = v;
          }}
        />
        <SwitchRoot checked={false} disabled />
        <RadioGroupRoot
          value={plan.value}
          onValueChange={(v) => {
            plan.value = v;
          }}
        >
          <RadioGroupItem value="x">X</RadioGroupItem>
          <RadioGroupItem value="y">Y</RadioGroupItem>
        </RadioGroupRoot>
        <AccordionRoot
          value={openItem.value}
          onValueChange={(v) => {
            if (typeof v === "string") openItem.value = v;
          }}
        >
          <AccordionItem value="1">
            <AccordionTrigger>One</AccordionTrigger>
          </AccordionItem>
        </AccordionRoot>
        <ToggleGroupRoot
          type="single"
          value={align.value}
          onValueChange={(v) => {
            if (typeof v === "string") align.value = v;
          }}
        >
          <ToggleGroupItem value="a">A</ToggleGroupItem>
          <ToggleGroupItem value="b">B</ToggleGroupItem>
          <ToggleGroupItem value="c" disabled>
            C
          </ToggleGroupItem>
        </ToggleGroupRoot>
        <ToggleGroupRoot value="" />
      </>
    ));
    click('[data-slot="tabs-trigger"][data-state="inactive"]');
    expect(tab.value).toBe("b");
    click('[data-slot="switch"]');
    expect(enabled.value).toBe(true);
    root.querySelectorAll('[data-slot="switch"]')[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    click('[data-slot="radio-group-item"][data-state="unchecked"]');
    expect(plan.value).toBe("y");
    click('[data-slot="accordion-trigger"]');
    expect(openItem.value).toBe("");
    click('[data-slot="toggle-group-item"][data-state="off"]');
    expect(align.value).toBe("b");
    await flush();
    click('[data-slot="toggle-group-item"][data-state="on"]');
    expect(align.value).toBe("");
    root
      .querySelector('[data-slot="toggle-group-item"][disabled]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    unmount();
  });
});
