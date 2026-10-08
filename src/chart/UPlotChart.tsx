import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import { type FormatOptions, formatNumber, formatTicks, NBSP } from '../lib/format';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import { resolveToken, type ShellColorToken } from '../lib/tokens';
import { useThemeStore } from '../lib/theme';
import { useStageSize } from '../workbench/Stage';

export interface ChartSeries {
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
}

export interface ChartAxis {
  label: BiText;
  unit?: BiText;
  format?: FormatOptions;
}

export interface UPlotChartProps {
  /** The x values and their axis. A time axis must be declared (`time: true`); uPlot otherwise reads numbers as
   * epoch seconds and labels ticks as dates (failure class 7). */
  x: ChartAxis & { values: number[]; time?: boolean; log?: boolean };
  y: ChartAxis & { log?: boolean; range?: [number, number] };
  series: ChartSeries[];
  /** Vertical markers at x positions, drawn on the plot and labelled (mark what the engine detected). */
  marks?: { x: number; label: BiText }[];
  /** Horizontal reference lines at y values, labelled at their right end (a null model's constant prediction, a
   * target, a limit). */
  yMarks?: { y: number; label: BiText }[];
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
}

const ROTATION: ShellColorToken[] = ['--color-accent', '--color-magenta', '--color-accent-2', '--color-good', '--color-warn', '--color-bad'];

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

/** How many tick labels repeat the label before them (empty labels apart); the gate fails a chart with any (G6). */
export function repeatedLabels(labels: readonly (string | null | undefined)[]): number {
  let n = 0;
  for (let i = 1; i < labels.length; i++) if (labels[i] && labels[i] === labels[i - 1]) n++;
  return n;
}

/** A placed mark label, in device pixels. */
interface Placed {
  x0: number;
  x1: number;
  row: number;
}

/**
 * The vertical marks of a chart and their labels. Every label is drawn with an explicit alignment (uPlot leaves the
 * context right-aligned after its last axis, so a label meant to start at its line ended there and ran off the plot
 * near the left edge, CAOS_Fragmenta 2026-10-06), on the side of its line where it fits inside the plot, on the next
 * row down when it would overlap the label before it, with a halo in the surface colour so a curve under it does not
 * cross its letters. A mark outside the x range is not drawn.
 */
export function drawMarks(u: uPlot, marks: { x: number; label: string }[], style: { color: string; halo: string; family: string }): void {
  const ctx = u.ctx;
  const pr = uPlot.pxRatio || 1;
  const left = u.bbox.left;
  const right = u.bbox.left + u.bbox.width;
  const gap = 4 * pr;
  const rowH = 14 * pr;
  const placed: Placed[] = [];
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
    const w = ctx.measureText(m.label).width;
    // right of the line when it fits, else left of it, else clamped inside the plot
    let x0 = px + gap;
    if (x0 + w > right) x0 = px - gap - w;
    if (x0 < left) x0 = Math.max(left, Math.min(right - w, px - w / 2));
    let row = 0;
    while (placed.some((p) => p.row === row && x0 < p.x1 + gap && x0 + w + gap > p.x0)) row += 1;
    placed.push({ x0, x1: x0 + w, row });
    const y = u.bbox.top + 12 * pr + row * rowH;
    ctx.textAlign = 'left';
    ctx.lineWidth = 3 * pr;
    ctx.strokeStyle = style.halo;
    ctx.strokeText(m.label, x0, y);
    ctx.fillStyle = style.color;
    ctx.fillText(m.label, x0, y);
  }
  ctx.restore();
}

/**
 * The horizontal reference lines of a chart and their labels: a dashed line across the plot, its label at the right
 * end above the line (below it when the line runs along the top), inside the plot, haloed; a label that would overlap
 * the one placed before it moves left of it. A line outside the y range is not drawn.
 */
