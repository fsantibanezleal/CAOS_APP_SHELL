# @fasl-work/caos-app-shell

[![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_APP_SHELL)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/fsantibanezleal/CAOS_APP_SHELL?label=version&sort=semver)](https://github.com/fsantibanezleal/CAOS_APP_SHELL/tags)

The shared **web-app shell + content primitives + design system** for the CAOS / Faena public apps
(implements [ADR-0016](https://github.com/fsantibanezleal)). Define the header, footer, theme, language
toggle and content primitives **once** here; every app consumes them so the chrome is identical and a
fix lands in one place.

## Install

```bash
npm i @fasl-work/caos-app-shell
# peer deps (the app provides them):
npm i react react-dom react-router lucide-react katex zustand
# optional: the house chart and the measured gate
npm i uplot && npm i -D playwright
```

## Use

```html
<!-- index.html: apply the stored theme and language before the first frame (THEME_BOOT_SCRIPT, ADR-0011) -->
<script>/* paste THEME_BOOT_SCRIPT here, or inject it at build */</script>
```

```tsx
// main.tsx
import "@fasl-work/caos-app-shell/styles.css";
import "@fasl-work/caos-app-shell/chart.css"; // only with the chart entry
import { BrowserRouter, Routes, Route } from "react-router";
import { AppShell, STANDARD_ROUTES, type ShellConfig } from "@fasl-work/caos-app-shell";

const config: ShellConfig = {
  product: { name: "RotorVitals" },
  routes: STANDARD_ROUTES, // App, Introduction, Methodology, Implementation, Experiments, Benchmark
  links: { github: "https://github.com/fsantibanezleal/CAOS_RotorVitals" },
  version: "0.01.000", // X.XX.XXX, checked on mount
  build: import.meta.env.VITE_BUILD_ID, // short commit, shown beside the version
  license: { en: "MIT licence", es: "Licencia MIT" }, // required; no default
  visibility: "public", // "private" hides every source link
  contain: true, // every route is the viewport (ADR-0071 rule 1)
};

<BrowserRouter basename={import.meta.env.BASE_URL}>
  <AppShell config={config}>
    <Routes>{/* / = the workbench; the rest are DocPage routes */}</Routes>
  </AppShell>
</BrowserRouter>
```

- **Land on the tool:** `/` is the workbench; the five documentation routes are separate pages.
- **One React, one router:** set `resolve.dedupe: ['react', 'react-dom', 'react-router']` in Vite. A second copy
  leaves the shell outside the router context; `AppShell` reports it with `console.error` and names the cause.
- **Product metadata:** `license` and `visibility` are required: the footer shows the product's licence and a
  private product shows no source link. `footer.attribution` accepts bilingual text or `false`.
- **Hub case (Faena):** pass `routes: []` (or one) and the nav is hidden; header and footer stay identical.
- **The App route:** compose `WorkbenchLayout` (rail and instrument on the full viewport) with `CaseSelector`
  and `CaseWorkbench` (`caseId`, `controls`, the variant bar, at most six question groups, then the variant
  comparison and the context). Controls are `Knob` and `ChipGroup` (each writes `data-control`). Values go in
  `Readout` / `Gauge` / `Verdict`, every view in a `PlotCard`; both take `lane` and `provenance` and a
  `dataKey`: pass `useWorkbenchState().stateKey` as captured when the computation started, and a view still
  showing an earlier selection is overlaid as stale.
- **Drawing:** put canvas, WebGL and SVG instruments in a `Stage` (or `useStageSize`): nothing draws at zero
  size, and colours come from `useThemeTokens()` (a canvas cannot read CSS variables).
- **Charts:** `import { UPlotChart } from "@fasl-work/caos-app-shell/chart"`: x and y titles with units, series
  by token colour, `marks` for what the engine detected, a cursor readout row, theme and language rebuilds.
- **Numbers:** `formatNumber(value, lang, opts)` or `useFormat()`; never `toFixed` in a view.
- **Documentation routes:** `DocPage` and `DocSection` (each section ends in its own `Refs`, or states why it
  cites nothing), `Equation` with a caption, `CitationsProvider` and `Cite` (every citation has a DOI or URL).
  `Tabs`, `SubTabs` and `TabGroups` are controllable and render only the open panel inside a `PanelBoundary`.
- **Architecture modal:** five or more tabs, each an inline SVG string (`import svg from "./x.svg?raw"`) that uses
  only `SHELL_TOKENS`; `validateArchitectureConfig` reports anything else on mount.
- **Measure it:** `npx caos-shell-gate --url http://127.0.0.1:4173 --expect-brand "RotorVitals"` against the
  built app (needs `playwright`); it exits non-zero on any ADR-0071 or ADR-0017 failure and writes screenshots
  and a JSON report.
- **Your own CSS:** never redefine a class in `reserved-classes.json`; the product guard reads that list.
- **Animated views:** drive every canvas or 3D loop through `usePausedViz` (default paused, run once, halt on a
  hidden tab), never call `requestAnimationFrame` directly.

## Exports

`AppShell`, `STANDARD_ROUTES`, `WorkbenchShell`, `FocusShell`, `ArchitectureModal`,
`validateArchitectureConfig`, `ThemeToggle`, `LanguageToggle`, `useThemeStore`, `applyTheme`, `readTheme`,
`THEME_BOOT_SCRIPT`, `THEME_STORAGE_KEY`, `LANG_STORAGE_KEY`, `useLangStore`, `useShellLang`, `formatNumber`,
`useFormat`, `NOT_AVAILABLE`, `SHELL_TOKENS`, `resolveToken`, `useThemeTokens`, `PanelBoundary`,
`usePausedViz`, `createVizLoop`, `CaseSelector` (and the `caseModel` helpers), `Tabs`, `MAX_PEER_TABS`,
`SubTabs`, `TabGroups`, `Callout`, `Equation`, `InlineMath`, `Figure`, `CitationsProvider`, `Cite`, `Refs`,
`ReferenceList` (deprecated), `DocPage`, `DocSection`, `WorkbenchLayout`, `CaseWorkbench`,
`MAX_WORKBENCH_GROUPS`, `VariantBar`, `LaneBadge`, `Readout`, `Gauge`, `Verdict`, `PlotCard`, `Knob`,
`ChipGroup`, `Stage`, `useStageSize`, `makeStateKey`, `isStale`, `useWorkbenchState`,
`WorkbenchStateContext`, `pick`. Separate entries: `/chart` (`UPlotChart`), `/keys` (the storage keys, no
React), `/styles.css`, `/chart.css`, `/reserved-classes.json`. Bin: `caos-shell-gate`.

### Authenticated workbenches

`WorkbenchShell` is the shared frame for products whose authenticated UI needs a desktop sidebar and
mobile bottom navigation. It renders typed routes and the main landmark while the product supplies its
own stateful controls through `brand`, `sidebarFooter`, `headerLead`, `headerActions`, and `overlays`.
Authentication, account policy, preference persistence, chat, and modal content remain product-owned.
The component uses the stable core `NavLink` contract and supports `react-router` 6, 7, and 8.
Browser applications on 6/7 install the matching `react-router-dom`, which supplies the core peer;
Router 8 applications provide `react-router` directly. Do not mix different core and DOM majors in
one application.

MIT · part of the Faena mining-analytics hub.
