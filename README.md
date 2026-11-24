# sinwan-ui-core

Headless behaviour primitives for [Sinwan](https://sinwanjs.com) UI components — the Radix-style layer under the `sinwan-ui` registry components.

`sinwan-ui-core` owns state, accessibility attributes, focus handling, dismissal, positioning and exit-animation timing. It ships **no styles**: no Tailwind classes, no `clsx`/`tailwind-merge`, no icons. Components copied from the `sinwan-ui` registry (`bunx sinwan-ui add dialog`) import these primitives and add their own classes through `class` props. Use it directly only if you are building your own styled components.

## Install

```bash
bun add sinwan-ui-core
```

Requirements:

- `sinwan` 2.x as a peer dependency (your app's runtime; the package never bundles its own copy).
- `@floating-ui/dom` is installed as a dependency.
- Compile your app with `bun-plugin-sinwan` or `vite-plugin-sinwan` (JSX with `jsxImportSource: "sinwan"`).

## Modules

Import from the root barrel or from a subpath (subpaths keep bundles small):

| Subpath | Contents |
| --- | --- |
| `sinwan-ui-core/core` | `Presence` (keeps content mounted through CSS exit), `UiPortal`, `useControllableState`, `getFocusableElements`, `trapFocus`; re-exports the positioning helpers from `floating` |
| `sinwan-ui-core/overlay` | Dialog, Collapsible, Popover and Tooltip primitives (`DialogRoot`, `DialogTrigger`, `DialogOverlay`, `DialogContent` with `role="alertdialog"`, `DialogTitle` and `DialogDescription`, which name and describe the dialog, `PopoverRoot`, …), their injection keys and `OpenApi` |
| `sinwan-ui-core/controls` | Tabs and RadioGroup (WAI-ARIA arrow keys and a single tab stop), Accordion, Checkbox, Switch, Toggle and ToggleGroup primitives with injection keys. Roots forward `aria-*` attributes |
| `sinwan-ui-core/floating` | `useAnchorPosition`, `usePointPosition`, `computePosition`, `estimatePosition` and placement helpers (Floating UI based) |
| `sinwan-ui-core/dismiss` | `isDismissExemptPointerTarget` for outside-press handling across portaled layers |
| `sinwan-ui-core/menu-sub` | `createMenuSubApi` (closes with its `parentOpen`), `createMenuSubTriggerHandlers`, `isInsideMenuSubContent`, `MenuSubContentLayer` for nested menus |
| `sinwan-ui-core/slot` | `Slot` (the `asChild` prop merge) |
| `sinwan-ui-core/types` | Intrinsic prop aliases, `isSinwanElement`, `flattenChildren` |
| `sinwan-ui-core/theme` | `ThemeProvider`, `useTheme`, `ThemeToggle` (unstyled), `ThemeKey`, `discoverPalettes`, `BUILT_IN_PALETTES` (see [Palettes](#palettes)) |
| `sinwan-ui-core/direction` | `DirectionProvider`, `useDirection`, `DirectionKey` |

## Palettes

`ThemeProvider` writes the light/dark mode as a class (`.light`/`.dark`) and the palette as `html[data-palette]`. The registry stylesheet ships `carzow` (the `:root` default), `jomlaty`, `cazview` and `voltzig`.

To add your own, write it in your stylesheet in the same structure as the built-in ones:

```css
html[data-palette="ocean"] { --background: …; --primary: …; /* every token */ }
html[data-palette="ocean"].dark { --background: …; --primary: …; }
@media (prefers-color-scheme: dark) {
  html[data-palette="ocean"]:not(.light) { /* the .dark tokens again */ }
}
```

Then use it by name. Nothing to register: without a `palettes` prop, `ThemeProvider` reads the page's stylesheets and allows every palette they define.

```tsx
<ThemeProvider defaultPalette="ocean">…</ThemeProvider>

const { palette, palettes, setPalette } = useTheme();
palettes.value; // ["carzow", "jomlaty", "cazview", "voltzig", "ocean"]
setPalette("ocean");
```

- A token the palette leaves out keeps its `carzow` value, so define every color token in both modes.
- Pass `palettes={[…]}` to allow a fixed list instead (needed for cross-origin stylesheets, whose rules the page cannot read).
- For CSS loaded after the provider mounts, `setPalette(name)` scans again for an unknown name, and `refreshPalettes()` rescans on demand.

## Styling contract

Every primitive renders a `data-slot` and, where relevant, `data-state` (`open`/`closed`, `checked`/`unchecked`, `on`/`off`, `active`/`inactive`) and `data-side`. Style those attributes from your component layer. `Presence` keeps closing content mounted for `exitMs` (200 ms by default), so exit animations must hold their last keyframe (`animation-fill-mode: forwards`) and finish within that time.

## License

MIT
