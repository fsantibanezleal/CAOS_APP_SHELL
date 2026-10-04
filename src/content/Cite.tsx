import { createContext, useContext, type ReactNode } from 'react';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';

export interface Citation {
  id: string;
  /** Short inline label, e.g. "Little 1961"; `{ en, es }` when it has words to translate ("Laplante and
   * Staunton" / "Laplante y Staunton"), known shell defect 9. The bibliographic record stays verbatim. */
  label: BiText;
  /** Full bibliographic string for the reference list. */
  citation: string;
  doi?: string;
  url?: string;
}

interface CitationsCtx {
  list: Citation[];
  byId: Record<string, Citation>;
}

const CitationsContext = createContext<CitationsCtx>({ list: [], byId: {} });

/** Provide the app's citation list once (e.g. at the page root) so <Cite>/<ReferenceList> resolve ids. */
export function CitationsProvider({ items, children }: { items: Citation[]; children: ReactNode }) {
  const byId: Record<string, Citation> = {};
  for (const c of items) {
    if (byId[c.id]) console.error(`[caos-app-shell] duplicate citation id ${c.id}`);
    // ADR-0017 s4: a reference without a DOI or URL reads as fabricated. Reported, so the gate fails on it.
    if (!c.doi && !c.url) console.error(`[caos-app-shell] citation ${c.id} has no doi or url (ADR-0017 s4)`);
    byId[c.id] = c;
  }
  return <CitationsContext.Provider value={{ list: items, byId }}>{children}</CitationsContext.Provider>;
}

function href(c: Citation): string | undefined {
  return c.doi ? `https://doi.org/${c.doi}` : c.url;
}

/** Inline reference linked to its DOI/URL, e.g. "(Little 1961)". */
export function Cite({ id, paren = true }: { id: string; paren?: boolean }) {
  const { byId } = useContext(CitationsContext);
  const lang = useShellLang();
  const c = byId[id];
  if (!c) {
    console.error(`[caos-app-shell] Cite of an unknown citation id ${id}`);
    return <cite className="cite-inline">[{id}]</cite>;
  }
  const h = href(c);
  const text = pick(c.label, lang);
  const label = h ? (
    <a href={h} target="_blank" rel="noreferrer noopener">{text}</a>
  ) : (
    <span>{text}</span>
  );
  return (
    <cite className="cite-inline">
      {paren ? '(' : null}
      {label}
      {paren ? ')' : null}
    </cite>
  );
}

/** A short inline "Refs: a · b · c" row (e.g. under a deep sub-tab). */
export function Refs({ ids, label }: { ids: string[]; label: string }) {
  return (
    <p className="th-refs">
      <span className="th-refs-label">{label}</span>{' '}
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 ? ' · ' : null}
          <Cite id={id} paren={false} />
        </span>
      ))}
    </p>
  );
}

/** Full ordered bibliography. Omit `ids` to render every provided citation.
 * @deprecated ADR-0017 s4 bans a bottom-of-page bibliography; end each section with `Refs` (or use `DocSection`).
 * Kept so existing products still compile; it reports itself on the console, which the gate fails on. */
export function ReferenceList({ ids, heading }: { ids?: string[]; heading?: string }) {
  console.error('[caos-app-shell] ReferenceList is banned (ADR-0017 s4): end each section with Refs');
  const { list, byId } = useContext(CitationsContext);
  const items = ids ? ids.map((k) => byId[k]).filter(Boolean) : list;
  return (
    <section className="references" aria-label={heading ?? 'References'}>
      {heading ? <h2>{heading}</h2> : null}
      <ol className="reference-list">
        {items.map((c) => {
          const h = href(c);
          return (
            <li key={c.id}>
              <span>{c.citation}</span>{' '}
              {h ? (
                <a href={h} target="_blank" rel="noreferrer noopener" className="faint">
                  {c.doi ? `doi:${c.doi}` : 'link'}
                </a>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
