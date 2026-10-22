import { type FocusEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { type FormatOptions, formatNumber, formatTicks, NBSP, NOT_AVAILABLE } from '../lib/format';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import type { Tone } from '../workbench/Readouts';
import { useStageSize } from '../workbench/Stage';
import { CHART_ROLE, ChartDataTable, ChartSummary, ResetZoomButton } from './ChartA11y';
import {
  allIntegers,
  axisTitleFits,
  brushWindow,
  categoryAt,
  chartSummary,
  DRAG_THRESHOLD,
  KEY_PAN,
  KEY_ZOOM,
  keyAction,
  panRange,
  pinchState,
  roundWindow,
  stepIndex,
  stepWindow,
  wheelFactor,
  windowRange,
  windowZoomed,
  wrapLines,
  zoomRange,
} from './interaction';
import { fitLabel, niceTicks, repeatedLabels, textWidth, widestLabel } from './text';

export interface BarDatum {
  id: string;
  label: BiText;
  /** `null` or `undefined` shows "not available" at the zero line, never a bar of zero. */
  value: number | null | undefined;
  /** An explicit colour by meaning; otherwise the accent, or faint beside a highlighted bar. */
  tone?: Tone;
  /** The bar the reader is on (the selected variant, the case asked about). */
  highlight?: boolean;
  /** One line shown as the bar's title. */
  hint?: BiText;
}

export interface BarChartProps {
  /** The chart's accessible name. */
  title: BiText;
  data: BarDatum[];
  /** The value axis: its title, unit and number format; `range` fixes the domain (it always includes zero). */
  axis: { label: BiText; unit?: BiText; format?: FormatOptions; range?: [number, number] };
  /** Horizontal bars (the default) give every category label its own line, so long labels never collide;
   * vertical bars suit a few short categories. */
  orientation?: 'horizontal' | 'vertical';
  /** Write each value at its bar (default true). */
  values?: boolean;
  /** A vertical chart's height in pixels (default 240), or `fill` to take its container's height (inside a filling
   * PlotCard). A horizontal chart takes the height its rows need, or fills and spaces its rows when `fill`. */
  height?: number | 'fill';
  /** Called with a bar's id when it is clicked or chosen with the keyboard. */
  onSelect?: (id: string) => void;
  /** Turn zoom and pan by category off (0.19.0), with the reason (at least 12 characters; the gate lists every chart that sets it).
   * The crosshair, the readout, the keyboard, the data table and the summary cannot be turned off. */
  zoomOff?: BiText;
}

const PX = 11;
const LINE = 13;
const TONE: Record<Tone, string> = {
  good: 'var(--color-good)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)',
  accent: 'var(--color-accent)',
  neutral: 'var(--color-fg-faint)',
};
const REST: Record<'en' | 'es', string> = {
  en: 'Point at a bar, or use the arrow keys, to read its value',
  es: 'Apunte a una barra, o use las flechas, para leer su valor',
};

function Lines({ x, y, lines, anchor, fill }: { x: number; y: number; lines: string[]; anchor: 'start' | 'middle' | 'end'; fill: string }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={PX} fill={fill} style={{ fontFamily: 'var(--font-sans)' }}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : LINE}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** Where the category axis lies in the drawing, in the drawing's own pixels, and how many bars it holds. */
interface Geometry {
  horizontal: boolean;
  start: number;
  end: number;
}

/**
 * The house categorical chart (CAOS_MANAGE audit 2026-10-07: every product hand-drew its bar charts with fixed margins,
 * the product template included). Margins are measured from the labels in the page's font; a category label is broken
 * over two lines at a word and only then shortened, with the whole label as its title; ticks are round and share one
 * notation; values are written in the interface language. It renders once its box has a width and declares
 * `data-chart`, which the gate's text check (G10) measures.
 *
 * Since 0.19.0 it carries Tier A of the interactive-visualization rubric: a crosshair band and a readout for the bar under
 * the pointer or the keyboard, zoom and pan by category (wheel while the chart has the focus, Ctrl and wheel, brush, Shift and
 * drag, pinch), a reset control shown while zoomed, the keyboard model (arrows, Home, End, + and -, Shift with the arrows,
 * 0 and Escape), a hidden table of the values and a one-line summary. A value axis of counts ticks at whole numbers only
 * (`data-ticks-repeat` declares the labels that repeat, for the gate), and a long axis title wraps instead of being cut.
 */
export function BarChart({ title, data, axis, orientation = 'horizontal', values = true, height, onSelect, zoomOff }: BarChartProps) {
  const lang = useShellLang();
  const [measureRef, box] = useStageSize();
  const innerRef = useRef<HTMLDivElement | null>(null);
  const setInner = useCallback(
    (el: HTMLDivElement | null) => {
      innerRef.current = el;
      measureRef(el);
    },
    [measureRef],
  );
  const fill = height === 'fill';
  const name = pick(title, lang);
  const unit = axis.unit ? pick(axis.unit, lang) : '';
  const axisTitle = unit ? `${pick(axis.label, lang)} (${unit})` : pick(axis.label, lang);
  const fmt = axis.format ?? { digits: 3 };
  const n = data.length;
  const finite = data.map((d) => d.value).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  const lo = Math.min(0, axis.range ? axis.range[0] : Math.min(0, ...finite));
  const hi = Math.max(0, axis.range ? axis.range[1] : Math.max(0, ...finite));
  // A value axis of counts ticks at whole numbers (known shell defect, Contraste b05 to b09: "0, 1, 1, 2, 2"): fixed zero decimals,
  // or whole values with no decimals asked for, on a domain whose ends are whole.
  // The smallest step the axis may tick at is the least difference its labels can show: a whole number for counts, a unit of the last
  // fixed decimal otherwise (a percent shows hundredths of the value), so the labels never repeat and none is a rounded fraction.
  const countAxis = fmt.decimals === undefined && finite.length > 0 && allIntegers(finite) && allIntegers(axis.range ?? []);
  const resolution = fmt.decimals !== undefined ? 10 ** -fmt.decimals / (fmt.percent ? 100 : 1) : countAxis ? 1 : 0;
  const anyHighlight = data.some((d) => d.highlight);
  const colour = (d: BarDatum) => (d.tone ? TONE[d.tone] : !anyHighlight || d.highlight ? 'var(--color-accent)' : 'var(--color-fg-faint)');
  const shown = (d: BarDatum) =>
    d.value === null || d.value === undefined || !Number.isFinite(d.value) ? NOT_AVAILABLE[lang] : formatNumber(d.value, lang, fmt);
  const width = box.width;

  // ---- Tier A state ----
  const ids = useId();
  const tableId = `${ids}-table`;
  const summaryId = `${ids}-summary`;
  const [win, setWin] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [brush, setBrush] = useState<{ a: number; b: number } | null>(null);
  const [s0, e0] = windowRange(n, win);
  const zoomed = windowZoomed(n, win);
  // zoom is off whenever `zoomOff` is given, whatever its text: an empty reason in a language still turns zoom off and is still reported (the gate fails it)
  const zoomIsOff = zoomOff !== undefined && zoomOff !== null;
  const zoomable = !zoomIsOff && n >= 3;
  const zoomWhy = zoomIsOff ? pick(zoomOff, lang) : '';
  const kbRef = useRef(false);
  const geoRef = useRef<Geometry | null>(null);
  const live = useRef({ win: win as [number, number] | null, n, zoomable, cursor: cursor as number | null });
  live.current = { win, n, zoomable, cursor };
  // the bars the chart is drawn for: a new list of ids starts from the whole of it
  const idKey = data.map((d) => d.id).join('\u0001');
  useEffect(() => {
    setWin(null);
    setCursor(null);
    setBrush(null);
  }, [idKey]);

  const select = (id: string) => onSelect?.(id);
  const keyed = (id: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(id);
    }
  };
  const interactive = (d: BarDatum) =>
    onSelect
      ? { role: 'button', tabIndex: 0, onClick: () => select(d.id), onKeyDown: keyed(d.id), style: { cursor: 'pointer' } }
      : {};

  let drawing: ReactNode = null;
  let drawnHeight = 0;
  let tickLabels: string[] = [];
  const valueLabels = data.map(shown);
  if (width > 0 && n > 0) {
    const count = e0 - s0;
    const valueCol = values ? widestLabel(valueLabels, PX) + 8 : 0;
    const rowsShown = data.slice(s0, e0);
    if (orientation === 'horizontal') {
      const labelCol = Math.min(widestLabel(data.map((d) => pick(d.label, lang)), PX), Math.max(80, 0.38 * width));
      const fittedAll = data.map((d) => fitLabel(pick(d.label, lang), labelCol, PX, 2));
      const fitted = fittedAll.slice(s0, e0);
      const need = Math.max(22, Math.max(...fittedAll.map((f) => f.lines.length)) * LINE + 8);
      const x0 = labelCol + 10;
      const x1 = Math.max(x0 + 40, width - valueCol - 6);
      // the axis title stays on one line under the plot while it fits there, and wraps over the drawing's width when it does not
      const cx = x0 + (x1 - x0) / 2;
      const titleFits = axisTitleFits(axisTitle, 2 * Math.min(cx, width - cx) - 8, PX);
      const titleLines = titleFits ? [axisTitle] : wrapLines(axisTitle, width - 8, PX);
      const axisH = 6 + LINE + 4 + titleLines.length * LINE + 4;
      const tickProbe = widestLabel(formatTicks([lo, hi], lang, fmt), PX);
      const ticks = niceTicks(lo, hi, x1 - x0, tickProbe, 6, resolution);
      const t0 = ticks[0];
      const t1 = ticks[ticks.length - 1];
      tickLabels = formatTicks(ticks, lang, fmt);
      const sx = (v: number) => x0 + ((v - t0) / (t1 - t0 || 1)) * (x1 - x0);
      // filling its card, the rows share the height (a capped row height left three bars on a quarter of the card,
      // under the gate's stage-fill floor); a bar keeps a readable thickness and its label stays centred on it. A zoomed
      // chart keeps the height of the whole one, so the page does not move: fewer rows take the same room.
      const rowFull = fill && box.height > 0 ? Math.max(need, (box.height - axisH - 4) / n) : need;
      const rowH = (n * rowFull) / count;
      const top = 4;
      const plotBottom = top + n * rowFull;
      drawnHeight = fill && box.height > 0 ? Math.max(box.height, plotBottom + axisH) : plotBottom + axisH;
      const barH = Math.min(rowH * 0.5, 40);
      geoRef.current = { horizontal: true, start: top, end: plotBottom };
      drawing = (
        <svg width={width} height={drawnHeight} role="presentation" data-chart="" data-chart-kind="bars">
          <title>{name}</title>
          {ticks.map((t, i) => (
            <g key={`t${i}`}>
              <line x1={sx(t)} x2={sx(t)} y1={top} y2={plotBottom} stroke="var(--color-border)" strokeWidth={t === 0 ? 1.4 : 1} />
              <text x={sx(t)} y={plotBottom + 6 + LINE - 2} textAnchor={i === 0 && sx(t) - textWidth(tickLabels[i], PX) / 2 < 0 ? 'start' : i === ticks.length - 1 && sx(t) + textWidth(tickLabels[i], PX) / 2 > width ? 'end' : 'middle'} fontSize={PX} fill="var(--color-fg-subtle)" style={{ fontFamily: 'var(--font-sans)' }}>
                {tickLabels[i]}
              </text>
            </g>
          ))}
          <Lines x={titleFits ? cx : width / 2} y={plotBottom + 6 + LINE + 4 + LINE - 2} lines={titleLines} anchor="middle" fill="var(--color-fg-subtle)" />
          {cursor !== null && cursor >= s0 && cursor < e0 && <rect className="caos-bars-cursor" data-bar-cursor="" x={0} y={top + (cursor - s0) * rowH} width={width} height={rowH} />}
          {rowsShown.map((d, k) => {
            const i = s0 + k;
            const cy = top + k * rowH + rowH / 2;
            const f = fitted[k];
            const v = d.value;
            const ok = v !== null && v !== undefined && Number.isFinite(v);
            const xa = sx(0);
            const xb = ok ? sx(v as number) : xa;
            const labelText = valueLabels[i];
            const negative = ok && (v as number) < 0;
            return (
              <g key={d.id} data-bar={d.id} data-cursor={cursor === i ? '1' : undefined} {...interactive(d)}>
                <title>{[pick(d.label, lang), labelText, pick(d.hint, lang)].filter(Boolean).join(': ')}</title>
                <Lines x={x0 - 8} y={cy - ((f.lines.length - 1) * LINE) / 2 + 4} lines={f.lines} anchor="end" fill={d.highlight ? 'var(--color-fg)' : 'var(--color-fg-subtle)'} />
                {ok && <rect x={Math.min(xa, xb)} y={cy - barH / 2} width={Math.max(1, Math.abs(xb - xa))} height={barH} rx={2} fill={colour(d)} />}
                {values && (
                  <text
                    x={ok ? (negative ? Math.max(x0 + textWidth(labelText, PX) + 2, xb - 4) : xb + 4) : xa + 4}
                    y={cy + 4}
                    textAnchor={negative ? 'end' : 'start'}
                    fontSize={PX}
                    fill={ok ? 'var(--color-fg)' : 'var(--color-fg-faint)'}
                    fontStyle={ok ? undefined : 'italic'}
                    style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {labelText}
                  </text>
                )}
              </g>
            );
          })}
          {brush && <rect className="caos-bars-brush" data-bar-brush="" x={0} y={Math.min(brush.a, brush.b)} width={width} height={Math.abs(brush.b - brush.a)} />}
        </svg>
      );
    } else {
      const h = fill && box.height > 0 ? box.height : typeof height === 'number' ? height : 240;
      const titleLines = wrapLines(axisTitle, width - 4, PX);
      const titleRow = titleLines.length * LINE + 6;
      const valueRow = values ? LINE + 4 : 4;
      const probe = widestLabel(formatTicks([lo, hi], lang, fmt), PX);
      const left = probe + 12;
      const right = 8;
      // a drawing narrower than its value column has no room for a bar: the band is 0, never negative (an SVG rect refuses a negative width)
      const band = Math.max(0, (width - left - right) / count);
      const fitted = rowsShown.map((d) => fitLabel(pick(d.label, lang), Math.max(24, band - 6), PX, 2));
      const bottom = Math.max(...fitted.map((f) => f.lines.length)) * LINE + 10;
      const y0 = titleRow + valueRow;
      const y1 = Math.max(y0 + 40, h - bottom);
      const ticks = niceTicks(lo, hi, y1 - y0, LINE, 6, resolution);
      const t0 = ticks[0];
      const t1 = ticks[ticks.length - 1];
      tickLabels = formatTicks(ticks, lang, fmt);
      const sy = (v: number) => y1 - ((v - t0) / (t1 - t0 || 1)) * (y1 - y0);
      const barW = Math.max(0, Math.min(band * 0.62, 56));
      drawnHeight = h;
      geoRef.current = { horizontal: false, start: left, end: width - right };
      drawing = (
        <svg width={width} height={h} role="presentation" data-chart="" data-chart-kind="bars">
          <title>{name}</title>
          <Lines x={0} y={LINE - 2} lines={titleLines} anchor="start" fill="var(--color-fg-subtle)" />
          {ticks.map((t, i) => (
            <g key={`t${i}`}>
              <line x1={left} x2={width - right} y1={sy(t)} y2={sy(t)} stroke="var(--color-border)" strokeWidth={t === 0 ? 1.4 : 1} />
              <text x={left - 6} y={sy(t) + 4} textAnchor="end" fontSize={PX} fill="var(--color-fg-subtle)" style={{ fontFamily: 'var(--font-sans)' }}>
                {tickLabels[i]}
              </text>
            </g>
          ))}
          {cursor !== null && cursor >= s0 && cursor < e0 && <rect className="caos-bars-cursor" data-bar-cursor="" x={left + band * (cursor - s0)} y={y0} width={band} height={h - y0} />}
          {rowsShown.map((d, k) => {
            const i = s0 + k;
            const cx = left + band * k + band / 2;
            const v = d.value;
            const ok = v !== null && v !== undefined && Number.isFinite(v);
            const ya = sy(0);
            const yb = ok ? sy(v as number) : ya;
            const f = fitted[k];
            return (
              <g key={d.id} data-bar={d.id} data-cursor={cursor === i ? '1' : undefined} {...interactive(d)}>
                <title>{[pick(d.label, lang), valueLabels[i], pick(d.hint, lang)].filter(Boolean).join(': ')}</title>
                {ok && <rect x={cx - barW / 2} y={Math.min(ya, yb)} width={barW} height={Math.max(1, Math.abs(yb - ya))} rx={2} fill={colour(d)} />}
                {values && (
                  <text x={cx} y={Math.min(ya, yb) - 5} textAnchor="middle" fontSize={PX} fill={ok ? 'var(--color-fg)' : 'var(--color-fg-faint)'} fontStyle={ok ? undefined : 'italic'} style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>
                    {valueLabels[i]}
                  </text>
                )}
                <Lines x={cx} y={y1 + LINE + 2} lines={f.lines} anchor="middle" fill={d.highlight ? 'var(--color-fg)' : 'var(--color-fg-subtle)'} />
              </g>
            );
          })}
          {brush && <rect className="caos-bars-brush" data-bar-brush="" x={Math.min(brush.a, brush.b)} y={y0} width={Math.abs(brush.b - brush.a)} height={h - y0} />}
        </svg>
      );
    }
  }
  const drawn = width > 0 && n > 0;
  const repeats = repeatedLabels(tickLabels);

  // ---- the data table, the summary and the readout ----
  const a11y = useMemo(() => {
    if (!drawn) return null;
    const head = [lang === 'es' ? 'Categoría' : 'Category', unit ? `${pick(axis.label, lang)} (${unit})` : pick(axis.label, lang), lang === 'es' ? 'Nota' : 'Note'];
    const rows = data.map((d, i) => [pick(d.label, lang), valueLabels[i], pick(d.hint, lang)]);
    let low = -1;
    let high = -1;
    data.forEach((d, i) => {
      if (d.value === null || d.value === undefined || !Number.isFinite(d.value)) return;
      if (low < 0 || d.value < (data[low].value as number)) low = i;
      if (high < 0 || d.value > (data[high].value as number)) high = i;
    });
    const withUnit = (i: number) => `${valueLabels[i]}${unit ? `${NBSP}${unit}` : ''}`;
    const summary = chartSummary(lang, {
      kind: 'bars',
      name,
      count: n,
      yLabel: axisTitle,
      low: low >= 0 ? { text: withUnit(low), at: pick(data[low].label, lang) } : undefined,
      high: high >= 0 ? { text: withUnit(high), at: pick(data[high].label, lang) } : undefined,
    });
    return { head, rows, summary };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, data, lang, unit, name, axisTitle, axis.label]);
  const rest = lang === 'es' ? REST.es : REST.en;
  const read =
    cursor !== null && cursor < n
      ? [`${pick(data[cursor].label, lang)}: ${valueLabels[cursor]}${data[cursor].value === null || data[cursor].value === undefined || !unit ? '' : `${NBSP}${unit}`}`, pick(data[cursor].hint, lang)].filter(Boolean).join(' · ')
      : rest;

  // ---- the gestures ----
  const along = (e: { clientX: number; clientY: number }): number | null => {
    const g = geoRef.current;
    const svg = innerRef.current?.querySelector('svg');
    if (!g || !svg) return null;
    const r = svg.getBoundingClientRect();
    return g.horizontal ? e.clientY - r.top : e.clientX - r.left;
  };
  const setWindow = (r: [number, number] | null) => {
    if (!r || (r[0] <= 0 && r[1] >= n)) setWin(null);
    else setWin(roundWindow(r, n));
  };
  // zoom `factor` around a position, in fractions of a bar: the bar under it keeps its place on the screen
  // A key press (`discrete`) steps whole bars; the wheel and the pinch make many small steps, which are kept as fractions of a bar
  // until they add up to one, so a slow wheel zooms slowly instead of not at all.
  const fine = useRef<[number, number] | null>(null);
  const zoomAround = (factor: number, anchorBar: number, discrete = false): boolean => {
    const cur = windowRange(n, live.current.win);
    if (discrete) {
      fine.current = null;
      const next = stepWindow(cur, n, anchorBar, factor);
      setWindow(next);
      return next[0] !== cur[0] || next[1] !== cur[1];
    }
    const held = fine.current;
    const base = held && held[0] > cur[0] - 1 && held[1] < cur[1] + 1 && roundWindow(held, n)[0] === cur[0] && roundWindow(held, n)[1] === cur[1] ? held : cur;
    const next = zoomRange(base, [0, n], anchorBar, factor, { minSpan: Math.min(2, n) });
    fine.current = next;
    setWindow(next);
    // the many small steps of a slow wheel count while they add up: the range moved when the fraction of a bar did
    return Math.abs(next[0] - base[0]) > 1e-9 || Math.abs(next[1] - base[1]) > 1e-9;
  };
  const barAt = (pos: number | null): number | null => {
    const g = geoRef.current;
    return pos === null || !g ? null : categoryAt(pos, g.start, g.end, windowRange(n, live.current.win), n);
  };
  const barFloat = (pos: number): number => {
    const g = geoRef.current;
    const [s, e] = windowRange(n, live.current.win);
    return g ? s + ((pos - g.start) / (g.end - g.start || 1)) * (e - s) : s;
  };

  // the wheel is native and not passive: zooming must stop the page from scrolling under it
  const wheelOn = drawn && zoomable;
  useEffect(() => {
    const el = innerRef.current;
    if (!el || !wheelOn) return;
    const onWheel = (e: WheelEvent) => {
      if (!live.current.zoomable) return;
      // as the line chart: the wheel (with Ctrl or Meta too, a trackpad pinch) zooms the chart that holds the focus, and only while that
      // changes the window; otherwise the wheel and the browser's page zoom are the page's
      if (!el.contains(document.activeElement)) return;
      const pos = along(e);
      if (pos === null) return;
      if (zoomAround(wheelFactor(e.deltaY, e.deltaMode), barFloat(pos))) e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // the handler reads the latest state through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheelOn, n]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ kind: 'brush' | 'pan' | 'pinch' | null; id: number; start: number; last: number; moved: boolean; f: [number, number]; dist: number }>({ kind: null, id: -1, start: 0, last: 0, moved: false, f: [0, 0], dist: 0 });
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.focus({ preventScroll: true });
    kbRef.current = false;
    if (!live.current.zoomable) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pos = along(e);
    const g = gesture.current;
    if (e.pointerType === 'mouse') {
      if (e.button !== 0 || pos === null) return;
      Object.assign(g, { kind: e.shiftKey ? 'pan' : 'brush', id: e.pointerId, start: pos, last: pos, moved: false, f: windowRange(n, live.current.win) });
      return;
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      Object.assign(g, { kind: 'pinch', dist: pinchState(a, b).dist });
    } else if (pointers.current.size === 1 && windowZoomed(n, live.current.win) && pos !== null) {
      Object.assign(g, { kind: 'pan', id: e.pointerId, start: pos, last: pos, moved: false, f: windowRange(n, live.current.win) });
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const pos = along(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.kind === 'pinch' && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const now = pinchState(a, b);
      const mid = along({ clientX: now.mx, clientY: now.my });
      if (g.dist > 0 && now.dist > 0 && mid !== null) {
        zoomAround(g.dist / now.dist, barFloat(mid));
        g.dist = now.dist;
      }
      return;
    }
    if (g.kind && g.id === e.pointerId && pos !== null) {
      const gap = geoRef.current ? geoRef.current.end - geoRef.current.start : 1;
      if (!g.moved && Math.abs(pos - g.start) < DRAG_THRESHOLD) return;
      if (!g.moved) {
        g.moved = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* the pointer is gone */
        }
      }
      if (g.kind === 'brush') setBrush({ a: g.start, b: pos });
      else {
        // a drag along the bars moves the window by the bars it passes
        const [s, en] = windowRange(n, live.current.win);
        const bars = ((g.last - pos) / (gap || 1)) * (en - s);
        g.last = pos;
        g.f = panRange(g.f, [0, n], bars / (g.f[1] - g.f[0] || 1));
        setWindow(g.f);
      }
      return;
    }
    // no gesture: the bar under the pointer is the crosshair
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      const bar = barAt(pos);
      kbRef.current = false;
      setCursor(bar);
    }
  };
  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    // a tap on a bar reads it (touch has no hover): the crosshair goes to the bar and its readout follows
    if (e.pointerType === 'touch' && e.type === 'pointerup' && !g.moved && g.kind !== 'pinch') {
      const bar = barAt(along(e));
      if (bar !== null) {
        kbRef.current = false;
        setCursor(bar);
      }
    }
    if (g.kind === 'brush' && g.id === e.pointerId && g.moved) {
      const geo = geoRef.current;
      const pos = along(e);
      if (geo && pos !== null) {
        const w = brushWindow(g.start, pos, geo.start, geo.end, windowRange(n, live.current.win), n);
        if (w) setWindow(w);
      }
    }
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setBrush(null);
    if (g.kind !== 'pinch' || pointers.current.size < 2) gesture.current = { ...g, kind: null, moved: false };
  };
  const onPointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    // a finger that lifts leaves too, and the bar it tapped stays read
    if (e.pointerType !== 'touch' && !kbRef.current) setCursor(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // a key on a bar that takes a choice (`onSelect`) moves the crosshair and zooms as on the chart, but Enter and Space are the bar's own
    const onBar = e.target !== e.currentTarget && e.target instanceof Element && e.target.closest('[data-bar]') !== null;
    if ((e.target !== e.currentTarget && !onBar) || n === 0) return;
    const act = keyAction(e.key, { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey });
    if (!act || (onBar && act === 'activate')) return;
    const [s, en] = windowRange(n, win);
    const stand = cursor;
    switch (act) {
      case 'prev':
      case 'next':
      case 'first':
      case 'last': {
        const from = stand !== null && stand >= s && stand < en ? stand : null;
        let idx: number | null;
        if (from === null && (act === 'next' || act === 'prev') && windowZoomed(n, win)) idx = act === 'next' ? s : en - 1;
        else idx = stepIndex(from, act, n);
        if (idx === null) return;
        kbRef.current = true;
        setCursor(idx);
        // the window follows the crosshair when it steps off its edge
        if (idx < s) setWindow([idx, idx + (en - s)]);
        else if (idx >= en) setWindow([idx + 1 - (en - s), idx + 1]);
        break;
      }
      case 'zoomIn':
      case 'zoomOut':
        if (!zoomable) return;
        zoomAround(act === 'zoomIn' ? KEY_ZOOM : 1 / KEY_ZOOM, stand !== null ? stand + 0.5 : (s + en) / 2, true);
        break;
      case 'panPrev':
      case 'panNext': {
        if (!zoomable || !windowZoomed(n, win)) return;
        const bars = Math.max(1, Math.round((en - s) * KEY_PAN));
        setWindow(panRange([s, en], [0, n], ((act === 'panNext' ? 1 : -1) * bars) / (en - s)));
        break;
      }
      case 'reset':
        if (e.key === 'Escape' && !windowZoomed(n, win)) return;
        setWin(null);
        e.stopPropagation();
        break;
      case 'activate':
        if (stand === null || !onSelect) return;
        select(data[stand].id);
        break;
    }
    e.preventDefault();
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    if (kbRef.current) {
      kbRef.current = false;
      setCursor(null);
    }
  };
  const resetZoom = () => {
    setWin(null);
    innerRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      className={fill ? 'caos-bars-host fill' : 'caos-bars-host'}
      data-chart-host={drawn ? 'bars' : undefined}
      data-points={drawn ? String(n) : undefined}
      data-zoomable={drawn ? (zoomable ? '1' : '0') : undefined}
      data-zoomed={drawn && zoomed ? '1' : undefined}
      data-zoom-off={drawn && zoomIsOff ? zoomWhy : undefined}
      data-window={drawn ? `${s0},${e0}` : undefined}
    >
      <div
        ref={setInner}
        className={fill ? 'caos-bars fill' : 'caos-bars'}
        style={!fill && orientation === 'vertical' ? { height: typeof height === 'number' ? height : 240 } : undefined}
        data-drawn={width > 0 ? '1' : '0'}
        data-width={width}
        data-height={drawnHeight}
        data-ticks-repeat={drawn ? String(repeats) : undefined}
        {...(drawn
          ? {
              tabIndex: 0,
              role: 'group',
              'aria-roledescription': CHART_ROLE[lang],
              'aria-label': name,
              'aria-describedby': summaryId,
              'aria-details': tableId,
              'data-chart-focus': '',
              'data-zoomed': zoomed ? '1' : undefined,
              onKeyDown,
              onBlur,
              onPointerDown,
              onPointerMove,
              onPointerUp: endPointer,
              onPointerCancel: endPointer,
              onPointerLeave,
              onDoubleClick: () => setWin(null),
            }
          : {})}
      >
        {drawing}
      </div>
      {drawn && a11y && <ChartSummary id={summaryId} text={a11y.summary} />}
      {drawn && a11y && <ChartDataTable id={tableId} caption={name} head={a11y.head} rows={a11y.rows} />}
      {drawn && (
        <div className="caos-bars-foot">
          <p className="caos-bars-readout" aria-live="polite" title={read}>
            {read}
          </p>
          {zoomed && zoomable && <ResetZoomButton lang={lang} onReset={resetZoom} />}
        </div>
      )}
    </div>
  );
}
