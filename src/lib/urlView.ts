import { useState } from 'react';
import { readCaseParam, withCaseParam } from '../case/caseModel';

/** Writes one query parameter with replaceState, keeping the router's history state (React Router keeps its entry
 * key and index there; replacing it with null broke the index the back button relies on). */
export function replaceQueryParam(param: string, value: string): void {
  if (typeof window === 'undefined') return;
  const next = withCaseParam(window.location.search, value, param);
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${next}${window.location.hash}`);
}

/**
 * The open view of a tab row, held in the URL (`?view=` by default) so a reader can share it and a reload keeps it.
 * Returns the id to show and the selector to call. Controlled when `value` is given: the product holds the state and
 * the URL is left alone. An id in the URL that names no tab of this row is ignored.
 */
export function useUrlView(
  ids: string[],
  param: string | null,
  value?: string,
  onChange?: (id: string) => void,
): [string | undefined, (id: string) => void] {
  const [own, setOwn] = useState<string | null>(() =>
    param && typeof window !== 'undefined' ? readCaseParam(window.location.search, param) : null,
  );
  const open = value ?? (own && ids.includes(own) ? own : ids[0]);
  const select = (id: string) => {
    if (value === undefined) {
      setOwn(id);
      if (param) replaceQueryParam(param, id);
    }
    onChange?.(id);
  };
  return [open, select];
}

/** The parameter name from a `deepLinkView` option: `true` or absent is `view`, a string names it, `false` is none. */
export function viewParamOf(option: boolean | string | undefined): string | null {
  return option === false ? null : typeof option === 'string' ? option : 'view';
}
