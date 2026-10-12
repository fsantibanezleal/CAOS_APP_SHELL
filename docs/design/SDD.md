# Software design document: `@fasl-work/caos-app-shell`

This is the shell's first software design document (ADR-0075). It says what the shell is, what it promises
to products, and which test or gate plant fails when a promise breaks. The requirements live in nine files, one per
area, under [`features/`](features/); each row names an existing test or a gate plant, and the CI step
`scripts/check_sdd.py` reads them. The behaviour itself is described in [`docs/01_structure.md`](../01_structure.md)
to [`docs/08_releasing.md`](../08_releasing.md); this document does not repeat those pages, it fixes the contracts and
the verification.

| Area | Prefix | Requirements file |
|---|---|---|
| Documents | SHD | [`features/documents/requirements.md`](features/documents/requirements.md) |
| Frame and navigation | SHF | [`features/frame-and-navigation/requirements.md`](features/frame-and-navigation/requirements.md) |
| Workbench | SHW | [`features/workbench/requirements.md`](features/workbench/requirements.md) |
| Charts | SHC | [`features/charts/requirements.md`](features/charts/requirements.md) |
| Controls and readouts | SHK | [`features/controls-and-readouts/requirements.md`](features/controls-and-readouts/requirements.md) |
| Numbers and units | SHN | [`features/numbers-and-units/requirements.md`](features/numbers-and-units/requirements.md) |
| Theme and language | SHT | [`features/theme-and-language/requirements.md`](features/theme-and-language/requirements.md) |
| Architecture modal | SHA | [`features/architecture-modal/requirements.md`](features/architecture-modal/requirements.md) |
| The gate | SHG | [`features/gate/requirements.md`](features/gate/requirements.md) |

## Problem and non-goals

Problem. About 40 CAOS and Faena products each wrote their own frame, header, tab rows, charts, number formats and
checks, and the same defects returned product after product: 29 of 89 frontends carried their own uPlot wrapper, and 16 to 24 products fixed the
shrinking tab row for themselves before 0.8.0 ([`docs/05_drawings.md`](../05_drawings.md), [`docs/03_navigation.md`](../03_navigation.md)).
The shell holds every pixel rule once, as components, tokens and a measured gate, so a fix lands in one place and a product
writes no CSS or code for the frame, the header, the icons, the tab structure, the viewport, the areas, the text in
its drawings or its numbers ([`docs/README.md`](../README.md); ADR-0078 section 3).

Non-goals, each something a product author could reasonably assume:

- Product logic. The shell has no case model beyond the shape of a case (`CaseDef`), no method, no engine and no model.
- Data access. It fetches nothing and holds no artifact; a product passes values and the shell draws and formats them.
- A backend. The package is a client library plus a Node gate CLI; it serves nothing at run time (the gate's own local
  server, `gate/serve.mjs`, exists only to measure a build).
- A router. It reads `react-router` through its stable core `NavLink` contract and does not own the product's routes.
- Judging content. The gate measures what a reader would meet (overflow, cut text, contrast, drawing) and never whether the
  science or the prose is right ([`docs/07_gate.md`](../07_gate.md)).
- Per-product breakpoints, colours or frames. A product that needs one has found a gap in the shell, which is fixed here first.

## Dimensioning

Measured by a script, not estimated. Command (run from the repository root; the script is kept with the delegation
record, not in this repository):

```
python dimension.py .
```

It reads every file under `src/`, takes the exported names with the pattern `export (function|const|class|interface|type|enum) Name`
and the `export { ... } from` lists, counts lines, and maps each module to its requirement area. Exported names count re-exports, so
a name re-exported by the barrel `src/index.ts` and `src/lib/keys.ts` is counted in the module that declares it and again where
it is re-exported.

