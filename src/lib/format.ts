import { type Lang, useShellLang } from './lang';

export interface FormatOptions {
  /** Significant digits (default 4). Ignored when `decimals` is set. */
  digits?: number;
  /** Fixed number of decimals. */
  decimals?: number;
  /** Render a fraction as a percentage (0.123 -> 12.3 %). */
  percent?: boolean;
}

const LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-CL' };

/** "Not available" in the interface language: what an absent or non-finite value renders as. */
export const NOT_AVAILABLE: Record<Lang, string> = { en: 'not available', es: 'no disponible' };

/**
 * A number in the interface language: a decimal point in English and a decimal comma in Spanish
 * (`conventions/languages.md`), significant digits by default. `null`, `undefined` and non-finite values render as
 * "not available", never as `NaN` (failure classes 5 and 23 of the 2026-10-04 history).
 */
export function formatNumber(value: number | null | undefined, lang: Lang, opts: FormatOptions = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE[lang];
  const v = opts.percent ? value * 100 : value;
  const nf =
    opts.decimals !== undefined
      ? new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: opts.decimals, maximumFractionDigits: opts.decimals })
      : new Intl.NumberFormat(LOCALE[lang], { maximumSignificantDigits: opts.digits ?? 4 });
  return opts.percent ? `${nf.format(v)} %` : nf.format(v);
}

/** `formatNumber` bound to the current shell language. */
export function useFormat(): (value: number | null | undefined, opts?: FormatOptions) => string {
  const lang = useShellLang();
  return (value, opts) => formatNumber(value, lang, opts);
}
