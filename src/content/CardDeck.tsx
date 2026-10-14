import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useShellLang } from '../lib/lang';
import type { Lang } from '../lib/lang';
import { FlipCard } from './FlipCard';

/** The words the deck itself writes (the product writes none of them). */
export const DECK_TEXT = {
  previous: { en: 'Previous', es: 'Anterior' },
  next: { en: 'Next', es: 'Siguiente' },
  of: { en: 'of', es: 'de' },
  to: { en: 'to', es: 'a' },
} as const;

/** The narrowest a card is drawn, in rem, and the gap between cards, in rem (the stylesheet's `.caos-deck-track`). */
const MIN_CARD_REM = 15;
const GAP_REM = 0.9;
/** A horizontal move of at least this many pixels, and twice as long as it is tall, is a swipe. */
const SWIPE_PX = 50;

/** How many cards of at least `minCard` px fit a row of `width` px with `gap` px between them: at least one. */
export function perPageFor(width: number, minCard: number, gap: number): number {
  if (!(width > 0)) return 1;
  return Math.max(1, Math.floor((width + gap) / (minCard + gap)));
}

/** The window `[start, end)` of `n` cards that `per` at a time show from `start`: never empty, never past the end, pulled back so it is full. */
export function deckWindow(n: number, per: number, start: number): { start: number; end: number } {
  const p = Math.max(1, Math.floor(per));
  if (p >= n) return { start: 0, end: n };
  const s = Math.min(Math.max(0, start), n - p);
  return { start: s, end: s + p };
}

/** "2 of 5" for one card, "1 to 3 of 5" for several (1-based). */
export function deckPosition(start: number, shown: number, n: number, lang: Lang): string {
  const o = DECK_TEXT.of[lang];
  if (shown <= 1) return `${start + 1} ${o} ${n}`;
  return `${start + 1} ${DECK_TEXT.to[lang]} ${start + shown} ${o} ${n}`;
}

export interface DeckCard {
  /** Stable key (default: the index). */
  id?: string | number;
  /** The title of the card (a flip card's face). */
  title: ReactNode;
  /** The title as plain text, for the back of a flip card. */
  label?: string;
  /** The content: a plain card's body, a flip card's back. */
  body: ReactNode;
  /** Attributes written on the card's list item (for example `data-exec-item`). */
  attrs?: Record<string, string | number | undefined>;
}

export interface CardDeckProps {
  cards: DeckCard[];
  /** Render each card as a `FlipCard` (a small card the reader scans by title; see FlipCard for the rule of use). */
  flip?: boolean;
  /** A list longer than this is a carousel; up to it, a row (default 4). */
  carouselAbove?: number;
  /** The accessible name of the deck. */
  ariaLabel: string;
  /** Extra classes of the list that holds the cards. */
  className?: string;
  /** Forces the language of the deck's own words (tests). */
  lang?: Lang;
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * A list of cards, plain or as flip cards, shown as a row up to `carouselAbove` cards (default 4) and as a CAROUSEL above
 * it (shell 0.14.0): one row of as many cards as fit (at least one), previous and next buttons, a swipe on touch, the arrow
 * keys, Home and End while it has focus, and a position ("2 of 5"). No autoplay. Every card is reachable by keyboard: the
 * cards the window hides are removed from sight and from the tab order but stay in the markup. The carousel pages through
 * its cards instead of scrolling a strip, so neither the page nor its panel ever scrolls sideways (ADR-0071). Reduced
 * motion removes the slide. When every card fits, the controls are not drawn.
 */
export function CardDeck({ cards, flip = false, carouselAbove = 4, ariaLabel, className, lang: forced }: CardDeckProps) {
  const stored = useShellLang();
  const lang = forced ?? stored;
  const n = cards.length;
  const carousel = n > carouselAbove;
  const rootRef = useRef<HTMLDivElement | null>(null);
  // one card until the row is measured (before the first paint): the markup of a carousel always has its controls
  const [per, setPer] = useState(1);
  const [start, setStart] = useState(0);
  const [moved, setMoved] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // How many cards fit the row now and when it resizes; the first paint is already right.
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!carousel || !root || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setPer(perPageFor(root.clientWidth, MIN_CARD_REM * rem, GAP_REM * rem));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [carousel, n]);

