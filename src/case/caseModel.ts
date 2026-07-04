// Framework-free model behind CaseSelector v2 (the shared source+case picker that closes the
// portfolio's inherited selector defects: cryptic ID-only chips, taxonomy lost between registry
// and UI, no first-level Synthetic|Real|Uploaded source, and faded-but-interactive locked state).
// Pure so it is unit-testable without React or a DOM.

export type CaseKind = 'synthetic' | 'real' | 'uploaded';

export interface CaseDef {
  /** stable slug — the value used in the ?case= deep link and reported to onSelect. */
  id: string;
  /** short human name shown ON the chip next to the id (never demoted to a tooltip-only string). */
  name: string;
  /** group label; cases with the same category render under one labelled group. */
  category?: string;
  /** which source lane this case belongs to. Defaults to 'synthetic'. */
  kind?: CaseKind;
  /** validation anchor (e.g. "published optimum 26,086,899") — surfaced in the chip tooltip. */
  anchor?: string;
  /** expected-range hint — surfaced in the chip tooltip. */
  expectedBand?: string;
  disabled?: boolean;
}

export const caseKind = (c: CaseDef): CaseKind => c.kind ?? 'synthetic';

const KIND_ORDER: CaseKind[] = ['synthetic', 'real', 'uploaded'];

/** The source lanes that actually appear in the deck, in canonical Synthetic → Real → Uploaded order. */
export function sourcesPresent(cases: CaseDef[]): CaseKind[] {
  const set = new Set(cases.map(caseKind));
  return KIND_ORDER.filter((k) => set.has(k));
}

export interface CaseGroup {
  category: string;
  cases: CaseDef[];
}

/** Group by category, preserving first-seen category order and case order within each group. */
export function groupByCategory(cases: CaseDef[]): CaseGroup[] {
  const order: string[] = [];
  const map = new Map<string, CaseDef[]>();
  for (const c of cases) {
    const cat = c.category ?? '';
    if (!map.has(cat)) {
      map.set(cat, []);
      order.push(cat);
    }
    map.get(cat)!.push(c);
  }
  return order.map((category) => ({ category, cases: map.get(category)! }));
}

/** Cases in a given source lane (or all cases when no source filter is active). */
export function casesInSource(cases: CaseDef[], source: CaseKind | undefined): CaseDef[] {
  if (!source) return cases;
  return cases.filter((c) => caseKind(c) === source);
}

/** The chip tooltip: anchor and/or expected band, joined; empty string when neither is set. */
export function caseTooltip(c: CaseDef): string {
  return [c.anchor, c.expectedBand].filter(Boolean).join(' · ');
}

// ---- deep-link helpers (operate on a location.search string; no DOM dependency) ----------------

/** Read the case id from a query string, or null when absent. */
export function readCaseParam(search: string, param = 'case'): string | null {
  return new URLSearchParams(search).get(param);
}

/** A new query string (leading '?') with the case param set to id. */
export function withCaseParam(search: string, id: string, param = 'case'): string {
  const p = new URLSearchParams(search);
  p.set(param, id);
  const s = p.toString();
  return s ? `?${s}` : '';
}
