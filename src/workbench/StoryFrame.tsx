import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import { RailBody, type RailSection } from './WorkbenchLayout';

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
  /** A complete panel node, or the existing control-rail section contract when its content needs splitting. */
  panel: ReactNode | RailSection[];
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
// The row already identifies the story. Visible verbs stay concise; accessible names retain full context.
const BUTTON_TEXT = {
  previous: { en: 'Previous', es: 'Anterior' }, next: { en: 'Next', es: 'Siguiente' },
  play: { en: 'Play', es: 'Reproducir' }, pause: { en: 'Pause', es: 'Pausar' },
  exit: { en: 'Explore', es: 'Explorar' },
};

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
  const navigation = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const nav = navigation.current;
    const selected = nav?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!nav || !selected) return;
    // Reveal only within the horizontal navigation owner; never jump the document
    // away from its current scene or panel when a step changes.
    const reveal = () => {
      const host = nav.getBoundingClientRect(), link = selected.getBoundingClientRect();
      const left = host.left + nav.clientLeft, right = left + nav.clientWidth;
      if (link.left < left) nav.scrollLeft += link.left - left;
      else if (link.right > right) nav.scrollLeft += link.right - right;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(nav);
    // Earlier intrinsic links can widen on a font/language change without changing
    // the selected link's own dimensions; its horizontal position still moves.
    nav.querySelectorAll('[data-story-link]').forEach(link => observer.observe(link));
    return () => observer.disconnect();
  }, [active?.id, lang]);

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
  const sections = Array.isArray(active.panel) && active.panel.every((item) => typeof item === 'object' && item !== null && 'id' in item && 'content' in item);
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
            <button type="button" aria-label={pick(copy.previous, lang)} title={pick(copy.previous, lang)} onClick={() => move(-1)} disabled={activeIndex === 0}>{pick(labels.previous ?? BUTTON_TEXT.previous, lang)}</button>
            <button type="button" aria-label={pick(playing ? copy.pause : copy.play, lang)} title={pick(playing ? copy.pause : copy.play, lang)} onClick={() => { setPlaying((value) => !value); }} aria-pressed={playing}>{pick(playing ? labels.pause ?? BUTTON_TEXT.pause : labels.play ?? BUTTON_TEXT.play, lang)}</button>
            <button type="button" aria-label={pick(copy.next, lang)} title={pick(copy.next, lang)} onClick={() => move(1)} disabled={activeIndex === steps.length - 1}>{pick(labels.next ?? BUTTON_TEXT.next, lang)}</button>
          </div>
          {onExit && <button type="button" className="caos-story-exit" aria-label={pick(copy.exit, lang)} title={pick(copy.exit, lang)} onClick={() => { setPlaying(false); onExit(); }}>{pick(labels.exit ?? BUTTON_TEXT.exit, lang)}</button>}
        </div>
      </header>
      <nav ref={navigation} className="caos-story-stepper" role="tablist" aria-label={pick(copy.steps, lang)}>
        {steps.map((step) => (
          <Link key={step.id} role="tab" aria-selected={step.id === active.id} aria-current={step.id === active.id ? 'step' : undefined} to={step.href} data-story-link={step.id} className={step.id === active.id ? 'caos-story-step is-active' : 'caos-story-step'} onClick={() => { setPlaying(false); onStepChange(step.id); }}>
            <span className="caos-story-step-number">{step.number}</span><span className="caos-story-step-verb" title={pick(step.verb, lang)}>{pick(step.verb, lang)}</span><span className="caos-story-step-headline" title={pick(step.headline, lang)}>{pick(step.headline, lang)}</span>
          </Link>
        ))}
      </nav>
      <div key={active.id} className="caos-story-layout" data-stage-layout="" data-story-transition={active.id}>
        <section className="caos-story-stage" data-stage="" data-drawn="1" aria-label={pick(active.verb, lang)} onPointerDown={() => setPlaying(false)} onKeyDownCapture={(event) => { if (event.target !== event.currentTarget) setPlaying(false); }}>{active.stage}</section>
        <aside className="caos-story-panel" data-stage-panel="" data-panel-layout={sections ? 'sections' : undefined} aria-label={pick(active.verb, lang)} onPointerDown={() => setPlaying(false)} onKeyDownCapture={(event) => { if (event.target !== event.currentTarget) setPlaying(false); }}>{sections ? <RailBody rail={active.panel as RailSection[]} /> : active.panel as ReactNode}</aside>
      </div>
    </section>
  );
}
