import { useState, type ReactNode } from 'react';
import { SubTabs, type SubTabDef } from './SubTabs';
import { Tabs } from './Tabs';

export interface TabGroupDef {
  id: string;
  /** The question the group answers (ADR-0071 rule 5: group by the user's question). */
  label: ReactNode;
  tabs: SubTabDef[];
}

export interface TabGroupsProps {
  groups: TabGroupDef[];
  /** Controlled selection as `group` and `tab` ids (for example held in the URL). */
  value?: { group: string; tab?: string };
  onChange?: (value: { group: string; tab: string }) => void;
  ariaLabel?: string;
}

/**
 * Grouped navigation for more than six views: one row of at most six groups, then the sub-tabs of the open group
 * only, each its own single row (ADR-0071 rules 4 and 5). No hover menus: every view is reached by plain clicks on
 * visible tabs, which a pointer and a keyboard can both operate (rule 9; menus that swallowed the first click were a
 * recorded failure).
 */
export function TabGroups({ groups, value, onChange, ariaLabel }: TabGroupsProps) {
  const [own, setOwn] = useState<{ group: string; tab?: string }>({ group: groups[0]?.id ?? '' });
  const sel = value ?? own;
  const group = groups.find((g) => g.id === sel.group) ?? groups[0];
  const tabOf = (g: TabGroupDef, wanted?: string) => g.tabs.find((t) => t.id === wanted)?.id ?? g.tabs[0]?.id ?? '';

  function set(next: { group: string; tab: string }) {
    if (value === undefined) setOwn(next);
    onChange?.(next);
  }

  return (
    <Tabs
      ariaLabel={ariaLabel}
      value={group?.id}
      onChange={(gid) => {
        const g = groups.find((x) => x.id === gid);
        if (g) set({ group: g.id, tab: tabOf(g) });
      }}
      tabs={groups.map((g) => ({
        id: g.id,
        label: g.label,
        content:
          g.tabs.length === 1 ? (
            g.tabs[0].content
          ) : (
            <SubTabs
              tabs={g.tabs}
              value={tabOf(g, g.id === group?.id ? sel.tab : undefined)}
              onChange={(tid) => set({ group: g.id, tab: tid })}
            />
          ),
      }))}
    />
  );
}
