// @fasl-work/caos-app-shell — public barrel.
// The shared shell + content primitives + design system for the CAOS / Faena apps (ADR-0016).
// Import the CSS once per app:  import "@fasl-work/caos-app-shell/styles.css";

export { AppShell } from './shell/AppShell';
export type { ShellConfig, ShellRoute } from './shell/AppShell';
export { ArchitectureModal } from './shell/ArchitectureModal';
export type { ArchitectureConfig, ArchTab } from './shell/ArchitectureModal';
export { ThemeToggle } from './shell/ThemeToggle';
export { LanguageToggle } from './shell/LanguageToggle';

export { useThemeStore, applyTheme, readTheme } from './lib/theme';
export type { Theme } from './lib/theme';
export { useLangStore, useShellLang } from './lib/lang';
export type { Lang } from './lib/lang';

export { Tabs } from './content/Tabs';
export type { TabDef } from './content/Tabs';
export { SubTabs } from './content/SubTabs';
export type { SubTabDef } from './content/SubTabs';
export { Callout } from './content/Callout';
export { Equation, InlineMath } from './content/Equation';
export { Figure } from './content/Figure';
export { CitationsProvider, Cite, Refs, ReferenceList } from './content/Cite';
export type { Citation } from './content/Cite';
