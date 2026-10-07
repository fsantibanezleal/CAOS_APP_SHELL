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
  /** `scientific` writes every non-zero value in scientific notation with `digits` significant digits; the default
   * chooses by magnitude. An axis uses it so all its ticks share one notation (`formatTicks`). */
  notation?: 'auto' | 'scientific';
  /** `false` writes the integer part without a group separator, in both languages: a calendar year on an axis, in a
   * readout or in a table reads 2021, never 2,021 or 2.021 (known shell defect 30). Default true. */
  grouping?: boolean;
}

const LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-CL' };

/** The no-break space (U+00A0) that joins a value to its unit or sign. */
export const NBSP = ' ';

/** Below this magnitude a value is written in scientific notation. In fixed notation a p-value of 1e-200 is two
 * hundred zeros: one table cell 12,790 px wide (known shell defect 15, CAOS_Contraste, 2026-10-05). */
export const SCIENTIFIC_BELOW = 1e-4;

/** "Not available" in the interface language: what an absent or non-finite value renders as. */
export const NOT_AVAILABLE: Record<Lang, string> = { en: 'not available', es: 'no disponible' };

/**
 * A number in the interface language: a decimal point in English and a decimal comma in Spanish
 * (`conventions/languages.md`), significant digits by default, scientific notation below 1e-4. `null`, `undefined`
 * and non-finite values render as "not available", never as `NaN` (failure classes 5 and 23 of the 2026-10-04
 * history). A percent is joined to its sign by a no-break space.
 */
export function formatNumber(value: number | null | undefined, lang: Lang, opts: FormatOptions = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE[lang];
  const v = opts.percent ? value * 100 : value;
  const digits = opts.digits ?? 4;
  const scientific = v !== 0 && (opts.notation === 'scientific' || Math.abs(v) < SCIENTIFIC_BELOW);
  const grouping = opts.grouping === false ? { useGrouping: false } : {};
  const nf =
    opts.decimals !== undefined
      ? new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: opts.decimals, maximumFractionDigits: opts.decimals, ...grouping })
      : scientific
        ? new Intl.NumberFormat(LOCALE[lang], { notation: 'scientific', maximumSignificantDigits: digits })
        : Math.abs(v) >= 10 ** (digits - 1)
          ? new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0, ...grouping })
          : new Intl.NumberFormat(LOCALE[lang], { maximumSignificantDigits: digits, ...grouping });
  // A no-break space joins the number and its sign, so a label that wraps never leaves "%" alone on a line (known
  // shell defect 22).
  return opts.percent ? `${nf.format(v)}${NBSP}%` : nf.format(v);
}

/**
 * The labels of one axis's ticks, in ONE notation: when any non-zero tick is below 1e-4 (and the axis has no fixed
 * decimals), every non-zero tick is written in scientific notation; deciding tick by tick wrote 0.0001 beside 7.5E-5
 * on one axis (known shell defect 19, CAOS_Contraste, 2026-10-05). `null` ticks are blank.
 */
export function formatTicks(values: readonly (number | null | undefined)[], lang: Lang, opts: FormatOptions = {}): string[] {
  let o = opts;
  if (opts.decimals === undefined && opts.notation === undefined) {
    const scale = opts.percent ? 100 : 1;
    const small = values.some((v) => v !== null && v !== undefined && Number.isFinite(v) && v !== 0 && Math.abs(v * scale) < SCIENTIFIC_BELOW);
    if (small) o = { ...opts, notation: 'scientific' };
  }
  return values.map((v) => (v === null || v === undefined ? '' : formatNumber(v, lang, o)));
}

/** `formatNumber` bound to the current shell language. */
export function useFormat(): (value: number | null | undefined, opts?: FormatOptions) => string {
  const lang = useShellLang();
  return (value, opts) => formatNumber(value, lang, opts);
}
