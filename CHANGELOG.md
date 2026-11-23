# Changelog

All notable changes to this package are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package uses [Semantic Versioning](https://semver.org/).

## [1.5.0]

### Added

- **SW202, a controlled prop that is `undefined`**: in development, `TabsRoot`, `AccordionRoot`, `RadioGroupRoot` and `ToggleGroupRoot` (`value`), `CheckboxRoot` and `SwitchRoot` (`checked`), `DialogRoot`, `PopoverRoot`, `TooltipRoot` and `CollapsibleRoot` (`open`), and `useControllableState` warn once when the prop is present but `undefined`. For example: `[Sinwan] SW202: <SwitchRoot> checked is undefined: the control is controlled with no value and ignores input…`. Before, the control silently ignored clicks and keys. Behaviour is unchanged: a present prop still makes the control controlled. The check uses `devWarn` from `sinwan/dev`, so the production bundle of sinwan prints nothing and does no extra work.

### Changed

- **Requires `sinwan` 2.5.0 or later** (peer `>=2.5.0 <3.0.0`) for `sinwan/dev`. `sinwan/dev` is kept as a bare external import in `dist/`.

## [1.4.0]

### Added

- `voltzig` palette (Voltzig AI): `Palette` now accepts `"voltzig"` and `ThemeProvider`'s default `palettes` list is `["carzow", "jomlaty", "cazview", "voltzig"]`. Pair it with the registry stylesheet, which defines the `html[data-palette="voltzig"]` tokens: `#08090D` black and `#FFFFFF` white surfaces with a monochrome primary, `#A3A3A3` silver for secondary text in dark mode, and `#6C5CE7` electric violet for focus rings, accent tints, the first chart color and the brand gradient. Apps that pass their own `palettes` list are unaffected.

### Changed

- **Breaking:** the default palette `"credit-blue"` is renamed `"carzow"`. `Palette` no longer accepts `"credit-blue"`, and `ThemeProvider`'s `defaultPalette` is now `"carzow"`, so `<html>` gets `data-palette="carzow"`. Replace `"credit-blue"` with `"carzow"` in `defaultPalette`, `forcedPalette`, `palettes` and `setPalette` calls. A saved `sinwan-ui-palette=credit-blue` value is ignored and falls back to `carzow`, which is the same set of colors. No alias is kept because sinwan-ui has no consumers yet.

## [1.3.1]

### Fixed

- A closing `DialogContent` (dialogs, sheets, drawers, alert dialogs) gives focus back to what opened it only when focus is still inside the dialog or was lost. Before, it always refocused the trigger once the exit animation ended, about 200 ms after closing. That undid focus the app had moved on purpose: after scanning a label, the quantity field lost focus to the "Scan" button.

## [1.3.0]

### Added

- Tabs follow the WAI-ARIA tabs pattern (`controls`). The tab list has a single tab stop (the active tab, or the first enabled one). Left and Right move between tabs, Up and Down when the root is `orientation="vertical"`, and Home and End jump to the first and last tab. Moving selects the tab (automatic activation) and skips disabled tabs. Left and Right swap inside a `DirectionProvider dir="rtl"`. Each tab and its panel are linked (`id`, `aria-controls`, `aria-labelledby`), the panel is focusable, and the list has `aria-orientation`.
- `DialogTitle` and `DialogDescription` (`overlay`): a heading and a paragraph that name and describe their dialog. Inside a `DialogRoot`, `DialogContent` gets `aria-labelledby` and `aria-describedby` pointing at them, so screen readers announce the dialog's title when it opens. An `id` you pass is kept and used. `DialogLabelsKey` and the `DialogLabels` type are exported.
- `DialogContent` takes `role="alertdialog"` for dialogs that interrupt to ask for a decision (the default stays `dialog`), and passes `aria-*` attributes through. An `aria-labelledby` or `aria-describedby` you pass wins over the automatic one.
- `TabsKey` gains optional `orientation`, `idOf`, `register`, `tabStop` and `move`. A context provided by hand without them still works, without the keyboard behaviour.
- Exported types: `AriaProps`, `RovingMove`, `HeadingProps`, `ParagraphProps`.

### Fixed

- `SwitchRoot`, `RadioGroupRoot` and `TabsList` forward `aria-*` attributes to their element, as `ToggleGroupRoot` already did. Before, an `aria-label` such as "Payment method" was dropped, so screen readers announced an unnamed switch, radio group or tab list. Attributes the primitive owns (`aria-checked`, `aria-orientation`) still win.

### Changed

- The radio group shares its roving-focus code with tabs. Its behaviour is unchanged (its keyboard tests pass as before).

## [1.2.1]

### Fixed

- `ThemeProvider` (`theme`): switching the theme no longer replays entrance animations. The transition lock used to set `animation: none` as well, and lifting it restarts every CSS animation on the page, so `animate-in` blocks faded in again after each switch. The lock now only turns transitions off.
- The transition lock now actually stops themed colors from transitioning. It released on the next animation frame without computing styles first, and a browser runs that callback before the frame's style pass, so the new theme and the release were applied together and every `transition-colors` element still faded through the old theme. The lock now reads a computed style while transitions are off and releases before `setTheme` returns.

## [1.2.0]

### Added

- `RadioGroupRoot` / `RadioGroupItem` (`controls`) follow the WAI-ARIA radio group keyboard pattern. The group has a single tab stop: the checked radio, or the first enabled one when nothing is checked. ArrowDown/ArrowRight select and focus the next enabled radio, and ArrowUp/ArrowLeft the previous one. Both wrap and skip disabled radios, and ArrowLeft/ArrowRight swap inside a right-to-left `DirectionProvider`. Click and Space are unchanged. Before, every radio was its own tab stop and arrow keys did nothing.
- `RadioGroupKey` gains `register`, `tabStop` and `move`, and the `RadioGroupEntry` type is exported. Code that only reads `value` and `setValue` is unaffected.

## [1.1.1]

### Fixed

- `ToggleGroupRoot` (`controls`) forwards `aria-*` attributes to its `role="group"` element. Before, an `aria-label` such as "Billing period" was dropped, so screen readers announced an unnamed group. Values stay live when driven by a signal or getter.

## [1.1.0]

### Added

- `cazview` palette: `Palette` now accepts `"cazview"` and `ThemeProvider`'s default `palettes` list is `["credit-blue", "jomlaty", "cazview"]`. Pair it with the registry stylesheet, which defines the `html[data-palette="cazview"]` tokens (midnight `#111E2E` text, `#1A73E8` → `#3B52D9` → `#7B2CBF` brand gradient, `#FAFAFA` surface).

## [1.0.0]

Initial release: the headless primitives extracted from `sinwan-ui` 0.1.0, published separately so registry components copied into apps can depend on them.

### Added

- Modules `core`, `overlay`, `controls`, `floating`, `dismiss`, `menu-sub`, `slot`, `types`, `theme` and `direction`, each available as a subpath export and through the root barrel. They were previously `sinwan-ui/src/primitives/*`, `src/lib/slot.ts`, `src/lib/types.ts`, `src/theme/theme-provider.tsx` and `src/theme/direction.tsx`.
- `sinwan` is a peer dependency (`>=2.0.3 <3.0.0`) and stays a bare import in `dist/`; the build fails if a Sinwan runtime or an undeclared package is bundled. Sinwan 2.0.3 is required because older runtimes keep a submenu's portal in `document.body` when the parent menu unmounts during the submenu's exit animation.
- `createMenuSubApi` accepts `parentOpen`: when the enclosing menu or submenu closes, the submenu closes too (and reports `onOpenChange(false)`), so its Presence exit runs with the parent instead of leaving an open layer behind.
- `createMenuSubTriggerHandlers(api)`: shared sub-trigger handlers. Hover, click and ArrowRight open the submenu; a click never toggles it closed; leaving starts the hover close delay.

### Changed

- `MenuSubContentLayer` is headless: it renders only the `class` it receives. The former default Tailwind classes now live in the registry's `dropdown-menu`, `context-menu` and `menubar` components.

### Fixed

- `dist/` uses the production JSX runtime (`jsx` from `sinwan/jsx-runtime`). The build sets Bun's `jsx.development: false`; before, every JSX chunk imported `jsxDEV` from `sinwan/jsx-dev-runtime` even though the Sinwan compiler ran with `dev: false`. The dist check now fails on any `sinwan/jsx-dev-runtime` import.
