import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';

export interface StageSize {
  width: number;
  height: number;
}

/**
 * The size of an element, observed through a callback ref and a ResizeObserver, so a canvas is sized from its real
 * box and never from viewport units, and is not built before it has a size (failure class 4: instruments drawn at
 * zero or at a guessed size).
 */
export function useStageSize(): [(el: HTMLElement | null) => void, StageSize] {
  const [size, setSize] = useState<StageSize>({ width: 0, height: 0 });
  const roRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) => (prev.width === Math.round(r.width) && prev.height === Math.round(r.height) ? prev : { width: Math.round(r.width), height: Math.round(r.height) }));
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      roRef.current = new ResizeObserver(measure);
      roRef.current.observe(el);
    }
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);
  return [ref, size];
}

/**
 * The drawing surface of an instrument. It renders its children only once it has a non-zero size, passes that size
 * down, and declares what it drew (`data-drawn`, `data-width`, `data-height`) so the gate measures the drawing, not
 * the host. A stage that never gets a size is reported.
 */
export function Stage({ label, children, className }: { label: BiText; children: (size: StageSize) => ReactNode; className?: string }) {
  const lang = useShellLang();
  const [ref, size] = useStageSize();
  const ready = size.width > 0 && size.height > 0;
  const name = pick(label, lang);
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => {
      console.error(`[caos-app-shell] Stage "${name}" has no size; give its container a height (ADR-0071 rule 8)`);
    }, 1500);
    return () => clearTimeout(t);
  }, [ready, name]);
  return (
    <div
      ref={ref}
      className={['caos-stage', className].filter(Boolean).join(' ')}
      data-stage={name}
      data-drawn={ready ? '1' : '0'}
      data-width={size.width}
      data-height={size.height}
    >
      {ready ? children(size) : null}
    </div>
  );
}
