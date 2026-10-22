import type uPlot from 'uplot';
import { brushRange, isZoomed, MIN_SPAN_SHARE, panRange, pinchState, revealValue, wheelFactor, zoomRange, type Range } from './interaction';

/**
 * Zoom, pan and the crosshair of a uPlot chart (shell 0.19.0, Tier A). `createZoom` returns the operations the keyboard of
 * the chart uses and attaches the pointer gestures to the plot: the wheel (only while the chart has the focus; with Ctrl or Meta too,
 * which is how a trackpad pinch arrives, and only while it can change the range), Shift with the mouse drag, one finger on a zoomed chart, two fingers to pinch and pan.
 * The plain mouse drag stays uPlot's own brush. The state it needs from the chart is read through `ctx`, so the handlers
 * always see the chart as it is now.
 */

export interface ZoomContext {
  /** The tab stop of the chart; the wheel zooms only while it holds the focus. */
  plot: HTMLElement;
  log: { x: boolean; y: boolean };
  /** Zoom and pan the y axis with the x axis. */
  both: boolean;
  /** Whether the chart may be zoomed now (it has two x values and its zoom is not turned off). */
  enabled: () => boolean;
  /** The range the chart opened with. */
  full: () => { x: Range; y: Range } | null;
  /** The least span an axis can be zoomed to, in the axis's units, beyond the default thousandth of the full span (labels that would repeat); undefined for none. */
  least?: (axis: 'x' | 'y') => number | undefined;
  /** Set while a range is being set by these operations: a scale with a fixed range (`x.range`, `y.range`) lets an explicit range through only then. */
  explicit: { current: boolean };
}

export interface ZoomControls {
  /** Each returns whether the range changed (a zoom out at the full range, or in at the least span, changes nothing). */
  zoomBy: (factor: number, ax: number, ay?: number) => boolean;
  panBy: (shareX: number, shareY?: number) => boolean;
  /** Zoom to a brushed range (y only where both axes zoom). */
  brush: (x: Range | null, y?: Range) => boolean;
  reveal: (x: number) => void;
  reset: () => void;
  view: () => { x: [number, number]; y: [number, number] };
  /** Put the crosshair on point `idx` of the data (the readout follows). */
  place: (idx: number) => void;
  clear: () => void;
  zoomed: () => boolean;
  detach: () => void;
}

const rangeOf = (u: uPlot, key: 'x' | 'y'): [number, number] => [u.scales[key].min ?? 0, u.scales[key].max ?? 1];