  const win = deckWindow(n, carousel ? per : n, start);
  const shown = win.end - win.start;
  const controls = carousel && shown < n;
  const atStart = win.start <= 0;
  const atEnd = win.end >= n;

  function go(to: number, step = false) {
    if (!controls) return;
    setMoved(true);
    setStart(deckWindow(n, per, step ? win.start + to : to).start);
  }
  const page = () => Math.max(1, per);

  // A window that moved never leaves keyboard focus on a card it hid.
  useEffect(() => {
    const root = rootRef.current;
    const a = document.activeElement as HTMLElement | null;
    if (!root || !a || !root.contains(a) || a.checkVisibility?.({ checkVisibilityCSS: true }) !== false) return;
    (root.querySelector('[data-deck-card]:not([hidden]) button') as HTMLElement | null)?.focus({ preventScroll: true });
  }, [win.start, win.end]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!controls || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (e.key === 'ArrowRight') go(1, true);
    else if (e.key === 'ArrowLeft') go(-1, true);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n);
    else return;
    e.preventDefault();
  }

  function onTouchStart(e: TouchEvent<HTMLUListElement>) {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  }
  function onTouchEnd(e: TouchEvent<HTMLUListElement>) {
    const from = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!from || !t || !controls) return;
    const dx = t.clientX - from.x;
    const dy = t.clientY - from.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > 2 * Math.abs(dy)) go(dx < 0 ? page() : -page(), true);
  }

  return (
    <div
      ref={rootRef}
      className="caos-deck"
      data-card-deck=""
      data-deck-mode={carousel ? 'carousel' : 'row'}
      data-deck-per={carousel ? Math.min(per, n) : n}
      data-deck-flip={flip ? '' : undefined}
      data-deck-moved={moved ? '' : undefined}
      role={carousel ? 'group' : undefined}
      aria-roledescription={carousel ? 'carousel' : undefined}
      aria-label={carousel ? ariaLabel : undefined}
      onKeyDown={carousel ? onKeyDown : undefined}
    >
      <ul
        className={['caos-deck-track', className].filter(Boolean).join(' ')}
        data-deck-track=""
        aria-label={carousel ? undefined : ariaLabel}
        style={carousel ? ({ '--deck-per': Math.min(per, n) } as CSSProperties) : undefined}
        onTouchStart={carousel ? onTouchStart : undefined}
        onTouchEnd={carousel ? onTouchEnd : undefined}
      >
        {cards.map((c, i) => (
          <li key={c.id ?? i} className="caos-deck-card" data-deck-card="" hidden={carousel && (i < win.start || i >= win.end)} {...c.attrs}>
            {flip ? (
              <FlipCard title={c.title} label={c.label} lang={lang}>
                {c.body}
              </FlipCard>
            ) : (
              <div className="caos-card">
                <strong className="caos-card-title">{c.title}</strong>
                {c.body}
              </div>
            )}
          </li>
        ))}
      </ul>
      {controls && (
        <div className="caos-deck-bar">
          <button type="button" className="caos-deck-btn" data-deck-prev="" aria-label={DECK_TEXT.previous[lang]} aria-disabled={atStart} onClick={() => !atStart && go(-page(), true)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="caos-deck-position" data-deck-position="" aria-live="polite">
            {deckPosition(win.start, shown, n, lang)}
          </span>
          <button type="button" className="caos-deck-btn" data-deck-next="" aria-label={DECK_TEXT.next[lang]} aria-disabled={atEnd} onClick={() => !atEnd && go(page(), true)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