| Path | Exports | Lines | Area |
|---|---|---|---|
| `src/case/caseModel.ts` | `CaseKind`, `CaseDef`, `caseKind`, `sourcesPresent`, `CaseGroup`, `groupByCategory`, `casesInSource`, `caseTooltip`, `readCaseParam`, `withCaseParam` | 78 | workbench |
| `src/case/CaseSelector.tsx` | `CaseSelectorText`, `CaseSelectorProps`, `CaseSelector`, `CaseDef`, `CaseKind` | 245 | workbench |
| `src/chart/BarChart.tsx` | `BarDatum`, `BarChartProps`, `BarChart` | 238 | charts |
| `src/chart/text.ts` | `fontFamily`, `textWidth`, `widestLabel`, `FittedLabel`, `fitLabel`, `niceStep`, `niceTicks` | 102 | charts |
| `src/chart/UPlotChart.tsx` | `ChartSeries`, `ChartAxis`, `YMarkTone`, `YMARK_TONE_TOKENS`, `UPlotChartProps`, `seriesStyle`, `sortOrder`, `parityRange`, `rangeWithLevels`, `tickSteps`, `LOG_TABLE_FLOOR`, `logDecades`, `smallestPositive`, `repeatedLabels`, `drawMarks`, `drawYMarks`, `nearestPoint`, `UPlotChart` | 629 | charts |
| `src/chart.ts` | re-exports the chart entry | 4 | charts |
| `src/content/Callout.tsx` | `Callout` | 25 | documents |
| `src/content/Cite.tsx` | `Citation`, `CitationsProvider`, `Cite`, `firstAppearance`, `useRefsScope`, `DocRefsScope`, `DocReferences`, `Refs`, `ReferenceList` | 206 | documents |
| `src/content/DocPage.tsx` | `DocPage`, `DocSectionProps`, `DocSection` | 61 | documents |
| `src/content/Equation.tsx` | `Equation`, `InlineMath` | 23 | documents |
| `src/content/Figure.tsx` | `Figure` | 12 | documents |
| `src/content/SubTabs.tsx` | `SubTabDef`, `SubTabsProps`, `SubTabs` | 112 | frame-and-navigation |
| `src/content/SurfacePage.tsx` | `SurfacePageProps`, `SurfacePage` | 59 | frame-and-navigation |
| `src/content/TabGroups.tsx` | `TabGroupDef`, `TabGroupsProps`, `TabGroups` | 61 | frame-and-navigation |
| `src/content/Tabs.tsx` | `TabDef`, `MAX_PEER_TABS`, `TabsProps`, `Tabs` | 104 | frame-and-navigation |
| `src/index.ts` | the public barrel (see Contracts) | 96 | (barrel) |
| `src/lib/breakpoints.ts` | `BREAKPOINTS` | 15 | frame-and-navigation |
| `src/lib/chrome.ts` | `ChromeStrings`, `chrome` | 39 | frame-and-navigation |
| `src/lib/format.ts` | `FormatOptions`, `NBSP`, `SCIENTIFIC_BELOW`, `NOT_AVAILABLE`, `formatNumber`, `formatTicks`, `useFormat` | 83 | numbers-and-units |
| `src/lib/keys.ts` | `THEME_STORAGE_KEY`, `LANG_STORAGE_KEY`, `THEME_BOOT_SCRIPT`, `STANDARD_ROUTES` | 21 | theme-and-language |
| `src/lib/lang.ts` | `Lang`, `useLangStore`, `useShellLang` | 47 | theme-and-language |
| `src/lib/overflow.ts` | `useOverflowFade` | 58 | frame-and-navigation |
| `src/lib/PanelBoundary.tsx` | `PanelBoundary` | 45 | workbench |
| `src/lib/text.ts` | `BiText`, `pick` | 11 | theme-and-language |
| `src/lib/theme.ts` | `Theme`, `readTheme`, `applyTheme`, `useThemeStore`, `THEME_BOOT_SCRIPT` | 55 | theme-and-language |
| `src/lib/tokens.ts` | `SHELL_TOKENS`, `ShellToken`, `ShellColorToken`, `resolveToken`, `useThemeTokens` | 87 | theme-and-language |
| `src/lib/urlView.ts` | `replaceQueryParam`, `useUrlView`, `viewParamOf` | 40 | frame-and-navigation |
| `src/lib/usePausedViz.ts` | `PausedVizController`, `UsePausedVizOptions`, `usePausedViz` | 77 | workbench |
| `src/lib/vizLoop.ts` | `VizFrame`, `VizLoopOptions`, `VizLoopDeps`, `VizLoop`, `createVizLoop` | 160 | workbench |
| `src/shell/AppShell.tsx` | `ShellRoute`, `ShellConfig`, `AppShell` | 270 | frame-and-navigation |
| `src/shell/ArchitectureModal.tsx` | `ArchTab`, `ArchitectureConfig`, `validateArchitectureConfig`, `ArchitectureModal` | 196 | architecture-modal |
| `src/shell/FocusShell.tsx` | `FocusShellProps`, `FocusShell` | 31 | frame-and-navigation |
| `src/shell/LanguageToggle.tsx` | `LanguageToggle` | 16 | theme-and-language |
| `src/shell/routes.ts` | `STANDARD_ROUTES` | 15 | frame-and-navigation |
| `src/shell/ThemeToggle.tsx` | `ThemeToggle` | 17 | theme-and-language |
| `src/shell/WorkbenchShell.tsx` | `WorkbenchRoute`, `WorkbenchShellProps`, `WorkbenchShell` | 85 | frame-and-navigation |
| `src/workbench/CaseWorkbench.tsx` | `WorkbenchGroup`, `CaseWorkbenchProps`, `MAX_WORKBENCH_GROUPS`, `CaseWorkbench` | 137 | workbench |
| `src/workbench/Controls.tsx` | `KnobProps`, `Knob`, `ChipOption`, `ChipGroupProps`, `ChipGroup` | 97 | controls-and-readouts |
| `src/workbench/LaneBadge.tsx` | `Lane`, `LaneBadge` | 37 | workbench |
| `src/workbench/Readouts.tsx` | `Tone`, `ReadoutItem`, `ReadoutProps`, `Readout`, `GaugeZone`, `GaugeProps`, `Gauge`, `VerdictProps`, `Verdict`, `PlotCardProps`, `PlotCard` | 249 | controls-and-readouts |
| `src/workbench/Stage.tsx` | `StageSize`, `useStageSize`, `Stage` | 65 | workbench |
| `src/workbench/state.ts` | `Provenance`, `WorkbenchState`, `WorkbenchStateContext`, `useWorkbenchState`, `makeStateKey`, `isStale` | 49 | workbench |
| `src/workbench/VariantBar.tsx` | `VariantDef`, `VariantBarProps`, `VariantBar` | 60 | workbench |
| `src/workbench/ViewsRow.tsx` | `ViewsRowProps`, `ViewsRow` | 29 | workbench |
| `src/workbench/WorkbenchLayout.tsx` | `RailSection`, `WorkbenchLayoutProps`, `WorkbenchLayout` | 105 | workbench |

