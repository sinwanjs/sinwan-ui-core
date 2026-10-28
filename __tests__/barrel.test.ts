import { describe, expect, test } from "bun:test";
import * as core from "../src";
import * as controls from "../src/controls";
import * as overlay from "../src/overlay";

describe("root barrel", () => {
  test("re-exports the public symbols of every module", () => {
    for (const name of [
      "Presence",
      "UiPortal",
      "useControllableState",
      "trapFocus",
      "useAnchorPosition",
      "usePointPosition",
      "computePosition",
      "isDismissExemptPointerTarget",
      "createMenuSubApi",
      "isInsideMenuSubContent",
      "MenuSubContentLayer",
      "Slot",
      "flattenChildren",
      "isSinwanElement",
      "ThemeProvider",
      "ThemeToggle",
      "useTheme",
      "ThemeKey",
      "DirectionProvider",
      "useDirection",
      "DirectionKey",
    ]) {
      expect(name in core).toBe(true);
    }
    for (const name of Object.keys(overlay)) expect(name in core).toBe(true);
    for (const name of Object.keys(controls)) expect(name in core).toBe(true);
  });

  test("shared re-exports resolve to one binding", () => {
    expect(core.Slot).toBe(controls.Slot);
    expect(core.Show).toBe(controls.Show);
  });
});
