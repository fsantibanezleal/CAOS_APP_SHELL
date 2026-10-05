import type { ReactNode } from 'react';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import { Refs } from './Cite';

/**
 * A documentation route (Introduction, Methodology, Implementation, Experiments, Benchmark): the page head with
 * its title and lede, then sections. `wide` for a route with a sub-tab rail (ADR-0071 rule 2, amended
 * 2026-09-04); a single prose column keeps the reading width and is centred (ADR-0017 §1).
 */
export function DocPage({ title, lede, wide, children }: { title: BiText; lede: ReactNode; wide?: boolean; children: ReactNode }) {
  const lang = useShellLang();
  return (
    <div className={wide ? 'page-body wide prose caos-doc' : 'page-body prose caos-doc'} data-doc-page="">
      <div className="page-head">
        <h1>{pick(title, lang)}</h1>
        <p className="lede">{lede}</p>
      </div>
      {children}
    </div>
  );
}

export interface DocSectionProps {
  title: BiText;
  id?: string;
  /** Citation ids for this section only, rendered as one inline `Refs` row at its end (ADR-0017 §4). */
  refs?: string[];
  /** Required when a section cites nothing, so the absence is a stated choice the gate can read. */
  noRefsReason?: BiText;
  children: ReactNode;
}

/** One section of a documentation route, ending in its own references. */
export function DocSection({ title, id, refs, noRefsReason, children }: DocSectionProps) {
  const lang = useShellLang();
  const hasRefs = Boolean(refs && refs.length > 0);
  return (
    <section
      id={id}
      className="caos-doc-section"
      data-doc-section=""
      data-no-refs-reason={hasRefs ? undefined : pick(noRefsReason, lang) || 'missing'}
    >
      <h2>{pick(title, lang)}</h2>
      {children}
      {hasRefs && <Refs ids={refs!} label={lang === 'es' ? 'Referencias' : 'References'} />}
    </section>
  );
}
