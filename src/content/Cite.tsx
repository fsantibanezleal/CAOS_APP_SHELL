import { createContext, useContext, type ReactNode } from 'react';

export interface Citation {
  id: string;
  /** Short inline label, e.g. "Little 1961". */
  label: string;
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
  for (const c of items) byId[c.id] = c;
  return <CitationsContext.Provider value={{ list: items, byId }}>{children}</CitationsContext.Provider>;
}

function href(c: Citation): string | undefined {
  return c.doi ? `https://doi.org/${c.doi}` : c.url;
}

/** Inline reference linked to its DOI/URL, e.g. "(Little 1961)". */
export function Cite({ id, paren = true }: { id: string; paren?: boolean }) {
  const { byId } = useContext(CitationsContext);
  const c = byId[id];
  if (!c) return <cite className="cite-inline">[{id}]</cite>;
  const h = href(c);
  const label = h ? (
    <a href={h} target="_blank" rel="noreferrer noopener">{c.label}</a>
  ) : (
    <span>{c.label}</span>
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

/** Full ordered bibliography. Omit `ids` to render every provided citation. */
export function ReferenceList({ ids, heading }: { ids?: string[]; heading?: string }) {
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
