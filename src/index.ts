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
export { validateArchitectureConfig } from './shell/ArchitectureModal';
export type { ArchitectureConfig, ArchTab } from './shell/ArchitectureModal';
export { ThemeToggle } from './shell/ThemeToggle';
export { LanguageToggle } from './shell/LanguageToggle';

export { useThemeStore, applyTheme, readTheme, THEME_BOOT_SCRIPT } from './lib/theme';
export { THEME_STORAGE_KEY, LANG_STORAGE_KEY } from './lib/keys';
export { formatNumber, formatTicks, useFormat, NBSP, NOT_AVAILABLE, SCIENTIFIC_BELOW } from './lib/format';
export type { FormatOptions } from './lib/format';
export { SHELL_TOKENS, resolveToken, useThemeTokens } from './lib/tokens';
export type { ShellColorToken, ShellToken } from './lib/tokens';
export { PanelBoundary } from './lib/PanelBoundary';
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
export { MAX_PEER_TABS } from './content/Tabs';
export type { TabsProps } from './content/Tabs';
export { TabGroups } from './content/TabGroups';
export type { TabGroupDef, TabGroupsProps } from './content/TabGroups';
export type { TabDef } from './content/Tabs';
export { SubTabs } from './content/SubTabs';
export type { SubTabDef } from './content/SubTabs';
export type { SubTabsProps } from './content/SubTabs';
export { Callout } from './content/Callout';
export { Equation, InlineMath } from './content/Equation';
export { Figure } from './content/Figure';
export { CitationsProvider, Cite, Refs, ReferenceList } from './content/Cite';
export type { Citation } from './content/Cite';
export { DocPage, DocSection } from './content/DocPage';
export type { DocSectionProps } from './content/DocPage';
// The surface route type (0.8.0): a tab App that fills the viewport; its open view is held in the URL.
export { SurfacePage } from './content/SurfacePage';
export type { SurfacePageProps } from './content/SurfacePage';
export { useUrlView, viewParamOf, replaceQueryParam } from './lib/urlView';
export { BREAKPOINTS } from './lib/breakpoints';

// Drawings without uPlot (0.8.0): the categorical chart and the text kit every drawing measures its labels with.
export { BarChart } from './chart/BarChart';
export type { BarChartProps, BarDatum } from './chart/BarChart';
export { fitLabel, fontFamily, niceStep, niceTicks, textWidth, widestLabel } from './chart/text';
export type { FittedLabel } from './chart/text';

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
export type { PlotCardProps, ReadoutProps, VerdictProps } from './workbench/Readouts';
export { ChipGroup, Knob } from './workbench/Controls';
export type { ChipGroupProps, ChipOption, KnobProps } from './workbench/Controls';
export { Stage, useStageSize } from './workbench/Stage';
export { ViewsRow } from './workbench/ViewsRow';
export type { ViewsRowProps } from './workbench/ViewsRow';
export type { StageSize } from './workbench/Stage';
export { isStale, makeStateKey, useWorkbenchState, WorkbenchStateContext } from './workbench/state';
export type { Provenance, WorkbenchState } from './workbench/state';
export type { GaugeProps, GaugeZone, ReadoutItem, Tone } from './workbench/Readouts';
export { pick } from './lib/text';
export type { BiText } from './lib/text';
