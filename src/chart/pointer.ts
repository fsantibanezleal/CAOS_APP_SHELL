// A page that scrolls under a resting pointer makes the browser re-dispatch the pointer position (a mouseover, a mouseenter and a mousemove at the
// SAME client coordinates) to the element now under it. A chart that reads such an event moves its cursor and its readout with no input from the
// reader: the gate's document walk, which scrolls the page, then saw the readout text change mid-traversal (issue 208, known defect 62, ADR-0017.2).
// A chart reads a pointer event only when it is real: a move to another position, a pointer that enters or leaves by moving, or the keyboard. The
// same holds for the leave the browser dispatches when the page scrolls the chart away from a resting pointer: it is held, and applied at the next
// real move of the pointer, so the walk reads a settled page and the chart still lets go of its reading when the pointer next moves.

/** What the page knows of the pointer, from the events that reached the window. */
export interface PointerTrack {
  /** The client position of the last pointer move to another position (NaN before the first). */
  x: number;
  y: number;
  /** The time of the last scroll (performance.now()). */
  scrolledAt: number;
  /** The pointer type of the last pointer event: touch and pen are never judged. */
  type: string;
}

/** The fields of a mouse event the judgement reads. */
export interface PointerSample {
  clientX: number;
  clientY: number;
  movementX: number;
  movementY: number;
}

/** The window of a scroll, in ms, in which a pointer event of a pointer the page has never seen move, with no movement, is a re-dispatch. */
export const SCROLL_WINDOW_MS = 300;

export const newTrack = (): PointerTrack => ({ x: Number.NaN, y: Number.NaN, scrolledAt: -Infinity, type: 'mouse' });

/**
 * True when a mouse event is the browser's re-dispatch of the pointer position after a scroll: the pointer is a mouse and the event is at the
 * position of its last move (a real move is to another position, and the browser re-dispatches before it dispatches the scroll event, so the
 * judgement cannot wait for one). Before the page has seen any move (the chart mounted after the pointer came to rest), a move with no movement
 * within SCROLL_WINDOW_MS of a scroll is one. A touch or a pen is never judged (its compatibility mouse events are real).
 */
export function scrollSynthesised(t: PointerTrack, e: PointerSample, now: number): boolean {
  if (t.type !== 'mouse') return false;
  if (!Number.isNaN(t.x)) return e.clientX === t.x && e.clientY === t.y;
  return now - t.scrolledAt < SCROLL_WINDOW_MS && e.movementX === 0 && e.movementY === 0;
}

let track: PointerTrack | null = null;
const realMoveListeners = new Set<() => void>();

/** Calls `fn` after every real pointer move of the page (a move to another position); returns the function that stops it. */
export function onRealMove(fn: () => void): () => void {
  realMoveListeners.add(fn);
  return () => void realMoveListeners.delete(fn);
}

/** Starts following the pointer for the page, once: three passive window listeners that live as long as the page. Safe to call on a server. */
export function pointerTrack(): PointerTrack {
  if (track) return track;
  const t = newTrack();
  track = t;
  if (typeof window === 'undefined') return t;
  window.addEventListener('scroll', () => { t.scrolledAt = performance.now(); }, { capture: true, passive: true });
  const type = (e: Event) => { t.type = (e as PointerEvent).pointerType || 'mouse'; };
  window.addEventListener('pointerdown', type, { capture: true, passive: true });
  window.addEventListener('pointermove', type, { capture: true, passive: true });
  // the bubble phase: a chart judges the event in the capture phase, before this notes it, and an event it stops never reaches here
  window.addEventListener(
    'mousemove',
    (e) => {
      if (e.clientX === t.x && e.clientY === t.y) return;
      t.x = e.clientX;
      t.y = e.clientY;
      for (const fn of [...realMoveListeners]) fn();
    },
    { passive: true },
  );
  return t;
}
