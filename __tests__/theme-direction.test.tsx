import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { inject } from "sinwan/component";
import { signal } from "sinwan/reactivity";
import { DirectionKey, DirectionProvider, useDirection, type Direction, type DirectionApi } from "../src/direction";
import { ThemeProvider, ThemeToggle, useTheme, type Palette, type ThemeApi } from "../src/theme";
import {
  matchMediaListenerCount,
  mountUi,
  query,
  setMatchMediaPrefersDark,
  setupDom,
  teardownDom,
  triggerMatchMediaChange,
  wait,
  withSetup,
} from "./helpers";

beforeEach(() => {
  setupDom();
  document.documentElement.className = "";
  localStorage.clear();
});
afterEach(() => teardownDom());

function captureTheme(): { api: () => ThemeApi; Capture: () => null } {
  let api: ThemeApi | undefined;
  return {
    api: () => {
      if (!api) throw new Error("ThemeApi not captured");
      return api;
    },
    Capture: () => {
      api = useTheme();
      return null;
    },
  };
}

const html = () => document.documentElement;
const transitionLocked = () =>
  [...document.head.querySelectorAll("style")].some((style) => (style.textContent ?? "").includes("transition:none"));

describe("ThemeProvider", () => {
  test("provides theme api and applies the resolved class", () => {
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="dark">
        <Capture />
      </ThemeProvider>
    ));
    expect(html().classList.contains("dark")).toBe(true);
    expect(api().themes).toEqual(["light", "dark", "system"]);
    api().setTheme("light");
    expect(api().theme.value).toBe("light");
    expect(api().resolved.value).toBe("light");
    expect(html().classList.contains("light")).toBe(true);
    expect(html().style.colorScheme).toBe("light");
    expect(localStorage.getItem("sinwan-ui-theme")).toBe("light");
    unmount();
  });

  test("locks transitions while switching and releases them on the next frame", async () => {
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    await wait(20);
    api().setTheme("dark");
    expect(transitionLocked()).toBe(true);
    await wait(40);
    expect(transitionLocked()).toBe(false);
    unmount();
  });

  test("keeps CSS transitions when disableTransitionOnChange is false", () => {
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light" disableTransitionOnChange={false} attribute="data-theme">
        <Capture />
      </ThemeProvider>
    ));
    api().setTheme("dark");
    expect(transitionLocked()).toBe(false);
    expect(html().getAttribute("data-theme")).toBe("dark");
    unmount();
  });

  test("system theme follows prefers-color-scheme changes until unmount", () => {
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider>
        <Capture />
      </ThemeProvider>
    ));
    expect(api().resolved.value).toBe("dark");
    setMatchMediaPrefersDark(false);
    triggerMatchMediaChange();
    expect(api().resolved.value).toBe("light");
    api().setTheme("dark");
    setMatchMediaPrefersDark(true);
    triggerMatchMediaChange();
    expect(api().theme.value).toBe("dark");
    expect(matchMediaListenerCount()).toBe(1);
    unmount();
    expect(matchMediaListenerCount()).toBe(0);
  });

  test("restores a stored theme and ignores invalid stored values", () => {
    localStorage.setItem("custom-theme", "dark");
    const { api, Capture } = captureTheme();
    const stored = mountUi(() => (
      <ThemeProvider defaultTheme="light" storageKey="custom-theme">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().theme.value).toBe("dark");
    stored.unmount();

    localStorage.setItem("custom-theme", "sepia");
    const invalid = mountUi(() => (
      <ThemeProvider defaultTheme="light" storageKey="custom-theme">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().theme.value).toBe("light");
    invalid.unmount();
  });

  test("forced themes win over setTheme and the system preference", () => {
    const { api, Capture } = captureTheme();
    const light = mountUi(() => (
      <ThemeProvider forcedTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    api().setTheme("dark");
    expect(api().resolved.value).toBe("light");
    light.unmount();

    const system = mountUi(() => (
      <ThemeProvider forcedTheme="system">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().resolved.value).toBe("dark");
    setMatchMediaPrefersDark(false);
    triggerMatchMediaChange();
    expect(api().resolved.value).toBe("light");
    system.unmount();
  });

  test("enableSystem=false resolves system to light and skips media listeners", () => {
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <Capture />
      </ThemeProvider>
    ));
    expect(api().themes).toEqual(["light", "dark"]);
    api().setTheme("system");
    expect(api().resolved.value).toBe("light");
    expect(matchMediaListenerCount()).toBe(0);
    unmount();
  });

  test("works without matchMedia and with a throwing storage", () => {
    const storage = localStorage;
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    Object.assign(globalThis, { localStorage: throwing });
    Object.assign(window, { matchMedia: undefined });
    const { api, Capture } = captureTheme();
    try {
      const { unmount } = mountUi(() => (
        <ThemeProvider enableSystem={false}>
          <Capture />
        </ThemeProvider>
      ));
      expect(api().resolved.value).toBe("light");
      api().setTheme("dark");
      api().setPalette("jomlaty");
      expect(api().theme.value).toBe("dark");
      expect(api().palette.value).toBe("jomlaty");
      unmount();
    } finally {
      Object.assign(globalThis, { localStorage: storage });
    }
  });

  test("falls back to defaults when storage is unavailable", () => {
    const storage = localStorage;
    Object.assign(globalThis, { localStorage: undefined });
    const { api, Capture } = captureTheme();
    try {
      const { unmount } = mountUi(() => (
        <ThemeProvider defaultTheme="dark" forcedPalette="jomlaty">
          <Capture />
        </ThemeProvider>
      ));
      expect(api().theme.value).toBe("dark");
      expect(api().palette.value).toBe("jomlaty");
      unmount();
    } finally {
      Object.assign(globalThis, { localStorage: storage });
    }
  });

  test("ThemeToggle flips light, dark and system themes", () => {
    const { api, Capture } = captureTheme();
    const { click, unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
        <ThemeToggle class="toggle-class" />
      </ThemeProvider>
    ));
    const toggle = query('[data-slot="theme-toggle"]');
    expect(toggle.className).toBe("toggle-class");
    expect(toggle.getAttribute("aria-label")).toBe("Toggle color theme");
    expect(toggle.textContent).toBe("Dark");
    click('[data-slot="theme-toggle"]');
    expect(api().theme.value).toBe("dark");
    click('[data-slot="theme-toggle"]');
    expect(api().theme.value).toBe("light");
    api().setTheme("system");
    click('[data-slot="theme-toggle"]');
    expect(api().theme.value).toBe("light");
    api().setTheme("system");
    setMatchMediaPrefersDark(false);
    triggerMatchMediaChange();
    click('[data-slot="theme-toggle"]');
    expect(api().theme.value).toBe("dark");
    unmount();
  });

  test("ThemeToggle stays unstyled and renders custom children", () => {
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle>
          <span data-slot="custom-icon">icon</span>
        </ThemeToggle>
      </ThemeProvider>
    ));
    const toggle = query('[data-slot="theme-toggle"]');
    expect(toggle.hasAttribute("class")).toBe(false);
    expect(toggle.querySelector('[data-slot="custom-icon"]')).toBeTruthy();
    unmount();
  });

  test("useTheme throws outside provider", () => {
    expect(() => withSetup(() => useTheme())).toThrow(/ThemeProvider/);
  });

  test("defaults to credit-blue palette and switches via setPalette", () => {
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palette.value).toBe("credit-blue");
    expect(api().palettes).toEqual(["credit-blue", "jomlaty"]);
    expect(html().getAttribute("data-palette")).toBe("credit-blue");
    api().setPalette("jomlaty");
    expect(api().palette.value).toBe("jomlaty");
    expect(html().getAttribute("data-palette")).toBe("jomlaty");
    expect(localStorage.getItem("sinwan-ui-palette")).toBe("jomlaty");
    unmount();
  });

  test("restores palette from storage and forcedPalette blocks setPalette", () => {
    localStorage.setItem("sinwan-ui-palette", "jomlaty");
    const { api, Capture } = captureTheme();
    const stored = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palette.value).toBe("jomlaty");
    stored.unmount();

    const forced = mountUi(() => (
      <ThemeProvider defaultTheme="light" forcedPalette="credit-blue">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palette.value).toBe("credit-blue");
    api().setPalette("jomlaty");
    expect(api().palette.value).toBe("credit-blue");
    expect(html().getAttribute("data-palette")).toBe("credit-blue");
    forced.unmount();
  });

  test("ignores unknown palette values from storage and setPalette", () => {
    localStorage.setItem("custom-palette", "not-a-palette");
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light" paletteStorageKey="custom-palette" palettes={["credit-blue", "jomlaty"]}>
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palette.value).toBe("credit-blue");
    api().setPalette("jomlaty");
    const unknown: string = "neon";
    const isPalette = (value: string): value is Palette => value.length > 0;
    if (isPalette(unknown)) api().setPalette(unknown);
    expect(api().palette.value).toBe("jomlaty");
    unmount();

    const empty = mountUi(() => (
      <ThemeProvider defaultTheme="light" palettes={[]}>
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palettes).toEqual(["credit-blue", "jomlaty"]);
    empty.unmount();
  });
});

