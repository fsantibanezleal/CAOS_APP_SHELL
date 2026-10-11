import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
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

/** The citation ids of a scope in the order of first appearance: each id once, sections in the order given. */
export function firstAppearance(sections: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ids of sections) {
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

interface RefsScopeApi {
  register(key: string, el: HTMLElement | null, ids: string[]): void;
  unregister(key: string): void;
}

const RefsScopeContext = createContext<RefsScopeApi | null>(null);

/** The nearest references scope, which a `DocSection` registers its citation ids with (null outside any scope). */
export function useRefsScope(): RefsScopeApi | null {
  return useContext(RefsScopeContext);
}

/**
 * A scope that lists the references of the sections inside it, once, at its own end: the `DocPage`, and each open panel
 * of `Tabs` and `SubTabs` (the innermost scope wins). Sections register in a layout effect; the order is their order in
 * the document (not the order of registration), so a section that mounts later keeps its place. It adds no element of
 * its own, and nothing renders while no section registered an id.
 */
export function DocRefsScope({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, { el: HTMLElement | null; ids: string[] }>());
  const [ids, setIds] = useState<string[]>([]);
  const recompute = useCallback(() => {
    const rows = [...entries.current.values()].filter((r) => r.ids.length > 0);
    rows.sort((a, b) => {
      if (!a.el || !b.el || a.el === b.el) return 0;
      return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    const next = firstAppearance(rows.map((r) => r.ids));
    setIds((prev) => (prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next));
  }, []);
  const api = useMemo<RefsScopeApi>(
    () => ({
      register(key, el, list) {
        entries.current.set(key, { el, ids: list });
        recompute();
      },
      unregister(key) {
        entries.current.delete(key);
        recompute();
      },
    }),
    [recompute],
  );
  return (
    <RefsScopeContext.Provider value={api}>
      {children}
      <DocReferences ids={ids} />
    </RefsScopeContext.Provider>
  );
}

/** The end-of-scope references block (ADR-0017 s4, shell 0.11.0): the full citation of each id, once, as an ordered list. */
export function DocReferences({ ids }: { ids: string[] }) {
  const { byId } = useContext(CitationsContext);
  const lang = useShellLang();
  const items = ids.filter((id) => {
    if (byId[id]) return true;
    console.error(`[caos-app-shell] a section lists the unknown citation id ${id}`);
    return false;
  });
  if (items.length === 0) return null;
  return (
    <section className="caos-doc-references" data-doc-references="">
      <h2>{lang === 'es' ? 'Referencias' : 'References'}</h2>
      <ol className="caos-doc-reference-list">
        {items.map((id) => {
          const c = byId[id]!;
          const h = href(c);
          return (
            <li key={id}>
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
 * @deprecated Superseded by the end-of-page references block that `DocPage` and the tab panels render from their
 * `DocSection`s (ADR-0017 s4). Kept so existing products still compile; it reports itself on the console, which the
 * gate fails on. */
export function ReferenceList({ ids, heading }: { ids?: string[]; heading?: string }) {
  console.error('[caos-app-shell] ReferenceList is superseded by the end-of-page references block (ADR-0017 s4): give each DocSection its refs');
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
