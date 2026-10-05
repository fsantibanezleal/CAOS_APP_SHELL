import { createContext, useContext } from 'react';

/** Where a value on screen came from: observed data, a generator, or a published reference. */
export type Provenance = 'real' | 'synthetic' | 'published';

/** The selection the instrument shows, and the key that identifies it (S10 of the 2026-10-04 requirements). */
export interface WorkbenchState {
  stateKey: string;
  caseId?: string;
  variantId?: string;
  source?: string;
}

export const WorkbenchStateContext = createContext<WorkbenchState | null>(null);

/** The current workbench selection, or null outside a `CaseWorkbench`. */
export function useWorkbenchState(): WorkbenchState | null {
  return useContext(WorkbenchStateContext);
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
    .join(',')}}`;
}

/**
 * A short, deterministic key for a selection: case, variant, source and every control value. A view that shows data
 * computed for another key is stale, and says so (failure classes 8 and 17: views that silently kept an old result
 * after a control changed). FNV-1a over a canonical serialisation.
 */
export function makeStateKey(parts: Record<string, unknown>): string {
  const text = stable(parts);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** True when a view's data key is known and differs from the workbench's current key. */
export function isStale(dataKey: string | undefined, current: WorkbenchState | null): boolean {
  return Boolean(current && dataKey !== undefined && dataKey !== current.stateKey);
}
