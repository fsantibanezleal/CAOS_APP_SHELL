import type { ShellRoute } from './AppShell';

/** The route every product lands on: the Introduction, whose executive view opens first (shell 0.13.0). */
export const LANDING_ROUTE = '/introduction';
/** The route of the App (the tool); it was the root before 0.13.0 (the `Landing` component forwards old links). */
export const APP_ROUTE = '/app';

/**
 * The six routes every CAOS product carries, in this order (ADR-0016 s3, ADR-0069 s7, the product quality bar):
 * the Introduction (the landing, executive view first), the App (the tool) and the four other documentation routes. One
 * definition, so the header, the router and the gate read the same list and no product retypes it.
 */
export const STANDARD_ROUTES: ShellRoute[] = [
  { path: LANDING_ROUTE, en: 'Introduction', es: 'Introducción' },
  { path: APP_ROUTE, en: 'App', es: 'App' },
  { path: '/methodology', en: 'Methodology', es: 'Metodología' },
  { path: '/implementation', en: 'Implementation', es: 'Implementación' },
  { path: '/experiments', en: 'Experiments', es: 'Experimentos' },
  { path: '/benchmark', en: 'Benchmark', es: 'Benchmark' },
];
