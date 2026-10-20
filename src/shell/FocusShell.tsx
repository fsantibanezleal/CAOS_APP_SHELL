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
 * Measure the overlay chrome (the label, the HUD tiles and the actions) against the stage and write the clearance on the stage's
 * style, only for the values that changed. Returns nothing when the stage has no layout yet (the CSS fallbacks then apply).
 */
function measureChrome(stage: HTMLElement): void {
  const box = stage.getBoundingClientRect();
  if (box.height <= 0 || box.width <= 0) return;
  const label = stage.querySelector<HTMLElement>(':scope > .caos-focus-label');
  const chrome = [
    label,
    ...Array.from(stage.querySelectorAll<HTMLElement>(':scope > .caos-focus-hud > div')),
    stage.querySelector<HTMLElement>(':scope > .caos-focus-actions'),
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
 * The frame measures its overlay chrome and sets three lengths on `.caos-focus-stage` (custom properties, so the instrument
 * inherits them): `--caos-focus-clear-top` (the stage's top edge to the lowest chrome box in its upper half, plus 8px),
 * `--caos-focus-clear-bottom` (likewise from the bottom edge, 0 or unset when nothing sits in the lower half) and
 * `--caos-focus-label-bottom` (the label's bottom edge from the stage's top). A product that renders its own instrument keeps
 * its controls clear of the chrome with `padding-top: var(--caos-focus-clear-top, 4.6rem)`. Before the first measurement and in
 * a non-browser render the properties are unset and the CSS fallbacks apply.
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
      for (const c of Array.from(el.querySelectorAll(':scope > .caos-focus-label, :scope > .caos-focus-hud, :scope > .caos-focus-actions'))) ro.observe(c);
    }
    return () => {
      window.removeEventListener('resize', run);
      ro?.disconnect();
    };
  }, []);
  return (
    <Root className={rail === null || rail === undefined ? 'caos-focus-shell caos-focus-norail' : 'caos-focus-shell'} data-focus-shell="">
      <section ref={stageRef} className="caos-focus-stage" aria-label={stageLabel}>
        <div className="caos-focus-instrument">{stage}</div>
        <div className="caos-focus-label"><strong>{title}</strong><span>{description}</span></div>
        <div className="caos-focus-hud" aria-label="HUD">
          {hud.map(item => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
        </div>
        <div className="caos-focus-actions"><LanguageToggle /><ThemeToggle /><button type="button" data-focus-exit="" onClick={onExit}>{exitLabel}</button></div>
      </section>
      {rail !== null && rail !== undefined && <aside className="caos-focus-rail" data-rail="">{rail}</aside>}
    </Root>
  );
}
