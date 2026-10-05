import type { ShellRoute } from './AppShell';

/**
 * The six routes every CAOS product carries, in this order (ADR-0016 s3, ADR-0069 s7, the product quality bar):
 * the App (the tool, landing) and the five documentation routes. One definition, so the header, the router and the
 * gate read the same list and no product retypes it.
 */
export const STANDARD_ROUTES: ShellRoute[] = [
  { path: '/', en: 'App', es: 'App' },
  { path: '/introduction', en: 'Introduction', es: 'Introducción' },
  { path: '/methodology', en: 'Methodology', es: 'Metodología' },
  { path: '/implementation', en: 'Implementation', es: 'Implementación' },
  { path: '/experiments', en: 'Experiments', es: 'Experimentos' },
  { path: '/benchmark', en: 'Benchmark', es: 'Benchmark' },
];
