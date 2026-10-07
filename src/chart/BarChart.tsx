import type { KeyboardEvent, ReactNode } from 'react';
import { type FormatOptions, formatNumber, formatTicks, NOT_AVAILABLE } from '../lib/format';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import type { Tone } from '../workbench/Readouts';
import { useStageSize } from '../workbench/Stage';
import { fitLabel, niceTicks, textWidth, widestLabel } from './text';

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

/**
 * The house categorical chart (CAOS_MANAGE audit 2026-10-07: every product hand-drew its bar charts with fixed margins,
 * the product template included). Margins are measured from the labels in the page's font; a category label is broken
 * over two lines at a word and only then shortened, with the whole label as its title; ticks are round and share one
 * notation; values are written in the interface language. It renders once its box has a width and declares
 * `data-chart`, which the gate's text check (G10) measures.
 */
export function BarChart({ title, data, axis, orientation = 'horizontal', values = true, height, onSelect }: BarChartProps) {
  const lang = useShellLang();
  const [ref, box] = useStageSize();
  const fill = height === 'fill';
  const name = pick(title, lang);
  const axisTitle = axis.unit ? `${pick(axis.label, lang)} (${pick(axis.unit, lang)})` : pick(axis.label, lang);
  const fmt = axis.format ?? { digits: 3 };
  const finite = data.map((d) => d.value).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  const lo = Math.min(0, axis.range ? axis.range[0] : Math.min(0, ...finite));
  const hi = Math.max(0, axis.range ? axis.range[1] : Math.max(0, ...finite));
  const anyHighlight = data.some((d) => d.highlight);
  const colour = (d: BarDatum) => (d.tone ? TONE[d.tone] : !anyHighlight || d.highlight ? 'var(--color-accent)' : 'var(--color-fg-faint)');
  const shown = (d: BarDatum) =>
    d.value === null || d.value === undefined || !Number.isFinite(d.value) ? NOT_AVAILABLE[lang] : formatNumber(d.value, lang, fmt);
  const width = box.width;

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
  if (width > 0 && data.length > 0) {
    const valueLabels = data.map(shown);
    const valueCol = values ? widestLabel(valueLabels, PX) + 8 : 0;
    if (orientation === 'horizontal') {
      const labelCol = Math.min(widestLabel(data.map((d) => pick(d.label, lang)), PX), Math.max(80, 0.38 * width));
      const fitted = data.map((d) => fitLabel(pick(d.label, lang), labelCol, PX, 2));
      const need = Math.max(22, Math.max(...fitted.map((f) => f.lines.length)) * LINE + 8);
      const axisH = 6 + LINE + 4 + LINE + 4;
      const x0 = labelCol + 10;
      const x1 = Math.max(x0 + 40, width - valueCol - 6);
      const tickProbe = widestLabel(formatTicks([lo, hi], lang, fmt), PX);
      const ticks = niceTicks(lo, hi, x1 - x0, tickProbe);
      const t0 = ticks[0];
      const t1 = ticks[ticks.length - 1];
      const tickLabels = formatTicks(ticks, lang, fmt);
      const sx = (v: number) => x0 + ((v - t0) / (t1 - t0 || 1)) * (x1 - x0);
      // filling its card, the rows share the height (a capped row height left three bars on a quarter of the card,
      // under the gate's stage-fill floor); a bar keeps a readable thickness and its label stays centred on it
      const rowH = fill && box.height > 0 ? Math.max(need, (box.height - axisH - 4) / data.length) : need;
      const top = 4;
      const plotBottom = top + data.length * rowH;
      drawnHeight = fill && box.height > 0 ? Math.max(box.height, plotBottom + axisH) : plotBottom + axisH;
      const barH = Math.min(rowH * 0.5, 40);
      drawing = (
        <svg width={width} height={drawnHeight} role="img" aria-label={name} data-chart="" data-chart-kind="bars">
          <title>{name}</title>
          {ticks.map((t, i) => (
            <g key={`t${i}`}>
              <line x1={sx(t)} x2={sx(t)} y1={top} y2={plotBottom} stroke="var(--color-border)" strokeWidth={t === 0 ? 1.4 : 1} />
              <text x={sx(t)} y={plotBottom + 6 + LINE - 2} textAnchor={i === 0 && sx(t) - textWidth(tickLabels[i], PX) / 2 < 0 ? 'start' : i === ticks.length - 1 && sx(t) + textWidth(tickLabels[i], PX) / 2 > width ? 'end' : 'middle'} fontSize={PX} fill="var(--color-fg-subtle)" style={{ fontFamily: 'var(--font-sans)' }}>
                {tickLabels[i]}
              </text>
            </g>
          ))}
          <text x={x0 + (x1 - x0) / 2} y={plotBottom + 6 + LINE + 4 + LINE - 2} textAnchor="middle" fontSize={PX} fill="var(--color-fg-subtle)" style={{ fontFamily: 'var(--font-sans)' }}>
            {axisTitle}
          </text>
          {data.map((d, i) => {
            const cy = top + i * rowH + rowH / 2;
            const f = fitted[i];
            const v = d.value;
            const ok = v !== null && v !== undefined && Number.isFinite(v);
            const xa = sx(0);
            const xb = ok ? sx(v as number) : xa;
            const labelText = valueLabels[i];
            const negative = ok && (v as number) < 0;
            return (
              <g key={d.id} data-bar={d.id} {...interactive(d)}>
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
        </svg>
      );
    } else {
      const h = fill && box.height > 0 ? box.height : typeof height === 'number' ? height : 240;
      const titleRow = LINE + 6;
      const valueRow = values ? LINE + 4 : 4;
      const probe = widestLabel(formatTicks([lo, hi], lang, fmt), PX);
      const left = probe + 12;
      const right = 8;
      const band = (width - left - right) / data.length;
      const fitted = data.map((d) => fitLabel(pick(d.label, lang), Math.max(24, band - 6), PX, 2));
      const bottom = Math.max(...fitted.map((f) => f.lines.length)) * LINE + 10;
      const y0 = titleRow + valueRow;
      const y1 = Math.max(y0 + 40, h - bottom);
      const ticks = niceTicks(lo, hi, y1 - y0, LINE);
      const t0 = ticks[0];
      const t1 = ticks[ticks.length - 1];
      const tickLabels = formatTicks(ticks, lang, fmt);
      const sy = (v: number) => y1 - ((v - t0) / (t1 - t0 || 1)) * (y1 - y0);
      const barW = Math.min(band * 0.62, 56);
      drawnHeight = h;
      drawing = (
        <svg width={width} height={h} role="img" aria-label={name} data-chart="" data-chart-kind="bars">
          <title>{name}</title>
          <text x={0} y={LINE - 2} textAnchor="start" fontSize={PX} fill="var(--color-fg-subtle)" style={{ fontFamily: 'var(--font-sans)' }}>
            {axisTitle}
          </text>
          {ticks.map((t, i) => (
            <g key={`t${i}`}>
              <line x1={left} x2={width - right} y1={sy(t)} y2={sy(t)} stroke="var(--color-border)" strokeWidth={t === 0 ? 1.4 : 1} />
              <text x={left - 6} y={sy(t) + 4} textAnchor="end" fontSize={PX} fill="var(--color-fg-subtle)" style={{ fontFamily: 'var(--font-sans)' }}>
                {tickLabels[i]}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = left + band * i + band / 2;
            const v = d.value;
            const ok = v !== null && v !== undefined && Number.isFinite(v);
            const ya = sy(0);
            const yb = ok ? sy(v as number) : ya;
            const f = fitted[i];
            return (
              <g key={d.id} data-bar={d.id} {...interactive(d)}>
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
        </svg>
      );
    }
  }

  return (
    <div
      ref={ref}
      className={fill ? 'caos-bars fill' : 'caos-bars'}
      style={!fill && orientation === 'vertical' ? { height: typeof height === 'number' ? height : 240 } : undefined}
      data-drawn={width > 0 ? '1' : '0'}
      data-width={width}
      data-height={drawnHeight}
    >
      {drawing}
    </div>
  );
}
