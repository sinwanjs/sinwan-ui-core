import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

/** `sinwan/dev` is a no-op in the production bundle the tests load; record the calls instead. */
const warnings: Array<[string, string]> = [];
mock.module("sinwan/dev", () => ({
  devWarn: (code: string, message: string) => warnings.push([code, message]),
  isDev: () => true,
}));

const { cc } = await import("sinwan/component");
const { isControlledProp } = await import("../src/internal/controlled");
const { useControllableState } = await import("../src/core");
const { AccordionRoot, CheckboxRoot, RadioGroupRoot, SwitchRoot, TabsRoot, ToggleGroupRoot } =
  await import("../src/controls");
const { CollapsibleRoot, DialogRoot, PopoverRoot, TooltipRoot } = await import("../src/overlay");
const { flush, mountUi, setupDom, teardownDom } = await import("./helpers");

beforeEach(() => {
  setupDom();
  warnings.length = 0;
});
afterEach(() => teardownDom());

const missing: string | undefined = undefined;
const missingFlag: boolean | undefined = undefined;

describe("isControlledProp", () => {
  test("is controlled when the prop is present", () => {
    expect(isControlledProp({}, "value", "Box")).toBe(false);
    expect(isControlledProp({ value: "a" }, "value", "Box")).toBe(true);
    expect(isControlledProp({ value: () => "a" }, "value", "Box")).toBe(true);
    expect(isControlledProp({ value: null }, "value", "Box")).toBe(true);
    expect(warnings).toEqual([]);
  });

  test("warns (SW202) when a present prop is undefined", () => {
    expect(isControlledProp({ value: undefined }, "value", "Box")).toBe(true);
    expect(isControlledProp({ open: () => undefined }, "open", "Box")).toBe(true);
    expect(warnings).toEqual([
      [
        "SW202",
        '<Box> value is undefined: the control is controlled with no value and ignores input. Omit value, or pass null or "" for an empty controlled value.',
      ],
      [
        "SW202",
        '<Box> open is undefined: the control is controlled with no value and ignores input. Omit open, or pass null or "" for an empty controlled value.',
      ],
    ]);
  });
});

describe("controls report an undefined controlled prop", () => {
  test("every control names itself and the prop", async () => {
    const { unmount } = mountUi(() => (
      <>
        <TabsRoot value={missing} />
        <AccordionRoot value={missing} />
        <CheckboxRoot checked={missingFlag} />
        <SwitchRoot checked={missingFlag} />
        <RadioGroupRoot value={missing} />
        <ToggleGroupRoot value={missing} />
        <CollapsibleRoot open={missingFlag} />
        <DialogRoot open={missingFlag} />
        <PopoverRoot open={missingFlag} />
        <TooltipRoot open={missingFlag} />
      </>
    ));
    await flush();
    expect(warnings.map(([, message]) => message.slice(0, message.indexOf(" is undefined")))).toEqual([
      "<TabsRoot> value",
      "<AccordionRoot> value",
      "<CheckboxRoot> checked",
      "<SwitchRoot> checked",
      "<RadioGroupRoot> value",
      "<ToggleGroupRoot> value",
      "<CollapsibleRoot> open",
      "<DialogRoot> open",
      "<PopoverRoot> open",
      "<TooltipRoot> open",
    ]);
    unmount();
  });

  test("stays quiet for defined or omitted props", async () => {
    const { unmount } = mountUi(() => (
      <>
        <TabsRoot value="a" />
        <SwitchRoot checked={false} />
        <DialogRoot />
      </>
    ));
    await flush();
    expect(warnings).toEqual([]);
    unmount();
  });
});

describe("useControllableState", () => {
  test("an uncontrolled state updates itself and reports the change", async () => {
    const changes: number[] = [];
    let api: ReturnType<typeof useControllableState<number>> | undefined;
    const Probe = cc(() => {
      api = useControllableState<number>({ defaultValue: 1, onChange: (next) => changes.push(next) });
      return null;
    });
    const { unmount } = mountUi(() => <Probe />);
    const [state, setState] = api!;
    setState((previous) => previous + 1);
    setState(5);
    expect(state.value).toBe(5);
    expect(changes).toEqual([2, 5]);
    expect(warnings).toEqual([]);
    unmount();
  });

  test("a controlled undefined value warns", () => {
    const Probe = cc(() => {
      useControllableState<number | undefined>({ value: undefined, defaultValue: 0 });
      return null;
    });
    const { unmount } = mountUi(() => <Probe />);
    expect(warnings[0]?.[1]).toStartWith("<useControllableState> value is undefined");
    unmount();
  });
});
