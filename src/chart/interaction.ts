/**
 * The pure rules of the interactions every shell chart carries (Tier A of the interactive-visualization rubric, shell 0.19.0):
 * zoom and pan of a range, the keys of the keyboard model, the window of categories a bar chart shows, the text a screen
 * reader gets, and the thinning of a long table. Nothing here touches the DOM, so each rule is tested in node.
 */

import type { Lang } from '../lib/lang';
import { textWidth } from './text';

/** A range [low, high] of an axis. */
export type Range = readonly [number, number];

/** Zoom never goes below this share of the full span (a thousandth), unless the caller gives its own least span. */
export const MIN_SPAN_SHARE = 1e-3;

/** One wheel notch (deltaY 100) multiplies the span by about 0.86 in and 1.16 out; keys use `KEY_ZOOM`. */
export const WHEEL_RATE = 0.0015;

/** The factor a `+` or `-` key zooms by. */
export const KEY_ZOOM = 0.7;

/** The share of the visible span a Shift+arrow pans. */
export const KEY_PAN = 0.1;

/** The least a pointer moves before a press becomes a drag (a click stays a click). */
export const DRAG_THRESHOLD = 5;

const forward = (v: number, log: boolean): number => (log ? Math.log10(v) : v);
const back = (v: number, log: boolean): number => (log ? 10 ** v : v);

/** Whether an axis can be zoomed in log space: a log axis with a range that reaches 0 or below is zoomed linearly. */
function logOk(log: boolean | undefined, ...ranges: Range[]): boolean {
  return Boolean(log) && ranges.every((r) => r[0] > 0 && r[1] > 0);
}

/**
 * The range after a zoom by `factor` (below 1 in, above 1 out) that keeps `anchor` where it is on the screen, kept inside
 * `full`: a range that would leave it slides back inside, and one as wide as `full` (or wider) is `full`. The span never
 * goes below `minSpan` (a thousandth of the full span by default). On a log axis the zoom is made in decades.
 */
export function zoomRange(cur: Range, full: Range, anchor: number, factor: number, opts: { log?: boolean; minSpan?: number } = {}): [number, number] {
  const log = logOk(opts.log, cur, full) && anchor > 0;
  const c0 = forward(Math.min(cur[0], cur[1]), log);
  const c1 = forward(Math.max(cur[0], cur[1]), log);
  const f0 = forward(Math.min(full[0], full[1]), log);
  const f1 = forward(Math.max(full[0], full[1]), log);
  const fullSpan = f1 - f0;
  if (!(fullSpan > 0) || !Number.isFinite(factor) || !(factor > 0) || !Number.isFinite(anchor)) return [full[0], full[1]];
  const span = c1 - c0 > 0 ? c1 - c0 : fullSpan;
  const least = Math.min(fullSpan, opts.minSpan !== undefined ? forward(opts.minSpan, false) : fullSpan * MIN_SPAN_SHARE);
  const next = Math.min(fullSpan, Math.max(least, span * factor));
  if (next >= fullSpan * (1 - 1e-9)) return [full[0], full[1]];
  const a = forward(anchor, log);
  const share = Math.min(1, Math.max(0, (a - c0) / span));
  let lo = a - share * next;
  let hi = lo + next;
  if (lo < f0) {
    hi += f0 - lo;
    lo = f0;
  }
  if (hi > f1) {
    lo -= hi - f1;
    hi = f1;
  }
  return [back(Math.max(f0, lo), log), back(Math.min(f1, hi), log)];
}

/** The range moved by a share of its own span (positive to the right), kept inside `full` without changing its span. */
export function panRange(cur: Range, full: Range, share: number, log = false): [number, number] {
  const lg = logOk(log, cur, full);
  const c0 = forward(Math.min(cur[0], cur[1]), lg);
  const c1 = forward(Math.max(cur[0], cur[1]), lg);
  const f0 = forward(Math.min(full[0], full[1]), lg);
  const f1 = forward(Math.max(full[0], full[1]), lg);
  const span = c1 - c0;
  if (!(span > 0) || span >= f1 - f0 || !Number.isFinite(share)) return [cur[0], cur[1]];
  const lo = Math.min(f1 - span, Math.max(f0, c0 + share * span));
  return [back(lo, lg), back(lo + span, lg)];
}

