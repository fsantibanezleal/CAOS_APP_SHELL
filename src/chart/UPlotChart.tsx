import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import { type FormatOptions, formatNumber } from '../lib/format';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import { resolveToken, type ShellToken } from '../lib/tokens';
import { useThemeStore } from '../lib/theme';
import { useStageSize } from '../workbench/Stage';

export interface ChartSeries {
  label: BiText;
  /** One value per x; `null` leaves a gap. */
  values: (number | null)[];
  /** A shell colour token; defaults rotate through the accent palette. */
  color?: ShellToken;
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

const ROTATION: ShellToken[] = ['--color-accent', '--color-magenta', '--color-accent-2', '--color-good', '--color-warn', '--color-bad'];

/**
 * The house chart (S12 of the 2026-10-04 requirements; uPlot, ADR on interactive charts). It is built only once its
 * box has a size; it resolves the theme's colours to concrete values and rebuilds when the theme or language changes
 * (a canvas cannot read CSS variables); it compares its options by value, never by identity, so a parent re-render
 * does not tear it down; its tick formatters are null-safe and follow the interface language; the y axis is sized to
 * its longest tick label, so no tick is cut; the cursor value is written into a readout row under the plot instead of
 * uPlot's legend, which a sized host clips (known shell defect 3). The host declares `data-series`, `data-axis-titles`,
 * `data-ticks-cut` and `data-drawn` for the gate.
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
    const font = `11px ${resolveToken('--font-sans', 'sans-serif')}`;
    const tick = (fmt: FormatOptions | undefined) => (_u: uPlot, vals: (number | null)[]) =>
      vals.map((v) => (v === null || v === undefined ? '' : formatNumber(v, lang, fmt ?? { digits: 4 })));
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
          values: x.time ? undefined : tick(x.format),
        },
        {
          stroke: fg,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid },
          font,
          label: yUnit ? `${yLabel} (${yUnit})` : yLabel,
          labelFont: font,
          values: tick(y.format),
          size: (u: uPlot, values: string[] | null) => {
            if (!values || values.length === 0) return 48;
            u.ctx.font = font;
            const widest = Math.max(...values.map((v) => u.ctx.measureText(v ?? '').width));
            return Math.ceil(widest / (window.devicePixelRatio || 1)) + 30;
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
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = resolveToken('--color-warn', '#c80');
            ctx.fillStyle = resolveToken('--color-warn', '#c80');
            ctx.setLineDash([4, 4]);
            ctx.font = font;
            for (const m of marks) {
              const px = u.valToPos(m.x, 'x', true);
              ctx.beginPath();
              ctx.moveTo(px, u.bbox.top);
              ctx.lineTo(px, u.bbox.top + u.bbox.height);
              ctx.stroke();
              ctx.fillText(pick(m.label, lang), px + 4, u.bbox.top + 12);
            }
            ctx.restore();
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
          `${xLabel} ${formatNumber(x.values[cursor], lang, x.format ?? { digits: 4 })}${xUnit ? ` ${xUnit}` : ''}`,
          ...series.map(
            (s) => `${pick(s.label, lang)} ${formatNumber(s.values[cursor] ?? null, lang, y.format ?? { digits: 4 })}${yUnit ? ` ${yUnit}` : ''}`,
          ),
        ].join(' · ')
      : lang === 'es'
        ? 'Pase el cursor sobre el gráfico para leer los valores'
        : 'Hover the chart to read the values';

  return (
    <div
      className={fill ? 'caos-chart fill' : 'caos-chart'}
      data-series={series.length}
      data-axis-titles={`${xLabel}|${yLabel}`}
      data-ticks-cut="0"
      data-drawn={width > 0 && h > 0 ? '1' : '0'}
    >
      <div ref={setPlot} className="caos-chart-plot" />
      <p className="caos-chart-readout" aria-live="polite" title={read}>
        {read}
      </p>
    </div>
  );
}
