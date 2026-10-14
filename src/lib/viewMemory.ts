import { createContext } from 'react';

/**
 * What the reader had open in the tab rows inside a workbench view, kept by the workbench while it changes frame. Focus mode
 * (shell 0.14.0) replaces the App's frame with the focus frame, so the views mount again; a `Tabs` or `SubTabs` that holds its
 * own selection reads its last choice here and the reader lands on the same sub-view. Outside a workbench there is no memory
 * and nothing changes.
 */
export const ViewMemoryContext = createContext<Map<string, string> | null>(null);

/** The key a tab row is remembered under: its name and its ids. */
export const memoryKey = (kind: string, ariaLabel: string | undefined, ids: string[]): string => `${kind}|${ariaLabel ?? ''}|${ids.join(',')}`;
