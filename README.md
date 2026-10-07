# @fasl-work/caos-app-shell

[![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_APP_SHELL)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/fsantibanezleal/CAOS_APP_SHELL?label=version&sort=semver)](https://github.com/fsantibanezleal/CAOS_APP_SHELL/tags)

The shared **web-app shell, route types, views, drawings, design system and measured gate** of the CAOS / Faena
public apps, one of the three parts of the CAOS base with the product template
([CAOS_PRODUCT_TEMPLATE](https://github.com/fsantibanezleal/CAOS_PRODUCT_TEMPLATE)) and the policy (ADR-0016,
ADR-0017, ADR-0071, ADR-0078). The frame, the header, the icons, the tab structure, the viewport, the areas, the text in
drawings and the numbers are defined **once** here; every product composes them, so a fix lands in one place and no
product writes them again. **Documentation: [`docs/`](docs/README.md)** (structure, tokens, navigation, views,
drawings, icons and numbers, the gate, releasing).

## Install

```bash
npm i -E @fasl-work/caos-app-shell        # an exact pin: the build you gated is the build you ship
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

- **Three route types** ([docs/01](docs/01_structure.md)): the **workbench** (`CaseWorkbench`, a product about
  cases), the **surface** (`SurfacePage`, a hub, an explorer or a console: a head, one row of views, the open view
  filling the rest), the **document** (`DocPage`). Under `contain` each fills or scrolls inside the viewport; no product
  writes containment CSS.
- **Land on the tool:** `/` is the App route; the five documentation routes are separate pages.
- **One React, one router:** set `resolve.dedupe: ['react', 'react-dom', 'react-router']` in Vite. A second copy
  leaves the shell outside the router context; `AppShell` reports it with `console.error` and names the cause.
- **Product metadata:** `license` and `visibility` are required: the footer shows the product's licence and a
  private product shows no source link. `footer.attribution` accepts bilingual text or `false`.
- **Hub case (Faena):** pass `routes: []` (or one) and the nav is hidden; header and footer stay identical.
- **The App route:** one `CaseWorkbench` is the whole route: the rail holds the case picker (`cases`, the
  `CaseSelector` props), the variants (`variants`) and your `rail` (parameters as `Knob` and `ChipGroup`, live
  values as `Readout` / `Gauge` / `Verdict`); the instrument holds at most six question `groups`, then the
  variant comparison and the context. Pickers and numbers live in the rail so the drawing keeps the instrument.
  Every control writes `data-control`. `PlotCard` and `Readout` take `lane`, `provenance` and a `dataKey`:
  pass `useWorkbenchState().stateKey` as captured when the computation started (rail and instrument share it), and
  a view still showing an earlier selection is overlaid as stale. Anything that loads declares
  `data-state="loading"` until it is ready; the gate waits for that, never for the network.
- **Fill the instrument:** `<PlotCard fill>` takes the height its panel leaves (several `fill` cards share it, a
  `.caos-views-row` puts them side by side), and a `Stage` or `<UPlotChart height="fill">` inside it gets a real
  size. A table (`.caos-table`) is sized to its rows: put it above the drawing of the same numbers, never alone.
- **Drawing:** put canvas, WebGL and SVG instruments in a `Stage` (or `useStageSize`): nothing draws at zero
  size, and colours come from `useThemeTokens()` (a canvas cannot read CSS variables).
- **Charts:** `import { UPlotChart } from "@fasl-work/caos-app-shell/chart"`: x and y titles with units, series
  by token colour, `marks` for what the engine detected (placed inside the plot, haloed), a key of every series when
  there are two or more, a cursor readout row, theme and language rebuilds, one tick notation per axis. Categories go
  in `BarChart` (main entry, no uPlot). A drawing of your own measures its labels with the text kit (`textWidth`,
  `fitLabel`, `niceTicks`) and declares `data-chart` ([docs/05](docs/05_drawings.md)).
- **Views in the URL:** `CaseWorkbench` and `SurfacePage` hold the open view in `?view=` (and the case selector the
  case in `?case=`), so a view can be shared and survives a reload.
- **Icons:** lucide icons are sized by where they sit (`svg.lucide`); pass no `size` ([docs/06](docs/06_icons-and-numbers.md)).
- **Numbers:** `formatNumber(value, lang, opts)` or `useFormat()`; never `toFixed` in a view. A magnitude below 1e-4
  is written in scientific notation (a p-value of 1e-200 is `1E-200`, not two hundred zeros); give `digits`, not
  `decimals`, for p-values. A percent and a unit are joined by a no-break space.
- **Documentation routes:** `DocPage` and `DocSection` (each section ends in its own `Refs`, or states why it
  cites nothing), `Equation` with a caption, `CitationsProvider` and `Cite` (every citation has a DOI or URL).
  `Tabs`, `SubTabs` and `TabGroups` are controllable and render only the open panel inside a `PanelBoundary`.
- **Architecture modal:** five or more tabs, each an inline SVG string (`import svg from "./x.svg?raw"`) that uses
  only `SHELL_TOKENS`; `validateArchitectureConfig` reports anything else on mount.
- **Measure it:** `npx caos-shell-gate --serve dist --expect-brand "RotorVitals"` serves the build as GitHub
  Pages does (no SPA fallback), or `--url https://...` measures the deployed origin (needs `playwright`). It walks
  every route, tab, sub-tab and case at five sizes, both themes and both languages, and fails on: a wrong subject
  (G1) or mode (G2), console errors and 4xx/5xx (G3), broken deep links or HTML for an artifact (G4), anything a
  reader cannot scroll to, see whole or click (G5), blank or underfilled drawings and an instrument under half the
  viewport (G6), a view that never settles (G7), loops at rest (G8), controls that change nothing (G9), labels cut or
  overlapping in a drawing, also in a wider fallback font (G10), a decimal point on a Spanish page (G11), a vertical
  sub-tab list that scrolls away (G12), text under WCAG AA contrast (G13). The report
  (`gate-output/gate-report.json`) lists every failure and the smallest margins against each floor; `index.html`
  beside it shows every capture (G14). Details: [docs/07](docs/07_gate.md).
- **Your own CSS:** never restyle a class of `reserved-classes.json` `components`; a `modifiers` word (`on`,
  `active`, `fill`, `wide`) may be joined to your own class (`.my-row.on`), never used alone. The template's guard reads
  that list. Values come from the tokens (`var(--rail-w)`, `var(--space-3)`, [docs/02](docs/02_tokens.md)).
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
`WorkbenchStateContext`, `pick`; since 0.8.0 `SurfacePage`, `useUrlView`, `viewParamOf`, `replaceQueryParam`,
`BREAKPOINTS`, `BarChart`, `textWidth`, `widestLabel`, `fitLabel`, `niceTicks`, `niceStep`, `fontFamily`,
`formatTicks`, `NBSP`, `SCIENTIFIC_BELOW`, the type `ShellColorToken`; since 0.9.0 `ViewsRow`. Separate entries:
`/chart` (`UPlotChart` with `x.log`, `parity`, `onPick`; `drawMarks`, `tickSteps`, `repeatedLabels`, `seriesStyle`,
`sortOrder`, `parityRange`), `/keys` (the storage keys, no React), `/styles.css`, `/chart.css`,
`/reserved-classes.json`. Bin: `caos-shell-gate`.

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
