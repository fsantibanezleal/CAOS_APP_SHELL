import type { ShellRoute } from './AppShell';

/** The route every product lands on: the Introduction, whose executive view opens first (shell 0.13.0). */
export const LANDING_ROUTE = '/introduction';
/** The route of the App (the tool); it was the root before 0.13.0 (the `Landing` component forwards old links). */
export const APP_ROUTE = '/app';

/**
 * The six routes every CAOS product carries, ALWAYS in this order (Felipe, 2026-10-13): App, Introduction,
 * Methodology, Implementation, Experiments, Benchmark. The App stays the leftmost tab; the product lands on the
 * Introduction (its executive view first) through `Landing`, which never changes the order (0.13.0 had moved the
 * Introduction first; 0.13.1 restores the App). One definition, so the header, the router and the gate read the same
 * list and no product retypes it.
 */
export const STANDARD_ROUTES: ShellRoute[] = [
  { path: APP_ROUTE, en: 'App', es: 'App' },
  { path: LANDING_ROUTE, en: 'Introduction', es: 'Introducción' },
  { path: '/methodology', en: 'Methodology', es: 'Metodología' },
  { path: '/implementation', en: 'Implementation', es: 'Implementación' },
  { path: '/experiments', en: 'Experiments', es: 'Experimentos' },
  { path: '/benchmark', en: 'Benchmark', es: 'Benchmark' },
];
