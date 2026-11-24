import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { inject } from "sinwan/component";
import { signal } from "sinwan/reactivity";
import { DirectionKey, DirectionProvider, useDirection, type Direction, type DirectionApi } from "../src/direction";
import {
  BUILT_IN_PALETTES,
  discoverPalettes,
  ThemeProvider,
  ThemeToggle,
  useTheme,
  type Palette,
  type ThemeApi,
} from "../src/theme";
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
const lockText = () =>
  [...document.head.querySelectorAll("style")].find((style) => (style.textContent ?? "").includes("transition:none"))
    ?.textContent ?? null;

/** Records every property read on a computed style, with the transition lock's CSS at that moment. */
function spyComputedStyleReads(): { entries: { lock: string | null; property: string | symbol }[]; restore(): void } {
  const original = window.getComputedStyle;
  const entries: { lock: string | null; property: string | symbol }[] = [];
  const spy: typeof window.getComputedStyle = (element, pseudoElement) =>
    new Proxy(original.call(window, element, pseudoElement), {
      get(target, property) {
        entries.push({ lock: lockText(), property });
        const value: unknown = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  window.getComputedStyle = spy;
  return { entries, restore: () => (window.getComputedStyle = original) };
}
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

  test("locks only transitions, reads computed style under the lock, and releases it before setTheme returns", async () => {
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    await wait(20);
    const reads = spyComputedStyleReads();
    try {
      api().setTheme("dark");
    } finally {
      reads.restore();
    }
    expect(html().classList.contains("dark")).toBe(true);
    // A property read is what makes the browser compute the new theme while
    // transitions are off; `getComputedStyle()` alone computes nothing.
    const locked = reads.entries.filter((entry) => entry.lock !== null);
    expect(locked.length).toBeGreaterThan(0);
    // Lifting `animation: none` would restart every running or finished entrance animation.
    for (const entry of locked) expect(entry.lock).not.toContain("animation");
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

  test("defaults to carzow palette and switches via setPalette", () => {
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palette.value).toBe("carzow");
    expect(api().palettes.value).toEqual(["carzow", "jomlaty", "cazview", "voltzig"]);
    expect(html().getAttribute("data-palette")).toBe("carzow");
    api().setPalette("jomlaty");
    expect(api().palette.value).toBe("jomlaty");
    expect(html().getAttribute("data-palette")).toBe("jomlaty");
    expect(localStorage.getItem("sinwan-ui-palette")).toBe("jomlaty");
    api().setPalette("cazview");
    expect(api().palette.value).toBe("cazview");
    expect(html().getAttribute("data-palette")).toBe("cazview");
    expect(localStorage.getItem("sinwan-ui-palette")).toBe("cazview");
    api().setPalette("voltzig");
    expect(api().palette.value).toBe("voltzig");
    expect(html().getAttribute("data-palette")).toBe("voltzig");
    expect(localStorage.getItem("sinwan-ui-palette")).toBe("voltzig");
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
      <ThemeProvider defaultTheme="light" forcedPalette="carzow">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palette.value).toBe("carzow");
    api().setPalette("jomlaty");
    expect(api().palette.value).toBe("carzow");
    expect(html().getAttribute("data-palette")).toBe("carzow");
    forced.unmount();
  });

  test("ignores unknown palette values from storage and setPalette", () => {
    localStorage.setItem("custom-palette", "not-a-palette");
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light" paletteStorageKey="custom-palette" palettes={["carzow", "jomlaty"]}>
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palette.value).toBe("carzow");
    api().setPalette("jomlaty");
    api().setPalette("neon");
    expect(api().palette.value).toBe("jomlaty");
    unmount();

    const empty = mountUi(() => (
      <ThemeProvider defaultTheme="light" palettes={[]}>
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palettes.value).toEqual(["carzow", "jomlaty", "cazview", "voltzig"]);
    empty.unmount();
  });
});

/** Adds a `<style>` to the document, as an app's global.css would. */
function addStylesheet(css: string): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

/** A custom palette written like the built-in ones in the registry stylesheet. */
const OCEAN_CSS = `
  :root { --primary: blue; }
  .dark { --primary: navy; }
  html[data-palette="jomlaty"] { --primary: orange; }
  html[data-palette="ocean"] { --primary: teal; }
  html[data-palette="ocean"].dark { --primary: darkcyan; }
  @media (prefers-color-scheme: dark) {
    html:not(.light):not([data-palette]), html[data-palette="carzow"]:not(.light) { --primary: navy; }
    html[data-palette="ocean"]:not(.light) { --primary: darkcyan; }
  }
`;

describe("custom palettes", () => {
  test("discoverPalettes finds every data-palette selector, carzow first", () => {
    expect(discoverPalettes()).toEqual([]);
    addStylesheet(OCEAN_CSS);
    addStylesheet(`
      html[data-palette=sunset].dark, html[data-palette='mint'] { --primary: red; }
      @supports (color: oklch(0 0 0)) { html[data-palette="aurora"] { --primary: green; } }
      html:not([data-palette="excluded"]) { --primary: gray; }
    `);
    expect(discoverPalettes()).toEqual(["carzow", "jomlaty", "ocean", "sunset", "mint", "aurora"]);
    expect(discoverPalettes(document)).toEqual(discoverPalettes());
  });

  test("a stylesheet without palettes falls back to the built-ins", () => {
    addStylesheet(":root { --primary: blue; }");
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palettes.value).toEqual([...BUILT_IN_PALETTES]);
    unmount();
  });

  test("ThemeProvider offers the discovered palettes and applies a custom one", () => {
    addStylesheet(OCEAN_CSS);
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palettes.value).toEqual(["carzow", "jomlaty", "ocean"]);
    api().setPalette("ocean");
    expect(api().palette.value).toBe("ocean");
    expect(html().getAttribute("data-palette")).toBe("ocean");
    expect(localStorage.getItem("sinwan-ui-palette")).toBe("ocean");
    // Not defined by the stylesheet: rejected.
    api().setPalette("voltzig");
    expect(api().palette.value).toBe("ocean");
    unmount();
  });

  test("defaultPalette and forcedPalette accept a custom palette", () => {
    addStylesheet(OCEAN_CSS);
    const { api, Capture } = captureTheme();
    const byDefault = mountUi(() => (
      <ThemeProvider defaultTheme="dark" defaultPalette="ocean">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palette.value).toBe("ocean");
    expect(html().getAttribute("data-palette")).toBe("ocean");
    expect(html().classList.contains("dark")).toBe(true);
    byDefault.unmount();

    const forced = mountUi(() => (
      <ThemeProvider defaultTheme="light" forcedPalette="ocean">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palette.value).toBe("ocean");
    api().setPalette("jomlaty");
    expect(api().palette.value).toBe("ocean");
    forced.unmount();
  });

  test("restores a saved custom palette", () => {
    addStylesheet(OCEAN_CSS);
    localStorage.setItem("sinwan-ui-palette", "ocean");
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palette.value).toBe("ocean");
    expect(html().getAttribute("data-palette")).toBe("ocean");
    unmount();
  });

  test("a palette from CSS loaded after mount is found on setPalette and refreshPalettes", () => {
    localStorage.setItem("sinwan-ui-palette", "ocean");
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    // The saved palette is unknown until its stylesheet loads.
    expect(api().palette.value).toBe("carzow");
    expect(api().palettes.value).toEqual([...BUILT_IN_PALETTES]);

    addStylesheet(OCEAN_CSS);
    api().setPalette("ocean");
    expect(api().palette.value).toBe("ocean");
    expect(api().palettes.value).toEqual(["carzow", "jomlaty", "ocean"]);

    addStylesheet('html[data-palette="sunset"] { --primary: red; }');
    expect(api().refreshPalettes()).toEqual(["carzow", "jomlaty", "ocean", "sunset"]);
    expect(api().palettes.value).toEqual(["carzow", "jomlaty", "ocean", "sunset"]);
    unmount();
  });

  test("palettes is reactive in JSX", async () => {
    const { api, Capture } = captureTheme();
    const List = () => {
      const theme = useTheme();
      return <span data-slot="palette-list">{theme.palettes.value.join(",")}</span>;
    };
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
        <List />
      </ThemeProvider>
    ));
    expect(query('[data-slot="palette-list"]').textContent).toBe("carzow,jomlaty,cazview,voltzig");
    addStylesheet('html[data-palette="ocean"] { --primary: teal; }');
    api().refreshPalettes();
    await wait();
    expect(query('[data-slot="palette-list"]').textContent).toBe("carzow,ocean");
    unmount();
  });

  test("an explicit palettes list skips discovery", () => {
    addStylesheet(OCEAN_CSS);
    const { api, Capture } = captureTheme();
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light" forcedPalette="cazview" palettes={["cazview"]}>
        <Capture />
      </ThemeProvider>
    ));
    expect(api().palettes.value).toEqual(["cazview"]);
    expect(api().refreshPalettes()).toEqual(["cazview"]);
    unmount();
  });

  test("cross-origin stylesheets are skipped", () => {
    addStylesheet(OCEAN_CSS);
    const blocked = { get cssRules(): CSSRuleList { throw new Error("SecurityError"); } };
    const sheets = [blocked, ...Array.from(document.styleSheets)];
    const doc = { styleSheets: sheets };
    const isDocument = (value: object): value is Document => "styleSheets" in value;
    if (!isDocument(doc)) throw new Error("unreachable");
    expect(discoverPalettes(doc)).toEqual(["carzow", "jomlaty", "ocean"]);
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
