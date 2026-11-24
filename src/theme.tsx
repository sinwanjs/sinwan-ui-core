import {
  cc,
  inject,
  onMounted,
  onUnmounted,
  provide,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { batch, computed, signal, type Signal } from "sinwan/reactivity";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
/** The palettes the sinwan-ui stylesheet ships. `carzow` is the `:root` default. */
export type BuiltInPalette = "carzow" | "jomlaty" | "cazview" | "voltzig";

/**
 * A built-in palette, or a custom one: any name the app's stylesheet defines
 * as `html[data-palette="name"]`. Built-in names keep their autocompletion.
 */
export type Palette = BuiltInPalette | (string & Record<never, never>);

export const BUILT_IN_PALETTES: readonly BuiltInPalette[] = [
  "carzow",
  "jomlaty",
  "cazview",
  "voltzig",
];

/** `[data-palette="name"]`, `[data-palette='name']` or `[data-palette=name]`. */
const PALETTE_ATTRIBUTE =
  /\[\s*data-palette\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s\]]+))\s*(?:[is]\s*)?\]/g;
/** `:not(...)` excludes a palette instead of defining one. */
const NOT_PSEUDO = /:not\([^()]*\)/g;

type RuleList = ArrayLike<CSSRule>;
type SheetLike = { readonly cssRules: RuleList };

function isRuleList(value: unknown): value is RuleList {
  return typeof value === "object" && value !== null && "length" in value && typeof value.length === "number";
}

function isSheet(value: unknown): value is SheetLike {
  return typeof value === "object" && value !== null && "cssRules" in value;
}

function collectPalettes(rules: RuleList, found: Set<string>): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;
    if ("selectorText" in rule && typeof rule.selectorText === "string") {
      const selector = rule.selectorText.replace(NOT_PSEUDO, "");
      for (const match of selector.matchAll(PALETTE_ATTRIBUTE)) {
        const name = match[1] ?? match[2] ?? match[3];
        if (name) found.add(name);
      }
    }
    // @media, @supports, @layer, @container and nested style rules.
    const children: unknown = Reflect.get(rule, "cssRules");
    if (isRuleList(children)) collectPalettes(children, found);
    // @import url(...)
    const imported: unknown = Reflect.get(rule, "styleSheet");
    if (isSheet(imported)) collectSheet(imported, found);
  }
}

function collectSheet(sheet: SheetLike, found: Set<string>): void {
  let rules: RuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    // A cross-origin stylesheet hides its rules: pass `palettes` explicitly.
    return;
  }
  collectPalettes(rules, found);
}

/**
 * The palettes the page's stylesheets define, in stylesheet order: every
 * `html[data-palette="name"]` selector names one, inside `@media`, `@supports`,
 * `@layer` and `@import` too. `carzow` comes first when any is found, since
 * the stylesheet's `:root` tokens are that palette. Empty when no stylesheet
 * defines a palette (no DOM, CSS not loaded yet, or cross-origin CSS).
 */
export function discoverPalettes(doc?: Document): Palette[] {
  const target = doc ?? (typeof document === "undefined" ? undefined : document);
  if (!target) return [];
  const found = new Set<string>();
  for (const sheet of Array.from(target.styleSheets)) collectSheet(sheet, found);
  if (found.size === 0) return [];
  return Array.from(new Set<Palette>(["carzow", ...found]));
}

export type ThemeApi = {
  theme: Signal<Theme>;
  resolved: Signal<ResolvedTheme>;
  setTheme: (theme: Theme) => void;
  themes: Theme[];
  palette: Signal<Palette>;
  setPalette: (palette: Palette) => void;
  /**
   * The palettes `setPalette` accepts: the `palettes` prop, or the ones the
   * stylesheets define (see `discoverPalettes`). A signal, so a palette
   * picker follows `refreshPalettes`.
   */
  palettes: Signal<Palette[]>;
  /** Scans the stylesheets again, for CSS loaded after the provider mounted. */
  refreshPalettes: () => Palette[];
};

