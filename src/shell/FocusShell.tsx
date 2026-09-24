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
}

/** Full-viewport, scenario-scoped analysis frame. The product supplies only its instrument and controls. */
export function FocusShell({ stage, rail, title, description, hud, onExit, exitLabel, stageLabel }: FocusShellProps) {
  return (
    <main className="caos-focus-shell">
      <section className="caos-focus-stage" aria-label={stageLabel}>
        <div className="caos-focus-instrument">{stage}</div>
        <div className="caos-focus-label"><strong>{title}</strong><span>{description}</span></div>
        <div className="caos-focus-hud" aria-label="HUD">
          {hud.map(item => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
        </div>
        <div className="caos-focus-actions"><LanguageToggle /><ThemeToggle /><button type="button" onClick={onExit}>{exitLabel}</button></div>
      </section>
      <aside className="caos-focus-rail">{rail}</aside>
    </main>
  );
}
