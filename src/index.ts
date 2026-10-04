// @fasl-work/caos-app-shell, public barrel.
// The shared shell + content primitives + design system for the CAOS / Faena apps (ADR-0016).
// Import the CSS once per app:  import "@fasl-work/caos-app-shell/styles.css";

export { AppShell } from './shell/AppShell';
export type { ShellConfig, ShellRoute } from './shell/AppShell';
export { STANDARD_ROUTES } from './shell/routes';
export { WorkbenchShell } from './shell/WorkbenchShell';
export { FocusShell } from './shell/FocusShell';
export type { FocusShellProps } from './shell/FocusShell';
export type { WorkbenchRoute, WorkbenchShellProps } from './shell/WorkbenchShell';
export { ArchitectureModal } from './shell/ArchitectureModal';
export type { ArchitectureConfig, ArchTab } from './shell/ArchitectureModal';
export { ThemeToggle } from './shell/ThemeToggle';
export { LanguageToggle } from './shell/LanguageToggle';

export { useThemeStore, applyTheme, readTheme, THEME_BOOT_SCRIPT } from './lib/theme';
export type { Theme } from './lib/theme';
export { useLangStore, useShellLang } from './lib/lang';
export type { Lang } from './lib/lang';

export { usePausedViz } from './lib/usePausedViz';
export type { PausedVizController, UsePausedVizOptions } from './lib/usePausedViz';
export { createVizLoop } from './lib/vizLoop';
export type { VizFrame, VizLoop, VizLoopOptions, VizLoopDeps } from './lib/vizLoop';

export { CaseSelector } from './case/CaseSelector';
export type { CaseSelectorProps, CaseSelectorText } from './case/CaseSelector';
export {
  caseKind,
  casesInSource,
  caseTooltip,
  groupByCategory,
  readCaseParam,
  sourcesPresent,
  withCaseParam,
} from './case/caseModel';
export type { CaseDef, CaseGroup, CaseKind } from './case/caseModel';

export { Tabs } from './content/Tabs';
export type { TabDef } from './content/Tabs';
export { SubTabs } from './content/SubTabs';
export type { SubTabDef } from './content/SubTabs';
export { Callout } from './content/Callout';
export { Equation, InlineMath } from './content/Equation';
export { Figure } from './content/Figure';
export { CitationsProvider, Cite, Refs, ReferenceList } from './content/Cite';
export type { Citation } from './content/Cite';
export { DocPage, DocSection } from './content/DocPage';
export type { DocSectionProps } from './content/DocPage';

// The App route of a product (ADR-0016 §9 and ADR-0071 as amended 2026-10-04): the shell owns the workbench.
export { WorkbenchLayout } from './workbench/WorkbenchLayout';
export type { RailSection, WorkbenchLayoutProps } from './workbench/WorkbenchLayout';
export { CaseWorkbench, MAX_WORKBENCH_GROUPS } from './workbench/CaseWorkbench';
export type { CaseWorkbenchProps, WorkbenchGroup } from './workbench/CaseWorkbench';
export { VariantBar } from './workbench/VariantBar';
export type { VariantBarProps, VariantDef } from './workbench/VariantBar';
export { LaneBadge } from './workbench/LaneBadge';
export type { Lane } from './workbench/LaneBadge';
export { Gauge, PlotCard, Readout, Verdict } from './workbench/Readouts';
export type { GaugeProps, GaugeZone, ReadoutItem, Tone } from './workbench/Readouts';
export { pick } from './lib/text';
export type { BiText } from './lib/text';
