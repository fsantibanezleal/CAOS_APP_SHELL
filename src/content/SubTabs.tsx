import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface SubTabDef {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

/** Second-level tabs nested inside a Tabs panel. Lighter chips; optional vertical left rail. */
export function SubTabs({
  tabs,
  initial,
  ariaLabel,
  orientation = 'horizontal',
}: {
  tabs: SubTabDef[];
  initial?: string;
  ariaLabel?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  const baseId = useId();
  const first = tabs[0]?.id ?? '';
  const [active, setActive] = useState<string>(initial ?? first);
  const vertical = orientation === 'vertical';

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
      setActive(target.id);
      document.getElementById(`${baseId}-subtab-${target.id}`)?.focus();
    }
  }

  return (
    <div className={vertical ? 'subtabs subtabs-vertical' : 'subtabs'}>
      <div className="subtablist" role="tablist" aria-label={ariaLabel} aria-orientation={vertical ? 'vertical' : 'horizontal'}>
        {tabs.map((tab, idx) => {
          const selected = tab.id === active;
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
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => onKeyDown(e, idx)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="subtabpanels">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`${baseId}-subpanel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-subtab-${tab.id}`}
            hidden={tab.id !== active}
            tabIndex={0}
            className="subtabpanel"
          >
            {tab.id === active ? tab.content : null}
          </div>
        ))}
      </div>
    </div>
  );
}
