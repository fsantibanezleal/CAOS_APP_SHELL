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
}

export interface ChartAxis {
  label: BiText;
  unit?: BiText;
  format?: FormatOptions;
}

export interface UPlotChartProps {
  /** The x values and their axis. A time axis must be declared (`time: true`); uPlot otherwise reads numbers as
   * epoch seconds and labels ticks as dates (failure class 7). */
  x: ChartAxis & { values: number[]; time?: boolean };
  y: ChartAxis & { log?: boolean; range?: [number, number] };
  series: ChartSeries[];
  /** Vertical markers at x positions, drawn on the plot and labelled (mark what the engine detected). */
  marks?: { x: number; label: BiText }[];
  /** Height in pixels, or `fill` to take the container's height (inside `PlotCard fill`); the width is always the
   * container's. */
  height?: number | 'fill';
  /** Called with the index under the cursor (or null), for linked views. */
  onCursor?: (index: number | null) => void;
}

const ROTATION: ShellColorToken[] = ['--color-accent', '--color-magenta', '--color-accent-2', '--color-good', '--color-warn', '--color-bad'];

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
export function UPlotChart({ x, y, series, marks, height = 280, onCursor }: UPlotChartProps) {
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
  const width = box.width;
  const h = fill ? box.height : height;
  const uRef = useRef<uPlot | null>(null);
  // the host, whose data-ticks-repeat the tick formatters keep current (set on the element: a formatter runs inside
  // uPlot's draw, where a state update would loop)
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const onCursorRef = useRef(onCursor);
  onCursorRef.current = onCursor;

  const xLabel = pick(x.label, lang);
  const yLabel = pick(y.label, lang);
  const xUnit = x.unit ? pick(x.unit, lang) : '';
  const yUnit = y.unit ? pick(y.unit, lang) : '';
  // Everything that changes the plot's structure, by value.
  const structure = JSON.stringify({
    s: series.map((s, i) => [pick(s.label, lang), s.color ?? ROTATION[i % ROTATION.length], s.width ?? 2, s.dash ?? null, s.mode ?? 'line']),
    x: [xLabel, xUnit, Boolean(x.time), x.format ?? null],
    y: [yLabel, yUnit, Boolean(y.log), y.range ?? null, y.format ?? null],
    m: (marks ?? []).map((m) => [m.x, pick(m.label, lang)]),
    theme,
    lang,
    h,
    w: width,
  });
  const data = useMemo(() => [x.values, ...series.map((s) => s.values)] as uPlot.AlignedData, [x.values, series]);

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
      return labels;
    };
    const xSteps = x.time ? undefined : tickSteps(x.format);
    const ySteps = y.log ? undefined : tickSteps(y.format);
    const opts: uPlot.Options = {
      width,
      height: h,
      legend: { show: false },
      scales: { x: { time: Boolean(x.time) }, y: { distr: y.log ? 3 : 1, ...(y.range ? { range: y.range } : {}) } },
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
          const stroke = resolveToken(s.color ?? ROTATION[i % ROTATION.length], '#4a8');
          return s.mode === 'points'
            ? { label: pick(s.label, lang), stroke, width: 1.5, paths: () => null, points: { show: true, space: 0, size: 9, fill: stroke } }
            : { label: pick(s.label, lang), stroke, width: s.width ?? 2, dash: s.dash, spanGaps: false, points: { show: false } };
        }),
      ],
      hooks: {
        setCursor: [
          (u: uPlot) => {
            const idx = u.cursor.idx ?? null;
            setCursor(idx);
            onCursorRef.current?.(idx);
          },
        ],
        draw: [
          (u: uPlot) => {
            if (!marks?.length) return;
            drawMarks(u, marks.map((m) => ({ x: m.x, label: pick(m.label, lang) })), {
              color: resolveToken('--color-warn', '#c80'),
              halo: surface,
              family,
            });
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
    cursor !== null
      ? [
          `${xLabel} ${formatNumber(x.values[cursor], lang, x.format ?? { digits: 4 })}${xUnit ? `${NBSP}${xUnit}` : ''}`,
          ...series.map(
            (s) => `${pick(s.label, lang)} ${formatNumber(s.values[cursor] ?? null, lang, y.format ?? { digits: 4 })}${yUnit ? `${NBSP}${yUnit}` : ''}`,
          ),
        ].join(' · ')
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
    >
      <div ref={setPlot} className="caos-chart-plot" />
      {series.length > 1 && (
        <ul className="caos-chart-legend" aria-label={lang === 'es' ? 'Series del gráfico' : 'Series of the chart'}>
          {series.map((s, i) => (
            <li key={i} className="caos-chart-key" data-mode={s.mode ?? 'line'} data-dash={s.dash ? '1' : undefined}>
              <span className="caos-chart-swatch" style={{ '--swatch': `var(${s.color ?? ROTATION[i % ROTATION.length]})` } as CSSProperties} aria-hidden="true" />
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
