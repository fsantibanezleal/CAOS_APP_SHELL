import { createContext } from 'react';

/**
 * What the reader had open in the tab rows inside a workbench view, kept by the workbench while it changes frame. Focus mode
 * (shell 0.14.0) replaces the App's frame with the focus frame, so the views mount again; a `Tabs` or `SubTabs` that holds its
 * own selection reads its last choice here and the reader lands on the same sub-view. Outside a workbench there is no memory
 * and nothing changes.
 */
export const ViewMemoryContext = createContext<Map<string, string> | null>(null);

/**
 * The place of a tab row: the path of the open panels above it (`/<open tab id>/<open sub-tab id>...`), provided by `Tabs` and
 * `SubTabs` around their open panel. A focus frame that mounts a view again (`CaseWorkbench`, `SurfacePage`) provides the same
 * path the row's panel would have, so a row finds its memory there. Ids only, never a localized name.
 */
export const PanelPathContext = createContext<string>('');

/**
 * The key a tab row is remembered under: its kind, its place (`PanelPathContext`) and its ids. Never its localized name (a language
 * switch inside Focus used to change the key and lose the sub-view, before 0.16.0), and never the ids alone (two rows with the same
 * ids in different groups or views would share one selection and override each other's `initial`).
 */
export const memoryKey = (kind: string, path: string, ids: string[]): string => `${kind}|${path}|${ids.join(',')}`;
