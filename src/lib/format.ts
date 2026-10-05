import { type Lang, useShellLang } from './lang';

export interface FormatOptions {
  /** Significant digits for a value below 10^(digits-1) (default 4); a larger value shows every integer digit, so a
   * count is never rounded (27345 people, not 27,350). A magnitude below 1e-4 is written in scientific notation with
   * these significant digits (6.53E-13). Ignored when `decimals` is set. */
  digits?: number;
  /** Fixed number of decimals. The caller's explicit choice: a value below the last decimal reads as zero. */
  decimals?: number;
  /** Render a fraction as a percentage (0.123 -> 12.3 %). */
  percent?: boolean;
}

const LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-CL' };

/** Below this magnitude a value is written in scientific notation. In fixed notation a p-value of 1e-200 is two
 * hundred zeros: one table cell 12,790 px wide (known shell defect 15, CAOS_Contraste, 2026-10-05). */
export const SCIENTIFIC_BELOW = 1e-4;

/** "Not available" in the interface language: what an absent or non-finite value renders as. */
export const NOT_AVAILABLE: Record<Lang, string> = { en: 'not available', es: 'no disponible' };

/**
 * A number in the interface language: a decimal point in English and a decimal comma in Spanish
 * (`conventions/languages.md`), significant digits by default, scientific notation below 1e-4. `null`, `undefined` and non-finite values render as
 * "not available", never as `NaN` (failure classes 5 and 23 of the 2026-10-04 history).
 */
export function formatNumber(value: number | null | undefined, lang: Lang, opts: FormatOptions = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE[lang];
  const v = opts.percent ? value * 100 : value;
  const digits = opts.digits ?? 4;
  const nf =
    opts.decimals !== undefined
      ? new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: opts.decimals, maximumFractionDigits: opts.decimals })
      : v !== 0 && Math.abs(v) < SCIENTIFIC_BELOW
        ? new Intl.NumberFormat(LOCALE[lang], { notation: 'scientific', maximumSignificantDigits: digits })
        : Math.abs(v) >= 10 ** (digits - 1)
          ? new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0 })
          : new Intl.NumberFormat(LOCALE[lang], { maximumSignificantDigits: digits });
  return opts.percent ? `${nf.format(v)} %` : nf.format(v);
}

/** `formatNumber` bound to the current shell language. */
export function useFormat(): (value: number | null | undefined, opts?: FormatOptions) => string {
  const lang = useShellLang();
  return (value, opts) => formatNumber(value, lang, opts);
}