| Area | Modules | Exported names | Lines |
|---|---|---|---|
| (barrel) | 1 | 0 | 96 |
| architecture-modal | 1 | 4 | 196 |
| charts | 4 | 28 | 973 |
| controls-and-readouts | 2 | 16 | 346 |
| documents | 5 | 16 | 327 |
| frame-and-navigation | 12 | 28 | 889 |
| numbers-and-units | 1 | 7 | 83 |
| theme-and-language | 7 | 21 | 254 |
| workbench | 12 | 47 | 1087 |
| total | 45 | 167 | 4251 |

| Other source | Lines |
|---|---|
| `gate/run.mjs` | 722 |
| `gate/inpage.mjs` | 824 |
| `gate/png.mjs` | 149 |
| `gate/serve.mjs` | 97 |
| `bin/caos-shell-gate.mjs` | 71 |
| `styles.css` | 698 |
| `chart.css` | 24 |

Requirements per area (counted from the nine files at the time of writing; `scripts/check_sdd.py` keeps them in step):

| Area | Prefix | Requirements |
|---|---|---|
| documents | SHD | 20 |
| frame-and-navigation | SHF | 27 |
| workbench | SHW | 30 |
| charts | SHC | 28 |
| controls-and-readouts | SHK | 12 |
| numbers-and-units | SHN | 9 |
| theme-and-language | SHT | 10 |
| architecture-modal | SHA | 4 |
| gate | SHG | 9 |
| total | | 149 |

Tests that verify them: 17 unit files in `test/` (node test runner) and the gate self-test `test/gate-selftest.mjs`, 11 browser files in `e2e/`
(Playwright Chromium), and 37 plants in `PLANTS` of `test/gate-selftest.mjs`. The coverage is shown by the report that
delivered this document, not duplicated here.

## Technology and versions

Read from `package.json` (version 0.10.0 at the time of writing; the 0.11.0 work is on `develop`). The package is ESM only
(`"type": "module"`), built by `tsup` to `dist/` with three entries (`index`, `chart`, `keys`), TypeScript `strict`, target ES2022, JSX `react-jsx`
(`tsconfig.json`, `tsup.config.ts`). CSS ships as two static files, not through the bundler.

Peer dependencies (the product provides them):

| Package | Range | Used for | Alternative considered |
|---|---|---|---|
| `react`, `react-dom` | `^18 \|\| ^19` | every component | none recorded |
| `react-router` | `^6 \|\| ^7 \|\| ^8` | `NavLink` in the header route row; built and tested against 8.3.0 (CHANGELOG 0.05.000) | the shell used to require one major; since 0.05.000 it uses the stable core `NavLink` contract so Router 6 and 7 applications (with `react-router-dom`) keep working without a downgrade |
| `lucide-react` | `>=0.400.0` | the icon set, sized by context | an own icon set was not taken; the 0.06.006 change replaced `Github` (removed in Lucide 1.x) with `CodeXml` after it broke consumer builds (CHANGELOG 0.06.006) |
| `katex` | `^0.16.0` | `Equation` and `InlineMath` | none recorded |
| `zustand` | `^4 \|\| ^5` | the theme and language stores | none recorded |
| `uplot` | `^1.6.30`, optional | `UPlotChart` (the `/chart` entry); a product that draws no chart does not need it | hand-drawn SVG charts per product (29 of 89 frontends); `BarChart` is the categorical chart without uPlot |
| `playwright` | `>=1.40`, optional | the gate CLI (`caos-shell-gate`), in the consuming project | none recorded |

Development dependencies (pinned or ranged as `package.json` states):

| Package | Version | Used for |
|---|---|---|
| `@playwright/test` | 1.63.0 (exact) | the browser suites in `e2e/` and the gate self-test |
| `esbuild` | 0.28.1 (exact, also an `overrides` entry) | the bundler under `tsup` and the fixture build |
| `lucide-react` | 1.43.0 (exact) | the installed Lucide for the bundle test (`test/lucideCompatibility.test.ts`) |
| `uplot` | 1.6.32 (exact) | the installed uPlot for the chart tests |
| `react`, `react-dom`, `@types/react`, `@types/react-dom` | `^19.0.0` | build and tests |
| `react-router` | `^8.3.0` | build and tests |
| `katex`, `@types/katex` | `^0.16.11`, `^0.16.7` | build and tests |
| `tsup`, `tsx`, `typescript`, `zustand` | `^8.3.5`, `^4.23.0`, `^5.7.3`, `^5.0.2` | build, test runner loader, type check, stores |

Support policy. `SECURITY.md` states that the project is developed on a rolling basis: fixes go to the latest release on `main` and older tags are
not maintained. The shell states no Node or browser support matrix of its own: UNVERIFIED (searched `package.json`, `README.md`, `CONTRIBUTING.md`,
`SECURITY.md` and `.github/workflows/ci.yml` for an `engines` field or a browser list; none exists). The gate runs Chromium only.
Products pin the shell exactly (ADR-0078 section 5, [`docs/08_releasing.md`](../08_releasing.md)).

