import { useRef } from 'react';
import { useShellLang } from '../lib/lang';
import { SelectDisplay } from '../lib/SelectDisplay';
import { useOverflowFade } from '../lib/overflow';
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
  /** How the one-of-N choice is drawn. 'chips' (the default) is one scrollable row of chips; 'select' is one native select with the shell's display
   * (the case select's: the active variant's full label shown whole, wrapping inside the rail), for a long or long-named list (ADR-0071 rule 7: 14
   * methods named by their names drew a 605 px column of chips in a 713 px rail). The title with its count, the lane badge, the active variant's
   * note, `data-variant-bar`, `data-variant-count` and `data-control="variant"` are the same in both. */
  layout?: 'chips' | 'select';
}

/** The regimes of the selected case on ONE scrollable row (ADR-0071 rule 4) or, with `layout: 'select'`, in one select (rule 7), the active
 * regime's lane, and the one-line note of what it shows. Selecting a regime must change every view of the case. */
export function VariantBar({ variants, activeId, onSelect, title, lane, layout = 'chips' }: VariantBarProps) {
  const lang = useShellLang();
  const active = variants.find((v) => v.id === activeId) ?? variants[0];
  const shownLane = active?.lane ?? lane;
  const rowRef = useRef<HTMLDivElement | null>(null);
  useOverflowFade(rowRef, '.chip.on', [active?.id, variants.length, lang]);
  const name = pick(title ?? { en: 'Variants', es: 'Variantes' }, lang);
  return (
    <div className="caos-variant-bar" data-variant-bar="" data-variant-count={variants.length}>
      <div className="caos-variant-head">
        <span className="caos-variant-title">
          {name} ({variants.length})
        </span>
        {shownLane && <LaneBadge lane={shownLane} />}
      </div>
      {layout === 'select' ? (
        <SelectDisplay names={variants.map((v) => pick(v.label, lang))} selectedName={active ? pick(active.label, lang) : ''}>
          <select data-control="variant" className="select cs-select cs-select-native" aria-label={name} value={active?.id ?? ''} onChange={(e) => onSelect(e.target.value)}>
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.disabled}>
                {pick(v.label, lang)}
              </option>
            ))}
          </select>
        </SelectDisplay>
      ) : (
        <div className="caos-chip-row" role="radiogroup" aria-label={name} data-control="variant" ref={rowRef}>
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
      )}
      {active?.note && <p className="caos-variant-note">{pick(active.note, lang)}</p>}
    </div>
  );
}