/** The range that holds a value: `cur` when it is inside, else `cur` slid so the value sits at its middle (kept inside `full`). */
export function revealValue(cur: Range, full: Range, value: number, log = false): [number, number] {
  if (value >= Math.min(cur[0], cur[1]) && value <= Math.max(cur[0], cur[1])) return [cur[0], cur[1]];
  const lg = logOk(log, cur, full) && value > 0;
  const mid = (forward(cur[0], lg) + forward(cur[1], lg)) / 2;
  return panRange(cur, full, (forward(value, lg) - mid) / (forward(cur[1], lg) - forward(cur[0], lg) || 1), log);
}

/** Whether `cur` is any range other than `full` (to a billionth of the span). */
export function isZoomed(cur: Range, full: Range): boolean {
  const tol = Math.abs(full[1] - full[0]) * 1e-9;
  return Math.abs(cur[0] - full[0]) > tol || Math.abs(cur[1] - full[1]) > tol;
}

/** A multiplier for the span from a wheel event: deltaY in pixels, lines (x16) or pages (x400); pinch on a trackpad arrives as a wheel with Ctrl. */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(Math.max(-600, Math.min(600, px)) * WHEEL_RATE);
}

/** What a key does on a focused chart. */
export type KeyAction = 'prev' | 'next' | 'first' | 'last' | 'zoomIn' | 'zoomOut' | 'panPrev' | 'panNext' | 'reset' | 'activate';

/**
 * The keyboard model of a chart: Left and Right (and Up and Down) move the crosshair from point to point, Home and End go to
 * the first and last, `+` and `-` zoom around the crosshair, Shift with an arrow pans, `0` and Escape reset, Enter and Space
 * choose the point. A key with Ctrl, Meta or Alt is the browser's (page zoom) and is not handled.
 */
export function keyAction(key: string, mods: { shift?: boolean; ctrl?: boolean; meta?: boolean; alt?: boolean } = {}): KeyAction | null {
  if (mods.ctrl || mods.meta || mods.alt) return null;
  const arrow = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : key === 'ArrowRight' || key === 'ArrowDown' ? 1 : 0;
  if (arrow !== 0) return mods.shift ? (arrow < 0 ? 'panPrev' : 'panNext') : arrow < 0 ? 'prev' : 'next';
  switch (key) {
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case '+':
    case '=':
      return 'zoomIn';
    case '-':
    case '_':
      return 'zoomOut';
    case '0':
    case 'Escape':
      return 'reset';
    case 'Enter':
    case ' ':
      return 'activate';
    default:
      return null;
  }
}

/** The index the crosshair moves to: from nothing, `next` and `first` take the first and `prev` and `last` the last; the ends hold. */
export function stepIndex(i: number | null, action: 'prev' | 'next' | 'first' | 'last', n: number): number | null {
  if (n <= 0) return null;
  if (action === 'first') return 0;
  if (action === 'last') return n - 1;
  if (i === null || i < 0 || i >= n) return action === 'next' ? 0 : n - 1;
  return Math.min(n - 1, Math.max(0, i + (action === 'next' ? 1 : -1)));
}

/** The first index whose x lies in [lo, hi] (`xs` ascending), or null; used to start a crosshair inside a zoomed view. */
export function firstVisible(xs: readonly number[], lo: number, hi: number): number | null {
  for (let i = 0; i < xs.length; i++) if (xs[i] >= lo && xs[i] <= hi) return i;
  return null;
}

/** A window of categories [start, end) of a bar chart, whole bars only, at least `minCount` of them, inside [0, n]. */
export function roundWindow(r: Range, n: number, minCount = 2): [number, number] {
  const count = Math.min(n, Math.max(1, minCount));
  let s = Math.max(0, Math.min(n - count, Math.round(r[0])));
  let e = Math.min(n, Math.max(s + count, Math.round(r[1])));
  if (e - s < count) s = Math.max(0, e - count);
  return [s, e];
}

/**
 * A window of whole bars after a keyboard zoom by `factor` around `anchor` (in bars): rounded to whole bars, and always at least
 * one bar narrower (zooming in) or wider (zooming out) while it can be, so a key press never does nothing because the rounding
 * undid it. The bar dropped or added is the one farther from the anchor.
 */
export function stepWindow(cur: Range, n: number, anchor: number, factor: number, minCount = 2): [number, number] {
  const least = Math.min(n, Math.max(1, minCount));
  const span = cur[1] - cur[0];
  let w = roundWindow(zoomRange(cur, [0, n], anchor, factor, { minSpan: least }), n, least);
  const share = span > 0 ? (anchor - cur[0]) / span : 0.5;
  if (factor < 1 && w[1] - w[0] >= span && span > least) w = share < 0.5 ? [cur[0], cur[1] - 1] : [cur[0] + 1, cur[1]];
  else if (factor > 1 && w[1] - w[0] <= span && span < n) w = (share >= 0.5 && cur[0] > 0) || cur[1] >= n ? [cur[0] - 1, cur[1]] : [cur[0], cur[1] + 1];
  return roundWindow(w, n, least);
}