## Contracts

Package entries (`package.json` `exports`):

| Entry | What it gives | Source |
|---|---|---|
| `@fasl-work/caos-app-shell` | the components, hooks and helpers below | `src/index.ts` |
| `@fasl-work/caos-app-shell/chart` | `UPlotChart` and its pure helpers, a separate entry so that a product without a chart needs no uPlot | `src/chart.ts` |
| `@fasl-work/caos-app-shell/keys` | the storage keys and the boot script, free of React, for an `index.html` build step | `src/lib/keys.ts` |
| `.../styles.css`, `.../chart.css` | the two stylesheets: tokens, frame, components; and the chart's own rules | `styles.css`, `chart.css` |
| `.../reserved-classes.json` | the classes the stylesheets define, as `components`, `modifiers` and `classes` (generated by `scripts/reserved-classes.mjs` on `prebuild`) | `reserved-classes.json` |
| `.../serve`, `.../gate` | the Pages-faithful server and the gate run as a module | `gate/serve.mjs`, `gate/run.mjs` |
| `caos-shell-gate` (bin) | the gate CLI | `bin/caos-shell-gate.mjs` |

Public API of the main entry by group, with the module that declares each value and its types (types are named, with their file):

| Group | Kind | Names | File |
|---|---|---|---|
| Frame and shell | values | `AppShell` | `src/shell/AppShell.tsx` |
| Frame and shell | types | `ShellConfig`, `ShellRoute` | `src/shell/AppShell.tsx` |
| Frame and shell | values | `STANDARD_ROUTES` | `src/shell/routes.ts` |
| Frame and shell | values | `WorkbenchShell` | `src/shell/WorkbenchShell.tsx` |
| Frame and shell | values | `FocusShell` | `src/shell/FocusShell.tsx` |
| Frame and shell | types | `FocusShellProps` | `src/shell/FocusShell.tsx` |
| Frame and shell | types | `WorkbenchRoute`, `WorkbenchShellProps` | `src/shell/WorkbenchShell.tsx` |
| Frame and shell | values | `ArchitectureModal` | `src/shell/ArchitectureModal.tsx` |
| Frame and shell | values | `validateArchitectureConfig` | `src/shell/ArchitectureModal.tsx` |
| Frame and shell | types | `ArchitectureConfig`, `ArchTab` | `src/shell/ArchitectureModal.tsx` |
| Frame and shell | values | `ThemeToggle` | `src/shell/ThemeToggle.tsx` |
| Frame and shell | values | `LanguageToggle` | `src/shell/LanguageToggle.tsx` |
| Theme, language, tokens, keys | values | `useThemeStore`, `applyTheme`, `readTheme`, `THEME_BOOT_SCRIPT` | `src/lib/theme.ts` |
| Theme, language, tokens, keys | values | `THEME_STORAGE_KEY`, `LANG_STORAGE_KEY` | `src/lib/keys.ts` |
| Theme, language, tokens, keys | values | `SHELL_TOKENS`, `resolveToken`, `useThemeTokens` | `src/lib/tokens.ts` |
| Theme, language, tokens, keys | types | `ShellColorToken`, `ShellToken` | `src/lib/tokens.ts` |
| Theme, language, tokens, keys | types | `Theme` | `src/lib/theme.ts` |
| Theme, language, tokens, keys | values | `useLangStore`, `useShellLang` | `src/lib/lang.ts` |
| Theme, language, tokens, keys | types | `Lang` | `src/lib/lang.ts` |
| Theme, language, tokens, keys | values | `pick` | `src/lib/text.ts` |
| Theme, language, tokens, keys | types | `BiText` | `src/lib/text.ts` |
| Numbers | values | `formatNumber`, `formatTicks`, `useFormat`, `NBSP`, `NOT_AVAILABLE`, `SCIENTIFIC_BELOW` | `src/lib/format.ts` |
| Numbers | types | `FormatOptions` | `src/lib/format.ts` |
| Navigation and views in the URL | values | `Tabs` | `src/content/Tabs.tsx` |
| Navigation and views in the URL | values | `MAX_PEER_TABS` | `src/content/Tabs.tsx` |
| Navigation and views in the URL | types | `TabsProps` | `src/content/Tabs.tsx` |
| Navigation and views in the URL | values | `TabGroups` | `src/content/TabGroups.tsx` |
| Navigation and views in the URL | types | `TabGroupDef`, `TabGroupsProps` | `src/content/TabGroups.tsx` |
| Navigation and views in the URL | types | `TabDef` | `src/content/Tabs.tsx` |
| Navigation and views in the URL | values | `SubTabs` | `src/content/SubTabs.tsx` |
| Navigation and views in the URL | types | `SubTabDef` | `src/content/SubTabs.tsx` |
| Navigation and views in the URL | types | `SubTabsProps` | `src/content/SubTabs.tsx` |
| Navigation and views in the URL | values | `SurfacePage` | `src/content/SurfacePage.tsx` |
| Navigation and views in the URL | types | `SurfacePageProps` | `src/content/SurfacePage.tsx` |
| Navigation and views in the URL | values | `useUrlView`, `viewParamOf`, `replaceQueryParam` | `src/lib/urlView.ts` |
| Navigation and views in the URL | values | `BREAKPOINTS` | `src/lib/breakpoints.ts` |
| Documents | values | `Callout` | `src/content/Callout.tsx` |
| Documents | values | `Equation`, `InlineMath` | `src/content/Equation.tsx` |
| Documents | values | `Figure` | `src/content/Figure.tsx` |
| Documents | values | `CitationsProvider`, `Cite`, `Refs`, `ReferenceList`, `DocReferences`, `DocRefsScope`, `firstAppearance` | `src/content/Cite.tsx` |
| Documents | types | `Citation` | `src/content/Cite.tsx` |
| Documents | values | `DocPage`, `DocSection` | `src/content/DocPage.tsx` |
| Documents | types | `DocSectionProps` | `src/content/DocPage.tsx` |
| Cases and the workbench | values | `CaseSelector` | `src/case/CaseSelector.tsx` |
| Cases and the workbench | types | `CaseSelectorProps`, `CaseSelectorText` | `src/case/CaseSelector.tsx` |
| Cases and the workbench | values | `caseKind`, `casesInSource`, `caseTooltip`, `groupByCategory`, `readCaseParam`, `sourcesPresent`, `withCaseParam` | `src/case/caseModel.ts` |
| Cases and the workbench | types | `CaseDef`, `CaseGroup`, `CaseKind` | `src/case/caseModel.ts` |
| Cases and the workbench | values | `WorkbenchLayout` | `src/workbench/WorkbenchLayout.tsx` |
| Cases and the workbench | types | `RailSection`, `WorkbenchLayoutProps` | `src/workbench/WorkbenchLayout.tsx` |
| Cases and the workbench | values | `CaseWorkbench`, `MAX_WORKBENCH_GROUPS` | `src/workbench/CaseWorkbench.tsx` |
| Cases and the workbench | types | `CaseWorkbenchProps`, `WorkbenchGroup` | `src/workbench/CaseWorkbench.tsx` |
| Cases and the workbench | values | `VariantBar` | `src/workbench/VariantBar.tsx` |
| Cases and the workbench | types | `VariantBarProps`, `VariantDef` | `src/workbench/VariantBar.tsx` |
| Cases and the workbench | values | `LaneBadge` | `src/workbench/LaneBadge.tsx` |
| Cases and the workbench | types | `Lane` | `src/workbench/LaneBadge.tsx` |
| Cases and the workbench | values | `Gauge`, `PlotCard`, `Readout`, `Verdict` | `src/workbench/Readouts.tsx` |
| Cases and the workbench | types | `PlotCardProps`, `ReadoutProps`, `VerdictProps` | `src/workbench/Readouts.tsx` |
| Cases and the workbench | values | `ChipGroup`, `Knob` | `src/workbench/Controls.tsx` |
| Cases and the workbench | types | `ChipGroupProps`, `ChipOption`, `KnobProps` | `src/workbench/Controls.tsx` |
| Cases and the workbench | values | `Stage`, `useStageSize` | `src/workbench/Stage.tsx` |
| Cases and the workbench | values | `ViewsRow` | `src/workbench/ViewsRow.tsx` |
| Cases and the workbench | types | `ViewsRowProps` | `src/workbench/ViewsRow.tsx` |
| Cases and the workbench | types | `StageSize` | `src/workbench/Stage.tsx` |
| Cases and the workbench | values | `isStale`, `makeStateKey`, `useWorkbenchState`, `WorkbenchStateContext` | `src/workbench/state.ts` |
| Cases and the workbench | types | `Provenance`, `WorkbenchState` | `src/workbench/state.ts` |
| Cases and the workbench | types | `GaugeProps`, `GaugeZone`, `ReadoutItem`, `Tone` | `src/workbench/Readouts.tsx` |
| Drawings without uPlot | values | `BarChart` | `src/chart/BarChart.tsx` |
| Drawings without uPlot | types | `BarChartProps`, `BarDatum` | `src/chart/BarChart.tsx` |
| Drawings without uPlot | values | `fitLabel`, `fontFamily`, `niceStep`, `niceTicks`, `textWidth`, `widestLabel` | `src/chart/text.ts` |
| Drawings without uPlot | types | `FittedLabel` | `src/chart/text.ts` |
| Boundaries and animation | values | `PanelBoundary` | `src/lib/PanelBoundary.tsx` |
| Boundaries and animation | values | `usePausedViz` | `src/lib/usePausedViz.ts` |
| Boundaries and animation | types | `PausedVizController`, `UsePausedVizOptions` | `src/lib/usePausedViz.ts` |
| Boundaries and animation | values | `createVizLoop` | `src/lib/vizLoop.ts` |
| Boundaries and animation | types | `VizFrame`, `VizLoop`, `VizLoopOptions`, `VizLoopDeps` | `src/lib/vizLoop.ts` |

