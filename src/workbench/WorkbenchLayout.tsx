import { useId, useState, type ReactNode } from 'react';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';

/** One section of the control rail. A rail whose content does not fit is SPLIT into sections, one shown at a
 * time, never scrolled (ADR-0071 rule 6: a panel must show its own controls). */
export interface RailSection {
  id: string;
  label: BiText;
  content: ReactNode;
}

export interface WorkbenchLayoutProps {
  /** The control rail: case and variant pickers, parameters, the live readout. Either one node or sections. */
  rail: ReactNode | RailSection[];
  /** Shown above the rail (and above its sections): the case and variant pickers, which every section shares. */
  railHead?: ReactNode;
  /** The instrument: the views of the selected case. It takes the rest of the viewport (ADR-0071 rules 2, 8). */
  children: ReactNode;
  /** Accessible name of the rail. */
  railLabel?: BiText;
  className?: string;
}

function isSections(rail: ReactNode | RailSection[]): rail is RailSection[] {
  return Array.isArray(rail) && rail.every((s) => typeof s === 'object' && s !== null && 'id' in s && 'content' in s);
}

/**
 * The App route of a CAOS product: a sized control rail beside the instrument, on the full viewport.
 *
 * Renders `.page-body.wide.caos-wb`: no reading-width cap (a workbench is not prose, ADR-0071 rule 2),
 * `min-width: 0` down the tree so no row pushes the page wider than the screen (rule 3), a rail with an
 * explicit width that never scrolls (rule 6), and an instrument marked `data-instrument` so the measured gate
 * can check that it covers at least half of the viewport (rule 8). Pair with `ShellConfig.contain`.
 */
export function WorkbenchLayout({ rail, railHead, children, railLabel, className }: WorkbenchLayoutProps) {
  const lang = useShellLang();
  const sections = isSections(rail) ? rail : null;
  const [active, setActive] = useState(sections?.[0]?.id ?? '');
  const baseId = useId();
  const label = pick(railLabel ?? { en: 'Controls', es: 'Controles' }, lang);
  const current = sections?.find((s) => s.id === active) ?? sections?.[0];

  return (
    <div className={['page-body', 'wide', 'caos-wb', className].filter(Boolean).join(' ')} data-workbench="">
      <aside className="caos-wb-rail" aria-label={label} data-rail="">
        {railHead && <div className="caos-wb-rail-head">{railHead}</div>}
        {sections ? (
          <>
            <div className="caos-wb-rail-sections" role="tablist" aria-label={label}>
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  id={`${baseId}-rs-${s.id}`}
                  aria-selected={s.id === current?.id}
                  aria-controls={`${baseId}-rp-${s.id}`}
                  className={s.id === current?.id ? 'chip on' : 'chip'}
                  onClick={() => setActive(s.id)}
                >
                  {pick(s.label, lang)}
                </button>
              ))}
            </div>
            {current && (
              <div
                className="caos-wb-rail-panel"
                role="tabpanel"
                id={`${baseId}-rp-${current.id}`}
                aria-labelledby={`${baseId}-rs-${current.id}`}
              >
                {current.content}
              </div>
            )}
          </>
        ) : (
          <div className="caos-wb-rail-panel">{rail as ReactNode}</div>
        )}
      </aside>
      <section className="caos-wb-main" data-instrument="">
        {children}
      </section>
    </div>
  );
}