export function drawYMarks(u: uPlot, marks: { y: number; label: string }[], style: { color: string; halo: string; family: string }): void {
  const ctx = u.ctx;
  const pr = uPlot.pxRatio || 1;
  const left = u.bbox.left;
  const right = u.bbox.left + u.bbox.width;
  const top = u.bbox.top;
  const bottom = u.bbox.top + u.bbox.height;
  const gap = 4 * pr;
  const textH = 11 * pr;
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  ctx.save();
  ctx.font = `${Math.round(11 * pr)}px ${style.family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  for (const m of [...marks].sort((a, b) => b.y - a.y)) {
    const py = u.valToPos(m.y, 'y', true);
    if (!Number.isFinite(py) || py < top - 0.5 || py > bottom + 0.5) continue;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = Math.max(1, pr);
    ctx.setLineDash([2 * pr, 4 * pr]);
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(right, py);
    ctx.stroke();
    ctx.setLineDash([]);
    const w = ctx.measureText(m.label).width;
    // above the line, or below it when there is no room above
    const base = py - gap - textH < top ? py + gap + textH : py - gap;
    let x1 = right - gap;
    while (placed.some((p) => x1 - w < p.x1 + gap && x1 > p.x0 - gap && base - textH < p.y1 && base > p.y0)) {
      x1 = Math.min(...placed.filter((p) => base - textH < p.y1 && base > p.y0).map((p) => p.x0)) - 2 * gap;
    }
    const x0 = Math.max(left + gap, x1 - w);
    placed.push({ x0, x1: x0 + w, y0: base - textH, y1: base });
    ctx.textAlign = 'left';
    ctx.lineWidth = 3 * pr;
    ctx.strokeStyle = style.halo;
    ctx.strokeText(m.label, x0, base);
    ctx.fillStyle = style.color;
    ctx.fillText(m.label, x0, base);
  }
  ctx.restore();
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
 * declares `data-series`, `data-axis-titles`, `data-ticks-cut`, `data-ticks-repeat` and `data-drawn` for the gate.
 */
export function UPlotChart({ x, y, series, marks, yMarks, height = 280, onCursor, onPick, parity, readout, hint }: UPlotChartProps) {
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
  const width = parity ? Math.min(box.width, fill ? box.height : height) : box.width;
  const h = parity ? width : fill ? box.height : height;
  const uRef = useRef<uPlot | null>(null);
  // the host, whose data-ticks-repeat the tick formatters keep current (set on the element: a formatter runs inside
  // uPlot's draw, where a state update would loop)
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
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
  const ys = useMemo(() => series.map((s) => (order ? order.map((i) => s.values[i] ?? null) : s.values)), [order, series]);
  const levels = useMemo(() => (yMarks ?? []).map((m) => m.y), [yMarks]);
  const range = useMemo(() => (parity ? parityRange(xs, ...ys, levels) : null), [parity, xs, ys, levels]);
  // a log axis reaching below uPlot's tick table ticks at powers of ten (known shell defect 31)
  const tiny = useMemo(
    () => ({
      x: Boolean(x.log) && smallestPositive([xs], range) < LOG_TABLE_FLOOR,
      y: Boolean(y.log) && smallestPositive(ys, range ?? y.range) < LOG_TABLE_FLOOR,
    }),
    [x.log, y.log, xs, ys, range, y.range],
  );

  const xLabel = pick(x.label, lang);
  const yLabel = pick(y.label, lang);
  const xUnit = x.unit ? pick(x.unit, lang) : '';
  const yUnit = y.unit ? pick(y.unit, lang) : '';
  // Everything that changes the plot's structure, by value.
  const structure = JSON.stringify({
    s: series.map((s, i) => [pick(s.label, lang), seriesStyle(s, i), s.width ?? 2, s.mode ?? 'line', s.size ?? 9]),
    x: [xLabel, xUnit, Boolean(x.time), Boolean(x.log), x.format ?? null, tiny.x],
    p: range,
    pick: Boolean(onPick),
    y: [yLabel, yUnit, Boolean(y.log), y.range ?? null, y.format ?? null, tiny.y],
    m: (marks ?? []).map((m) => [m.x, pick(m.label, lang)]),
    ym: (yMarks ?? []).map((m) => [m.y, pick(m.label, lang)]),
    theme,
    lang,
    h,
    w: width,
  });
  const data = useMemo(() => [xs, ...ys] as uPlot.AlignedData, [xs, ys]);
  // a chart of points only (a scatter, a parity plot): the cursor takes the point nearest the pointer in the plane
  const scatter = series.length > 0 && series.every((s) => s.mode === 'points');

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
    const tick = (fmt: FormatOptions | undefined, axis: 'x' | 'y') => (_u: uPlot, vals: (number | null)[]) => {
      const labels = formatTicks(vals, lang, fmt ?? { digits: 4 });
      repeats[axis] = repeatedLabels(labels);
      hostRef.current?.setAttribute('data-ticks-repeat', String(repeats.x + repeats.y));
      // how many ticks the axis labels: a parity plot's two axes must agree, and an axis with fewer than two says nothing
      hostRef.current?.setAttribute(`data-ticks-${axis}`, String(labels.filter((l) => l).length));
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
    const opts: uPlot.Options = {
      width,
      height: h,
      legend: { show: false },
      ...(scatter ? { cursor: { dataIdx: (u: uPlot, sIdx: number, closest: number) => (sIdx === 0 ? closest : (nearest(u) ?? closest)) } } : {}),
      // a log axis labels the ticks uPlot keeps and passes null for the rest, which formatTicks leaves blank
      scales: {
        // a log x axis spans the data, not the decades around it (uPlot rounds out to the next decade, which left an
        // axis to 1,000 for data that ends at 120)
        x: {
          time: Boolean(x.time),
          distr: x.log ? 3 : 1,
          ...(range ? { range } : x.log ? { range: (_u: uPlot, min: number, max: number): uPlot.Range.MinMax => [min, max] } : {}),
        },
        y: { distr: y.log ? 3 : 1, ...(range ? { range } : y.range ? { range: y.range } : {}) },
      },
      axes: [
        {
          stroke: fg,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid },
          font,
          label: xUnit ? `${xLabel} (${xUnit})` : xLabel,
          labelFont: font,
          values: x.time ? undefined : tick(x.format, 'x'),
          ...(xSteps ? { incrs: xSteps } : {}),
          ...(range ? { space: PARITY_TICK_SPACE } : {}),
          ...(tiny.x ? DECADE_AXIS : {}),
        },
        {
          stroke: fg,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid },
          font,
          label: yUnit ? `${yLabel} (${yUnit})` : yLabel,
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
            return Math.ceil(widest / pr) + 30;
          },
        },
      ],
      series: [
        {},
        ...series.map((s, i) => {
          const style = seriesStyle(s, i);
          const stroke = resolveToken(style.color, '#4a8');
          return s.mode === 'points'
            ? { label: pick(s.label, lang), stroke, width: 1.5, paths: () => null, points: { show: true, space: 0, size: s.size ?? 9, fill: stroke } }
            : { label: pick(s.label, lang), stroke, width: s.width ?? 2, dash: style.dash, spanGaps: false, points: { show: false } };
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
            const markStyle = { color: resolveToken('--color-warn', '#c80'), halo: surface, family };
            if (yMarks?.length) drawYMarks(u, yMarks.map((m) => ({ y: m.y, label: pick(m.label, lang) })), markStyle);
            if (marks?.length) drawMarks(u, marks.map((m) => ({ x: m.x, label: pick(m.label, lang) })), markStyle);
          },
        ],
      },
    };
    uRef.current?.destroy();
    uRef.current = new uPlot(opts, data, el);
    return () => {
      uRef.current?.destroy();
      uRef.current = null;
    };
    // structure is the by-value key of everything above; data updates go through setData below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure]);

  useEffect(() => {
    uRef.current?.setData(data);
  }, [data]);

  const read =
    cursor !== null && readout
      ? readout(order ? order[cursor] : cursor)
      : cursor !== null
      ? [
          `${xLabel} ${formatNumber(xs[cursor], lang, x.format ?? { digits: 4 })}${xUnit ? `${NBSP}${xUnit}` : ''}`,
          ...series
            .map((s, k) => ({ s, v: ys[k][cursor] ?? null }))
            // a scatter's series are sets of points: name only the ones that have this point
            .filter(({ v }) => !scatter || v !== null)
            .map(({ s, v }) => `${pick(s.label, lang)} ${formatNumber(v, lang, y.format ?? { digits: 4 })}${yUnit ? `${NBSP}${yUnit}` : ''}`),
        ].join(' · ')
      : hint
        ? pick(hint, lang)
        : lang === 'es'
          ? 'Pase el cursor sobre el gráfico para leer los valores'
          : 'Hover the chart to read the values';

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
    >
      <div ref={setPlot} className="caos-chart-plot" />
      {series.length > 1 && (
        <ul className="caos-chart-legend" aria-label={lang === 'es' ? 'Series del gráfico' : 'Series of the chart'}>
          {series.map((s, i) => (
            <li key={i} className="caos-chart-key" data-mode={s.mode ?? 'line'} data-dash={seriesStyle(s, i).dash ? '1' : undefined}>
              <span className="caos-chart-swatch" style={{ '--swatch': `var(${seriesStyle(s, i).color})` } as CSSProperties} aria-hidden="true" />
              {pick(s.label, lang)}
            </li>
          ))}
        </ul>
      )}
      <p className="caos-chart-readout" aria-live="polite" title={read}>
        {read}
      </p>
    </div>
  );
}