/** The categories a window shows: the whole list when no window is given. */
export function windowRange(n: number, win: Range | null): [number, number] {
  return win ? roundWindow(win, n) : [0, n];
}

/** The category (index in the data) under a position along the category axis, or null outside it. */
export function categoryAt(pos: number, start: number, end: number, win: Range, n: number): number | null {
  if (!(end > start) || pos < start || pos > end) return null;
  const [s, e] = windowRange(n, win);
  const k = Math.min(e - s - 1, Math.floor(((pos - start) / (end - start)) * (e - s)));
  return s + Math.max(0, k);
}

/** The window of categories a brush from `a` to `b` (positions along the category axis) selects: every category it touches. */
export function brushWindow(a: number, b: number, start: number, end: number, win: Range, n: number): [number, number] | null {
  if (!(end > start)) return null;
  const lo = Math.max(start, Math.min(a, b));
  const hi = Math.min(end, Math.max(a, b));
  const first = categoryAt(lo, start, end, win, n);
  const last = categoryAt(Math.min(hi, end - 1e-9), start, end, win, n);
  if (first === null || last === null) return null;
  return roundWindow([first, last + 1], n);
}

/** Whether a window shows fewer categories than there are. */
export function windowZoomed(n: number, win: Range | null): boolean {
  if (!win) return false;
  const [s, e] = windowRange(n, win);
  return s > 0 || e < n;
}

/** The distance of two touch points and their middle, for a pinch. */
export function pinchState(a: { x: number; y: number }, b: { x: number; y: number }): { dist: number; mx: number; my: number } {
  return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}

/** Whether an axis title of `px` text fits along an axis of `room` pixels. */
export function axisTitleFits(title: string, room: number, px = 11): boolean {
  return textWidth(title, px) <= Math.max(0, room);
}

/** Text broken at words into lines of at most `width` pixels, as many lines as it needs (a word longer than a line is broken). Never shortened. */
export function wrapLines(text: string, width: number, px = 11): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const push = (word: string) => {
    let rest = word;
    while (textWidth(rest, px) > width && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && textWidth(rest.slice(0, cut), px) > width) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  };
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (!line || textWidth(tryLine, px) <= width) {
      if (!line && textWidth(word, px) > width) push(word);
      else line = tryLine;
    } else {
      lines.push(line);
      line = '';
      if (textWidth(word, px) > width) push(word);
      else line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

/** Which rows of a long table to keep: all of them up to `most`, else every k-th with the last one kept. */
export function thinRows(n: number, most = 1000): number[] {
  if (n <= most) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil(n / most);
  const rows: number[] = [];
  for (let i = 0; i < n; i += step) rows.push(i);
  if (rows[rows.length - 1] !== n - 1) rows.push(n - 1);
  return rows;
}

/** Whether every finite value is a whole number (a count): the axis of a count ticks at whole numbers only. */
export function allIntegers(values: readonly (number | null | undefined)[]): boolean {
  return values.every((v) => v === null || v === undefined || !Number.isFinite(v) || Number.isInteger(v));
}

/**
 * Whether new aligned data is the data already drawn (the same values, whether or not in the same array): an element-wise compare, so a
 * swap of two values or a change too small for a sum to hold is never taken for the same data. A missing value (null, undefined, NaN
 * or infinite) equals any other missing value.
 */
export function sameData(a: readonly (readonly (number | null | undefined)[])[], b: readonly (readonly (number | null | undefined)[])[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let k = 0; k < a.length; k++) {
    const x = a[k];
    const y = b[k];
    if (x === y) continue;
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) {
      const u = x[i];
      const v = y[i];
      if (u === v) continue;
      const mu = u === null || u === undefined || !Number.isFinite(u);
      const mv = v === null || v === undefined || !Number.isFinite(v);
      if (mu && mv) continue;
      return false;
    }
  }
  return true;
}

/**
 * The least span an axis can be zoomed to before two of its tick labels read alike. An axis with fixed `decimals` ticks only at
 * multiples of its decimals (`tickSteps`), so it has no bound (0); an axis of significant digits writes a value at or above
 * 10^(digits-1) as a whole number and a smaller one to `digits` digits, so its labels cannot tell apart ticks closer than that
 * resolution, and an axis `plotPx` long holds about `plotPx / spacePx` ticks. Scientific notation has no fixed resolution (0).
 */
