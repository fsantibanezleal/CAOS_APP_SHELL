import { type CSSProperties, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import { type FormatOptions, formatNumber, formatTicks, NBSP } from '../lib/format';
import { type Lang, useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import { CHART_ROLE, ChartDataTable, ChartSummary, ResetZoomButton, ZOOM_HINT } from './ChartA11y';
import {
  axisTitleFits,
  chartSummary,
  countOverlaps,
  dateNames,
  defaultChartName,
  DRAG_THRESHOLD,
  firstVisible,
  formatTime,
  isZoomed,
  KEY_PAN,
  KEY_ZOOM,
  keyAction,
  type LabelBox,
  leastLabelSpan,
  placeXLabel,
  placeYLabel,
  sameData,
  stepIndex,
  thinRows,
} from './interaction';
import { referenceLineName, repeatedLabels } from './text';
export { repeatedLabels };
import { createZoom, type ZoomControls } from './uplotZoom';
import { resolveToken, type ShellColorToken } from '../lib/tokens';
import { useThemeStore } from '../lib/theme';
import { useStageSize } from '../workbench/Stage';

export interface ChartSeries {
  /** What identifies the series to the solo key (0.18.0): the solo follows the series with this id when the list of series
   * changes (one dropped, one added, a label changed), not its position. Without an id the English label is the key. Unique
   * within the chart; with two series of one key the first is taken. */
  id?: string;
  label: BiText;
  /** One value per x; `null` leaves a gap. */
  values: (number | null)[];
  /** A shell colour token; defaults rotate through the accent palette. */
  color?: ShellColorToken;
  width?: number;
  dash?: number[];
  /** `points` draws markers only (a scatter of cases over a curve); `null` values are simply absent. */
  mode?: 'line' | 'points';
  /** The marker diameter of a `points` series, in CSS pixels (9 by default): a larger one rings the selected case. */
  size?: number;
  /** A `points` series on x values of its own (measured cases over a modelled curve that has other sizes): one x per
   * value. It is drawn over the plot on its own x, outside the curve's data, so it takes no part in the cursor, the
   * pick or the readout, and the axes take its extent in. */
  x?: number[];
  /** A dot at each value of a `line` series (CAOS_Fragmenta drew them under 40 values: `dots={x.length < 40}`). Off by
   * default; no dot is drawn at a `null`. */
  dots?: boolean;
}

/** A named x tick: the x value it sits at and the text the axis reads there (and the readout, for an x on it). */
export interface ChartTick {
  value: number;
  label: BiText;
}

/** What a reference line may be dragged over: the range it stays inside, and the step it snaps to (a hundredth of the
 * range when not given; on a log axis the step is a factor). */
export interface YMarkDrag {
  min: number;
  max: number;
  step?: number;
}

export interface ChartAxis {
  label: BiText;
  unit?: BiText;
  format?: FormatOptions;
}

/** What a reference line says (CAOS_APP_SHELL#94): `warn` an amber threshold (the default), `bad` a red one, `good` a
 * level to reach, `neutral` a level that is no alarm (a nominal size, "no bias"). The line and its label take the tone's
 * colour. */
export type YMarkTone = 'warn' | 'bad' | 'good' | 'neutral';

/** The shell colour token of each tone of a reference line. */
export const YMARK_TONE_TOKENS: Record<YMarkTone, ShellColorToken> = {
  warn: '--color-warn',
  bad: '--color-bad',
  good: '--color-good',
  neutral: '--color-fg-subtle',
};

export interface UPlotChartProps {
  /** The x values and their axis. A time axis must be declared (`time: true`); uPlot otherwise reads numbers as
   * epoch seconds and labels ticks as dates (failure class 7). */
  x: ChartAxis & {
    values: number[];
    time?: boolean;
    log?: boolean;
    /** Named ticks (0.18.0): the axis ticks exactly at these values, no other, each labelled with its text in the page
     * language (a categorical axis: protocols, blast ids). The readout names an x that sits on one by its label. A tick
     * outside the range is not drawn; an empty list leaves uPlot its own ticks. A value listed twice keeps its first label.
     * Labels must be different from each other, adjacent or not (the gate fails any repeated label, G6). An x is on a tick
     * when it is within 1e-9 of the x span of it. Ignored on a time axis. */
    ticks?: ChartTick[];
    /** The x scale spans at least this range (0.18.0), as `y.range` fixes the y scale: widen it past the data so an end tick's
     * label is not cut by the plot edge. The data and the overlays still widen it further. On a log axis a range that reaches 0
     * or below is ignored (the overlays still widen the scale); on a parity chart it is ignored, the chart's own shared range
     * rules. */
    range?: [number, number];
  };
  y: ChartAxis & { log?: boolean; range?: [number, number] };
  series: ChartSeries[];
  /** Vertical markers at x positions, drawn on the plot and labelled (mark what the engine detected). */
  marks?: { x: number; label: BiText }[];
  /** Horizontal reference lines at y values, labelled at their right end (a null model's constant prediction, a
   * target, a limit). A line without a `label` is drawn with no label box and nothing reserved for one (a zero line). */
  yMarks?: { y: number; label?: BiText; tone?: YMarkTone; drag?: YMarkDrag }[];
  /** Called with the index in `yMarks` and the new y of a draggable reference line (`drag`) every time the reader moves
   * it, by the pointer or the keyboard (a slider on the line: arrows, Page keys, Home and End); the caller sets the new
   * y in `yMarks`. */
  onYMarkChange?: (index: number, y: number) => void;
  /** Height in pixels, or `fill` to take the container's height (inside `PlotCard fill`); the width is always the
   * container's. */
  height?: number | 'fill';
  /** Called with the index under the cursor (or null), for linked views; the index is the caller's, before any
   * sorting by x. */
  onCursor?: (index: number | null) => void;
  /** Called with the caller's index of the point under the cursor when the plot is clicked (select a case, a blast).
   * On a chart whose series are all `points` (a scatter, a parity plot) the point under the cursor is the one nearest
   * the pointer in the plane, not the one nearest in x. */
  onPick?: (index: number) => void;
  /** A parity plot: predicted (the series) against observed (x) on one shared range, in a square box, with the
   * identity line. Unsorted x is allowed (the chart sorts it and maps every index back). The range takes in the
   * reference lines (`yMarks`), so a null model's level is always in view. */
  parity?: boolean;
  /** The readout under the plot for the point under the cursor (the caller's index), in place of the list of values:
   * a scatter names its case ("Mg1, Murgul: measured 23.0 cm, predicted 25.1 cm"). */
  readout?: (index: number) => string;
  /** The readout at rest; by default "Hover the chart to read the values". */
  hint?: BiText;
  /** The key solos a series (0.18.0): each entry is a button (`aria-pressed`, Tab, click, Enter or Space) that dims every
   * other series (alpha 0.12, 1 px) and leaves the chosen one as drawn; pressing it again releases it, pressing another
   * moves the solo. The chart is redrawn, not rebuilt. A chart of one series shows the key too. Off by default. */
  solo?: boolean;
  /** The chart's accessible name and the name of its data table (0.19.0); by default the y axis by the x axis. */
  title?: BiText;
  /** Zoom and pan the y axis too (0.19.0): the wheel, the pinch, the brush and the keys then work on both axes (a parity plot
   * always does, its two axes share one range). Off by default: x zooms and y follows the visible data. */
  zoomY?: boolean;
  /** Turn zoom, pan and the brush off (0.19.0), with the reason, in both languages when the page is bilingual (a chart whose
   * range is the finding). It names a reason of at least 12 characters, or the gate fails it; the gate lists every chart that
   * sets it. The keyboard crosshair, the readout, the data table and the summary cannot be turned off. */
  zoomOff?: BiText;
}

const ROTATION: ShellColorToken[] = ['--color-accent', '--color-magenta', '--color-accent-2', '--color-good', '--color-warn', '--color-bad'];

/** The alpha a series takes when another one is soloed (0.18.0; what CAOS_Fragmenta's key did). */
export const SOLO_DIM_ALPHA = 0.12;

/** How a series is drawn while `solo` (the index in `series` of the soloed one, or null) is held: as given, or dimmed to
 * `SOLO_DIM_ALPHA` and 1 px when another is soloed. Dimmed, never hidden, so the reader keeps the context. */
export function soloStyle(solo: number | null, i: number, width: number): { alpha: number; width: number } {
  return solo !== null && solo !== i ? { alpha: SOLO_DIM_ALPHA, width: 1 } : { alpha: 1, width };
}

/** The values a named x axis ticks at inside [min, max]: ascending, each once; on a log axis only the ones above 0. A value
 * that is not a number is dropped. */
export function tickSplits(ticks: readonly ChartTick[], min: number, max: number, log = false): number[] {
  const eps = Math.abs(max - min) * 1e-9;
  const values = ticks.map((t) => t.value).filter((v) => Number.isFinite(v) && (!log || v > 0) && v >= min - eps && v <= max + eps);
  return [...new Set(values)].sort((a, b) => a - b);
}

/** The label of the named tick at an x, in the page language; null when no tick sits there. An x is on a tick when it is
 * within 1e-9 of `span` (the x span, as `tickSplits` takes the range) of its value, so 0.1 + 0.2 is on a tick at 0.3; without
 * a span only an equal x is. A value listed twice keeps its first label. */
export function tickLabelAt(ticks: readonly ChartTick[] | undefined, x: number, lang: Lang, span = 0): string | null {
  const eps = Math.abs(span) * 1e-9;
  const t = ticks?.find((one) => Math.abs(one.value - x) <= eps);
  return t ? pick(t.label, lang) : null;
}

/** How many of the labels of named ticks repeat another's, adjacent or not (the gate's check of numeric ticks counts only
 * neighbours, and on a categorical axis order means nothing), and which ones; an empty label is no label. */
export function namedRepeats(labels: readonly string[]): { n: number; names: string[] } {
  const seen = new Set<string>();
  const names: string[] = [];
  let n = 0;
  for (const l of labels) {
    if (!l) continue;
    if (seen.has(l)) {
      n++;
      if (!names.includes(l)) names.push(l);
    } else seen.add(l);
  }
  return { n, names };
}

/** What a series is known by to the solo key: its id, else its English label. */
export function soloKey(s: ChartSeries): string {
  return s.id ?? pick(s.label, 'en');
}

/** The x scale of a chart whose x range is fixed, or whose overlays reach past the curve: the data's extent widened by the
 * given range and by the overlays' x; null when none is given (uPlot's own range), and on a log axis when the data would reach 0.
 * One x alone gets a unit either side, a decade on a log axis. `xs` is sorted ascending. */
export function xScaleRange(xs: readonly number[], ext: { x: [number, number] } | null, range: readonly [number, number] | undefined, log: boolean): [number, number] | null {
  // a log axis has no room at or below 0: a range that reaches it is ignored, alone, and the overlays still widen the scale
  const given = range && !(log && Math.min(range[0], range[1]) <= 0) ? range : undefined;
  if ((!ext && !given) || xs.length === 0) return null;
  let lo = xs[0];
  let hi = xs[xs.length - 1];
  if (ext) {
    lo = Math.min(lo, ext.x[0]);
    hi = Math.max(hi, ext.x[1]);
  }
  if (given) {
    lo = Math.min(lo, given[0], given[1]);
    hi = Math.max(hi, given[0], given[1]);
  }
  if (log && !(lo > 0)) return null;
  return hi > lo ? [lo, hi] : log ? [lo / 10, hi * 10] : [lo - 1, hi + 1];
}

/** The colour and dash of a series: its own, or the rotation's; when the rotation comes round (a seventh series
 * repeats the first colour) the repeat is dashed, so two series never look the same (CAOS_Fragmenta drew this for
 * itself until 0.9.0). */
export function seriesStyle(s: ChartSeries, i: number): { color: ShellColorToken; dash?: number[] } {
  const color = s.color ?? ROTATION[i % ROTATION.length];
  const dash = s.dash ?? (!s.color && i >= ROTATION.length ? [6, 4] : undefined);
  return { color, dash };
}

/** The order that sorts x ascending (uPlot draws aligned data by increasing x), or null when x is already sorted. */
export function sortOrder(xs: readonly number[]): number[] | null {
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] < xs[i - 1]) return xs.map((_, j) => j).sort((a, b) => xs[a] - xs[b] || a - b);
  }
  return null;
}