export const ThemeKey: InjectionKey<ThemeApi> = Symbol("sinwan-ui.theme");

export type ThemeProviderProps = {
  children?: SinwanNode;
  defaultTheme?: Theme;
  forcedTheme?: Theme;
  storageKey?: string;
  defaultPalette?: Palette;
  forcedPalette?: Palette;
  paletteStorageKey?: string;
  /**
   * The palettes to allow. Omit it (or pass `[]`) to discover them from the
   * stylesheets: a custom `html[data-palette="name"]` block in the app's CSS
   * is then a palette like the built-in ones.
   */
  palettes?: Palette[];
  disableTransitionOnChange?: boolean;
  enableSystem?: boolean;
  attribute?: "class" | "data-theme";
};

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function isPalette(value: string | null, allowed: readonly Palette[]): value is Palette {
  return value !== null && allowed.includes(value);
}

function readStoredTheme(storageKey: string, fallback: Theme): Theme {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const value = localStorage.getItem(storageKey);
    if (isTheme(value)) return value;
  } catch {
    /* ignore */
  }
  return fallback;
}

function readStoredValue(storageKey: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Turns CSS transitions off while the theme is written. Only transitions:
 * lifting an `animation: none` restarts every animation on the page, so
 * entrance animations would replay on each switch.
 */
function disableTransitionsTemporarily(): () => void {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode("*,*::before,*::after{transition:none!important}"),
  );
  document.head.appendChild(style);
  return () => {
    // Reading a property computes the new theme while transitions are off;
    // without it the change and the release share one style pass and every
    // themed color still transitions.
    void window.getComputedStyle(document.body).opacity;
    style.parentNode?.removeChild(style);
  };
}

function writeDomTheme(
  next: ResolvedTheme,
  attribute: "class" | "data-theme",
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (attribute === "class") {
    root.classList.remove("light", "dark");
    root.classList.add(next);
  } else {
    root.setAttribute("data-theme", next);
  }
  root.style.colorScheme = next;
}

function writeDomPalette(next: Palette): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-palette", next);
}

