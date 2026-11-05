import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';

export type StoryAccent = 1 | 2 | 3 | 4 | 5;

export interface StoryStep {
  id: string;
  number: number;
  verb: BiText;
  headline: BiText;
  summary: BiText;
  href: string;
  accent: StoryAccent;
  stage: ReactNode;
  panel: ReactNode;
}

export interface StoryFrameProps {
  steps: StoryStep[];
  activeId: string;
  onStepChange: (id: string) => void;
  onExit?: () => void;
  labels?: Partial<{ steps: BiText; previous: BiText; next: BiText; play: BiText; pause: BiText; exit: BiText }>;
  autoAdvanceMs?: number;
  className?: string;
}

const DEFAULT_LABELS = {
  steps: { en: 'Story steps', es: 'Pasos de la historia' },
  previous: { en: 'Previous step', es: 'Paso anterior' },
  next: { en: 'Next step', es: 'Paso siguiente' },
  play: { en: 'Play story', es: 'Reproducir historia' },
  pause: { en: 'Pause story', es: 'Pausar historia' },
  exit: { en: 'Return to exploration', es: 'Volver a explorar' },
} as const;

/**
 * A guided 3 to 6 step story over the same state as a product App. The product owns each step's real view and panel;
 * the shell owns the stepper, deep links, keyboard behavior, pause-on-interaction, and semantic structure (ADR-0082).
 */
export function StoryFrame({ steps, activeId, onStepChange, onExit, labels = {}, autoAdvanceMs = 5000, className }: StoryFrameProps) {
  const lang = useShellLang();
  const [playing, setPlaying] = useState(false);
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeId));
  const active = steps[activeIndex];
  const copy = useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);

  useEffect(() => {
    if (steps.length < 3 || steps.length > 6) console.error('[caos-app-shell] A showcase story has 3 to 6 steps (ADR-0082 rule 3)');
  }, [steps.length]);

  useEffect(() => {
    if (!playing || steps.length < 2) return;
    const timer = window.setTimeout(() => {
      if (activeIndex >= steps.length - 1) setPlaying(false);
      else onStepChange(steps[activeIndex + 1]!.id);
    }, Math.max(1000, autoAdvanceMs));
    return () => window.clearTimeout(timer);
  }, [activeIndex, autoAdvanceMs, onStepChange, playing, steps]);

  function move(delta: number) {
    setPlaying(false);
    const next = Math.max(0, Math.min(steps.length - 1, activeIndex + delta));
    if (steps[next]) onStepChange(steps[next]!.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    else if (event.key === 'Home') { event.preventDefault(); setPlaying(false); onStepChange(steps[0]!.id); }
    else if (event.key === 'End') { event.preventDefault(); setPlaying(false); onStepChange(steps[steps.length - 1]!.id); }
    else if (event.key === ' ') { event.preventDefault(); setPlaying((value) => !value); }
  }

  if (!active) return null;
  return (
    <section className={['caos-story', 'page-body', 'wide', className].filter(Boolean).join(' ')} data-story="" data-story-step={active.id} data-step-accent={active.accent} aria-label={pick(copy.steps, lang)} tabIndex={0} onKeyDown={onKeyDown}>
      <header className="caos-story-header">
        <div className="caos-story-heading">
          <span className="caos-story-verb">{active.number.toString().padStart(2, '0')} · {pick(active.verb, lang)}</span>
          <h1 className="caos-story-headline" data-story-headline="">{pick(active.headline, lang)}</h1>
          <p title={pick(active.summary, lang)}>{pick(active.summary, lang)}</p>
        </div>
        <div className="caos-story-actions">
          <div className="caos-story-controls" aria-label={pick(copy.steps, lang)}>
            <button type="button" onClick={() => move(-1)} disabled={activeIndex === 0}>{pick(copy.previous, lang)}</button>
            <button type="button" onClick={() => { setPlaying((value) => !value); }} aria-pressed={playing}>{pick(playing ? copy.pause : copy.play, lang)}</button>
            <button type="button" onClick={() => move(1)} disabled={activeIndex === steps.length - 1}>{pick(copy.next, lang)}</button>
          </div>
          {onExit && <button type="button" className="caos-story-exit" onClick={() => { setPlaying(false); onExit(); }}>{pick(copy.exit, lang)}</button>}
        </div>
      </header>
      <nav className="caos-story-stepper" role="tablist" aria-label={pick(copy.steps, lang)}>
        {steps.map((step) => (
          <Link key={step.id} role="tab" aria-selected={step.id === active.id} aria-current={step.id === active.id ? 'step' : undefined} to={step.href} data-story-link={step.id} className={step.id === active.id ? 'caos-story-step is-active' : 'caos-story-step'} onClick={() => { setPlaying(false); onStepChange(step.id); }}>
            <span className="caos-story-step-number">{step.number}</span><span className="caos-story-step-verb" title={pick(step.verb, lang)}>{pick(step.verb, lang)}</span><span className="caos-story-step-headline" title={pick(step.headline, lang)}>{pick(step.headline, lang)}</span>
          </Link>
        ))}
      </nav>
      <div key={active.id} className="caos-story-layout" data-stage-layout="" data-story-transition={active.id}>
        <section className="caos-story-stage" data-stage="" data-drawn="1" aria-label={pick(active.verb, lang)} onPointerDown={() => setPlaying(false)} onKeyDownCapture={(event) => { if (event.target !== event.currentTarget) setPlaying(false); }}>{active.stage}</section>
        <aside className="caos-story-panel" data-stage-panel="" aria-label={pick(active.verb, lang)} onPointerDown={() => setPlaying(false)} onKeyDownCapture={(event) => { if (event.target !== event.currentTarget) setPlaying(false); }}>{active.panel}</aside>
      </div>
    </section>
  );
}
