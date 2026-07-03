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
- **Hub case (Faena):** pass `routes: []` (or one) → the nav is hidden, header/footer identical.
- **Deep pages:** compose with `Tabs`, `SubTabs`, `Equation`/`InlineMath`, `Callout`, `Figure`, and
  `CitationsProvider` + `Cite`/`Refs`/`ReferenceList`. Read the current language with `useShellLang()`.

## Exports

`AppShell`, `ThemeToggle`, `LanguageToggle`, `useThemeStore`, `applyTheme`, `readTheme`, `useLangStore`,
`useShellLang`, `Tabs`, `SubTabs`, `Callout`, `Equation`, `InlineMath`, `Figure`, `CitationsProvider`,
`Cite`, `Refs`, `ReferenceList`, plus the `@fasl-work/caos-app-shell/styles.css` design system.

MIT · part of the Faena mining-analytics hub.
