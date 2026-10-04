import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import { type Lane, LaneBadge } from './LaneBadge';

/** One configured regime of a case: a full parameter vector, never a cosmetic label (ADR-0016 §9). */
export interface VariantDef {
  id: string;
  label: BiText;
  /** One line: what this regime shows. */
  note?: BiText;
  /** The lane of this variant's result, when it differs from the bar's. */
  lane?: Lane;
  disabled?: boolean;
}

export interface VariantBarProps {
  variants: VariantDef[];
  activeId: string;
  onSelect: (id: string) => void;
  title?: BiText;
  lane?: Lane;
}

/** The regimes of the selected case on ONE scrollable row (ADR-0071 rule 4), the active regime's lane, and the
 * one-line note of what it shows. Selecting a regime must change every view of the case. */
export function VariantBar({ variants, activeId, onSelect, title, lane }: VariantBarProps) {
  const lang = useShellLang();
  const active = variants.find((v) => v.id === activeId) ?? variants[0];
  const shownLane = active?.lane ?? lane;
  return (
    <div className="caos-variant-bar" data-variant-bar="" data-variant-count={variants.length}>
      <div className="caos-variant-head">
        <span className="caos-variant-title">
          {pick(title ?? { en: 'Variants', es: 'Variantes' }, lang)} ({variants.length})
        </span>
        {shownLane && <LaneBadge lane={shownLane} />}
      </div>
      <div className="caos-chip-row" role="radiogroup" aria-label={pick(title ?? { en: 'Variants', es: 'Variantes' }, lang)}>
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={v.id === active?.id}
            disabled={v.disabled}
            className={v.id === active?.id ? 'chip on' : 'chip'}
            onClick={() => onSelect(v.id)}
          >
            {pick(v.label, lang)}
          </button>
        ))}
      </div>
      {active?.note && <p className="caos-variant-note">{pick(active.note, lang)}</p>}
    </div>
  );
}
