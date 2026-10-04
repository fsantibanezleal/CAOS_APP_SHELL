import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { PanelBoundary } from '../lib/PanelBoundary';
import { useOverflowFade } from '../lib/overflow';
import { MAX_PEER_TABS } from './Tabs';

export interface SubTabDef {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

export interface SubTabsProps {
  tabs: SubTabDef[];
  initial?: string;
  /** Controlled selection (known shell defect 6). */
  value?: string;
  onChange?: (id: string) => void;
  ariaLabel?: string;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Second-level tabs nested inside a Tabs panel: lighter chips, or a vertical left rail for deep content. Only the
 * active panel is rendered, inside an error boundary; controlled when `value` is given; more than six peers is
 * reported (ADR-0071 rule 5).
 */
export function SubTabs({ tabs, initial, value, onChange, ariaLabel, orientation = 'horizontal' }: SubTabsProps) {
  const baseId = useId();
  const first = tabs[0]?.id ?? '';
  const [own, setOwn] = useState<string>(initial ?? first);
  const active = value ?? own;
  const vertical = orientation === 'vertical';
  const rowRef = useRef<HTMLDivElement | null>(null);
  useOverflowFade(rowRef, '.subtab.active', [active, tabs.length, vertical]);
  if (tabs.length > MAX_PEER_TABS) {
    console.error(`[caos-app-shell] ${tabs.length} peer sub-tabs (${ariaLabel ?? 'unnamed'}); at most ${MAX_PEER_TABS}, then group (ADR-0071 rule 5)`);
  }

  function select(id: string) {
    if (value === undefined) setOwn(id);
    onChange?.(id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const fwd = vertical ? 'ArrowDown' : 'ArrowRight';
    const back = vertical ? 'ArrowUp' : 'ArrowLeft';
    if (e.key !== fwd && e.key !== back && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    let next = idx;
    if (e.key === fwd) next = (idx + 1) % tabs.length;
    else if (e.key === back) next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    const target = tabs[next];
    if (target) {
      select(target.id);
      document.getElementById(`${baseId}-subtab-${target.id}`)?.focus();
    }
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className={vertical ? 'subtabs subtabs-vertical' : 'subtabs'}>
      <div
        className="subtablist"
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        ref={rowRef}
      >
        {tabs.map((tab, idx) => {
          const selected = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              id={`${baseId}-subtab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-subpanel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={selected ? 'subtab active' : 'subtab'}
              data-tab={tab.id}
              onClick={() => select(tab.id)}
              onKeyDown={(e) => onKeyDown(e, idx)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="subtabpanels">
        {current && (
          <div
            key={current.id}
            id={`${baseId}-subpanel-${current.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-subtab-${current.id}`}
            tabIndex={0}
            className="subtabpanel"
            data-panel={current.id}
          >
            <PanelBoundary panel={current.id}>{current.content}</PanelBoundary>
          </div>
        )}
      </div>
    </div>
  );
}
