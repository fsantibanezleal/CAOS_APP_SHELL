import { createContext, useContext, useRef, type ChangeEvent, type ReactNode } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type SelectionOrigin = 'scene' | 'panel' | 'series' | 'external';
export type LinkedViewSide = 'scene' | 'panel';
export interface LinkedViewState { selectedId: string | null; cursor: number | null; seriesId: string | null; origin: SelectionOrigin; select: (id: string | null, origin: SelectionOrigin) => void; scrub: (cursor: number | null) => void; showSeries: (id: string | null) => void; }
export type LinkedViewStore = StoreApi<LinkedViewState>;
const LinkedViewContext = createContext<LinkedViewStore | null>(null);

export function createLinkedViewStore(initial: Partial<Pick<LinkedViewState, 'selectedId' | 'cursor' | 'seriesId'>> = {}): LinkedViewStore {
  return createStore<LinkedViewState>((set) => ({ selectedId: initial.selectedId ?? null, cursor: initial.cursor ?? null, seriesId: initial.seriesId ?? null, origin: 'external', select: (selectedId, origin) => set({ selectedId, origin }), scrub: (cursor) => set({ cursor }), showSeries: (seriesId) => set({ seriesId }) }));
}

export function LinkedViewProvider({ children, initial }: { children: ReactNode; initial?: Partial<Pick<LinkedViewState, 'selectedId' | 'cursor' | 'seriesId'>> }) {
  const storeRef = useRef<LinkedViewStore | null>(null);
  if (!storeRef.current) storeRef.current = createLinkedViewStore(initial);
  return <LinkedViewContext.Provider value={storeRef.current}>{children}</LinkedViewContext.Provider>;
}

/** Scene selection, panel selection and time scrubbing share one store rather than shadowing one another. */
export function useLinkedView<T>(selector: (state: LinkedViewState) => T): T {
  const store = useContext(LinkedViewContext);
  if (!store) throw new Error('useLinkedView must be inside LinkedViewProvider');
  return useStore(store, selector);
}

/** Attributes and action for one selectable object in either linked view; spread onto a native button or SVG group. */
export function useLinkedItem(id: string, side: LinkedViewSide) {
  const selected = useLinkedView((state) => state.selectedId === id);
  const select = useLinkedView((state) => state.select);
  return {
    'data-linked-id': id,
    'data-linked-view': side,
    'data-linked-selected': selected ? 'true' : 'false',
    'aria-pressed': selected,
    onClick: () => select(id, side),
  } as const;
}

/** Shared scrub value and marker metadata for a chart/profile input and its matching scene marker. */
export function useLinkedCursor() {
  const cursor = useLinkedView((state) => state.cursor);
  const scrub = useLinkedView((state) => state.scrub);
  const onChange = (event: ChangeEvent<HTMLInputElement>) => scrub(Number(event.currentTarget.value));
  return { cursor, scrub, inputProps: { 'data-linked-cursor': '', value: cursor ?? 0, onChange }, markerProps: { 'data-linked-cursor-marker': '', 'data-linked-cursor-position': cursor ?? '' } } as const;
}
