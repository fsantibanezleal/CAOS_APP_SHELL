import { useMemo } from 'react';
import { useThemeStore } from './theme';

/**
 * The colour and font tokens `styles.css` defines for both themes. The architecture-modal validation and the
 * template's web-baseline guard check every `var(--x)` a product names against this list; a token that is not
 * defined renders as nothing, silently (failure class 25 of the 2026-10-04 history). A unit test keeps this list
 * equal to the stylesheet.
 */
export const SHELL_TOKENS = [
  '--color-bg',
  '--color-surface',
  '--color-surface-2',
  '--color-border',
  '--color-fg',
  '--color-fg-subtle',
  '--color-fg-faint',
  '--color-accent',
  '--color-accent-fg',
  '--color-accent-soft',
  '--color-accent-2',
  '--color-magenta',
  '--color-good',
  '--color-warn',
  '--color-bad',
  '--color-shadow',
  '--font-sans',
  '--font-mono',
  '--maxw',
  '--maxw-wide',
] as const;

export type ShellToken = (typeof SHELL_TOKENS)[number];

/** The computed value of a token on the document, or `fallback` outside a browser. */
export function resolveToken(token: string, fallback = ''): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return v || fallback;
}

/**
 * The colour tokens resolved to concrete values for the active theme, recomputed when the theme changes. Canvas
 * and WebGL renderers cannot read CSS variables, so they take these (failure classes 7 and 18: charts drawn in
 * dark-theme colours on a light page).
 */
export function useThemeTokens(): Record<ShellToken, string> {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => {
    const out = {} as Record<ShellToken, string>;
    for (const t of SHELL_TOKENS) out[t] = resolveToken(t);
    return out;
    // the theme is the dependency: the stylesheet values change with data-theme
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}
