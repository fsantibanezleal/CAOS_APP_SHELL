import { useEffect, useId } from 'react';
import type { Lang } from '../lib/lang';
import {
  type CaseDef,
  type CaseKind,
  casesInSource,
  caseTooltip,
  groupByCategory,
  readCaseParam,
  sourcesPresent,
  withCaseParam,
} from './caseModel';

export type { CaseDef, CaseKind } from './caseModel';

export interface CaseSelectorText {
  source: string;
  synthetic: string;
  real: string;
  uploaded: string;
  /** shown under the source control when a non-synthetic lane is active and knobs are locked. */
  lockedNote: string;
  /** prefix for the divergence badge, e.g. "modified from". */
  modifiedPrefix: string;
  reset: string;
}

const TEXT: Record<Lang, CaseSelectorText> = {
  en: {
    source: 'Source',
    synthetic: 'Synthetic',
    real: 'Real',
    uploaded: 'Uploaded',
    lockedNote: 'Scenario knobs are locked on a real sample — you pick which datum; every tool runs on it as-is.',
    modifiedPrefix: 'modified from',
    reset: 'reset',
  },
  es: {
    source: 'Fuente',
    synthetic: 'Sintético',
    real: 'Real',
    uploaded: 'Subido',
    lockedNote: 'Los controles del escenario quedan bloqueados en una muestra real: eliges el dato; todas las herramientas corren sobre él tal cual.',
    modifiedPrefix: 'modificado desde',
    reset: 'restablecer',
  },
};

const KIND_TAG: Record<CaseKind, string> = { synthetic: 'S', real: 'R', uploaded: 'U' };

export interface CaseSelectorProps {
  cases: CaseDef[];
  selectedId: string;
  onSelect: (id: string) => void;

  /** When provided, renders the first-level source control and filters cases to the active lane.
   *  Controlled — pair with onSourceChange. Omit for a single-lane deck (no source control). */
  source?: CaseKind;
  onSourceChange?: (k: CaseKind) => void;
  /** Overrides the default locked-knobs explanation shown for a non-synthetic source. */
  lockedNote?: string;

  /** Set to the case id the current knob state diverged from to show a "modified from X" badge.
   *  The consumer owns the knobs and computes this; null/undefined hides the badge. */
  modifiedFromId?: string | null;
  onResetToCanonical?: () => void;

  lang?: Lang;
  text?: Partial<CaseSelectorText>;

  /** Sync selectedId with the URL query. true → ?case=, a string → that param name. */
  deepLink?: boolean | string;
  ariaLabel?: string;
  className?: string;
}

/**
 * CaseSelector v2 — the shared source + case picker. Renders (1) an optional first-level source
 * segmented control (Synthetic | Real | Uploaded, only the lanes present), (2) a labelled group per
 * case category, each case a chip showing "ID · name" with its validation anchor as the tooltip and
 * a source tag, (3) a locked-knobs explanation when a non-synthetic source is active, and (4) a
 * "modified from CASE" divergence badge with a reset action. Optional ?case= deep-linking.
 *
 * Controlled: the consumer owns selectedId, source, and the scenario knobs (which it disables when
 * source !== 'synthetic'); this component signals and reports, it does not own knob state.
 */
export function CaseSelector(props: CaseSelectorProps) {
  const {
    cases,
    selectedId,
    onSelect,
    source,
    onSourceChange,
    lockedNote,
    modifiedFromId,
    onResetToCanonical,
    lang = 'en',
    text,
    deepLink,
    ariaLabel,
    className,
  } = props;

  const t = { ...TEXT[lang], ...text };
  const baseId = useId();
  const param = typeof deepLink === 'string' ? deepLink : 'case';

  // deep-link: adopt ?case= on mount when it names a known case.
  useEffect(() => {
    if (!deepLink || typeof window === 'undefined') return;
    const fromUrl = readCaseParam(window.location.search, param);
    if (fromUrl && fromUrl !== selectedId && cases.some((c) => c.id === fromUrl)) onSelect(fromUrl);
    // adopt once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // deep-link: reflect the current selection back into the URL without a history entry.
  useEffect(() => {
    if (!deepLink || typeof window === 'undefined') return;
    const next = withCaseParam(window.location.search, selectedId, param);
    if (next !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${next}${window.location.hash}`);
    }
  }, [deepLink, param, selectedId]);

  const lanes = source ? sourcesPresent(cases) : [];
  const visible = casesInSource(cases, source);
  const groups = groupByCategory(visible);
  const modified = cases.find((c) => c.id === modifiedFromId) ?? null;

  return (
    <div className={`cs${className ? ` ${className}` : ''}`} role="group" aria-label={ariaLabel ?? 'Case selector'}>
      {source && lanes.length > 1 && (
        <div className="cs-source">
          <span className="cs-source-label">{t.source}</span>
          <div className="cs-source-tabs" role="tablist" aria-label={t.source}>
            {lanes.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={source === k}
                className={source === k ? 'subtab active' : 'subtab'}
                onClick={() => onSourceChange?.(k)}
              >
                {k === 'synthetic' ? t.synthetic : k === 'real' ? t.real : t.uploaded}
              </button>
            ))}
          </div>
        </div>
      )}

      {source && source !== 'synthetic' && (
        <p className="cs-locked banner">{lockedNote ?? t.lockedNote}</p>
      )}

      {groups.map((g) => (
        <div key={g.category || '_'} className="cs-group" role="group" aria-label={g.category || undefined}>
          {g.category && <span className="cs-group-label">{g.category}</span>}
          <div className="cs-chips">
            {g.cases.map((c) => {
              const on = c.id === selectedId;
              const tip = caseTooltip(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  id={`${baseId}-case-${c.id}`}
                  className={`cs-chip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  disabled={c.disabled}
                  title={tip || undefined}
                  onClick={() => onSelect(c.id)}
                >
                  <span className="cs-chip-id">{c.id}</span>
                  <span className="cs-chip-name">{c.name}</span>
                  <span className={`cs-kind cs-kind-${caseKindOf(c)}`} aria-hidden="true">
                    {KIND_TAG[caseKindOf(c)]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {modified && (
        <div className="cs-modified">
          <span className="badge accent">
            {t.modifiedPrefix} <strong>{modified.id}</strong>
          </span>
          {onResetToCanonical && (
            <button type="button" className="cs-reset" onClick={onResetToCanonical}>
              {t.reset}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// local re-import to keep the JSX terse (kind with the synthetic default applied).
function caseKindOf(c: CaseDef): CaseKind {
  return c.kind ?? 'synthetic';
}
