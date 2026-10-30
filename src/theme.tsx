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
export type Palette = "credit-blue" | "jomlaty" | "cazview";

const DEFAULT_PALETTES: Palette[] = ["credit-blue", "jomlaty", "cazview"];

export type ThemeApi = {
  theme: Signal<Theme>;
  resolved: Signal<ResolvedTheme>;
  setTheme: (theme: Theme) => void;
  themes: Theme[];
  palette: Signal<Palette>;
  setPalette: (palette: Palette) => void;
  palettes: Palette[];
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
  palettes?: Palette[];
  disableTransitionOnChange?: boolean;
  enableSystem?: boolean;
  attribute?: "class" | "data-theme";
};

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function isPalette(value: string | null, allowed: Palette[]): value is Palette {
  return value !== null && (allowed as string[]).includes(value);
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

function readStoredPalette(
  storageKey: string,
  fallback: Palette,
  allowed: Palette[],
): Palette {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const value = localStorage.getItem(storageKey);
    if (isPalette(value, allowed)) return value;
  } catch {
    /* ignore */
  }
  return fallback;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function disableTransitionsTemporarily(): () => void {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important;animation:none!important}",
    ),
  );
  document.head.appendChild(style);
  return () => {
    window.getComputedStyle(document.body);
    requestAnimationFrame(() => {
      style.parentNode?.removeChild(style);
    });
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
    defaultPalette = "credit-blue",
    forcedPalette,
    paletteStorageKey = "sinwan-ui-palette",
    palettes = DEFAULT_PALETTES,
    disableTransitionOnChange = true,
    enableSystem = true,
    attribute = "class",
  }) => {
    const allowedPalettes = palettes.length > 0 ? palettes : DEFAULT_PALETTES;
    const initialTheme = forcedTheme ?? readStoredTheme(storageKey, defaultTheme);
    const initialPalette =
      forcedPalette ??
      readStoredPalette(paletteStorageKey, defaultPalette, allowedPalettes);
    const theme = signal<Theme>(initialTheme);
    const palette = signal<Palette>(initialPalette);
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
      if (!allowedPalettes.includes(value)) return;
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
