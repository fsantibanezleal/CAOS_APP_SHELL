import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

export interface FocusShellProps {
  stage: ReactNode;
  /** The parameter column on the right. Null or omitted: no column, and the stage is the whole frame (a view of a surface with no rail). */
  rail?: ReactNode;
  title: string;
  description: string;
  hud: Array<{ label: string; value: string }>;
  onExit: () => void;
  exitLabel: string;
  stageLabel: string;
  /**
   * True (default): the frame is the page's `main`. False: the frame sits inside a page that already has its `main` (the App's
   * Focus mode does), so it renders a `div` and the page holds one `main`.
   */
  landmark?: boolean;
}

const GAP = 8;

/**
 * Docked metadata needs no overlay clearance. Clear stale offsets after layout changes;
 * retain measured clearance for legacy overlay compositions, writing only changed values.
 */
function measureChrome(stage: HTMLElement): void {
  // Docked chrome is outside the drawing at every narrow size, and beside it in desktop Focus.
  // display:contents has no box to measure; clear inherited offsets before attempting box geometry.
  const dockedLabel = stage.parentElement?.querySelector<HTMLElement>(':scope > .caos-focus-label');
  if ((dockedLabel && getComputedStyle(dockedLabel).position === 'static') || ['grid', 'contents'].includes(getComputedStyle(stage).display)) {
    for (const name of ['--caos-focus-clear-top', '--caos-focus-clear-bottom']) {
      if (stage.style.getPropertyValue(name) !== '0px') stage.style.setProperty(name, '0px');
    }
    if (stage.style.getPropertyValue('--caos-focus-label-bottom')) stage.style.removeProperty('--caos-focus-label-bottom');
    return;
  }
  const box = stage.getBoundingClientRect();
  if (box.height <= 0 || box.width <= 0) return;
  const label = stage.querySelector<HTMLElement>(':scope > .caos-focus-label');
  const chrome = [
    label,
    ...Array.from(stage.querySelectorAll<HTMLElement>(':scope > .caos-focus-hud > div')),
    stage.parentElement?.querySelector<HTMLElement>(':scope > .caos-focus-actions') ?? stage.querySelector<HTMLElement>(':scope > .caos-focus-actions'),
  ].filter((e): e is HTMLElement => e !== null);
  const write = (name: string, px: number | null): boolean => {
    const next = px === null ? '' : `${px}px`;
    if (stage.style.getPropertyValue(name) === next) return false;
    if (px === null) stage.style.removeProperty(name);
    else stage.style.setProperty(name, next);
    return true;
  };
  const labelBottom = label ? Math.ceil(label.getBoundingClientRect().bottom - box.top) : null;
  // the HUD's top follows the label, so a changed label bottom moves the tiles: measure again once it is written
  const moved = write('--caos-focus-label-bottom', labelBottom !== null && labelBottom > 0 ? labelBottom : null);
  if (moved) {
    measureChrome(stage);
    return;
  }
  const mid = box.height / 2;
  let top = 0;
  let bottom = 0;
  for (const el of chrome) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.top - box.top < mid) top = Math.max(top, r.bottom - box.top + GAP);
    else bottom = Math.max(bottom, box.bottom - r.top + GAP);
  }
  write('--caos-focus-clear-top', top > 0 ? Math.ceil(top) : null);
  write('--caos-focus-clear-bottom', bottom > 0 ? Math.ceil(bottom) : null);
}

/**
 * Full-viewport, scenario-scoped analysis frame. The product supplies only its instrument and controls.
 *
 * Metadata sits beside the actual drawing on desktop and above it on narrow screens.
 * One owner scrolls on narrow screens and keeps exit reachable. Existing clearance
 * properties remain available for legacy compositions; docked layouts explicitly use zero.
 */
export function FocusShell({ stage, rail, title, description, hud, onExit, exitLabel, stageLabel, landmark = true }: FocusShellProps) {
  const Root = landmark ? 'main' : 'div';
  const stageRef = useRef<HTMLElement | null>(null);
  // after every render (the text, the group or the HUD may have changed) and on every size change of the chrome or the window;
  // values are written only when they change, so a page at rest is not mutated (G8)
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (el) measureChrome(el);
  });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const run = () => measureChrome(el);
    window.addEventListener('resize', run);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(run);
      for (const c of Array.from(el.parentElement?.querySelectorAll(':scope > .caos-focus-label, :scope > .caos-focus-hud') ?? [])) ro.observe(c);
      const actions = el.parentElement?.querySelector(':scope > .caos-focus-actions');
      if (actions) ro.observe(actions);
    }
    return () => {
      window.removeEventListener('resize', run);
      ro?.disconnect();
    };
  }, []);
  return (
    <Root className={rail === null || rail === undefined ? 'caos-focus-shell caos-focus-norail' : 'caos-focus-shell'} data-focus-shell="">
      <div className="caos-focus-actions"><LanguageToggle /><ThemeToggle /><button type="button" data-focus-exit="" onClick={onExit}>{exitLabel}</button></div>
      <div className="caos-focus-label"><strong>{title}</strong><span>{description}</span></div>
      <div className="caos-focus-hud" aria-label="HUD">
        {hud.map(item => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
      </div>
      <section ref={stageRef} className="caos-focus-stage" aria-label={stageLabel}>
        <div className="caos-focus-instrument">{stage}</div>
      </section>
      {rail !== null && rail !== undefined && <aside className="caos-focus-rail" data-rail="">{rail}</aside>}
    </Root>
  );
}
