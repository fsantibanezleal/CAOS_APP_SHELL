import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';

export interface StatProps {
  /** The number as written, for example `42` or `3.5`. */
  value: BiText;
  /** Its unit, for example `% of downtime` (a statement without a unit is not quantified). */
  unit: BiText;
  /** Where the number comes from (a document, a measurement, a dataset): shown beside it and declared as `data-stat-source`. */
  source: BiText;
}

/**
 * A quantified statement (ADR-0017 section 2.1, the executive view): a value, its unit and its source, rendered as
 * `data-stat` so the gate can count the claims of value that carry a number. A claim without all three is not a stat.
 */
export function Stat({ value, unit, source }: StatProps) {
  const lang = useShellLang();
  const src = pick(source, lang);
  return (
    <span className="caos-stat" data-stat="" data-stat-unit={pick(unit, lang)} data-stat-source={src}>
      <strong className="caos-stat-value">{pick(value, lang)}</strong> <span className="caos-stat-unit">{pick(unit, lang)}</span>{' '}
      <span className="caos-stat-source">({src})</span>
    </span>
  );
}
