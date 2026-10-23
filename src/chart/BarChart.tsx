import { type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { type FormatOptions, formatNumber, formatTicks, NBSP, NOT_AVAILABLE } from '../lib/format';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import type { Tone } from '../workbench/Readouts';
import { useStageSize } from '../workbench/Stage';
import { CHART_ROLE, ChartDataTable, ChartSummary, ResetZoomButton } from './ChartA11y';
import {
  allIntegers,
  axisTitleFits,
  bandsOf,
  barExtent,
  brushWindow,
  categoryAt,
  chartSummary,
  clipExtent,
  DRAG_THRESHOLD,
  KEY_PAN,
  GROUP_MARGIN,
  KEY_ZOOM,
  keyAction,
  memberAt,
  memberSlots,
  panRange,
  pinchState,
  roundWindow,
  stepIndex,
  stepWindow,
  unusedLegendTones,
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
  /** The bar the reader is on (the selected variant, the case asked about). A bar with a `tone` keeps it and is outlined (0.19.0). */
  highlight?: boolean;
  /** One line shown as the bar's title. */
  hint?: BiText;
  /** A floating bar (0.19.0): the bar's two ends on the value axis, in any order (a waterfall layer, a bridge step). Without it the bar spans
   * zero to `value`. `value` stays the number the bar states (a layer's size, a step's amount, a total): it is written at the bar, read in the
   * readout and the table, which add the two ends. A span of zero length is drawn as a dot as thick as a bar (a total on a bridge); a span with
   * a missing end draws nothing; a span outside `axis.range` is cut to it. */
  span?: [number | null | undefined, number | null | undefined];
  /** Grouped bars (0.19.0): consecutive data with the same `group.id` share one category band, side by side (vertical) or one under another
   * (horizontal), and the category axis prints the group label once; `label` then names the member (a regime, a year), read with its group
   * ("Retail, Stress: 18"). Data of one group that are not consecutive make a band each. */
  group?: { id: string; label: BiText };
  /** The number format of this bar (0.19.0), over `axis.format`: its value label, its readout, its ends and its table cells (a layer stated to three
   * decimals in a stack of two). The axis keeps `axis.format`. */
  format?: FormatOptions;
}

export interface BarChartProps {
  /** The chart's accessible name. */
  title: BiText;
  data: BarDatum[];
  /** The value axis: its title, unit and number format; `range` fixes the domain (it includes zero, unless a datum has a `span`: then
   * the range is the axis, a bridge's from 100 to 140 for instance). */
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
  /** What each tone means (0.19.0), drawn as a legend under the bars: grouped bars name their members by tone. A tone no bar uses is drawn
   * anyway and warned about in development. */
  legend?: Array<{ tone: Tone; label: BiText }>;
}

declare const process: { env: { NODE_ENV?: string } };

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
export function BarChart({ title, data, axis, orientation = 'horizontal', values = true, height, onSelect, zoomOff, legend }: BarChartProps) {
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
  // a floating bar's ends are on the axis too; with a span the range is the axis as given (a bridge need not start at zero)
  const spanEnds = data.flatMap((d) => {
    const e = barExtent(d.value, d.span);
    return e && e.given ? [e.a, e.b] : [];
  });
  const floating = data.some((d) => d.span !== undefined && d.span !== null);
  const reach = [...finite, ...spanEnds];
  const lo = floating && axis.range ? Math.min(axis.range[0], axis.range[1]) : Math.min(0, axis.range ? axis.range[0] : Math.min(0, ...reach));
  const hi = floating && axis.range ? Math.max(axis.range[0], axis.range[1]) : Math.max(0, axis.range ? axis.range[1] : Math.max(0, ...reach));
  // in a floating chart the range is the whole axis, so a plain bar is cut to it too (re-review of 0.19.0, MJ2: it ran from zero over the labels)
  const extents = data.map((d) => clipExtent(barExtent(d.value, d.span), lo, hi, floating));
  // the largest dot (a zero-length span) of the drawing: the value axis is inset by its radius at both ends, so a total at an end of
  // `axis.range` is drawn whole, its value label too, and never over a category label (re-review of 0.19.0, MJ1)
  const anyDot = extents.some((e) => e !== null && e.dot);
  // A value axis of counts ticks at whole numbers (known shell defect, Contraste b05 to b09: "0, 1, 1, 2, 2"): fixed zero decimals,
  // or whole values with no decimals asked for, on a domain whose ends are whole.
  // The smallest step the axis may tick at is the least difference its labels can show: a whole number for counts, a unit of the last
  // fixed decimal otherwise (a percent shows hundredths of the value), so the labels never repeat and none is a rounded fraction.
  const countAxis = fmt.decimals === undefined && reach.length > 0 && allIntegers(reach) && allIntegers(axis.range ?? []);
  const resolution = fmt.decimals !== undefined ? 10 ** -fmt.decimals / (fmt.percent ? 100 : 1) : countAxis ? 1 : 0;
  const anyHighlight = data.some((d) => d.highlight);
  const colour = (d: BarDatum) => (d.tone ? TONE[d.tone] : !anyHighlight || d.highlight ? 'var(--color-accent)' : 'var(--color-fg-faint)');
  // a highlighted bar that carries a tone keeps it and is outlined, so it stands out from neighbours of the same tone (re-review of 0.19.0, m3)
  const outline = (d: BarDatum) => (d.tone && d.highlight ? { stroke: 'var(--color-fg)', strokeWidth: 2 } : {});
  const fmtOf = (d: BarDatum): FormatOptions => d.format ?? fmt;
  const shown = (d: BarDatum) =>
    d.value === null || d.value === undefined || !Number.isFinite(d.value) ? NOT_AVAILABLE[lang] : formatNumber(d.value, lang, fmtOf(d));
  const width = box.width;

  // ---- Tier A state ----
  const ids = useId();
  const tableId = `${ids}-table`;
  const summaryId = `${ids}-summary`;
  const [win, setWin] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [brush, setBrush] = useState<{ a: number; b: number } | null>(null);
  // the category bands: one per datum, or one per group of consecutive data (0.19.0); the window, the zoom and the pan are over bands
  const bands = useMemo(() => bandsOf(data.map((d) => d.group?.id)), [data]);
  const nb = bands.length;
  const grouped = data.some((d) => d.group !== undefined && d.group !== null);
  const most = Math.max(1, ...bands.map((b) => b.to - b.from));
  const bandOf = (i: number): number => bands.findIndex((b) => i >= b.from && i < b.to);
  const bandLabel = (b: (typeof bands)[number]): string => pick(b.group !== undefined ? data[b.from].group!.label : data[b.from].label, lang);
  const [s0, e0] = windowRange(nb, win);
  const zoomed = windowZoomed(nb, win);
  // zoom is off whenever `zoomOff` is given, whatever its text: an empty reason in a language still turns zoom off and is still reported (the gate fails it)
  const zoomIsOff = zoomOff !== undefined && zoomOff !== null;
  const zoomable = !zoomIsOff && nb >= 3;
  const zoomWhy = zoomIsOff ? pick(zoomOff, lang) : '';
  const kbRef = useRef(false);
  const geoRef = useRef<Geometry | null>(null);
  const live = useRef({ win: win as [number, number] | null, n: nb, zoomable, cursor: cursor as number | null });
  live.current = { win, n: nb, zoomable, cursor };
  // the bars the chart is drawn for: a new list of ids starts from the whole of it
  const idKey = data.map((d) => (d.group ? `${d.id}\u0002${d.group.id}` : d.id)).join('\u0001');
  useEffect(() => {
    setWin(null);
    setCursor(null);
    setBrush(null);
  }, [idKey]);

  // a legend that names a tone no bar uses is drawn anyway; in development it is said once for each such legend
  const unusedTones = legend ? unusedLegendTones(data.map((d) => d.tone ?? (anyHighlight && !d.highlight ? 'neutral' : 'accent')), legend) : [];
  const unusedKey = unusedTones.join(',');
  useEffect(() => {
    let dev = false;
    try {
      // written out in full so a bundler can replace it; a page with no `process` has no development mode to warn in
      dev = process.env.NODE_ENV !== 'production';
    } catch {
      dev = false;
    }
    if (dev && unusedKey) console.warn(`BarChart "${name}": the legend names the tone(s) ${unusedKey}, which no bar uses`);
  }, [unusedKey, name]);

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
  // a floating or a grouped bar that takes a choice is a target over its whole slot: the middle of its box is often empty (a bar beside its
  // label, a short bar under its raised value), and a pointer there met the drawing, not the bar (the Contraste adoption, F8-1; G5)
  const hitArea = Boolean(onSelect) && (floating || grouped);

  let drawing: ReactNode = null;
  let drawnHeight = 0;
  let tickLabels: string[] = [];
  const valueLabels = data.map(shown);
  // a floating bar reads its two ends, in the order given ("from 40 to 65"); a bar with a missing end has none to read. In a floating chart a plain
  // bar reads its ends too (zero and its value), as the table writes them (the Contraste adoption, F8-2: G20 found the readout short of the table)
  const endsText = data.map((d) => {
    const e = barExtent(d.value, d.span);
    if (!e || (!e.given && !floating)) return '';
    const [a, b] = [formatNumber(e.a, lang, fmtOf(d)), formatNumber(e.b, lang, fmtOf(d))];
    return lang === 'es' ? `de ${a} a ${b}` : `from ${a} to ${b}`;
  });
  // a member of a group is named on the drawing when its slot has room for a short label: the label, else its first letters (re-review of
  // 0.19.0, m4: the tone alone told the members apart); the legend keeps the tone
  const memberName = (d: BarDatum, room: number): string => {
    if (!d.group) return '';
    const full = pick(d.label, lang);
    for (let k = full.length; k >= 1; k--) {
      const t = full.slice(0, k).trimEnd();
      if (t && textWidth(t, PX) <= room) return t;
    }
    return '';
  };
  // a member of a group is read with its group ("Retail, Stress")
  const fullName = (d: BarDatum): string => (d.group ? `${pick(d.group.label, lang)}, ${pick(d.label, lang)}` : pick(d.label, lang));
  if (width > 0 && n > 0) {
    const count = e0 - s0;
    const valueCol = values ? widestLabel(valueLabels, PX) + 8 : 0;
    const vis = bands.slice(s0, e0);
    // the members of the bands in view, in order, with the band each stands in and its place in it
    const items = vis.flatMap((b, kb) => Array.from({ length: b.to - b.from }, (_, j) => ({ b, kb, j, i: b.from + j, c: b.to - b.from })));
    const slots = (c: number) => memberSlots(c, most);
    if (orientation === 'horizontal') {
      const bandTexts = bands.map(bandLabel);
      const labelCol = Math.min(widestLabel(bandTexts, PX), Math.max(80, 0.38 * width));
      const fittedAll = bandTexts.map((t) => fitLabel(t, labelCol, PX, 2));
      const fitted = fittedAll.slice(s0, e0);
      // a group needs a slot of 18 px for each of its members
      const need = Math.max(22, Math.max(...fittedAll.map((f) => f.lines.length)) * LINE + 8, grouped ? (most * 18) / (1 - 2 * GROUP_MARGIN) : 0);
      // grouped members are named in a column of their own between the group labels and the plot, as wide as the widest name needs (at most a
      // fifth of the drawing): the whole label when it fits, else its first letters
      const memberRoom = grouped ? Math.min(widestLabel(data.map((d) => (d.group ? pick(d.label, lang) : '')), PX), Math.max(24, 0.2 * width)) : 0;
      const memberCol = memberRoom > 0 ? memberRoom + 8 : 0;
      const p0 = labelCol + 10 + memberCol;
      const p1 = Math.max(p0 + 40, width - valueCol - 6);
      // the axis title stays on one line under the plot while it fits there, and wraps over the drawing's width when it does not
      const cx = p0 + (p1 - p0) / 2;
      const titleFits = axisTitleFits(axisTitle, 2 * Math.min(cx, width - cx) - 8, PX);
      const titleLines = titleFits ? [axisTitle] : wrapLines(axisTitle, width - 8, PX);
      const axisH = 6 + LINE + 4 + titleLines.length * LINE + 4;
      // filling its card, the rows share the height (a capped row height left three bars on a quarter of the card,
      // under the gate's stage-fill floor); a bar keeps a readable thickness and its label stays centred on it. A zoomed
      // chart keeps the height of the whole one, so the page does not move: fewer rows take the same room.
      const rowFull = fill && box.height > 0 ? Math.max(need, (box.height - axisH - 4) / nb) : need;
      const rowH = (nb * rowFull) / count;
      // a group shares its band out in slots, one for each member of the largest group; a plain chart has a bar to a band
      const barH = grouped ? Math.min(rowH * slots(most).size * 0.8, 40) : Math.min(rowH * 0.5, 40);
      // a dot is as thick as a bar: the value axis is inset by its radius at both ends (MJ1)
      const inset = anyDot ? barH / 2 : 0;
      const x0 = p0 + inset;
      const x1 = Math.max(x0 + 40, p1 - inset);
      const tickProbe = widestLabel(formatTicks([lo, hi], lang, fmt), PX);
      const ticks = niceTicks(lo, hi, x1 - x0, tickProbe, 6, resolution);
      const t0 = ticks[0];
      const t1 = ticks[ticks.length - 1];
      tickLabels = formatTicks(ticks, lang, fmt);
      const sx = (v: number) => x0 + ((v - t0) / (t1 - t0 || 1)) * (x1 - x0);
      const top = 4;
      const plotBottom = top + nb * rowFull;
      drawnHeight = fill && box.height > 0 ? Math.max(box.height, plotBottom + axisH) : plotBottom + axisH;
      // the height of one bar's slot: a row, or a member's share of a group's row
      const slotH = grouped ? rowH * slots(1).size : rowH;
      const centre = (it: (typeof items)[number]) => top + it.kb * rowH + (grouped ? rowH * (slots(it.c).start + (it.j + 0.5) * slots(it.c).size) : rowH / 2);
      geoRef.current = { horizontal: true, start: top, end: plotBottom };
      const cb = cursor !== null ? bandOf(cursor) : -1;
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
          {cursor !== null && cb >= s0 && cb < e0 && (grouped ? (
            <rect className="caos-bars-cursor" data-bar-cursor="" x={0} y={top + (cb - s0) * rowH + rowH * (slots(bands[cb].to - bands[cb].from).start + (cursor - bands[cb].from) * slots(1).size)} width={width} height={rowH * slots(1).size} />
          ) : (
            <rect className="caos-bars-cursor" data-bar-cursor="" x={0} y={top + (cursor - s0) * rowH} width={width} height={rowH} />
          ))}
          {vis.map((b, kb) =>
            b.group !== undefined ? (
              <g key={`grp${s0 + kb}`} data-group={b.group}>
                <title>{bandTexts[s0 + kb]}</title>
                <Lines x={labelCol + 2} y={top + kb * rowH + rowH / 2 - ((fitted[kb].lines.length - 1) * LINE) / 2 + 4} lines={fitted[kb].lines} anchor="end" fill="var(--color-fg)" />
              </g>
            ) : null,
          )}
          {items.map((it) => {
            const { i, kb } = it;
            const d = data[i];
            const cy = centre(it);
            const f = fitted[kb];
            const v = d.value;
            const ok = v !== null && v !== undefined && Number.isFinite(v);
            const ex = extents[i];
            const xa = ex ? sx(ex.a) : sx(0);
            const xb = ex ? sx(ex.b) : xa;
            const labelText = valueLabels[i];
            const negative = ok && !ex?.given && (v as number) < 0;
            // a floating bar's value is written past its far end, whichever way the bar runs
            const far = Math.max(xa, xb);
            const member = memberName(d, memberRoom);
            return (
              <g key={d.id} data-bar={d.id} data-cursor={cursor === i ? '1' : undefined} {...interactive(d)}>
                <title>{[fullName(d), labelText, pick(d.hint, lang), endsText[i]].filter(Boolean).join(': ')}</title>
                {!d.group && <Lines x={labelCol + 2} y={cy - ((f.lines.length - 1) * LINE) / 2 + 4} lines={f.lines} anchor="end" fill={d.highlight ? 'var(--color-fg)' : 'var(--color-fg-subtle)'} />}
                {ex && ex.dot && <circle cx={xa} cy={cy} r={barH / 2} fill={colour(d)} {...outline(d)} />}
                {ex && !ex.dot && <rect x={Math.min(xa, xb)} y={cy - barH / 2} width={Math.max(1, Math.abs(xb - xa))} height={barH} rx={2} fill={colour(d)} {...outline(d)} />}
                {values && (
                  <text
                    x={ok ? (negative ? Math.max(x0 + textWidth(labelText, PX) + 2, xb - 4) : (ex?.given ? far : xb) + 4 + (ex?.dot ? barH / 2 : 0)) : xa + 4}
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
                {member && (
                  <text data-member="" x={p0 - 8} y={cy + 4} textAnchor="end" fontSize={PX} fill="var(--color-fg-subtle)" style={{ fontFamily: 'var(--font-sans)' }}>
                    {member}
                  </text>
                )}
                {hitArea && <rect data-bar-hit="" x={0} y={cy - slotH / 2} width={width} height={slotH} fill="transparent" />}
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
      const fitted = vis.map((b) => fitLabel(bandLabel(b), Math.max(24, band - 6), PX, 2));
      // a group shares its band out in slots, one for each member of the largest group; a plain chart has a bar to a band
      const slotW = band * slots(most).size;
      const barW = grouped ? Math.max(0, Math.min(slotW * 0.84, 56)) : Math.max(0, Math.min(band * 0.62, 56));
      // grouped members are named on a row under their bars, above the group labels, when a slot has room for at least a letter (m4)
      const memberRow = grouped && data.some((d) => memberName(d, slotW - 2) !== '') ? LINE + 3 : 0;
      const bottom = Math.max(...fitted.map((f) => f.lines.length)) * LINE + 10 + memberRow;
      // a dot is as thick as a bar: the value axis is inset by its radius at both ends (MJ1), and the labels under it keep their place
      const inset = anyDot ? barW / 2 : 0;
      const y0 = titleRow + valueRow + inset;
      const y1 = Math.max(y0 + 40, h - bottom - inset);
      const yl = y1 + inset;
      const ticks = niceTicks(lo, hi, y1 - y0, LINE, 6, resolution);
      const t0 = ticks[0];
      const t1 = ticks[ticks.length - 1];
      tickLabels = formatTicks(ticks, lang, fmt);
      const sy = (v: number) => y1 - ((v - t0) / (t1 - t0 || 1)) * (y1 - y0);
      // value labels wider than a slot are set on two rows, alternately, so neighbours do not run into each other
      const crowded = grouped && values && widestLabel(valueLabels, PX) > slotW - 2;
      const centre = (it: (typeof items)[number]) => left + band * it.kb + (grouped ? band * (slots(it.c).start + (it.j + 0.5) * slots(it.c).size) : band / 2);
      drawnHeight = h;
      geoRef.current = { horizontal: false, start: left, end: width - right };
      const cb = cursor !== null ? bandOf(cursor) : -1;
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
          {cursor !== null && cb >= s0 && cb < e0 && (grouped ? (
            <rect className="caos-bars-cursor" data-bar-cursor="" x={left + band * (cb - s0) + band * (slots(bands[cb].to - bands[cb].from).start + (cursor - bands[cb].from) * slots(1).size)} y={y0} width={band * slots(1).size} height={h - y0} />
          ) : (
            <rect className="caos-bars-cursor" data-bar-cursor="" x={left + band * (cursor - s0)} y={y0} width={band} height={h - y0} />
          ))}
          {vis.map((b, kb) =>
            b.group !== undefined ? (
              <g key={`grp${s0 + kb}`} data-group={b.group}>
                <title>{bandLabel(b)}</title>
                <Lines x={left + band * kb + band / 2} y={yl + LINE + 2 + memberRow} lines={fitted[kb].lines} anchor="middle" fill="var(--color-fg)" />
              </g>
            ) : null,
          )}
          {items.map((it) => {
            const { i, kb } = it;
            const d = data[i];
            const cx = centre(it);
            const v = d.value;
            const ok = v !== null && v !== undefined && Number.isFinite(v);
            const ex = extents[i];
            const ya = ex ? sy(ex.a) : sy(0);
            const yb = ex ? sy(ex.b) : ya;
            const f = fitted[kb];
            const member = memberName(d, slotW - 2);
            return (
              <g key={d.id} data-bar={d.id} data-cursor={cursor === i ? '1' : undefined} {...interactive(d)}>
                <title>{[fullName(d), valueLabels[i], pick(d.hint, lang), endsText[i]].filter(Boolean).join(': ')}</title>
                {ex && ex.dot && <circle cx={cx} cy={ya} r={barW / 2} fill={colour(d)} {...outline(d)} />}
                {ex && !ex.dot && <rect x={cx - barW / 2} y={Math.min(ya, yb)} width={barW} height={Math.max(1, Math.abs(yb - ya))} rx={2} fill={colour(d)} {...outline(d)} />}
                {values && (
                  <text x={cx} y={Math.min(ya, yb) - 5 - (ex?.dot ? barW / 2 : 0) - (crowded && it.j % 2 === 1 ? LINE : 0)} textAnchor="middle" fontSize={PX} fill={ok ? 'var(--color-fg)' : 'var(--color-fg-faint)'} fontStyle={ok ? undefined : 'italic'} style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>
                    {valueLabels[i]}
                  </text>
                )}
                {!d.group && <Lines x={cx} y={yl + LINE + 2} lines={f.lines} anchor="middle" fill={d.highlight ? 'var(--color-fg)' : 'var(--color-fg-subtle)'} />}
                {member && (
                  <text data-member="" x={cx} y={yl + LINE + 2} textAnchor="middle" fontSize={PX} fill="var(--color-fg-subtle)" style={{ fontFamily: 'var(--font-sans)' }}>
                    {member}
                  </text>
                )}
                {hitArea && <rect data-bar-hit="" x={cx - (grouped ? slotW : band) / 2} y={0} width={grouped ? slotW : band} height={h} fill="transparent" />}
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
    // a chart with a floating bar adds the two ends of every bar to the table
    const head = [
      ...(grouped ? [lang === 'es' ? 'Grupo' : 'Group'] : []),
      lang === 'es' ? 'Categoría' : 'Category',
      unit ? `${pick(axis.label, lang)} (${unit})` : pick(axis.label, lang),
      ...(floating ? (lang === 'es' ? ['Desde', 'Hasta'] : ['From', 'To']) : []),
      lang === 'es' ? 'Nota' : 'Note',
    ];
    const rows = data.map((d, i) => {
      const e = barExtent(d.value, d.span);
      const end = (v: number | undefined) => (e && v !== undefined ? formatNumber(v, lang, fmtOf(d)) : '');
      return [...(grouped ? [d.group ? pick(d.group.label, lang) : ''] : []), pick(d.label, lang), valueLabels[i], ...(floating ? [end(e?.a), end(e?.b)] : []), pick(d.hint, lang)];
    });
    let low = -1;
    let high = -1;
    data.forEach((d, i) => {
      if (d.value === null || d.value === undefined || !Number.isFinite(d.value)) return;
      if (low < 0 || d.value < (data[low].value as number)) low = i;
      if (high < 0 || d.value > (data[high].value as number)) high = i;
    });
    const withUnit = (i: number) => `${valueLabels[i]}${unit ? `${NBSP}${unit}` : ''}`;
    // a floating chart states its first and its last ends (a bridge's opening and closing totals, a waterfall's start and its total), not its
    // lowest and highest value, which compare a step with a total (re-review of 0.19.0, m5)
    const drawnExtents = data.map((d) => barExtent(d.value, d.span));
    const firstAt = drawnExtents.findIndex((e) => e !== null);
    const lastAt = drawnExtents.length - 1 - [...drawnExtents].reverse().findIndex((e) => e !== null);
    const endOf = (i: number, v: number) => ({ text: `${formatNumber(v, lang, fmtOf(data[i]))}${unit ? `${NBSP}${unit}` : ''}`, at: fullName(data[i]) });
    const ends = floating && firstAt >= 0 ? { first: endOf(firstAt, drawnExtents[firstAt]!.a), last: endOf(lastAt, drawnExtents[lastAt]!.b) } : {};
    const summary = chartSummary(lang, {
      ...ends,
      kind: 'bars',
      name,
      count: n,
      yLabel: axisTitle,
      low: low >= 0 ? { text: withUnit(low), at: fullName(data[low]) } : undefined,
      high: high >= 0 ? { text: withUnit(high), at: fullName(data[high]) } : undefined,
    });
    return { head, rows, summary };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, data, lang, unit, name, axisTitle, axis.label, floating, grouped]);
  const rest = lang === 'es' ? REST.es : REST.en;
  const read =
    cursor !== null && cursor < n
      ? [`${fullName(data[cursor])}: ${valueLabels[cursor]}${data[cursor].value === null || data[cursor].value === undefined || !unit ? '' : `${NBSP}${unit}`}`, pick(data[cursor].hint, lang), endsText[cursor]].filter(Boolean).join(' · ')
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
    if (!r || (r[0] <= 0 && r[1] >= nb)) setWin(null);
    else setWin(roundWindow(r, nb));
  };
  // zoom `factor` around a position, in fractions of a bar: the bar under it keeps its place on the screen
  // A key press (`discrete`) steps whole bars; the wheel and the pinch make many small steps, which are kept as fractions of a bar
  // until they add up to one, so a slow wheel zooms slowly instead of not at all.
  const fine = useRef<[number, number] | null>(null);
  const zoomAround = (factor: number, anchorBar: number, discrete = false): boolean => {
    const cur = windowRange(nb, live.current.win);
    if (discrete) {
      fine.current = null;
      const next = stepWindow(cur, nb, anchorBar, factor);
      setWindow(next);
      return next[0] !== cur[0] || next[1] !== cur[1];
    }
    const held = fine.current;
    const base = held && held[0] > cur[0] - 1 && held[1] < cur[1] + 1 && roundWindow(held, nb)[0] === cur[0] && roundWindow(held, nb)[1] === cur[1] ? held : cur;
    const next = zoomRange(base, [0, nb], anchorBar, factor, { minSpan: Math.min(2, nb) });
    fine.current = next;
    setWindow(next);
    // the many small steps of a slow wheel count while they add up: the range moved when the fraction of a bar did
    return Math.abs(next[0] - base[0]) > 1e-9 || Math.abs(next[1] - base[1]) > 1e-9;
  };
  // the datum under a position along the category axis: its band, then the member of a group the position lies on
  const barAt = (pos: number | null): number | null => {
    const g = geoRef.current;
    if (pos === null || !g) return null;
    const win2 = windowRange(nb, live.current.win);
    const bi = categoryAt(pos, g.start, g.end, win2, nb);
    if (bi === null) return null;
    const b = bands[bi];
    if (b.to - b.from === 1) return b.from;
    const scaled = ((pos - g.start) / (g.end - g.start || 1)) * (win2[1] - win2[0]);
    return b.from + memberAt(scaled - Math.floor(scaled), b.to - b.from, most);
  };
  const barFloat = (pos: number): number => {
    const g = geoRef.current;
    const [s, e] = windowRange(nb, live.current.win);
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
  }, [wheelOn, nb]);

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
      Object.assign(g, { kind: e.shiftKey ? 'pan' : 'brush', id: e.pointerId, start: pos, last: pos, moved: false, f: windowRange(nb, live.current.win) });
      return;
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      Object.assign(g, { kind: 'pinch', dist: pinchState(a, b).dist });
    } else if (pointers.current.size === 1 && windowZoomed(nb, live.current.win) && pos !== null) {
      Object.assign(g, { kind: 'pan', id: e.pointerId, start: pos, last: pos, moved: false, f: windowRange(nb, live.current.win) });
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
        const [s, en] = windowRange(nb, live.current.win);
        const bars = ((g.last - pos) / (gap || 1)) * (en - s);
        g.last = pos;
        g.f = panRange(g.f, [0, nb], bars / (g.f[1] - g.f[0] || 1));
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
        const w = brushWindow(g.start, pos, geo.start, geo.end, windowRange(nb, live.current.win), nb);
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
    if ((e.target !== e.currentTarget && !onBar) || nb === 0) return;
    const act = keyAction(e.key, { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey });
    if (!act || (onBar && act === 'activate')) return;
    const [s, en] = windowRange(nb, win);
    const stand = cursor;
    switch (act) {
      case 'prev':
      case 'next':
      case 'first':
      case 'last': {
        const standBand = stand !== null ? bandOf(stand) : -1;
        const from = stand !== null && standBand >= s && standBand < en ? stand : null;
        let idx: number | null;
        if (from === null && (act === 'next' || act === 'prev') && windowZoomed(nb, win)) idx = act === 'next' ? bands[s].from : bands[en - 1].to - 1;
        else idx = stepIndex(from, act, n);
        if (idx === null) return;
        kbRef.current = true;
        setCursor(idx);
        // the window follows the crosshair when it steps off its edge
        const into = bandOf(idx);
        if (into < s) setWindow([into, into + (en - s)]);
        else if (into >= en) setWindow([into + 1 - (en - s), into + 1]);
        break;
      }
      case 'zoomIn':
      case 'zoomOut':
        if (!zoomable) return;
        zoomAround(act === 'zoomIn' ? KEY_ZOOM : 1 / KEY_ZOOM, stand !== null ? bandOf(stand) + 0.5 : (s + en) / 2, true);
        break;
      case 'panPrev':
      case 'panNext': {
        if (!zoomable || !windowZoomed(nb, win)) return;
        const bars = Math.max(1, Math.round((en - s) * KEY_PAN));
        setWindow(panRange([s, en], [0, nb], ((act === 'panNext' ? 1 : -1) * bars) / (en - s)));
        break;
      }
      case 'reset':
        if (e.key === 'Escape' && !windowZoomed(nb, win)) return;
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
      data-groups={drawn && grouped ? String(nb) : undefined}
      data-legend={drawn && legend && legend.length > 0 ? String(legend.length) : undefined}
      data-spans={drawn && floating ? String(data.filter((d) => d.span !== undefined && d.span !== null).length) : undefined}
      data-zoomable={drawn ? (zoomable ? '1' : '0') : undefined}
      data-zoomed={drawn && zoomed ? '1' : undefined}
      data-zoom-off={drawn && zoomIsOff ? zoomWhy : undefined}
      data-window={drawn ? `${s0},${e0}` : undefined}
      data-orientation={drawn ? orientation : undefined}
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
      {drawn && legend && legend.length > 0 && (
        <ul className="caos-bars-legend" aria-label={lang === 'es' ? 'Leyenda' : 'Legend'}>
          {legend.map((l, k) => (
            <li key={k} className="caos-bars-key" data-tone={l.tone}>
              <span className="caos-bars-swatch" style={{ '--swatch': TONE[l.tone] } as CSSProperties} aria-hidden="true" />
              {pick(l.label, lang)}
            </li>
          ))}
        </ul>
      )}
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
