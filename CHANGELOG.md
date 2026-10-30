# Changelog

All notable changes to this package are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package uses [Semantic Versioning](https://semver.org/).

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