describe("DirectionProvider", () => {
  test("sets dir and useDirection reads it", () => {
    let seen = "";
    const Child = () => {
      seen = useDirection();
      return <span>{seen}</span>;
    };
    const { unmount } = mountUi(() => (
      <DirectionProvider dir="rtl">
        <Child />
      </DirectionProvider>
    ));
    expect(seen).toBe("rtl");
    expect(query('[data-slot="direction-provider"]').getAttribute("dir")).toBe("rtl");
    unmount();
    expect(withSetup(() => useDirection())).toBe("ltr");
  });

  test("live dir prop updates the wrapper and ignores setDir", async () => {
    const dir = signal<Direction | undefined>("ltr");
    let api: DirectionApi | undefined;
    const Probe = () => {
      api = inject(DirectionKey);
      return <span />;
    };
    const { unmount } = mountUi(() => (
      <DirectionProvider dir={dir.value}>
        <Probe />
      </DirectionProvider>
    ));
    const provider = () => query('[data-slot="direction-provider"]');
    expect(provider().getAttribute("dir")).toBe("ltr");
    dir.value = "rtl";
    await Promise.resolve();
    expect(provider().getAttribute("dir")).toBe("rtl");
    api!.setDir("ltr");
    await Promise.resolve();
    expect(provider().getAttribute("dir")).toBe("rtl");
    dir.value = undefined;
    await Promise.resolve();
    expect(provider().getAttribute("dir")).toBe("ltr");
    unmount();
  });

  test("uncontrolled setDir updates the wrapper attribute", async () => {
    let api: DirectionApi | undefined;
    const Probe = () => {
      api = inject(DirectionKey);
      return <span />;
    };
    const { unmount } = mountUi(() => (
      <DirectionProvider>
        <Probe />
      </DirectionProvider>
    ));
    expect(query('[data-slot="direction-provider"]').getAttribute("dir")).toBe("ltr");
    api!.setDir("rtl");
    await Promise.resolve();
    expect(query('[data-slot="direction-provider"]').getAttribute("dir")).toBe("rtl");
    unmount();
  });
});
