import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import { DocRefsScope, useRefsScope } from './Cite';

/**
 * A documentation route (Introduction, Methodology, Implementation, Experiments, Benchmark): the page head with
 * its title and lede, then sections. `wide` for a route with a sub-tab rail (ADR-0071 rule 2, amended
 * 2026-09-04); a single prose column keeps the reading width and is centred (ADR-0017 §1). Text takes the full width
 * of the column, and the references of its sections are listed once at the end of the page (ADR-0017 §4).
 */
/**
 * The areas a section may declare, per documentation route (ADR-0017 section 2.1). The gate's table (`gate/areas.mjs`)
 * holds each area's rule; `test/docFloors.test.ts` keeps these names equal to that table's.
 */
export const DOC_AREAS = {
  '/introduction': ['initiative', 'outcomes', 'positioning', 'credibility', 'problem', 'principles', 'math', 'pipeline', 'honesty'],
  '/methodology': ['method'],
  '/implementation': ['architecture', 'reproducibility', 'engine', 'lanes', 'contract', 'deployment'],
  '/experiments': ['question', 'metrics', 'protocol', 'datasets'],
  '/benchmark': ['results', 'comparison', 'robustness', 'live', 'provenance', 'caveat'],
} as const;

export interface DocPageProps {
  title: BiText;
  lede: ReactNode;
  wide?: boolean;
  /**
   * The required areas this page cannot carry, each with the reason (ADR-0017 section 2.1): rendered as
   * `data-floor-waiver="<floor>: <reason>"`, separated by `; ` (a reason holds no semicolon). The gate skips a waived
   * floor, lists the waiver, and fails one whose reason has fewer than 12 characters or whose floor is unknown.
   */
  floorWaivers?: Array<{ floor: string; reason: BiText }>;
  children: ReactNode;
}

export function DocPage({ title, lede, wide, floorWaivers, children }: DocPageProps) {
  const lang = useShellLang();
  const waivers = (floorWaivers ?? []).map((w) => `${w.floor}: ${pick(w.reason, lang)}`).join('; ');
  return (
    <div className={wide ? 'page-body wide prose caos-doc' : 'page-body prose caos-doc'} data-doc-page="" data-floor-waiver={waivers || undefined}>
      <div className="page-head">
        <h1>{pick(title, lang)}</h1>
        <p className="lede">{lede}</p>
      </div>
      <DocRefsScope>{children}</DocRefsScope>
    </div>
  );
}

export interface DocSectionProps {
  title: BiText;
  id?: string;
  /** The required area this section covers (ADR-0017 section 2.1), rendered as `data-area`; the vocabulary is fixed per page (`gate/areas.mjs`). */
  area?: string;
  /** Methodology only: the kind of the method this section describes, rendered as `data-method-kind`. */
  kind?: 'classical' | 'learned';
  /** Citation ids this section cites; they are listed in the references block at the end of the page or open tab (ADR-0017 §4). */
  refs?: string[];
  /** Required when a section cites nothing, so the absence is a stated choice the gate can read. */
  noRefsReason?: BiText;
  children: ReactNode;
}

/** One section of a documentation route; its references are registered with the nearest scope, not rendered here. */
export function DocSection({ title, id, area, kind, refs, noRefsReason, children }: DocSectionProps) {
  const lang = useShellLang();
  const hasRefs = Boolean(refs && refs.length > 0);
  const scope = useRefsScope();
  const key = useId();
  const el = useRef<HTMLElement | null>(null);
  const idsKey = (refs ?? []).join('\n');
  useLayoutEffect(() => {
    if (!scope || !idsKey) return undefined;
    scope.register(key, el.current, idsKey.split('\n'));
    return () => scope.unregister(key);
  }, [scope, key, idsKey]);
  return (
    <section
      ref={el}
      id={id}
      className="caos-doc-section"
      data-doc-section=""
      data-area={area}
      data-method-kind={kind}
      data-no-refs-reason={hasRefs ? undefined : pick(noRefsReason, lang) || 'missing'}
      data-refs={hasRefs ? refs!.length : undefined}
    >
      <h2>{pick(title, lang)}</h2>
      {children}
    </section>
  );
}
