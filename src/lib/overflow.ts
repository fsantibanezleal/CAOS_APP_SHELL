import { type RefObject, useEffect } from 'react';

/** The width of the faded edge; an item is brought this far inside the row so the mask never covers it. */
const FADE = 28;

/** Scrolls `row` (its own `scrollLeft` only) so `item` lies fully inside it, clear of the faded edges when the row is
 * wide enough for that; an item wider than the row between its fades is fitted with the margin it leaves. */
function reveal(row: HTMLElement, item: HTMLElement): void {
  const r = row.getBoundingClientRect();
  const b = item.getBoundingClientRect();
  const margin = Math.max(0, Math.min(FADE, (r.width - b.width) / 2));
  // instant: a row with scroll-behavior smooth would animate an assignment, leaving a focused item half hidden while
  // it moves (the navigation e2e caught it as a flaky failure)
  if (b.left < r.left + margin) {
    row.scrollTo({ left: Math.max(0, row.scrollLeft - (r.left + margin - b.left)), behavior: 'instant' });
  } else if (b.right > r.right - margin) {
    row.scrollTo({ left: Math.min(row.scrollWidth - row.clientWidth, row.scrollLeft + (b.right - (r.right - margin))), behavior: 'instant' });
  }
}

/**
 * Marks a horizontally scrolling row with `data-fade-start` / `data-fade-end` when content is hidden at that end, so
 * the shell's mask fades it and a reader sees that more links or tabs follow; scrolls the active item into view, and
 * any item that receives keyboard focus (a browser leaves a partly hidden focused item where it is), with the row's
 * own `scrollLeft` (never `scrollIntoView`, which also moves the document). Known shell defect 11; ADR-0071 rule 9.
 */
export function useOverflowFade(ref: RefObject<HTMLElement | null>, activeSelector: string | null, deps: unknown[] = []): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.dataset.fadeStart = start ? '1' : '0';
      el.dataset.fadeEnd = end ? '1' : '0';
    };
    // The reader's focus wins: after a route change the effect runs late, and revealing the active item then would
    // scroll a link the keyboard has already moved to back out of view (a race the navigation e2e caught).
    const focused = document.activeElement instanceof HTMLElement && el.contains(document.activeElement) && document.activeElement !== el ? document.activeElement : null;
    const active = focused ?? (activeSelector ? el.querySelector<HTMLElement>(activeSelector) : null);
    if (active && el.scrollWidth > el.clientWidth) reveal(el, active);
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target !== el && el.contains(target) && el.scrollWidth > el.clientWidth) reveal(el, target);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('focusin', onFocus);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('focusin', onFocus);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