export const ThemeProvider = cc<ThemeProviderProps>(
  ({
    children,
    defaultTheme = "system",
    forcedTheme,
    storageKey = "sinwan-ui-theme",
    defaultPalette = "carzow",
    forcedPalette,
    paletteStorageKey = "sinwan-ui-palette",
    palettes = [],
    disableTransitionOnChange = true,
    enableSystem = true,
    attribute = "class",
  }) => {
    const explicitPalettes = palettes.length > 0 ? palettes : null;
    /**
     * The allowed palettes: the `palettes` prop as given, or the discovered
     * ones (the built-ins when none is found) plus the default and forced ones.
     */
    const listPalettes = (): Palette[] => {
      if (explicitPalettes) return explicitPalettes;
      const discovered = discoverPalettes();
      return Array.from(
        new Set<Palette>([
          ...(discovered.length > 0 ? discovered : BUILT_IN_PALETTES),
          defaultPalette,
          ...(forcedPalette === undefined ? [] : [forcedPalette]),
        ]),
      );
    };
    const allowedPalettes = signal<Palette[]>(listPalettes());
    const initialTheme = forcedTheme ?? readStoredTheme(storageKey, defaultTheme);
    const storedPalette = readStoredValue(paletteStorageKey);
    const initialPalette =
      forcedPalette ??
      (isPalette(storedPalette, allowedPalettes.peek())
        ? storedPalette
        : defaultPalette);
    const theme = signal<Theme>(initialTheme);
    const palette = signal<Palette>(initialPalette);

    const refreshPalettes = (): Palette[] => {
      const next = listPalettes();
      const current = allowedPalettes.peek();
      if (
        next.length !== current.length ||
        next.some((name, index) => name !== current[index])
      ) {
        allowedPalettes.value = next;
      }
      return allowedPalettes.peek();
    };
    const resolved = signal<ResolvedTheme>(
      initialTheme === "system"
        ? getSystemTheme()
        : (initialTheme as ResolvedTheme),
    );

    const resolve = (value: Theme): ResolvedTheme => {
      if (forcedTheme === "light" || forcedTheme === "dark") return forcedTheme;
      if (forcedTheme === "system") return getSystemTheme();
      if (value === "system") return enableSystem ? getSystemTheme() : "light";
      return value;
    };

    const withTransitionLock = (apply: () => void) => {
      const restore =
        disableTransitionOnChange && typeof document !== "undefined"
          ? disableTransitionsTemporarily()
          : null;
      apply();
      restore?.();
    };

    const commit = (value: Theme, nextTheme?: Theme) => {
      const next = resolve(value);
      withTransitionLock(() => {
        writeDomTheme(next, attribute);
        writeDomPalette(palette.value);
        batch(() => {
          if (nextTheme !== undefined) {
            theme.value = nextTheme;
          }
          resolved.value = next;
        });
      });
    };

    const commitPalette = (next: Palette) => {
      withTransitionLock(() => {
        writeDomPalette(next);
        writeDomTheme(resolved.value, attribute);
        palette.value = next;
      });
    };

    const setTheme = (value: Theme) => {
      if (forcedTheme) return;
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        /* ignore */
      }
      commit(value, value);
    };

    const setPalette = (value: Palette) => {
      if (forcedPalette) return;
      // A palette from CSS loaded after the last scan: look again once.
      if (!allowedPalettes.peek().includes(value) && !refreshPalettes().includes(value)) {
        return;
      }
      try {
        localStorage.setItem(paletteStorageKey, value);
      } catch {
        /* ignore */
      }
      commitPalette(value);
    };

    onMounted(() => {
      commit(theme.value);
      writeDomPalette(palette.value);
      // Stylesheets that finished loading after setup may define the saved
      // palette: restore it now instead of keeping the default.
      if (
        !forcedPalette &&
        !explicitPalettes &&
        storedPalette !== null &&
        storedPalette !== palette.peek() &&
        isPalette(storedPalette, refreshPalettes())
      ) {
        commitPalette(storedPalette);
      }
      if (!enableSystem) return;
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => {
        if (theme.value === "system" || forcedTheme === "system") {
          commit("system");
        }
      };
      mq.addEventListener("change", onChange);
      onUnmounted(() => mq.removeEventListener("change", onChange));
    });

    provide(ThemeKey, {
      theme,
      resolved,
      setTheme,
      themes: enableSystem
        ? (["light", "dark", "system"] as Theme[])
        : (["light", "dark"] as Theme[]),
      palette,
      setPalette,
      palettes: allowedPalettes,
      refreshPalettes,
    });

    // Touch computed so consumers can depend on resolved updates in templates.
    void computed(() => resolved.value);
    void computed(() => palette.value);

    return <>{children}</>;
  },
);

export function useTheme(): ThemeApi {
  const api = inject(ThemeKey);
  if (!api) {
    throw new Error("useTheme() must be used within a ThemeProvider");
  }
  return api;
}

export const ThemeToggle = cc<{ class?: string; children?: SinwanNode }>(
  ({ class: className, children }) => {
    const { theme, resolved, setTheme } = useTheme();
    return (
      <button
        type="button"
        class={className}
        data-slot="theme-toggle"
        aria-label="Toggle color theme"
        onclick={() => {
          const next =
            theme.value === "system"
              ? resolved.value === "dark"
                ? "light"
                : "dark"
              : theme.value === "dark"
                ? "light"
                : "dark";
          setTheme(next);
        }}
      >
        {children ?? (resolved.value === "dark" ? "Light" : "Dark")}
      </button>
    );
  },
);
