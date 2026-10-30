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
| `sinwan-ui-core/overlay` | Dialog, Collapsible, Popover and Tooltip primitives (`DialogRoot`, `DialogTrigger`, `DialogOverlay`, `DialogContent`, `PopoverRoot`, …), their injection keys and `OpenApi` |
| `sinwan-ui-core/controls` | Tabs, Accordion, Checkbox, Switch, RadioGroup (WAI-ARIA arrow keys and a single tab stop), Toggle and ToggleGroup primitives with injection keys |
| `sinwan-ui-core/floating` | `useAnchorPosition`, `usePointPosition`, `computePosition`, `estimatePosition` and placement helpers (Floating UI based) |
| `sinwan-ui-core/dismiss` | `isDismissExemptPointerTarget` for outside-press handling across portaled layers |
| `sinwan-ui-core/menu-sub` | `createMenuSubApi` (closes with its `parentOpen`), `createMenuSubTriggerHandlers`, `isInsideMenuSubContent`, `MenuSubContentLayer` for nested menus |
| `sinwan-ui-core/slot` | `Slot` (the `asChild` prop merge) |
| `sinwan-ui-core/types` | Intrinsic prop aliases, `isSinwanElement`, `flattenChildren` |
| `sinwan-ui-core/theme` | `ThemeProvider`, `useTheme`, `ThemeToggle` (unstyled), `ThemeKey` |
| `sinwan-ui-core/direction` | `DirectionProvider`, `useDirection`, `DirectionKey` |

## Styling contract

Every primitive renders a `data-slot` and, where relevant, `data-state` (`open`/`closed`, `checked`/`unchecked`, `on`/`off`, `active`/`inactive`) and `data-side`. Style those attributes from your component layer. `Presence` keeps closing content mounted for `exitMs` (200 ms by default), so exit animations must hold their last keyframe (`animation-fill-mode: forwards`) and finish within that time.

## License

MIT
