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
npm i react react-dom react-router-dom lucide-react katex zustand
```

## Use

```tsx
// main.tsx
import { applyTheme, readTheme } from "@fasl-work/caos-app-shell";
import "@fasl-work/caos-app-shell/styles.css";
applyTheme(readTheme()); // (an inline script in index.html should also set data-theme pre-paint)

// router / app
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell, type ShellConfig } from "@fasl-work/caos-app-shell";

const config: ShellConfig = {
  product: { name: "RotorVitals" },
  routes: [
    { path: "/", en: "App", es: "App" },
    { path: "/introduction", en: "Introduction", es: "Introducción" },
    { path: "/methodology", en: "Methodology", es: "Metodología" },
    { path: "/implementation", en: "Implementation", es: "Implementación" },
    { path: "/experiments", en: "Experiments", es: "Experimentos" },
    { path: "/benchmark", en: "Benchmark", es: "Benchmark" },
  ],
  links: { github: "https://github.com/fsantibanezleal/CAOS_RotorVitals" }, // personal/portfolio default in
  version: "0.01.000",
};

<BrowserRouter>
  <AppShell config={config}>
    <Routes>{/* /  = the tool (landing); the rest are deep pages */}</Routes>
  </AppShell>
</BrowserRouter>
```

- **Land on the tool:** make `/` your interactive tool; Introduction/Methodology/etc. are separate routes.
- **Product metadata:** `footer.attribution` accepts bilingual text or `false` when a product excludes personal attribution. `footer.license` accepts the product's bilingual license label. Omitting these keeps existing consumer defaults. A product does not inherit the shell's MIT license.
- **Hub case (Faena):** pass `routes: []` (or one) → the nav is hidden, header/footer identical.
- **Deep pages:** compose with `Tabs`, `SubTabs`, `Equation`/`InlineMath`, `Callout`, `Figure`, and
  `CitationsProvider` + `Cite`/`Refs`/`ReferenceList`. Read the current language with `useShellLang()`.
- **Case + source picking:** use `CaseSelector` for the interactive tool's source/case selection
  (labelled groups, `Synthetic | Real | Uploaded` source control, locked-knobs explanation, divergence
  badge, `?case=` deep-linking).
- **The App route (0.7.0):** compose `WorkbenchLayout` (rail + instrument on the full viewport) with
  `CaseSelector` and `CaseWorkbench` (variant bar + at most six question groups, then the variant comparison
  and the context). Put live values in `Readout`/`Gauge`/`Verdict` and every chart in a `PlotCard`. Set
  `contain: true` in `ShellConfig` so every route is the viewport.
- **Documentation routes (0.7.0):** `DocPage` + `DocSection` (each section ends in its own `Refs`).
- **Measure it (0.7.0):** `npx caos-shell-gate --url http://127.0.0.1:4173` against the built app (needs
  `playwright`); it exits non-zero on any ADR-0071 or ADR-0017 failure and writes screenshots and a JSON report.
- **Animated views:** drive every canvas/3D loop through `usePausedViz` (default paused, run-once,
  halt on a hidden tab), never call `requestAnimationFrame` directly.

## Exports

`AppShell`, `WorkbenchShell`, `ThemeToggle`, `LanguageToggle`, `useThemeStore`, `applyTheme`, `readTheme`, `useLangStore`,
`useShellLang`, `usePausedViz`, `createVizLoop`, `CaseSelector` (+ `caseModel` helpers), `Tabs`, `SubTabs`,
`Callout`, `Equation`, `InlineMath`, `Figure`, `CitationsProvider`, `Cite`, `Refs`, `ReferenceList`, `DocPage`,
`DocSection`, `WorkbenchLayout`, `CaseWorkbench`, `VariantBar`, `LaneBadge`, `Readout`, `Gauge`, `Verdict`,
`PlotCard`, `pick`, plus the `@fasl-work/caos-app-shell/styles.css` design system and the `caos-shell-gate` bin.

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
