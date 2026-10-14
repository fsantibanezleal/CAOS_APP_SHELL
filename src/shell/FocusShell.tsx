import type { ReactNode } from 'react';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

export interface FocusShellProps {
  stage: ReactNode;
  rail: ReactNode;
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

/** Full-viewport, scenario-scoped analysis frame. The product supplies only its instrument and controls. */
export function FocusShell({ stage, rail, title, description, hud, onExit, exitLabel, stageLabel, landmark = true }: FocusShellProps) {
  const Root = landmark ? 'main' : 'div';
  return (
    <Root className="caos-focus-shell" data-focus-shell="">
      <section className="caos-focus-stage" aria-label={stageLabel}>
        <div className="caos-focus-instrument">{stage}</div>
        <div className="caos-focus-label"><strong>{title}</strong><span>{description}</span></div>
        <div className="caos-focus-hud" aria-label="HUD">
          {hud.map(item => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
        </div>
        <div className="caos-focus-actions"><LanguageToggle /><ThemeToggle /><button type="button" data-focus-exit="" onClick={onExit}>{exitLabel}</button></div>
      </section>
      <aside className="caos-focus-rail" data-rail="">{rail}</aside>
    </Root>
  );
}
