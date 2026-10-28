import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { isDismissExemptPointerTarget } from "../src/dismiss";
import { setupDom, teardownDom } from "./helpers";

beforeEach(() => setupDom());
afterEach(() => teardownDom());

describe("isDismissExemptPointerTarget", () => {
  test("returns false for null and nodes without an element parent", () => {
    expect(isDismissExemptPointerTarget(null)).toBe(false);
    expect(isDismissExemptPointerTarget(document)).toBe(false);
    expect(isDismissExemptPointerTarget(new EventTarget())).toBe(false);
  });

  test("matches floating content, native select, and text inside them", () => {
    const layer = document.createElement("div");
    layer.setAttribute("data-slot", "select-content");
    const text = document.createTextNode("Apple");
    layer.appendChild(text);
    document.body.appendChild(layer);
    expect(isDismissExemptPointerTarget(layer)).toBe(true);
    expect(isDismissExemptPointerTarget(text)).toBe(true);

    const overlay = document.createElement("div");
    overlay.setAttribute("data-slot", "dialog-overlay");
    document.body.appendChild(overlay);
    expect(isDismissExemptPointerTarget(overlay)).toBe(true);

    const menu = document.createElement("div");
    menu.setAttribute("data-slot", "dropdown-menu-content");
    document.body.appendChild(menu);
    expect(isDismissExemptPointerTarget(menu)).toBe(true);

    const menubar = document.createElement("div");
    menubar.setAttribute("data-slot", "menubar-content");
    const menubarItem = document.createElement("button");
    menubar.appendChild(menubarItem);
    document.body.appendChild(menubar);
    expect(isDismissExemptPointerTarget(menubar)).toBe(true);
    expect(isDismissExemptPointerTarget(menubarItem)).toBe(true);

    const select = document.createElement("select");
    const option = document.createElement("option");
    select.appendChild(option);
    document.body.appendChild(select);
    expect(isDismissExemptPointerTarget(option)).toBe(true);

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    expect(isDismissExemptPointerTarget(outside)).toBe(false);

    const layout = document.createElement("div");
    layout.setAttribute("data-slot", "card-content");
    document.body.appendChild(layout);
    expect(isDismissExemptPointerTarget(layout)).toBe(false);
  });
});
