import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { PanelBoundary } from '../lib/PanelBoundary';
import { useOverflowFade } from '../lib/overflow';

export interface TabDef {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

/** At most about six peers, then group by the question (ADR-0071 rule 5). */
export const MAX_PEER_TABS = 6;

export interface TabsProps {
  tabs: TabDef[];
  /** Uncontrolled: the first selected tab. */
  initial?: string;
  /** Controlled: the selected tab, owned by the app (for example a view held in the URL). */
  value?: string;
  /** Called on every selection, controlled or not. */
  onChange?: (id: string) => void;
  ariaLabel?: string;
}

/**
 * Accessible roving-tabindex tab strip on ONE row (ADR-0071 rule 4): arrow keys, Home and End; only the active panel
 * is rendered, inside an error boundary; a row wider than its box fades the hidden end. Controlled when `value` is
 * given (known shell defect 6). More than six peers is reported (rule 5).
 */
export function Tabs({ tabs, initial, value, onChange, ariaLabel }: TabsProps) {
  const baseId = useId();
  const first = tabs[0]?.id ?? '';
  const [own, setOwn] = useState<string>(initial ?? first);
  const active = value ?? own;
  const rowRef = useRef<HTMLDivElement | null>(null);
  useOverflowFade(rowRef, '.tab.active', [active, tabs.length]);
  if (tabs.length > MAX_PEER_TABS) {
    console.error(`[caos-app-shell] ${tabs.length} peer tabs (${ariaLabel ?? 'unnamed'}); at most ${MAX_PEER_TABS}, then group (ADR-0071 rule 5)`);
  }

  function select(id: string) {
    if (value === undefined) setOwn(id);
    onChange?.(id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    const target = tabs[next];
    if (target) {
      select(target.id);
      document.getElementById(`${baseId}-tab-${target.id}`)?.focus();
    }
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className="tabs">
      <div className="tablist" role="tablist" aria-label={ariaLabel} ref={rowRef}>
        {tabs.map((tab, idx) => {
          const selected = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={selected ? 'tab active' : 'tab'}
              data-tab={tab.id}
              onClick={() => select(tab.id)}
              onKeyDown={(e) => onKeyDown(e, idx)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {current && (
        <div
          key={current.id}
          id={`${baseId}-panel-${current.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${current.id}`}
          tabIndex={0}
          className="tabpanel"
          data-panel={current.id}
        >
          <PanelBoundary panel={current.id}>{current.content}</PanelBoundary>
        </div>
      )}
    </div>
  );
}
