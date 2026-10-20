import { createContext } from 'react';

/**
 * What the reader had open in the tab rows inside a workbench view, kept by the workbench while it changes frame. Focus mode
 * (shell 0.14.0) replaces the App's frame with the focus frame, so the views mount again; a `Tabs` or `SubTabs` that holds its
 * own selection reads its last choice here and the reader lands on the same sub-view. Outside a workbench there is no memory
 * and nothing changes.
 */
export const ViewMemoryContext = createContext<Map<string, string> | null>(null);

/**
 * The key a tab row is remembered under: its kind and its ids, never its name (the name is localized, and a language switch inside
 * Focus used to change the key and lose the sub-view, before 0.16.0).
 */
export const memoryKey = (kind: string, ids: string[]): string => `${kind}|${ids.join(',')}`;