The chart entry (`src/chart.ts`) exports the values `drawMarks`, `drawYMarks`, `LOG_TABLE_FLOOR`, `logDecades`, `nearestPoint`, `parityRange`, `rangeWithLevels`,
`repeatedLabels`, `seriesStyle`, `smallestPositive`, `sortOrder`, `tickSteps`, `UPlotChart`, `YMARK_TONE_TOKENS`, and the types `ChartAxis`, `ChartSeries`,
`UPlotChartProps`, `YMarkTone`, all from `src/chart/UPlotChart.tsx`.

Reserved CSS classes. `reserved-classes.json` lists the classes the shell styles: `components` (a class the shell styles on its own, for example `chip`, `tablist`,
`caos-plot`, `page-body`, `caos-surface`, `skip-link`), which a product never restyles, and `modifiers` (a state or variant used only joined to another class, for
example `on`, `active`, `fill`, `wide`, `compact`, `fixed`, `contain`), which a product may join to its own class and never use alone. The template's web-baseline guard
reads this file from the installed package. The counts and the separation are held by SHT-001 and SHT-005.

`data-*` attributes. The gate reads these (counted from `gate/run.mjs` and `gate/inpage.mjs`): `data-control`, `data-case`, `data-case-workbench`, `data-plot`, `data-instrument`,
`data-rail`, `data-state`, `data-state-key`, `data-stale`, `data-drawn`, `data-ticks-repeat`, `data-readout`, `data-tab`, `data-panel`, `data-stage`, `data-chart`,
`data-text-overlap` (the value `allowed` lets a drawing cross labels on purpose), `data-refs`, `data-no-refs-reason`, `data-doc-references`, `data-doc-page`, `data-replay-only`,
`data-theme`, `data-brand`, `data-version`, `data-build` and `data-caos-gate-font` (set by the gate's wide-font pass). The components that declare them are named in the area requirement files.

Gate CLI options (`bin/caos-shell-gate.mjs`): a subject, `--serve <dir>` (with `--base-path`) or `--url <origin>`, and the required `--expect-brand`; `--routes`, `--workbench`,
`--sizes`, `--themes`, `--langs`, `--case-sample`, `--single-case`, `--idle-ms`, `--settle-ms`, `--text-floor`, `--instrument-min`, `--stage-fill-min`, `--stage-floor`,
`--wide-font-sizes`, `--no-wide-font`, `--out`. Exit 1 on any failure, 2 on misuse (SHG-002). The report is `gate-report.json` plus `shots/` and `index.html` (SHG-001).

The exact-pin rule (ADR-0078 section 5). A product pins the shell exactly, never with a caret, so the build it gated is the build it ships; it moves to a new release only when its owner names
it, bumps the pin, removes the overrides the release makes unnecessary, and passes the gate again ([`docs/08_releasing.md`](../08_releasing.md)).

## Components

One paragraph each; the rows are in the area file.

- Documents (SHD). `DocPage`, `DocSection`, `Cite`, `CitationsProvider`, `DocReferences`, `DocRefsScope`, `Equation`, `Figure`, `Callout`. A document route is a prose page whose sections declare
  their citations; the references are one block at the end of the scope that shows them, each once, in order of first appearance (0.11.0). Text blocks take the full column and captions keep a measure.
  See [`features/documents/requirements.md`](features/documents/requirements.md).
- Frame and navigation (SHF). `AppShell`, `STANDARD_ROUTES`, `FocusShell`, `WorkbenchShell`, `Tabs`, `SubTabs`, `TabGroups`, `SurfacePage`, `BREAKPOINTS`, `useUrlView`, `useOverflowFade` (internal).
  The frame, its three modes, the three route types and every row of links or tabs as one scrolling line. See [`features/frame-and-navigation/requirements.md`](features/frame-and-navigation/requirements.md).
- Workbench (SHW). `WorkbenchLayout`, `CaseWorkbench`, `CaseSelector`, the case model helpers, `VariantBar`, `LaneBadge`, `Stage`, `ViewsRow`, the state key, `PanelBoundary`, the viz loop. The App route of
  a product about cases: a rail beside an instrument of at most six views, all computed for one state key. See [`features/workbench/requirements.md`](features/workbench/requirements.md).
- Charts (SHC). `UPlotChart` (line, point, log and parity plots, marks and toned reference lines), `BarChart`, and the text kit. Drawings that size their own margins from measured text and declare themselves
  to the gate. See [`features/charts/requirements.md`](features/charts/requirements.md).
- Controls and readouts (SHK). `Knob`, `ChipGroup`, `Readout`, `Gauge`, `Verdict`, `PlotCard`. Registered controls and the values, zones and frames of the rail and the views. A filling card keeps a drawing floor under its note
  (0.11.0). See [`features/controls-and-readouts/requirements.md`](features/controls-and-readouts/requirements.md).
- Numbers and units (SHN). `formatNumber`, `formatTicks`, `useFormat`, `NBSP`, `NOT_AVAILABLE`, `SCIENTIFIC_BELOW`. Every number in the interface language; absent values never read `NaN`. See
  [`features/numbers-and-units/requirements.md`](features/numbers-and-units/requirements.md).
- Theme and language (SHT). Tokens (`SHELL_TOKENS`, `resolveToken`, `useThemeTokens`), the theme and language stores and toggles, `THEME_BOOT_SCRIPT`, the storage keys, `pick`. Both themes at WCAG AA, English by default. See
  [`features/theme-and-language/requirements.md`](features/theme-and-language/requirements.md).
- Architecture modal (SHA). `ArchitectureModal` and `validateArchitectureConfig`. The in-app "how it works" dialog (ADR-0058). See [`features/architecture-modal/requirements.md`](features/architecture-modal/requirements.md).
- The gate (SHG). `caos-shell-gate`, G1 to G15 and the ADR checks, and its self-test. See [`features/gate/requirements.md`](features/gate/requirements.md).

## Degradation and dependency states

How each component behaves without data, with partial data, in error and while loading. Rows marked "gap" have no test yet and are not requirement rows; they are listed in the delegation report.

| State | Behaviour | Requirement |
|---|---|---|
| Value absent or not finite (readout, knob, axis, number) | reads "not available" ("no disponible"), never `NaN` | SHN-001, SHK-002 |
| Tick absent in an axis | an empty label, the others keep one notation | SHN-006 |
| Bar chart value missing | documented as "not available" at the zero line, never a bar of zero; no test yet | gap (BarChart) |
| A view throws while rendering | `PanelBoundary` contains it, names the panel (`data-panel-error`) and shows that the view failed | SHW-014 |
| A view shows data for an earlier selection | overlaid as stale (`data-stale=1`) with a recomputing note | SHW-008 |
| A view is loading | declares `data-state="loading"` until ready; the gate waits for that, never for the network, and fails a state that never settles | SHW-029 |
| Stage without a size | children are not rendered; `data-drawn=0` | SHW-013 |
| Chart before it is drawn | declares `data-drawn=0` and shows a hint at rest | SHC-001 |
| Bar chart before its box has a width | draws nothing, `data-drawn=0` | SHC-025 |
| Chart with no data and no level | `rangeWithLevels` gives no range; with levels alone it takes them | SHC-014 |
| Log axis below the uPlot tick table | ticks at powers of ten, at most eight; draws without error | SHC-022, SHC-023 |
| Reference line outside a given `y.range` | not drawn; a mark outside the x range is not drawn | SHC-021 (marks); `yMarks` outside `y.range`: gap |
| Section cites nothing | must state a `noRefsReason`; no references block renders when every section gives one | SHD-001, SHD-006 |
| Citation without DOI or URL, duplicate id, unknown `Cite` | reported by name | SHD-016 |
| Equation without a caption | reported | SHD-015 |
| More than six peer tabs or groups | `Tabs` reports; `CaseWorkbench` refuses | SHF-017, SHW-004 |
| Architecture configuration invalid | `validateArchitectureConfig` lists each problem | SHA-003 |
| View named in `?view=` that the route lacks | ignored; the first view opens | SHF-022 |
| Case with no category or no kind | groups under the empty key; defaults to synthetic | SHW-017, SHW-015 |
| Pending lane (replay, offline) | the lane badge states it in the interface language | SHW-011 |
| Private product | no source link in the header or footer | SHF-008 |
| Hidden browser tab | the viz loop halts its frames and keeps its intent | SHW-026 |
| uPlot or Playwright not installed | both are optional peers: the main entry works without them; the `/chart` entry and the gate need them; no test exercises their absence | gap |

## Verification

Three layers plus the gate on products.

- Unit and contract tests, `npm test`: `node --import tsx --test "test/**/*.test.ts" "test/**/*.test.tsx"`. They render components to static markup, read the stylesheets (the layout, token and
  reserved-class contracts are held by parsing `styles.css`), and compute colour contrast. Seconds, no browser. Run in CI.
- Browser tests, `npm run test:browser`: `node --import tsx --test "e2e/**/*.test.ts"`. Playwright Chromium builds a small page per test with esbuild and measures boxes, pixels, focus and
  pointer behaviour. Run in CI.
- The gate self-test, `npm run test:gate` (G15): `test/gate-selftest.mjs` builds the fixture product `test/gate-fixture`, runs the gate on it clean in the full matrix, and once per plant in `PLANTS`
  (one per check and per distinct trap); the check that owns the plant must fail with its own message. A check without a plant is a check that can agree with a broken app. Run in CI.
- The gate on products: `caos-shell-gate` run by each product against its build and its deployed origin.

Rule of change: a change starts with its requirement row (the behaviour in EARS form, naming the test that will verify it), then a failing test (red, for a gate check a plant that must fail), then the code (green), then
the CHANGELOG entry and the version. `scripts/check_sdd.py` (CI) fails a row whose named test does not exist, so a row cannot be written for a test that was never made. The CI budget is cheap checks only,
trunk-only triggers (ADR-0074, `scripts/check_ci_budget.py`).

## Versions and adoption

Versions are `X.XX.XXX` in `VERSION` (ADR-0068) with the semver form in `package.json` (0.08.000 is 0.8.0); the top CHANGELOG entry and the tag `vX.XX.XXX` agree with them
(`scripts/check_version_coherence.py`). A fix is a patch; a new primitive, a new check or a changed default is a minor version. The package is published to npm; `.github/workflows/publish-npm.yml` publishes on a GitHub
release through Trusted Publishing, which has never published (the package page has no Trusted Publisher yet), so releases are published with the owner's direct-publish token until it is set
([`docs/08_releasing.md`](../08_releasing.md)). Products pin the shell exactly and adopt a release when their owner names it (ADR-0078 section 5): bump the pin, remove the overrides the CHANGELOG entry says are unnecessary,
and pass the gate again. The CHANGELOG at the time of writing ends at 0.10.000; the 0.11.0 work (#91, #94, #95, #96) is on `develop` and its entry is written at release.

## Risks

From the CHANGELOG's known shell defects and the docs; each has the requirement or gate that holds the mitigation.

| Risk | Mitigation |
|---|---|
| Reading-width caps left a wide page's text at the left (before 0.11.0) | text blocks take the full column; captions keep a measure: SHD-009, SHD-010 |
| A references row per section duplicated citations (before 0.11.0) | one block per scope, each citation once; the gate fails a block that is not last or missing: SHD-002, SHD-019, SHD-018 |
| A tab row that shrinks under a tall panel cuts its tabs (known defect 16) | `flex: none` on every row: SHF-018; G5 plant `shrunk-tabs` |
| `overflow-x: hidden` made body a scroll container and stopped sticky (known defect 26) | `overflow-x: clip`: SHF-015 |
| A vertical sub-tab list scrolling out of view (known defect 24) | sticky list, G12: SHF-019 |
| A log axis below uPlot's tick table threw and was never drawn (known defect 31) | `logDecades`, `LOG_TABLE_FLOOR`: SHC-022, SHC-023 |
| A magnitude below 1e-4 rendered as a row of zeros (known defect 15); 1e-4 as a percent of 1e-6 fell a hair under it (known defect 32); a year read 2,021 (known defect 30) | SHN-002, SHN-004, SHN-005 |
| Repeated tick labels on an integer axis (known defect 21) | SHC-003, G6 plant `repeat-ticks` |
| Fixed margins cut labels in wider Linux fonts and in Spanish (Fragmenta 0.05.000) | measured text, wide-font pass: SHC-024, SHC-027 |
| A filling card's note starved its drawing (0.11.0) | note capped at 35 percent, G6 stage floor: SHK-009, SHK-012, SHG-008 |
| Faint text under WCAG AA in the light and dark themes (0.7) | SHT-003, G13 plant `low-contrast` |
| Lucide 1.x removed an export the shell used, breaking consumer builds (0.06.006) | SHT-006 |
| A gate check that can agree with a broken app | one plant per check: SHG-007; the count in `docs/07_gate.md` is kept equal to `PLANTS` (37 at 0.11.0) |
| A behaviour documented but never tested (see the gaps list in the report) | the gaps are not requirement rows; each gets a row when its test exists, tests first |
| The npm Trusted Publisher is not configured and direct-publish tokens stop in January 2027 ([`docs/08_releasing.md`](../08_releasing.md)) | the owner's switch on the package page; not verifiable from this repository |

## ADR fit

Each ADR below is read from the private management repository (`conventions/architecture/`); what is bound in the shell is stated from the shell's own sources.

| ADR | Subject | What it binds in the shell, and where |
|---|---|---|
| ADR-0011 | English-default i18n | English is the default language, with no auto-detection of `navigator.language` (`src/lib/lang.ts`); `pick` falls back to English (`src/lib/text.ts`); `THEME_BOOT_SCRIPT` sets `<html lang>` (SHT-007, SHT-008) |
| ADR-0012 | Light and dark theming | both themes defined by tokens on `data-theme`, set before the first frame, persisted under the storage keys (`src/lib/theme.ts`, `src/lib/keys.ts`; SHT-003, SHT-007) |
| ADR-0016 | Web-app shell and content depth | the frame, the footer provenance and honesty, and the App route owned by the shell (ADR-0016 section 9); SHF-001 to SHF-011, SHW-001 to SHW-005 |
| ADR-0017 | The frontend bar (quantified, enforceable) | the document structure: equation captions, references once at the end, bibliography off the section; SHD-001 to SHD-008, SHD-015 to SHD-019; gate check ADR-0017.4 (SHG-009) |
| ADR-0058 | In-app architecture modal | `ArchitectureModal` and its validation of five tabs, inline SVG, tokens and both languages; SHA-001 to SHA-004 |
| ADR-0065 | Repository community standards and honest badges | the repository's health files (`LICENSE`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`) and README badges; no requirement row binds it, it is a repository rule |
| ADR-0067 | No em-dash, no emoji | `scripts/check_content_standards.py` in CI; the new documents and requirement files carry none |
| ADR-0068 | Versioning and release discipline | display version `X.XX.XXX`, `scripts/check_version_coherence.py`; `AppShell` reports a version not in that form (`src/shell/AppShell.tsx`); SHF-010 |
| ADR-0071 | Sized containers, no incidental scrolling, bounded navigation depth | the route as the viewport, one line per row, at most six peers, rail sections, an instrument of at least half the viewport; SHF-002 to SHF-005, SHF-016 to SHF-021, SHW-002, SHW-004, SHC-026; gate G5, G6 |
| ADR-0074 | CI and CD budget, no training | `scripts/check_ci_budget.py` and the trunk-only, timeout-per-job workflow `.github/workflows/ci.yml` |
| ADR-0075 | Software design document before development | this document and the nine requirement files; every row names its test; `scripts/check_sdd.py` in CI |
| ADR-0078 | Rules live in the base | the shell owns every pixel rule; products pin exactly and adopt per section 5; a gap is fixed here first (section 3); the reserved-class list and the gate carry the rules to products |

UNVERIFIED: ADR-0065 is named in the brief's ADR list, but nothing in the shell's code or tests names it; the row above reads the ADR's title in the management repository and states the repository files it concerns, not a verified binding.