export function leastLabelSpan(fmt: { decimals?: number; digits?: number; percent?: boolean } | undefined, full: Range, plotPx: number, spacePx: number): number {
  if (fmt && fmt.decimals !== undefined) return 0;
  const scale = fmt?.percent ? 100 : 1;
  const digits = fmt?.digits ?? 4;
  const top = Math.max(Math.abs(full[0]), Math.abs(full[1])) * scale;
  if (!(top > 0) || !Number.isFinite(top) || top < SCIENTIFIC_FLOOR) return 0;
  const res = top >= 10 ** (digits - 1) ? 1 : 10 ** (Math.floor(Math.log10(top)) - digits + 1);
  return ((res * (Math.ceil(Math.max(0, plotPx) / Math.max(1, spacePx)) + 1)) / scale);
}

/** Below this magnitude `formatTicks` writes an axis in scientific notation (the shell's own floor, `SCIENTIFIC_BELOW` in `lib/format`). */
const SCIENTIFIC_FLOOR = 1e-4;

/** A time of an axis (epoch seconds) in the page language: the date, with the time of day when the span shown is under three days. */
export function formatTime(seconds: number, lang: Lang, spanSeconds: number): string {
  const short = spanSeconds < 3 * 86400;
  const opts: Intl.DateTimeFormatOptions = short ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { year: 'numeric', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-CL' : 'en-US', opts).format(new Date(seconds * 1000));
}

/** The range a brush from `a` to `b` selects: in order, inside `full`, and never narrower than `least` (widened around its middle, slid back inside). */
export function brushRange(sel: Range, full: Range, least: number): [number, number] {
  const f0 = Math.min(full[0], full[1]);
  const f1 = Math.max(full[0], full[1]);
  if (least >= f1 - f0) return [f0, f1];
  let lo = Math.max(f0, Math.min(sel[0], sel[1]));
  let hi = Math.min(f1, Math.max(sel[0], sel[1]));
  if (hi - lo < least) {
    const mid = (lo + hi) / 2;
    lo = mid - least / 2;
    hi = mid + least / 2;
    if (lo < f0) {
      hi += f0 - lo;
      lo = f0;
    }
    if (hi > f1) {
      lo -= hi - f1;
      hi = f1;
    }
  }
  return [lo, hi];
}

/** The words of the one-line summary a screen reader gets for a chart (every number already written in the page language). */
export interface SummaryParts {
  kind: 'line' | 'bars';
  name: string;
  /** Line charts: the x axis and its ends. */
  xLabel?: string;
  xFrom?: string;
  xTo?: string;
  /** The names of the series (line charts). */
  series?: string[];
  /** The value axis and where it is lowest and highest. */
  yLabel?: string;
  low?: { text: string; at: string };
  high?: { text: string; at: string };
  /** How many points or bars. */
  count: number;
}

/** The one-line text summary of a chart: what it is, its series, its x range and its extremes. */
export function chartSummary(lang: Lang, p: SummaryParts): string {
  const es = lang === 'es';
  const parts: string[] = [];
  if (p.kind === 'bars') parts.push(es ? `Gráfico de barras, ${p.name}: ${p.count} barras` : `Bar chart, ${p.name}: ${p.count} bars`);
  else parts.push(es ? `Gráfico de líneas, ${p.name}: ${p.count} puntos` : `Line chart, ${p.name}: ${p.count} points`);
  if (p.series && p.series.length > 0) parts.push(es ? `${p.series.length === 1 ? 'serie' : 'series'} ${p.series.join(', ')}` : `${p.series.length === 1 ? 'series' : 'series'} ${p.series.join(', ')}`);
  if (p.xLabel && p.xFrom !== undefined && p.xTo !== undefined) parts.push(es ? `${p.xLabel} de ${p.xFrom} a ${p.xTo}` : `${p.xLabel} from ${p.xFrom} to ${p.xTo}`);
  if (p.low && p.high) {
    const axis = p.yLabel ? `${p.yLabel}: ` : '';
    parts.push(es ? `${axis}mínimo ${p.low.text} en ${p.low.at}, máximo ${p.high.text} en ${p.high.at}` : `${axis}lowest ${p.low.text} at ${p.low.at}, highest ${p.high.text} at ${p.high.at}`);
  }
  return `${parts.join('. ')}.`;
}

/** The accessible name of a chart that was not given a title: the value axis by the category or x axis. */
export function defaultChartName(lang: Lang, yLabel: string, xLabel: string): string {
  return lang === 'es' ? `${yLabel} según ${xLabel}` : `${yLabel} by ${xLabel}`;
}