/** One range for both axes of a parity plot, padded by 5% of the span on each side. */
export function parityRange(...arrays: readonly (readonly (number | null)[])[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const a of arrays) {
    for (const v of a) {
      if (v === null || !Number.isFinite(v)) continue;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  if (!Number.isFinite(lo)) return [0, 1];
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.05;
  return [lo - pad, hi + pad];
}

/**
 * The data's y extent widened to take in the levels of the reference lines, so a line is always drawn (CAOS_APP_SHELL#94;
 * a constant series pulled the range to it, a mark did not). A log axis takes in only the levels above 0. Returns the
 * extent unchanged when every level is inside it; `null` ends (no data) take the levels alone. An end a level pushed out
 * moves a further `pad` of the span (of the span in decades on a log axis), so the line sits inside the frame, not on it;
 * the caller applies uPlot's own padding after this.
 */
export function rangeWithLevels(min: number | null, max: number | null, levels: readonly number[], log = false, pad = 0): [number, number] | null {
  const d0 = min !== null && Number.isFinite(min) ? min : Infinity;
  const d1 = max !== null && Number.isFinite(max) ? max : -Infinity;
  let lo = d0;
  let hi = d1;
  for (const v of levels) {
    if (!Number.isFinite(v) || (log && !(v > 0))) continue;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (pad > 0 && (lo < d0 || hi > d1)) {
    if (log && lo > 0) {
      const room = (Math.log10(hi) - Math.log10(lo) || 1) * pad;
      if (lo < d0) lo = lo / 10 ** room;
      if (hi > d1) hi = hi * 10 ** room;
    } else {
      const room = (hi - lo || Math.abs(hi) || 1) * pad;
      if (lo < d0) lo -= room;
      if (hi > d1) hi += room;
    }
  }
  return [lo, hi];
}

/** uPlot's numeric tick steps: 1, 2, 2.5 and 5 times every power of ten. */
const STEPS: number[] = [];
for (let e = -16; e <= 16; e++) for (const m of [1, 2, 2.5, 5]) STEPS.push(Number((m * 10 ** e).toPrecision(3)));

/**
 * The tick steps an axis may use. With fixed `decimals` (scaled by 100 for a percent) only multiples of the smallest
 * difference its labels can show, so no two ticks read the same: an integer axis ticks at integers, never at 1.5,
 * which reads "2" beside the 2 (CAOS_Contraste, 2026-10-05). `undefined` leaves uPlot its own steps: an axis formatted
 * by significant digits has no fixed resolution, and `data-ticks-repeat` reports what it does.
 */
export function tickSteps(fmt: FormatOptions | undefined): number[] | undefined {
  if (!fmt || fmt.decimals === undefined) return undefined;
  const res = 10 ** -fmt.decimals / (fmt.percent ? 100 : 1);
  return STEPS.filter((s) => s >= res * (1 - 1e-9) && Math.abs(s / res - Math.round(s / res)) < 1e-6);
}

/**
 * uPlot ticks a log axis at 1 to 9 times every power of ten, from a precision table that ends near 1e-22: a log axis
 * that reaches below it throws "Invalid array length" after stalling the page, and the chart is never drawn (known
 * shell defect 31, p-values of 1e-124 in CAOS_Contraste, 2026-10-07). Below this floor the axis ticks at powers of ten
 * only (`logDecades`), each one labelled.
 */
export const LOG_TABLE_FLOOR = 1e-22;

/** The powers of ten within [min, max], thinned to at most `most` (every k-th decade, the top one kept). */
export function logDecades(min: number, max: number, most = 8): number[] {
  if (!(min > 0) || !(max > 0) || !Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  const a = Math.ceil(Math.log10(min) - 1e-9);
  const b = Math.floor(Math.log10(max) + 1e-9);
  if (b < a) return [];
  const step = Math.max(1, Math.ceil((b - a + 1) / most));
  const out: number[] = [];
  for (let k = b; k >= a; k -= step) out.unshift(Number(`1e${k}`));
  return out;
}

/** The smallest positive value among columns of values and the lower end of a fixed range; Infinity if none. */
export function smallestPositive(columns: readonly (readonly (number | null)[])[], range?: readonly [number, number] | null): number {
  let lo = range && range[0] > 0 ? range[0] : Infinity;
  for (const c of columns) for (const v of c) if (v !== null && Number.isFinite(v) && v > 0 && v < lo) lo = v;
  return lo;
}

/** Whether a tick is a power of ten (a decade of a log axis). */
function isDecade(t: number | null | undefined): t is number {
  if (t === null || t === undefined || !Number.isFinite(t) || t <= 0) return false;
  const d = Math.log10(t);
  return Math.abs(d - Math.round(d)) < 1e-6;
}

/**
 * The ticks of a log x axis that get a label: the powers of ten only (null for every other tick, which formatTicks leaves
 * blank). A range with no power of ten in it keeps its ticks, so the axis is never left without a label.
 */
export function decadeOnly(ticks: readonly (number | null)[]): (number | null)[] {
  if (!ticks.some(isDecade)) return [...ticks];
  return ticks.map((t) => (isDecade(t) ? t : null));
}

/** The side of the square box of a parity plot: the smaller of the box's width and the height asked for (the box's
 * height when the chart fills it). */
export function parityBox(boxWidth: number, boxHeight: number, height: number, fill: boolean): number {
  return Math.min(boxWidth, fill ? boxHeight : height);
}

/** A dragged value kept inside the range of its line and snapped to its step; a value that is not a number falls to the
 * lower end. */
export function clampMark(y: number, drag: YMarkDrag): number {
  if (!Number.isFinite(y)) return drag.min;
  const v = drag.step && drag.step > 0 ? drag.min + Math.round((y - drag.min) / drag.step) * drag.step : y;
  const clamped = Math.min(drag.max, Math.max(drag.min, v));
  return Number(clamped.toPrecision(12));
}

/**
 * The value a key sets on a draggable line, or null for a key it does not handle: the arrows one step, Page Up and Down
 * ten, Home and End the ends of the range. A step is a hundredth of the range, or `drag.step`; on a log axis it is a factor
 * (a hundredth of the range in decades) and `drag.step` is not used.
 */
export function nudgeMark(y: number, key: string, drag: YMarkDrag, log = false): number | null {
  const dir = key === 'ArrowUp' || key === 'ArrowRight' || key === 'PageUp' ? 1 : key === 'ArrowDown' || key === 'ArrowLeft' || key === 'PageDown' ? -1 : 0;
  if (key === 'Home') return drag.min;
  if (key === 'End') return drag.max;
  if (dir === 0) return null;
  const n = key === 'PageUp' || key === 'PageDown' ? 10 : 1;
  if (log && drag.min > 0 && drag.max > drag.min) {
    const decades = (Math.log10(drag.max) - Math.log10(drag.min)) / 100;
    return Math.min(drag.max, Math.max(drag.min, y * 10 ** (dir * n * decades)));
  }
  const step = drag.step && drag.step > 0 ? drag.step : (drag.max - drag.min) / 100;
  return clampMark(y + dir * n * step, { ...drag, step: undefined });
}

/** Whether a series is an overlay: a `points` series with an x of its own (a line series ignores `x`). */
export function isOverlay(s: ChartSeries): boolean {
  return Boolean(s.x) && s.mode === 'points';
}

/** A drag range cut to the y range the chart was given, so a line cannot be dragged off the axis (its handle would be
 * hidden and lose focus); a range that does not meet the axis collapses to its nearest end. */
export function dragWithin(drag: YMarkDrag, range?: readonly [number, number] | null): YMarkDrag {
  if (!range) return drag;
  const lo = Math.min(range[0], range[1]);
  const hi = Math.max(range[0], range[1]);
  const min = Math.min(hi, Math.max(lo, drag.min));
  const max = Math.max(lo, Math.min(hi, drag.max));
  return { ...drag, min, max: Math.max(min, max) };
}

/** The x and y extent of the series that bring an x of their own, finite points only (on a log x axis, `positiveX`,
 * only the points with x above 0); null when there are none. */
export function overlayExtent(series: readonly ChartSeries[], positiveX = false): { x: [number, number]; y: [number, number] } | null {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of series) {
    if (!isOverlay(s) || !s.x) continue;
    for (let i = 0; i < Math.min(s.x.length, s.values.length); i++) {
      const px = s.x[i];
      const py = s.values[i];
      if (py === null || py === undefined || !Number.isFinite(px) || !Number.isFinite(py) || (positiveX && !(px > 0))) continue;
      x0 = Math.min(x0, px);
      x1 = Math.max(x1, px);
      y0 = Math.min(y0, py);
      y1 = Math.max(y1, py);
    }
  }
  return Number.isFinite(x0) ? { x: [x0, x1], y: [y0, y1] } : null;
}

/** A log axis reaching below uPlot's tick table: decade ticks, every one labelled (uPlot's own log filter blanks the
 * labels outside its table). */
const DECADE_AXIS = {
  splits: (_u: uPlot, _i: number, min: number, max: number) => logDecades(min, max),
  filter: (_u: uPlot, splits: number[]) => splits,
};

/** The least distance between two ticks on either axis of a parity plot, in CSS pixels. uPlot spaces x ticks at 50
 * and y ticks at 30 by default, so two axes over one range ticked at different steps (25, 30, 35 against 24, 26, 28
 * on CAOS_Fragmenta's blasts); one spacing gives both the same step. */
const PARITY_TICK_SPACE = 40;

/** The height of the handle on a draggable line, in CSS pixels: a band the pointer can take hold of. */
const HANDLE_HEIGHT = 14;

/** What separates the whole texts of the cut mark labels in `cutKey`. */
const CUT_SEP = String.fromCharCode(1);

/** A placed mark label, in device pixels: its box (`y1` is the baseline), the kind of mark, the text drawn and the whole text it stands for. */
export interface MarkBox extends LabelBox {
  kind: 'x' | 'y';
  text: string;
  full: string;
}

/**
 * The vertical marks of a chart and their labels. Every label is drawn with an explicit alignment (uPlot leaves the
 * context right-aligned after its last axis, so a label meant to start at its line ended there and ran off the plot
 * near the left edge, CAOS_Fragmenta 2026-10-06), on the side of its line where it fits inside the plot, on the next
 * row down when it would overlap a label before it, with a halo in the surface colour so a curve under it does not
 * cross its letters. A mark outside the x range is not drawn.
 *
 * Since 0.19.0 the labels of x marks and of y marks share one set of boxes (`boxes`, to which `drawYMarks` adds its own first): no x
 * label lies over a y label or another x label. A label for which no row inside the plot has room is cut with an ellipsis, and one
 * that fits nowhere is not written; the whole texts of those are returned, and every label placed is added to `boxes`.
 */
export function drawMarks(u: uPlot, marks: { x: number; label: string }[], style: { color: string; halo: string; family: string }, boxes: MarkBox[] = []): string[] {
  const ctx = u.ctx;
  const pr = uPlot.pxRatio || 1;
  const left = u.bbox.left;
  const right = u.bbox.left + u.bbox.width;
  const gap = 4 * pr;
  const rowH = 14 * pr;
  const textH = 11 * pr;
  const cut: string[] = [];
  ctx.save();
  ctx.font = `${Math.round(11 * pr)}px ${style.family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  for (const m of [...marks].sort((a, b) => a.x - b.x)) {
    const px = u.valToPos(m.x, 'x', true);
    if (!Number.isFinite(px) || px < left - 0.5 || px > right + 0.5) continue;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = Math.max(1, pr);
    ctx.setLineDash([4 * pr, 4 * pr]);
    ctx.beginPath();
    ctx.moveTo(px, u.bbox.top);
    ctx.lineTo(px, u.bbox.top + u.bbox.height);
    ctx.stroke();
    ctx.setLineDash([]);
    // a mark with an empty label (the later years of a run named once) draws its line only: an empty box took a row from the labels after it
    if (!m.label) continue;
    const at = placeXLabel(m.label, { px, left, right, bottom: u.bbox.top + u.bbox.height, gap, rowH, textH, first: u.bbox.top + 12 * pr, boxes, measure: (t) => ctx.measureText(t).width });
    if (!at) {
      cut.push(m.label);
      continue;
    }
    if (at.cut) cut.push(m.label);
    boxes.push({ kind: 'x', text: at.text, full: m.label, x0: at.x0, x1: at.x0 + at.w, y0: at.y - textH, y1: at.y });
    ctx.textAlign = 'left';
    ctx.lineWidth = 3 * pr;
    ctx.strokeStyle = style.halo;
    ctx.strokeText(at.text, at.x0, at.y);
    ctx.fillStyle = style.color;
    ctx.fillText(at.text, at.x0, at.y);
  }
  ctx.restore();
  return cut;
}

/**
 * The horizontal reference lines of a chart and their labels: a dashed line across the plot, its label at the right
 * end above the line (below it when the line runs along the top), inside the plot, haloed; a label that would overlap
 * the one placed before it moves left of it, then to the other side of its line or a row further, and is cut with an ellipsis when no place
 * clears (`placeYLabel`; `boxes`, when given, collects what is placed, for `drawMarks` to avoid). Returns the whole texts of the labels it cut
 * or could not write. A line outside the y range is not drawn; a line without a label is drawn alone. A mark's `color` (the tone's) draws
 * its line and its label; without one `style.color` does.
 */
export function drawYMarks(u: uPlot, marks: { y: number; label?: string; color?: string }[], style: { color: string; halo: string; family: string }, boxes?: MarkBox[]): string[] {
  const ctx = u.ctx;
  const pr = uPlot.pxRatio || 1;
  const left = u.bbox.left;
  const right = u.bbox.left + u.bbox.width;
  const top = u.bbox.top;
  const bottom = u.bbox.top + u.bbox.height;
  const gap = 4 * pr;
  const rowH = 14 * pr;
  const textH = 11 * pr;
  const placed: LabelBox[] = [];
  const cut: string[] = [];
  ctx.save();
  ctx.font = `${Math.round(11 * pr)}px ${style.family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  for (const m of [...marks].sort((a, b) => b.y - a.y)) {
    const py = u.valToPos(m.y, 'y', true);
    if (!Number.isFinite(py) || py < top - 0.5 || py > bottom + 0.5) continue;
    const color = m.color ?? style.color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, pr);
    ctx.setLineDash([2 * pr, 4 * pr]);
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(right, py);
    ctx.stroke();
    ctx.setLineDash([]);
    // a line with no label stops here: no box, nothing reserved
    if (!m.label) continue;
    // at the right end above the line (below it at the top), left of a label in the way, on the other side of the line, a row further, and
    // then cut with an ellipsis: never over another label of either kind (re-review of 0.19.0, m1; it was clamped at the left edge over the others)
    const at = placeYLabel(m.label, { py, left, right, top, bottom, gap, rowH, textH, boxes: [...placed, ...(boxes ?? [])], measure: (t) => ctx.measureText(t).width });
    if (!at) {
      cut.push(m.label);
      continue;
    }
    if (at.cut) cut.push(m.label);
    placed.push({ x0: at.x0, x1: at.x0 + at.w, y0: at.y - textH, y1: at.y });
    boxes?.push({ kind: 'y', text: at.text, full: m.label, x0: at.x0, x1: at.x0 + at.w, y0: at.y - textH, y1: at.y });
    ctx.textAlign = 'left';
    ctx.lineWidth = 3 * pr;
    ctx.strokeStyle = style.halo;
    ctx.strokeText(at.text, at.x0, at.y);
    ctx.fillStyle = color;
    ctx.fillText(at.text, at.x0, at.y);
  }
  ctx.restore();
  return cut;
}

/**
 * The index of the point nearest (left, top) in the plane, over every series, or null when no point has a value.
 * `xs` and every column of `ys` are positions in the same pixels as (left, top); a null position is no point.
 */
export function nearestPoint(xs: readonly number[], ys: readonly (readonly (number | null)[])[], left: number, top: number): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (let i = 0; i < xs.length; i++) {
    if (!Number.isFinite(xs[i])) continue;
    for (const col of ys) {
      const y = col[i];
      if (y === null || y === undefined || !Number.isFinite(y)) continue;
      const d = (xs[i] - left) ** 2 + (y - top) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return best;
}

/**
 * The house chart (S12 of the 2026-10-04 requirements; uPlot, ADR on interactive charts). It is built only once its
 * box has a size; it resolves the theme's colours to concrete values and rebuilds when the theme or language changes
 * (a canvas cannot read CSS variables); it compares its options by value, never by identity, so a parent re-render
 * does not tear it down; its tick formatters are null-safe and follow the interface language; the y axis is sized to
 * its longest tick label, so no tick is cut; the cursor value is written into a readout row under the plot instead of
 * uPlot's legend, which a sized host clips (known shell defect 3). A chart of two or more series keys every series
 * under the plot, always (its colour, a dashed or a dotted swatch, its label): at rest the readout names none of them
 * (known shell defect 17). An axis with fixed decimals ticks only where its labels differ (`tickSteps`). The host
 * declares `data-series`, `data-axis-titles`, `data-ticks-cut`, `data-ticks-repeat` and `data-drawn` for the gate. Since
 * 0.18.0: named x ticks (`x.ticks`, declared in `data-x-tick-labels`), an x range (`x.range`), a key that solos a series
 * (`solo`, declared in `data-solo`), dots on a line (`ChartSeries.dots`) and reference lines without a label.
 */
export function UPlotChart({ x, y, series, marks, yMarks, onYMarkChange, height = 280, onCursor, onPick, parity, readout, hint, solo, title, zoomY, zoomOff }: UPlotChartProps) {
  const lang = useShellLang();
  const theme = useThemeStore((s) => s.theme);
  const fill = height === 'fill';
  // The plot box is measured: its width always, its height too when the chart fills its container.
  const [measureRef, box] = useStageSize();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const setPlot = useCallback(
    (el: HTMLDivElement | null) => {
      plotRef.current = el;
      measureRef(el);
    },
    [measureRef],
  );
  // a parity plot is square: the side is the smaller of the box's width and the height asked for
  const width = parity ? parityBox(box.width, box.height, typeof height === 'number' ? height : 0, fill) : box.width;
  const h = parity ? width : fill ? box.height : height;
  const uRef = useRef<uPlot | null>(null);
  const ctlRef = useRef<ZoomControls | null>(null);
  const explicitRef = useRef(false);
  // the host, whose data-ticks-repeat the tick formatters keep current (set on the element: a formatter runs inside
  // uPlot's draw, where a state update would loop)
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  // Tier A (0.19.0): the range the chart opened with, the range now, and the point the keyboard stands on. They are refs the
  // handlers of the plot read, because the plot is built once and its handlers must see the latest.
  const ids = useId();
  const tableId = `${ids}-table`;
  const summaryId = `${ids}-summary`;
  const [zoomed, setZoomed] = useState(false);
  const fullRef = useRef<{ x: [number, number]; y: [number, number] } | null>(null);
  const zoomRef = useRef<{ x: [number, number] | null; y: [number, number] | null }>({ x: null, y: null });
  const zoomedRef = useRef(false);
  const kbRef = useRef<number | null>(null);
  const dataRef = useRef<uPlot.AlignedData | null>(null);
  const [forced, setForced] = useState('');
  // the whole texts of the mark labels the drawing had to cut (joined), kept for the readout, the plot's title and the table of marks
  const [cutKey, setCutKey] = useState('');
  // the soloed series (its index in `series`); a press redraws the chart, so it is held here and read by the drawing
  // held by the series key, not by position: a series dropped from the list releases it, and it is not given back when it returns
  const [soloPick, setSoloPick] = useState<string | null>(null);
  const soloFound = solo && soloPick !== null ? series.findIndex((s) => soloKey(s) === soloPick) : -1;
  const soloIdx = soloFound >= 0 ? soloFound : null;
  const soloRef = useRef(soloIdx);
  soloRef.current = soloIdx;
  useEffect(() => {
    if (soloPick !== null && soloIdx === null) setSoloPick(null);
  }, [soloPick, soloIdx]);
  const onCursorRef = useRef(onCursor);
  onCursorRef.current = onCursor;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  // the index (in uPlot's order) a click picks: the cursor's, or on a scatter the point nearest the pointer
  const pickedRef = useRef<number | null>(null);
  // uPlot draws by increasing x: unsorted x is sorted here and every index handed back is mapped to the caller's
  const order = useMemo(() => sortOrder(x.values), [x.values]);
  const orderRef = useRef(order);
  orderRef.current = order;
  const xs = useMemo(() => (order ? order.map((i) => x.values[i]) : x.values), [order, x.values]);
  // a series with an x of its own is an overlay, drawn over the plot on its own x; the others share the chart's x
  const entries = useMemo(() => series.map((s, i) => ({ s, i })), [series]);
  const baseEntries = useMemo(() => entries.filter(({ s }) => !isOverlay(s)), [entries]);
  const overlays = useMemo(() => entries.filter(({ s }) => isOverlay(s)), [entries]);
  const ext = useMemo(() => overlayExtent(series, Boolean(x.log)), [series, x.log]);
  const ys = useMemo(() => baseEntries.map(({ s }) => (order ? order.map((i) => s.values[i] ?? null) : s.values)), [order, baseEntries]);
  // a draggable line takes in the whole range it may be dragged over, so the axis does not move under the pointer
  const levels = useMemo(() => (yMarks ?? []).flatMap((m) => (m.drag ? [m.drag.min, m.drag.max] : [m.y])), [yMarks]);
  const range = useMemo(() => (parity ? parityRange(xs, ...ys, levels, ext ? [...ext.x, ...ext.y] : []) : null), [parity, xs, ys, levels, ext]);
  // any other chart without a given y range takes the reference lines and the overlays into it, so a line is always drawn (#94)
  const yLevels = !parity && !y.range && (levels.length > 0 || ext) ? [...levels, ...(ext ? ext.y : [])] : null;
  // the x range that takes in the overlays (they have x values the curve has not)
  const xExt = useMemo((): [number, number] | null => (range ? null : xScaleRange(xs, ext, x.range, Boolean(x.log))), [ext, range, xs, x.log, x.range]);
  // the x span a tick is matched within
  const xSpan = xs.length > 0 ? Math.max(Math.abs(xs[xs.length - 1] - xs[0]), x.range ? Math.abs(x.range[1] - x.range[0]) : 0) : 0;
  // named ticks (not on a time axis); an empty list leaves uPlot its own
  const ticks = !x.time && x.ticks && x.ticks.length > 0 ? x.ticks : undefined;
  // a log axis reaching below uPlot's tick table ticks at powers of ten (known shell defect 31)
  const tiny = useMemo(
    () => ({
      x: !ticks && Boolean(x.log) && smallestPositive(ext ? [xs, ext.x] : [xs], range) < LOG_TABLE_FLOOR,
      y: Boolean(y.log) && smallestPositive(yLevels ? [...ys, yLevels] : ys, range ?? y.range) < LOG_TABLE_FLOOR,
    }),
    [x.log, y.log, xs, ys, range, y.range, yLevels, ext, ticks],
  );

  const xLabel = pick(x.label, lang);
  const yLabel = pick(y.label, lang);
  // the lines, the overlays and the callback as the caller last gave them: the drawing reads these, so a line dragged to a
  // new value (and a new label) is redrawn, never rebuilt (a rebuild would drop the handle the reader holds)
  const yMarksRef = useRef(yMarks);
  yMarksRef.current = yMarks;
  const liveRef = useRef<number[]>([]);
  liveRef.current = (yMarks ?? []).map((m) => m.y);
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const onYMarkChangeRef = useRef(onYMarkChange);
  onYMarkChangeRef.current = onYMarkChange;
  const dragCount = (yMarks ?? []).filter((m) => m.drag).length;
  const xUnit = x.unit ? pick(x.unit, lang) : '';
  const yUnit = y.unit ? pick(y.unit, lang) : '';
  // ---- Tier A (0.19.0) ----
  const drawn = width > 0 && h > 0;
  const name = title ? pick(title, lang) : defaultChartName(lang, yLabel, xLabel);
  // zoom is off whenever `zoomOff` is given, whatever its text: an empty reason in a language still turns zoom off and is still reported (the gate fails it)
  const zoomIsOff = zoomOff !== undefined && zoomOff !== null;
  const zoomWhy = zoomIsOff ? pick(zoomOff, lang) : '';
  const zoomable = !zoomIsOff && xs.length >= 2 && xs[xs.length - 1] > xs[0];
  const both = Boolean(zoomY || parity);
  const zoomableRef = useRef(zoomable);
  zoomableRef.current = zoomable;
  const bothRef = useRef(both);
  bothRef.current = both;
  // An axis title never cuts: a rotated y title longer than the plot is high moves above the plot as a horizontal line, and an
  // x title wider than the chart moves below it, where it wraps. The decision is made on an estimate of the plot (the x axis
  // takes about 60 px) and, once the chart is built, on its real height, which can only move a title out.
  const xTitle = xUnit ? `${xLabel} (${xUnit})` : xLabel;
  const yTitle = yUnit ? `${yLabel} (${yUnit})` : yLabel;
  const yAbove = !axisTitleFits(yTitle, h - 44) || forced === yTitle;
  const xBelow = !axisTitleFits(xTitle, width - 16);
  // Everything that changes the plot's structure, by value.
  const structure = JSON.stringify({
    s: series.map((s, i) => [pick(s.label, lang), seriesStyle(s, i), s.width ?? 2, s.mode ?? 'line', s.size ?? 9, isOverlay(s), Boolean(s.dots)]),
    x: [xLabel, xUnit, Boolean(x.time), Boolean(x.log), x.format ?? null, tiny.x, xExt, ticks ? ticks.map((t) => [t.value, pick(t.label, lang)]) : null],
    oe: ext,
    p: range,
    pick: Boolean(onPick),
    y: [yLabel, yUnit, Boolean(y.log), y.range ?? null, y.format ?? null, tiny.y],
    m: (marks ?? []).map((m) => [m.x, pick(m.label, lang)]),
    ym: (yMarks ?? []).map((m) => (m.drag ? ['drag', m.drag, Boolean(m.label)] : [m.y, m.label ? pick(m.label, lang) : null, m.tone ?? 'warn'])),
    theme,
    lang,
    h,
    w: width,
    ta: [yAbove, xBelow, zoomable, both],
  });
  const data = useMemo(() => [xs, ...ys] as uPlot.AlignedData, [xs, ys]);
  // the least span an axis can be zoomed to before its labels (significant digits) could not tell the ticks apart; the chart reads the
  // plot's size as it is now. Axes with their own tick rules (fixed decimals, a time axis, named ticks, a log axis) have no bound here.
  const leastSpan = (axis: 'x' | 'y'): number | undefined => {
    const u = uRef.current;
    const f = fullRef.current;
    if (!u || !f) return undefined;
    if (axis === 'x' ? x.time || x.log || Boolean(ticks) : Boolean(y.log)) return undefined;
    const pr = uPlot.pxRatio || 1;
    const room = (axis === 'x' ? u.bbox.width : u.bbox.height) / pr;
    return leastLabelSpan(axis === 'x' ? x.format : y.format, f[axis], room, range ? PARITY_TICK_SPACE : axis === 'x' ? 50 : 30);
  };
  // a chart of points only (a scatter, a parity plot): the cursor takes the point nearest the pointer in the plane
  const scatter = baseEntries.length > 0 && baseEntries.every(({ s }) => s.mode === 'points');

  useEffect(() => {
    const el = plotRef.current;
    if (!el || width <= 0 || h <= 0) return;
    const fg = resolveToken('--color-fg-subtle', '#888');
    const grid = resolveToken('--color-border', '#ccc');
    const family = resolveToken('--font-sans', 'sans-serif');
    const font = `11px ${family}`;
    const surface = resolveToken('--color-surface', '#fff');
    const repeats = { x: 0, y: 0 };
    // One notation per axis (known shell defect 19): the labels of an axis are formatted together.
    const declareTicks = (axis: 'x' | 'y', labels: string[], repeated = repeatedLabels(labels)) => {
      repeats[axis] = repeated;
      hostRef.current?.setAttribute('data-ticks-repeat', String(repeats.x + repeats.y));
      // how many ticks the axis labels: a parity plot's two axes must agree, and an axis with fewer than two says nothing
      hostRef.current?.setAttribute(`data-ticks-${axis}`, String(labels.filter((l) => l).length));
    };
    const tick = (fmt: FormatOptions | undefined, axis: 'x' | 'y', pre?: (v: (number | null)[]) => (number | null)[]) => (_u: uPlot, vals: (number | null)[]) => {
      const labels = formatTicks(pre ? pre(vals) : vals, lang, fmt ?? { digits: 4 });
      // a log x axis: the labels it shows, declared for the shell's own test (the decades, no other)
      if (axis === 'x' && pre) hostRef.current?.setAttribute('data-log-labels', labels.filter((l) => l).join('|'));
      declareTicks(axis, labels);
      return labels;
    };
    // named x ticks: the text of each tick, declared for the gate and the shell's own test
    const namedTicks = (_u: uPlot, vals: (number | null)[]) => {
      const labels = vals.map((v) => (v === null || v === undefined ? '' : (tickLabelAt(ticks, v, lang) ?? '')));
      hostRef.current?.setAttribute('data-x-tick-labels', labels.filter((l) => l).join('|'));
      // a name used by two ticks is a repeat wherever they sit on the axis, and the gate names it
      const dup = namedRepeats(labels);
      if (dup.n > 0) hostRef.current?.setAttribute('data-ticks-repeated', dup.names.join('|'));
      else hostRef.current?.removeAttribute('data-ticks-repeated');
      declareTicks('x', labels, dup.n);
      return labels;
    };
    // the point nearest the pointer, computed once per cursor position and handed to every series (uPlot asks each)
    const near = { left: NaN, top: NaN, idx: null as number | null };
    const nearest = (u: uPlot): number | null => {
      const { left, top } = u.cursor;
      if (left === undefined || top === undefined || left < 0 || top < 0) return null;
      if (left !== near.left || top !== near.top) {
        const d = u.data as (number | null)[][];
        const px = d[0].map((v) => (v === null ? NaN : u.valToPos(v, 'x')));
        const py = d.slice(1).map((col) => col.map((v) => (v === null ? null : u.valToPos(v, 'y'))));
        near.left = left;
        near.top = top;
        near.idx = nearestPoint(px, py, left, top);
      }
      return near.idx;
    };
    const xSteps = x.time || x.log ? undefined : tickSteps(x.format);
    const ySteps = y.log ? undefined : tickSteps(y.format);
    const fixedRange = (r: readonly [number, number]) => (_u: uPlot, min: number | null, max: number | null): uPlot.Range.MinMax => (explicitRef.current && min !== null && max !== null ? [min, max] : [r[0], r[1]]);
    const opts: uPlot.Options = {
      width,
      height: h,
      // the month and weekday names of a time axis in the page language: uPlot's own are English (0.19.1, SHC-099)
      ...(x.time ? { fmtDate: ((names: uPlot.DateNames) => (tpl: string) => uPlot.fmtDate(tpl, names))(dateNames(lang)) } : {}),
      legend: { show: false },
      cursor: {
        ...(scatter ? { dataIdx: (u: uPlot, sIdx: number, closest: number) => (sIdx === 0 ? closest : (nearest(u) ?? closest)) } : {}),
        // the brush: a drag along x (and y where both axes zoom); a drag under DRAG_THRESHOLD px is a click, not a zoom. uPlot's own setScale
        // is off: a fixed range (`range`, `x.range`) turns the scale it sets back into the fixed one, so the selection is applied by the
        // `setSelect` hook below, through the same operation as the wheel and the keys
        drag: zoomable ? { x: true, y: both, dist: DRAG_THRESHOLD, setScale: false } : { x: false, y: false, setScale: false },
      },
      // a log axis labels the ticks uPlot keeps and passes null for the rest, which formatTicks leaves blank
      scales: {
        // a log x axis spans the data, not the decades around it (uPlot rounds out to the next decade, which left an
        // axis to 1,000 for data that ends at 120)
        x: {
          time: Boolean(x.time),
          distr: x.log ? 3 : 1,
          // a fixed range is a function that gives way to a zoom: uPlot passes even an explicit range through the scale's range, so a constant
          // (or an array) undid every zoom of a chart with `x.range` or `y.range` (Tier A, 0.19.0)
          ...(range ? { range: fixedRange(range) } : xExt ? { range: fixedRange(xExt) } : x.log ? { range: (_u: uPlot, min: number, max: number): uPlot.Range.MinMax => [min, max] } : {}),
        },
        y: {
          distr: y.log ? 3 : 1,
          ...(range
            ? { range: fixedRange(range) }
            : y.range
              ? { range: fixedRange(y.range) }
              : yLevels
                ? {
                    // uPlot's own range of the data and the levels: its padding, its decade snap on a log axis
                    range: (u: uPlot, dmin: number | null, dmax: number | null): uPlot.Range.MinMax => {
                      const w = rangeWithLevels(dmin, dmax, yLevels, Boolean(y.log), 0.05);
                      if (!w) return [dmin, dmax] as unknown as uPlot.Range.MinMax;
                      return y.log ? uPlot.rangeLog(w[0], w[1], (u.scales.y.log ?? 10) as uPlot.Scale.LogBase, false) : uPlot.rangeNum(w[0], w[1], 0.1, true);
                    },
                  }
                : {}),
        },
      },
      axes: [
        {
          stroke: fg,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid },
          font,
          label: xBelow ? undefined : xTitle,
          labelFont: font,
          // a log x axis labels the decades only; the ticks between stay drawn, unlabelled
          values: x.time ? undefined : ticks ? namedTicks : tick(x.format, 'x', x.log && !tiny.x ? decadeOnly : undefined),
          ...(ticks
            ? // exactly the named values, no other tick
              { splits: (_u: uPlot, _i: number, min: number, max: number) => tickSplits(ticks, min, max, Boolean(x.log)), filter: (_u: uPlot, splits: number[]) => splits }
            : {
                ...(xSteps ? { incrs: xSteps } : {}),
                ...(range ? { space: PARITY_TICK_SPACE } : {}),
                ...(tiny.x ? DECADE_AXIS : {}),
              }),
        },
        {
          stroke: fg,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid },
          font,
          label: yAbove ? undefined : yTitle,
          labelFont: font,
          values: tick(y.format, 'y'),
          ...(ySteps ? { incrs: ySteps } : {}),
          ...(range ? { space: PARITY_TICK_SPACE } : {}),
          ...(tiny.y ? DECADE_AXIS : {}),
          // Sized to the longest tick label. uPlot draws in device pixels with a font scaled by its pixel ratio, so the
          // label is measured in that font and divided back (measuring the unscaled font and dividing by the ratio
          // made the axis too narrow on every high-density screen; the gate runs at ratio 1 and never saw it).
          size: (u: uPlot, values: string[] | null) => {
            if (!values || values.length === 0) return 48;
            const pr = uPlot.pxRatio || 1;
            u.ctx.font = `${Math.round(11 * pr)}px ${family}`;
            const widest = Math.max(...values.map((v) => u.ctx.measureText(v ?? '').width));
            return Math.ceil(widest / pr) + (yAbove ? 18 : 30);
          },
        },
      ],
      series: [
        {},
        ...baseEntries.map(({ s, i }) => {
          const style = seriesStyle(s, i);
          const stroke = resolveToken(style.color, '#4a8');
          // a soloed chart dims the other series; the build reads the solo as it stands
          const dim = soloStyle(soloRef.current, i, s.mode === 'points' ? 1.5 : (s.width ?? 2));
          return s.mode === 'points'
            ? { label: pick(s.label, lang), stroke, width: dim.width, alpha: dim.alpha, paths: () => null, points: { show: true, space: 0, size: s.size ?? 9, fill: stroke } }
            : { label: pick(s.label, lang), stroke, width: dim.width, alpha: dim.alpha, dash: style.dash, spanGaps: false, points: s.dots ? { show: true, size: 5, fill: stroke } : { show: false } };
        }),
      ],
      hooks: {
        setCursor: [
          (u: uPlot) => {
            const idx = scatter ? nearest(u) : (u.cursor.idx ?? null);
            pickedRef.current = idx;
            setCursor(idx);
            onCursorRef.current?.(idx === null ? null : orderRef.current ? orderRef.current[idx] : idx);
          },
        ],
        ready: [
          (u: uPlot) => {
            u.over.addEventListener('click', () => {
              const idx = pickedRef.current;
              if (idx === null || idx === undefined || !onPickRef.current) return;
              onPickRef.current(orderRef.current ? orderRef.current[idx] : idx);
            });
            // a draggable line has a handle on it: a slider the pointer drags and the keyboard moves
            const accent = resolveToken('--color-accent', '#06c');
            (yMarks ?? []).forEach((m, i) => {
              if (!m.drag) return;
              // a given y range bounds the drag: a line dragged off the axis would lose its handle
              const drag = dragWithin(m.drag, range ? undefined : y.range);
              const el = document.createElement('div');
              el.setAttribute('role', 'slider');
              el.setAttribute('tabindex', '0');
              el.setAttribute('aria-orientation', 'vertical');
              el.setAttribute('aria-valuemin', String(drag.min));
              el.setAttribute('aria-valuemax', String(drag.max));
              el.setAttribute('data-y-handle', String(i));
              Object.assign(el.style, { position: 'absolute', left: '0', width: '100%', height: `${HANDLE_HEIGHT}px`, cursor: 'ns-resize', touchAction: 'none', outlineOffset: '-2px', zIndex: '3' });
              el.addEventListener('focus', () => (el.style.outline = `2px solid ${accent}`));
              el.addEventListener('blur', () => (el.style.outline = 'none'));
              el.addEventListener('click', (e) => e.stopPropagation());
              const set = (raw: number) => {
                const v = clampMark(raw, y.log ? { ...drag, step: undefined } : drag);
                if (v === liveRef.current[i]) return;
                liveRef.current[i] = v;
                onYMarkChangeRef.current?.(i, v);
                u.redraw(false);
              };
              let dragging = false;
              el.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                dragging = true;
                el.setPointerCapture(e.pointerId);
                el.focus();
                e.preventDefault();
              });
              el.addEventListener('pointermove', (e) => {
                if (!dragging) return;
                set(u.posToVal(e.clientY - u.over.getBoundingClientRect().top, 'y'));
              });
              const end = (e: PointerEvent) => {
                dragging = false;
                if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
              };
              el.addEventListener('pointerup', end);
              el.addEventListener('pointercancel', end);
              el.addEventListener('keydown', (e) => {
                const v = nudgeMark(liveRef.current[i], e.key, drag, Boolean(y.log));
                if (v === null) return;
                e.preventDefault();
                set(v);
              });
              u.over.appendChild(el);
            });
            // the first draw came before the handles, and uPlot ignores a redraw asked inside its own commit: draw once more
            // when it is done, so each handle is placed
            if (dragCount) queueMicrotask(() => uRef.current === u && u.redraw(false));
          },
        ],
        setSelect: [
          (u: uPlot) => {
            const sel = { left: u.select.left, top: u.select.top, width: u.select.width, height: u.select.height };
            if (!(sel.width > 0 || sel.height > 0)) return;
            const x0 = u.posToVal(sel.left, 'x');
            const x1 = u.posToVal(sel.left + sel.width, 'x');
            const y0 = u.posToVal(sel.top + sel.height, 'y');
            const y1 = u.posToVal(sel.top, 'y');
            u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
            ctlRef.current?.brush(sel.width > 0 ? [x0, x1] : null, bothRef.current && sel.height > 0 ? [y0, y1] : undefined);
          },
        ],
        setScale: [
          (u: uPlot, key: string) => {
            if (key !== 'x' && key !== 'y') return;
            const f = fullRef.current;
            if (!f) return;
            const rx: [number, number] = [u.scales.x.min ?? f.x[0], u.scales.x.max ?? f.x[1]];
            const ry: [number, number] = [u.scales.y.min ?? f.y[0], u.scales.y.max ?? f.y[1]];
            // the x range in view, declared for the gate and the shell's own tests
            hostRef.current?.setAttribute('data-view-x', `${rx[0]},${rx[1]}`);
            const zx = isZoomed(rx, f.x);
            const zy = bothRef.current && isZoomed(ry, f.y);
            zoomRef.current = { x: zx ? rx : null, y: zy ? ry : null };
            const z = zx || zy;
            if (z !== zoomedRef.current) {
              zoomedRef.current = z;
              setZoomed(z);
            }
            // a finger drags a zoomed chart; an unzoomed one leaves the vertical scroll to the page
            u.over.style.touchAction = zoomableRef.current ? (z ? 'none' : 'pan-y') : '';
          },
        ],
        draw: [
          (u: uPlot) => {
            if (range) {
              // the identity line of a parity plot: where a prediction equals the observation
              const ctx = u.ctx;
              const pr = uPlot.pxRatio || 1;
              ctx.save();
              ctx.strokeStyle = resolveToken('--color-fg-faint', '#888');
              ctx.lineWidth = Math.max(1, pr);
              ctx.setLineDash([5 * pr, 4 * pr]);
              ctx.beginPath();
              ctx.moveTo(u.valToPos(range[0], 'x', true), u.valToPos(range[0], 'y', true));
              ctx.lineTo(u.valToPos(range[1], 'x', true), u.valToPos(range[1], 'y', true));
              ctx.stroke();
              ctx.restore();
            }
            // the points that bring their own x, drawn over the curves on the plot's scales
            const dots = overlaysRef.current;
            if (dots.length) {
              const ctx = u.ctx;
              const pr = uPlot.pxRatio || 1;
              let drawn = 0;
              ctx.save();
              ctx.beginPath();
              ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
              ctx.clip();
              for (const { s, i } of dots) {
                ctx.globalAlpha = soloStyle(soloRef.current, i, 1).alpha;
                ctx.fillStyle = resolveToken(seriesStyle(s, i).color, '#4a8');
                ctx.strokeStyle = surface;
                ctx.lineWidth = Math.max(1, pr);
                const r = ((s.size ?? 9) / 2) * pr;
                const ox = s.x ?? [];
                for (let k = 0; k < Math.min(ox.length, s.values.length); k++) {
                  const v = s.values[k];
                  if (v === null || v === undefined || !Number.isFinite(v) || !Number.isFinite(ox[k])) continue;
                  const px = u.valToPos(ox[k], 'x', true);
                  const py = u.valToPos(v, 'y', true);
                  if (!Number.isFinite(px) || !Number.isFinite(py) || px < u.bbox.left - 0.5 || px > u.bbox.left + u.bbox.width + 0.5 || py < u.bbox.top - 0.5 || py > u.bbox.top + u.bbox.height + 0.5) continue;
                  ctx.beginPath();
                  ctx.arc(px, py, r, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.stroke();
                  drawn++;
                }
              }
              ctx.restore();
              hostRef.current?.setAttribute('data-overlay-drawn', String(drawn));
            }
            const markStyle = { color: resolveToken('--color-warn', '#c80'), halo: surface, family };
            // the lines as the caller last gave them (a dragged line has a new y and label, not a new chart)
            const lines = yMarksRef.current ?? [];
            // the labels of the y marks and of the x marks share one set of boxes (0.19.0): the x labels go where no label is
            const boxes: MarkBox[] = [];
            const ycut = lines.length ? drawYMarks(u, lines.map((m, i) => ({ y: liveRef.current[i] ?? m.y, label: m.label ? pick(m.label, lang) : undefined, color: resolveToken(YMARK_TONE_TOKENS[m.tone ?? 'warn'], '#c80') })), markStyle, boxes) : [];
            // each handle sits on its line, and says its value to a screen reader
            u.over.querySelectorAll<HTMLElement>('[data-y-handle]').forEach((el) => {
              const i = Number(el.getAttribute('data-y-handle'));
              const m = lines[i];
              const v = liveRef.current[i];
              if (!m || v === undefined) return;
              const top = u.valToPos(v, 'y');
              el.style.display = Number.isFinite(top) && top >= 0 && top <= u.bbox.height / (uPlot.pxRatio || 1) ? '' : 'none';
              el.style.top = `${top - HANDLE_HEIGHT / 2}px`;
              const label = m.label ? pick(m.label, lang) : '';
              const shown = `${formatNumber(v, lang, y.format ?? { digits: 4 })}${yUnit ? `${NBSP}${yUnit}` : ''}`;
              // an unlabelled line is named by the text module, numbered when several unlabelled lines can be dragged
              const unnamed = lines.flatMap((one, k) => (one.drag && !one.label ? [k] : []));
              el.setAttribute('aria-label', label || referenceLineName(lang, unnamed.indexOf(i) + 1, unnamed.length));
              el.setAttribute('aria-valuenow', String(Number(v.toPrecision(12))));
              el.setAttribute('aria-valuetext', label ? `${label}: ${shown}` : shown);
            });
            const cut = [...ycut, ...(marks?.length ? drawMarks(u, marks.map((m) => ({ x: m.x, label: pick(m.label, lang) })), markStyle, boxes) : [])];
            // what was placed, in CSS pixels from the canvas' corner, and how many labels overlap: declared for the gate (G20) and the shell's own tests
            const pr = uPlot.pxRatio || 1;
            const rounded = (v: number) => Math.round((v / pr) * 10) / 10;
            hostRef.current?.setAttribute('data-mark-overlaps', String(countOverlaps(boxes)));
            if (boxes.length) hostRef.current?.setAttribute('data-mark-boxes', JSON.stringify(boxes.map((b) => ({ k: b.kind, t: b.text, x0: rounded(b.x0), y0: rounded(b.y0), x1: rounded(b.x1), y1: rounded(b.y1), ...(b.text !== b.full ? { cut: true } : {}) }))));
            else hostRef.current?.removeAttribute('data-mark-boxes');
            if (cut.length) hostRef.current?.setAttribute('data-mark-cut', cut.join('|'));
            else hostRef.current?.removeAttribute('data-mark-cut');
            const now = cut.join(CUT_SEP);
            setCutKey((prev) => (prev === now ? prev : now));
          },
        ],
      },
    };
    // the attributes of named ticks go with the ticks
    if (!ticks) {
      hostRef.current?.removeAttribute('data-x-tick-labels');
      hostRef.current?.removeAttribute('data-ticks-repeated');
    }
    uRef.current?.destroy();
    fullRef.current = null;
    dataRef.current = data;
    const u = new uPlot(opts, data, el);
    uRef.current = u;
    // uPlot sets its scales in a microtask after it is built: settle them now, so the range read below is the real one
    u.batch(() => undefined);
    // Tier A: the range the chart opens with is the one to come back to; a zoom held before a rebuild (a theme or language
    // change, a resize) is put back when it still meets the new range
    const f = { x: [u.scales.x.min ?? 0, u.scales.x.max ?? 1] as [number, number], y: [u.scales.y.min ?? 0, u.scales.y.max ?? 1] as [number, number] };
    fullRef.current = f;
    hostRef.current?.setAttribute('data-view-x', `${f.x[0]},${f.x[1]}`);
    const ctl = createZoom(u, { plot: el, log: { x: Boolean(x.log), y: Boolean(y.log) }, both, enabled: () => zoomableRef.current, full: () => fullRef.current, explicit: explicitRef, least: leastSpan });
    ctlRef.current = ctl;
    u.over.style.touchAction = zoomable ? 'pan-y' : '';
    const held = zoomRef.current;
    const meets = (r: [number, number] | null, full: [number, number]) => (r && r[1] > full[0] && r[0] < full[1] ? ([Math.max(r[0], full[0]), Math.min(r[1], full[1])] as [number, number]) : null);
    const hx = zoomable ? meets(held.x, f.x) : null;
    const hy = zoomable && both ? meets(held.y, f.y) : null;
    if (hx || hy) {
      explicitRef.current = true;
      u.batch(() => {
        if (hx) u.setScale('x', { min: hx[0], max: hx[1] });
        if (hy) u.setScale('y', { min: hy[0], max: hy[1] });
      });
      explicitRef.current = false;
    } else {
      zoomRef.current = { x: null, y: null };
      if (zoomedRef.current) {
        zoomedRef.current = false;
        setZoomed(false);
      }
    }
    // an axis title that the built chart cannot hold moves above it (the estimate that chose the layout was too generous)
    if (!yAbove && yTitle) {
      const pr = uPlot.pxRatio || 1;
      const cy = (u.bbox.top + u.bbox.height / 2) / pr;
      if (!axisTitleFits(yTitle, 2 * Math.min(cy, h - cy) - 4)) setForced(yTitle);
    }
    return () => {
      ctl.detach();
      ctlRef.current = null;
      uRef.current?.destroy();
      uRef.current = null;
    };
    // structure is the by-value key of everything above; data updates go through setData below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure]);

  // New data redraws the chart from its full range; the same data handed in again as a fresh array (a parent that renders
  // often) changes nothing, so a zoom the reader made is not thrown away.
  useEffect(() => {
    const u = uRef.current;
    if (!u) return;
    if (dataRef.current && sameData(dataRef.current as (number | null)[][], data as (number | null)[][])) return;
    dataRef.current = data;
    fullRef.current = null;
    zoomRef.current = { x: null, y: null };
    u.batch(() => u.setData(data));
    fullRef.current = { x: [u.scales.x.min ?? 0, u.scales.x.max ?? 1], y: [u.scales.y.min ?? 0, u.scales.y.max ?? 1] };
    if (zoomedRef.current) {
      zoomedRef.current = false;
      setZoomed(false);
    }
  }, [data]);

  // a line moved or relabelled by the caller, and overlays given anew, are drawn again without a rebuild
  const overlaysKey = JSON.stringify(overlays.map(({ s, i }) => [i, s.x, s.values, s.size ?? 9, seriesStyle(s, i).color]));
  const linesKey = JSON.stringify((yMarks ?? []).map((m) => [m.y, m.label ? pick(m.label, lang) : null, m.tone ?? 'warn']));
  useEffect(() => {
    uRef.current?.redraw(false);
  }, [linesKey, overlaysKey]);

  // a press on the key dims the other series: their style is changed on the plot and it is drawn again, never rebuilt, so the
  // cursor and a line the reader holds survive
  useEffect(() => {
    const u = uRef.current;
    if (!u) return;
    baseEntries.forEach(({ s, i }, k) => {
      const dim = soloStyle(soloIdx, i, s.mode === 'points' ? 1.5 : (s.width ?? 2));
      const one = u.series[k + 1];
      if (!one) return;
      one.alpha = dim.alpha;
      one.width = dim.width;
    });
    u.redraw(false);
  }, [soloIdx, baseEntries]);

  // an x as text: a date in the page language on a time axis (epoch seconds read as numbers were meaningless), else a formatted number
  const timeSpan = xs.length > 1 ? Math.abs(xs[xs.length - 1] - xs[0]) : 0;
  const xValue = (v: number): string => (x.time ? formatTime(v, lang, timeSpan) : formatNumber(v, lang, x.format ?? { digits: 4 }));
  const read =
    cursor !== null && readout
      ? readout(order ? order[cursor] : cursor)
      : cursor !== null
      ? [
          // an x that sits on a named tick is named by it, not by its number
          tickLabelAt(ticks, xs[cursor], lang, xSpan) !== null
            ? `${xLabel} ${tickLabelAt(ticks, xs[cursor], lang, xSpan)}`
            : `${xLabel} ${xValue(xs[cursor])}${xUnit && !x.time ? `${NBSP}${xUnit}` : ''}`,
          ...baseEntries
            .map(({ s }, k) => ({ s, v: ys[k][cursor] ?? null }))
            // a scatter's series are sets of points: name only the ones that have this point
            .filter(({ v }) => !scatter || v !== null)
            .map(({ s, v }) => `${pick(s.label, lang)} ${formatNumber(v, lang, y.format ?? { digits: 4 })}${yUnit ? `${NBSP}${yUnit}` : ''}`),
        ].join(' · ')
      : hint
        ? pick(hint, lang)
        : lang === 'es'
          ? 'Pase el cursor sobre el gráfico para leer los valores'
          : 'Hover the chart to read the values';
  // a mark label the drawing had to cut is read whole here, in the plot's title and in the table of marks
  const cutTexts = cutKey ? cutKey.split(CUT_SEP) : [];
  const readFull = cutTexts.length ? [read, ...cutTexts].join(' · ') : read;

  // ---- Tier A: the keyboard, the data table and the summary ----
  const xText = (v: number): string => tickLabelAt(ticks, v, lang, xSpan) ?? xValue(v);
  const yText = (v: number | null | undefined): string => (v === null || v === undefined || !Number.isFinite(v) ? '' : `${formatNumber(v, lang, y.format ?? { digits: 4 })}`);
  const xFormatKey = JSON.stringify(x.format ?? null);
  const yFormatKey = JSON.stringify(y.format ?? null);
  const a11y = useMemo(() => {
    if (!drawn) return null;
    const head = [xTitle, ...baseEntries.map(({ s: one }) => (yUnit ? `${pick(one.label, lang)} (${yUnit})` : pick(one.label, lang))), ...overlays.map(({ s: one }) => (yUnit ? `${pick(one.label, lang)} (${yUnit})` : pick(one.label, lang)))];
    const kept = thinRows(xs.length);
    const blanks = (n: number) => Array.from({ length: n }, () => '');
    const rows: string[][] = kept.map((i) => [xText(xs[i]), ...ys.map((col) => yText(col[i])), ...blanks(overlays.length)]);
    overlays.forEach(({ s: one }, o) => {
      const ox = one.x ?? [];
      for (const k of thinRows(Math.min(ox.length, one.values.length))) {
        if (!Number.isFinite(ox[k]) || one.values[k] === null || one.values[k] === undefined) continue;
        const cells = [...blanks(ys.length), ...blanks(overlays.length)];
        cells[ys.length + o] = yText(one.values[k]);
        rows.push([xText(ox[k]), ...cells]);
      }
    });
    const multi = baseEntries.length + overlays.length > 1;
    let low: { v: number; at: string } | null = null;
    let high: { v: number; at: string } | null = null;
    baseEntries.forEach(({ s: one }, k) => {
      for (let i = 0; i < xs.length; i++) {
        const v = ys[k][i];
        if (v === null || v === undefined || !Number.isFinite(v)) continue;
        const at = `${multi ? `${pick(one.label, lang)}, ` : ''}${xLabel} ${xText(xs[i])}`;
        if (!low || v < low.v) low = { v, at };
        if (!high || v > high.v) high = { v, at };
      }
    });
    const unit = yUnit ? `${NBSP}${yUnit}` : '';
    const lo = low as { v: number; at: string } | null;
    const hi = high as { v: number; at: string } | null;
    const summary = chartSummary(lang, {
      kind: 'line',
      name,
      count: xs.length,
      series: series.map((one) => pick(one.label, lang)),
      xLabel,
      xFrom: xs.length ? xText(xs[0]) : undefined,
      xTo: xs.length ? xText(xs[xs.length - 1]) : undefined,
      yLabel: yTitle,
      low: lo ? { text: `${yText(lo.v)}${unit}`, at: lo.at } : undefined,
      high: hi ? { text: `${yText(hi.v)}${unit}`, at: hi.at } : undefined,
    });
    return { head, rows, summary, thinned: kept.length < xs.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, xs, ys, baseEntries, overlays, series, lang, ticks, xSpan, xTitle, yTitle, xLabel, yUnit, name, xFormatKey, yFormatKey, x.time, timeSpan]);

  // the table of marks: every vertical and horizontal mark with its position, whole (0.19.0)
  const marksId = `${ids}-marks`;
  const markRows = useMemo(() => {
    const unnamed = (yMarks ?? []).flatMap((m, k) => (m.label ? [] : [k]));
    const xs2 = (marks ?? []).map((m) => [pick(m.label, lang), `${xLabel} ${xText(m.x)}${xUnit && !x.time && tickLabelAt(ticks, m.x, lang, xSpan) === null ? `${NBSP}${xUnit}` : ''}`]);
    const ys2 = (yMarks ?? []).map((m, k) => [m.label ? pick(m.label, lang) : referenceLineName(lang, unnamed.indexOf(k) + 1, unnamed.length), `${yText(m.y)}${yUnit ? `${NBSP}${yUnit}` : ''}`]);
    return [...xs2, ...ys2];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, yMarks, lang, xLabel, xUnit, yUnit, ticks, xSpan, xFormatKey, yFormatKey, x.time, timeSpan]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // a key that reaches the plot from a draggable line's handle is the handle's
    if (e.target !== e.currentTarget) return;
    const u = uRef.current;
    const ctl = ctlRef.current;
    if (!u || !ctl) return;
    const act = keyAction(e.key, { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey });
    if (!act) return;
    const n = xs.length;
    const stand = kbRef.current;
    switch (act) {
      case 'prev':
      case 'next':
      case 'first':
      case 'last': {
        let idx: number | null;
        if (stand === null && zoomedRef.current && (act === 'next' || act === 'prev')) {
          // a zoomed chart starts at the edge of what is in view, not at the far end of the data
          const v = ctl.view().x;
          let last: number | null = null;
          for (let i = n - 1; i >= 0; i--) {
            if (xs[i] >= v[0] && xs[i] <= v[1]) {
              last = i;
              break;
            }
          }
          idx = act === 'next' ? firstVisible(xs, v[0], v[1]) : last;
        } else idx = stepIndex(stand, act, n);
        if (idx === null) return;
        kbRef.current = idx;
        ctl.reveal(xs[idx]);
        ctl.place(idx);
        break;
      }
      case 'zoomIn':
      case 'zoomOut': {
        if (!zoomableRef.current) return;
        const v = ctl.view();
        const ax = stand !== null ? xs[stand] : x.log && v.x[0] > 0 ? Math.sqrt(v.x[0] * v.x[1]) : (v.x[0] + v.x[1]) / 2;
        const firstY = stand !== null ? ys.map((col) => col[stand]).find((val) => val !== null && val !== undefined && Number.isFinite(val)) : undefined;
        const ay = firstY ?? (y.log && v.y[0] > 0 ? Math.sqrt(v.y[0] * v.y[1]) : (v.y[0] + v.y[1]) / 2);
        ctl.zoomBy(act === 'zoomIn' ? KEY_ZOOM : 1 / KEY_ZOOM, ax, ay);
        if (stand !== null) ctl.place(stand);
        break;
      }
      case 'panPrev':
      case 'panNext':
        if (!zoomableRef.current || !zoomedRef.current) return;
        ctl.panBy(act === 'panNext' ? KEY_PAN : -KEY_PAN);
        break;
      case 'reset':
        if (e.key === 'Escape' && !zoomedRef.current) return;
        ctl.reset();
        if (stand !== null) ctl.place(stand);
        e.stopPropagation();
        break;
      case 'activate': {
        if (stand === null || !onPickRef.current) return;
        onPickRef.current(orderRef.current ? orderRef.current[stand] : stand);
        break;
      }
    }
    e.preventDefault();
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    if (kbRef.current === null) return;
    kbRef.current = null;
    ctlRef.current?.clear();
  };
  const resetZoom = () => {
    ctlRef.current?.reset();
    plotRef.current?.focus({ preventScroll: true });
  };
  const moved = [xBelow ? 'x' : '', yAbove ? 'y' : ''].filter(Boolean).join('');
  const readoutEl = (
    <p className="caos-chart-readout" aria-live="polite" title={readFull}>
      {readFull}
    </p>
  );

  return (
    <div
      ref={hostRef}
      className={fill ? 'caos-chart fill' : 'caos-chart'}
      data-series={series.length}
      data-axis-titles={`${xLabel}|${yLabel}`}
      data-ticks-cut="0"
      data-ticks-repeat="0"
      data-drawn={width > 0 && h > 0 ? '1' : '0'}
      data-parity={parity ? '1' : undefined}
      data-log-x={x.log ? '1' : undefined}
      data-pick={onPick ? '1' : undefined}
      data-y-marks={yMarks?.length ? String(yMarks.length) : undefined}
      data-y-drag={dragCount ? String(dragCount) : undefined}
      data-overlay={overlays.length ? String(overlays.length) : undefined}
      data-solo={soloIdx !== null ? String(soloIdx) : undefined}
      data-chart-host={drawn ? 'line' : undefined}
      data-points={drawn ? String(xs.length) : undefined}
      data-zoomable={drawn ? (zoomable ? '1' : '0') : undefined}
      data-zoomed={drawn && zoomed ? '1' : undefined}
      data-zoom-off={drawn && zoomIsOff ? zoomWhy : undefined}
      data-axis-title-moved={drawn && moved ? moved : undefined}
    >
      {drawn && yAbove && yTitle && (
        <p className="caos-chart-axis-title" data-axis-title="y">
          {yTitle}
        </p>
      )}
      <div
        ref={setPlot}
        className="caos-chart-plot"
        title={cutTexts.length ? cutTexts.join('; ') : undefined}
        {...(drawn
          ? {
              tabIndex: 0,
              role: 'group',
              'aria-roledescription': CHART_ROLE[lang],
              'aria-label': name,
              'aria-describedby': summaryId,
              'aria-details': markRows.length ? `${tableId} ${marksId}` : tableId,
              'aria-description': zoomable ? ZOOM_HINT[lang] : undefined,
              'data-chart-focus': '',
              onKeyDown,
              onBlur,
            }
          : {})}
      />
      {drawn && xBelow && (
        <p className="caos-chart-axis-title" data-axis-title="x">
          {xTitle}
        </p>
      )}
      {drawn && a11y && <ChartSummary id={summaryId} text={a11y.summary} />}
      {drawn && markRows.length > 0 && (
        <div className="sr-only" data-chart-marks-box="">
          <table id={marksId} className="caos-chart-table" data-chart-marks="">
            <caption>{lang === 'es' ? `Marcas de ${name}` : `Marks of ${name}`}</caption>
            <thead>
              <tr>
                <th scope="col">{lang === 'es' ? 'Marca' : 'Mark'}</th>
                <th scope="col">{lang === 'es' ? 'Posición' : 'Position'}</th>
              </tr>
            </thead>
            <tbody>
              {markRows.map((row, r) => (
                <tr key={r}>
                  <th scope="row">{row[0]}</th>
                  <td>{row[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {drawn && a11y && <ChartDataTable id={tableId} caption={a11y.thinned ? `${name} (${lang === 'es' ? 'una de cada varias filas' : 'every few rows'})` : name} head={a11y.head} rows={a11y.rows} />}
      {(series.length > 1 || solo) && (
        <ul className="caos-chart-legend" aria-label={lang === 'es' ? 'Series del gráfico' : 'Series of the chart'}>
          {series.map((s, i) => (
            <li key={i} className="caos-chart-key" data-mode={s.mode ?? 'line'} data-dash={seriesStyle(s, i).dash ? '1' : undefined}>
              {solo ? (
                <button type="button" className="caos-chart-key-button" aria-pressed={soloIdx === i} onClick={() => setSoloPick(soloIdx === i ? null : soloKey(s))}>
                  <span className="caos-chart-swatch" style={{ '--swatch': `var(${seriesStyle(s, i).color})` } as CSSProperties} aria-hidden="true" />
                  {pick(s.label, lang)}
                </button>
              ) : (
                <>
                  <span className="caos-chart-swatch" style={{ '--swatch': `var(${seriesStyle(s, i).color})` } as CSSProperties} aria-hidden="true" />
                  {pick(s.label, lang)}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {drawn ? (
        <div className="caos-chart-foot">
          {readoutEl}
          {zoomed && zoomable && <ResetZoomButton lang={lang} onReset={resetZoom} />}
        </div>
      ) : (
        readoutEl
      )}
    </div>
  );
}
