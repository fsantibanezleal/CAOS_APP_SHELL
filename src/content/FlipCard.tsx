import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { useShellLang } from '../lib/lang';
import type { Lang } from '../lib/lang';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The limits of a SMALL card (rule of use, CAOS_MANAGE plans/app-shell/0-14-0-plan.md decision 3): a title of about eight
 * words and a back of about forty. They are counted in the interface language: Spanish runs about a quarter longer than
 * English for the same text, so its limits are a quarter higher. `gate/areas.mjs` FLIP_LIMITS holds the same values and
 * `test/flipCard.test.tsx` keeps the two equal.
 */
export const FLIP_LIMITS = {
  title: { en: 8, es: 10 },
  back: { en: 40, es: 50 },
} as const;

/** The words the card itself writes (the product writes none of them). */
export const FLIP_TEXT = {
  show: { en: 'Show details', es: 'Mostrar detalles' },
  hide: { en: 'Hide details', es: 'Ocultar detalles' },
} as const;

export interface FlipCardProps {
  /** The face: a short title (a node, so a card may carry a source mark). */
  title: ReactNode;
  /** The title as plain text, repeated on the back beside the return control; omit it and the back shows none. */
  label?: string;
  /** The back: the content shown after the card turns. It stays in the markup while the face shows. */
  children: ReactNode;
  /** Base of the ids (default: generated). */
  id?: string;
  /** Start turned (default: face up). */
  defaultOpen?: boolean;
  /** Controlled turn, when the product holds it itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /** Forces the language of the card's own words (tests; the card otherwise follows the language toggle). */
  lang?: Lang;
}

/**
 * A small card whose face shows its title and whose back shows its content after a click or a key press (Enter or Space),
 * and back again (shell 0.14.0). Use it only for a small card the reader scans by title first and opens when it matters
 * (a title of about eight words, a back of about forty; the gate fails a card over the limit): a long card or an ordered
 * sequence stays plain.
 *
 * - A real `button` carries `aria-expanded` and `aria-controls`; each face has one, so focus moves to the face that shows
 *   and never rests on a hidden one. Escape closes an open card.
 * - The hidden face is out of the accessibility tree and the tab order (`aria-hidden` and `inert` at once, `visibility: hidden`
 *   after the turn) while its content stays in the markup (search, copy and the gate read it).
 * - `prefers-reduced-motion: reduce` swaps the faces without the turn; colours are theme tokens only.
 * - The face states that it turns: a small icon and a visually hidden label in both languages.
 */
export function FlipCard({ title, label, children, id, defaultOpen = false, open: controlled, onOpenChange, className, lang: forced }: FlipCardProps) {
  const stored = useShellLang();
  const lang = forced ?? stored;
  const auto = useId().replace(/:/g, '');
  const base = id ?? `flip-${auto}`;
  const backId = `${base}-back`;
  const [own, setOwn] = useState(defaultOpen);
  const open = controlled ?? own;
  const front = useRef<HTMLButtonElement | null>(null);
  const back = useRef<HTMLButtonElement | null>(null);
  const byUser = useRef(false);
  const frontFace = useRef<HTMLDivElement | null>(null);
  const backFace = useRef<HTMLDivElement | null>(null);

  // The hidden face is inert at once (no focus, no pointer, no accessibility tree), while CSS hides it after the turn.
  // Set here and not as a prop: React 18 and 19 disagree on how `inert` is written.
  useIsoLayoutEffect(() => {
    frontFace.current?.toggleAttribute('inert', open);
    backFace.current?.toggleAttribute('inert', !open);
  }, [open]);

  // After a turn the reader asked for, focus is on the control of the face that shows.
  useEffect(() => {
    if (!byUser.current) return;
    (open ? back : front).current?.focus({ preventScroll: true });
  }, [open]);

  function turn(next: boolean) {
    byUser.current = true;
    if (controlled === undefined) setOwn(next);
    onOpenChange?.(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      turn(false);
    }
  }

  const icon = <RotateCw size={14} aria-hidden="true" className="caos-flip-icon" />;
  return (
    <div className={['caos-flip', className].filter(Boolean).join(' ')} data-flip-card="" data-flip-open={open ? 'true' : 'false'} onKeyDown={onKeyDown}>
      <div className="caos-flip-inner">
        <div className="caos-flip-face caos-flip-front" aria-hidden={open ? true : undefined} ref={frontFace}>
          <button
            type="button"
            className="caos-flip-toggle"
            aria-expanded={open}
            aria-controls={backId}
            data-flip-toggle="front"
            ref={front}
            onClick={() => turn(true)}
          >
            <span className="caos-flip-title" data-flip-title="">{title}</span>
            {icon}
            <span className="sr-only">{FLIP_TEXT.show[lang]}</span>
          </button>
        </div>
        <div className="caos-flip-face caos-flip-back" id={backId} data-flip-back="" aria-hidden={open ? undefined : true} ref={backFace}>
          <button
            type="button"
            className="caos-flip-toggle caos-flip-return"
            aria-expanded={open}
            aria-controls={backId}
            data-flip-toggle="back"
            ref={back}
            onClick={() => turn(false)}
          >
            {label ? <span className="caos-flip-return-title">{label}</span> : <span />}
            {icon}
            <span className="sr-only">{FLIP_TEXT.hide[lang]}</span>
          </button>
          <div className="caos-flip-content" data-flip-content="">{children}</div>
        </div>
      </div>
    </div>
  );
}