export function createZoom(u: uPlot, ctx: ZoomContext): ZoomControls {
  const differs = (a: Range, b: Range, full: Range) => {
    const tol = Math.abs(full[1] - full[0]) * 1e-9;
    return Math.abs(a[0] - b[0]) > tol || Math.abs(a[1] - b[1]) > tol;
  };
  /** Sets the ranges asked for and tells whether either one moved the view. */
  const apply = (nx: Range | null, ny: Range | null): boolean => {
    const full = ctx.full();
    const cx = rangeOf(u, 'x');
    const cy = rangeOf(u, 'y');
    const moved = Boolean((nx && differs(nx, cx, full ? full.x : cx)) || (ny && differs(ny, cy, full ? full.y : cy)));
    if (!moved) return false;
    ctx.explicit.current = true;
    try {
      u.batch(() => {
        if (nx) u.setScale('x', { min: nx[0], max: nx[1] });
        if (ny) u.setScale('y', { min: ny[0], max: ny[1] });
      });
    } finally {
      ctx.explicit.current = false;
    }
    return true;
  };
  const isNow = (): boolean => {
    const full = ctx.full();
    if (!full) return false;
    return isZoomed(rangeOf(u, 'x'), full.x) || (ctx.both && isZoomed(rangeOf(u, 'y'), full.y));
  };
  // the least span of an axis: a thousandth of the full span, or more where the labels could not tell the ticks apart (never on a log axis)
  const leastOf = (axis: 'x' | 'y', full: Range): number | undefined => {
    if (ctx.log[axis]) return undefined;
    return Math.max(Math.abs(full[1] - full[0]) * MIN_SPAN_SHARE, ctx.least?.(axis) ?? 0);
  };

  const zoomBy = (factor: number, ax: number, ay?: number): boolean => {
    const full = ctx.full();
    if (!full || !ctx.enabled()) return false;
    const nx = zoomRange(rangeOf(u, 'x'), full.x, ax, factor, { log: ctx.log.x, minSpan: leastOf('x', full.x) });
    const ny = ctx.both && ay !== undefined ? zoomRange(rangeOf(u, 'y'), full.y, ay, factor, { log: ctx.log.y, minSpan: leastOf('y', full.y) }) : null;
    return apply(nx, ny);
  };
  const panBy = (shareX: number, shareY = 0): boolean => {
    const full = ctx.full();
    if (!full || !ctx.enabled()) return false;
    const nx = shareX ? panRange(rangeOf(u, 'x'), full.x, shareX, ctx.log.x) : null;
    const ny = ctx.both && shareY ? panRange(rangeOf(u, 'y'), full.y, shareY, ctx.log.y) : null;
    return apply(nx, ny);
  };
  const brush = (sx: Range | null, sy?: Range): boolean => {
    const full = ctx.full();
    if (!full || !ctx.enabled()) return false;
    const nx = sx ? brushRange(sx, full.x, leastOf('x', full.x) ?? 0) : null;
    const ny = ctx.both && sy ? brushRange(sy, full.y, leastOf('y', full.y) ?? 0) : null;
    return apply(nx, ny);
  };
  const reveal = (x: number) => {
    const full = ctx.full();
    if (!full || !isNow()) return;
    const cur = rangeOf(u, 'x');
    const next = revealValue(cur, full.x, x, ctx.log.x);
    if (next[0] !== cur[0] || next[1] !== cur[1]) apply(next, null);
  };
  const reset = () => {
    const full = ctx.full();
    if (!full) return;
    apply(full.x, ctx.both ? full.y : null);
  };
  const place = (idx: number) => {
    const d = u.data as (number | null)[][];
    const xv = d[0][idx];
    if (xv === null || xv === undefined) return;
    const left = u.valToPos(xv, 'x');
    let top = u.bbox.height / (window.devicePixelRatio || 1) / 2;
    for (let k = 1; k < d.length; k++) {
      const v = d[k][idx];
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        top = u.valToPos(v, 'y');
        break;
      }
    }
    u.setCursor({ left, top }, true);
  };
  const clear = () => u.setCursor({ left: -10, top: -10 }, true);

  // ---- the pointer gestures on the plot ----
  const over = u.over;
  const onHandle = (e: Event) => e.target instanceof Element && e.target.closest('[data-y-handle]') !== null;
  const ac = new AbortController();
  const opt = { signal: ac.signal };
  const sizeOf = () => {
    const r = over.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height), left: r.left, top: r.top };
  };

  over.addEventListener(
    'wheel',
    (e) => {
      if (!ctx.enabled()) return;
      // The rule: the wheel (with Ctrl or Meta too, which is how a trackpad pinch arrives) zooms the chart that holds the focus (a click or
      // a Tab gives it), and only while that changes the range: at the full range a wheel out, and at the least span a wheel in, is the
      // page's, so a chart in a long document never traps the scroll. Over a chart without the focus the wheel and the browser's own
      // page zoom (Ctrl and the wheel) are left alone.
      if (!ctx.plot.contains(document.activeElement)) return;
      const s = sizeOf();
      const changed =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) && isNow()
          ? panBy(e.deltaX / s.w)
          : zoomBy(wheelFactor(e.deltaY, e.deltaMode), u.posToVal(e.clientX - s.left, 'x'), ctx.both ? u.posToVal(e.clientY - s.top, 'y') : undefined);
      if (changed) e.preventDefault();
    },
    { ...opt, passive: false },
  );

  // Shift with the mouse pans: it must not start uPlot's brush, which listens for the same press.
  u.root.addEventListener(
    'mousedown',
    (e) => {
      if (e.shiftKey && e.button === 0 && ctx.enabled() && !onHandle(e)) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    { ...opt, capture: true },
  );

  const pts = new Map<number, { x: number; y: number }>();
  let pan: { id: number; x: number; y: number } | null = null;
  let pinch: { dist: number } | null = null;

  const startPan = (id: number, x: number, y: number) => {
    pan = { id, x, y };
    try {
      over.setPointerCapture(id);
    } catch {
      /* a pointer that is already gone */
    }
  };
  over.addEventListener(
    'pointerdown',
    (e) => {
      if (onHandle(e)) return;
      ctx.plot.focus({ preventScroll: true });
      if (!ctx.enabled()) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (e.pointerType === 'mouse') {
        if (e.button === 0 && e.shiftKey) startPan(e.pointerId, e.clientX, e.clientY);
        return;
      }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { dist: pinchState(a, b).dist };
        pan = null;
      } else if (pts.size === 1 && isNow()) startPan(e.pointerId, e.clientX, e.clientY);
    },
    opt,
  );
  over.addEventListener(
    'pointermove',
    (e) => {
      if (!pts.has(e.pointerId)) return;
      const before = pts.get(e.pointerId)!;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const s = sizeOf();
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const now = pinchState(a, b);
        if (pinch.dist > 0 && now.dist > 0) {
          zoomBy(pinch.dist / now.dist, u.posToVal(now.mx - s.left, 'x'), ctx.both ? u.posToVal(now.my - s.top, 'y') : undefined);
          pinch.dist = now.dist;
        }
        // two fingers moving together pan: half of each finger's move is the middle's
        panBy(-(e.clientX - before.x) / 2 / s.w, ctx.both ? (e.clientY - before.y) / 2 / s.h : 0);
        return;
      }
      if (pan && pan.id === e.pointerId) {
        panBy(-(e.clientX - pan.x) / s.w, ctx.both ? (e.clientY - pan.y) / s.h : 0);
        pan.x = e.clientX;
        pan.y = e.clientY;
      }
    },
    opt,
  );
  const end = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pan && pan.id === e.pointerId) {
      pan = null;
      if (over.hasPointerCapture?.(e.pointerId)) over.releasePointerCapture(e.pointerId);
    }
    if (pts.size < 2) pinch = null;
    // a finger left on a zoomed chart goes on panning
    if (pts.size === 1 && !pan && isNow()) {
      const [[id, p]] = [...pts.entries()];
      startPan(id, p.x, p.y);
    }
  };
  over.addEventListener('pointerup', end, opt);
  over.addEventListener('pointercancel', end, opt);
  over.addEventListener(
    'dblclick',
    (e) => {
      if (onHandle(e) || !ctx.enabled()) return;
      reset();
    },
    opt,
  );

  return {
    zoomBy,
    panBy,
    brush,
    reveal,
    reset,
    view: () => ({ x: rangeOf(u, 'x'), y: rangeOf(u, 'y') }),
    place,
    clear,
    zoomed: isNow,
    detach: () => ac.abort(),
  };
}
