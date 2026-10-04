import { type RefObject, useEffect } from 'react';

/**
 * Marks a horizontally scrolling row with `data-fade-start` / `data-fade-end` when content is hidden at that end, so
 * the shell's mask fades it and a reader sees that more links or tabs follow; scrolls the active item into view with
 * the row's own `scrollLeft` (never `scrollIntoView`, which also moves the document). Known shell defect 11.
 */
export function useOverflowFade(ref: RefObject<HTMLElement | null>, activeSelector: string, deps: unknown[] = []): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.dataset.fadeStart = start ? '1' : '0';
      el.dataset.fadeEnd = end ? '1' : '0';
    };
    const active = el.querySelector<HTMLElement>(activeSelector);
    if (active) {
      const left = active.offsetLeft - el.offsetLeft;
      if (left < el.scrollLeft || left + active.offsetWidth > el.scrollLeft + el.clientWidth) {
        el.scrollLeft = Math.max(0, left - 24);
      }
    }
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
