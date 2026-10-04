import type { ReactNode } from 'react';
import { type FormatOptions, formatNumber } from '../lib/format';
import { useShellLang } from '../lib/lang';
import { PanelBoundary } from '../lib/PanelBoundary';
import { type BiText, pick } from '../lib/text';
import { type Lane, LaneBadge } from './LaneBadge';
import { isStale, type Provenance, useWorkbenchState } from './state';

export type Tone = 'good' | 'warn' | 'bad' | 'accent' | 'neutral';

export interface ReadoutItem {
  label: BiText;
  /** A number, or `null`/`undefined` when it is not available. NaN is reported and shown as not available. */
  value?: number | null;
  /** A categorical value shown as text instead of a number. */
  text?: BiText;
  /** The unit. Required unless `unitless` is set (failure class 23: readouts without units). */
  unit?: string;
  unitless?: boolean;
  /** What the quantity is, in one line (ADR-0017 s3.8: every variable is self-explanatory). */
  hint?: BiText;
  /** An explicit tone, or a tone derived from `better` and the `good`/`bad` thresholds, never from the sign. */
  tone?: Tone;
  better?: 'higher' | 'lower';
  good?: number;
  bad?: number;
  format?: FormatOptions;
}

function toneOf(it: ReadoutItem): Tone {
  if (it.tone) return it.tone;
  if (!it.better || it.value === null || it.value === undefined || !Number.isFinite(it.value)) return 'neutral';
  const v = it.value;
  const higher = it.better === 'higher';
  if (it.bad !== undefined && (higher ? v <= it.bad : v >= it.bad)) return 'bad';
  if (it.good !== undefined && (higher ? v >= it.good : v <= it.good)) return 'good';
  if (it.good !== undefined || it.bad !== undefined) return 'warn';
  return 'neutral';
}

function checkItem(it: ReadoutItem, where: string): void {
  if (!it.unit && !it.unitless && it.text === undefined) {
    console.error(`[caos-app-shell] readout "${where}" has no unit; give a unit or set unitless`);
  }
  if (typeof it.value === 'number' && Number.isNaN(it.value)) {
    console.error(`[caos-app-shell] readout "${where}" received NaN; pass null when the value is not available`);
  }
}

export interface ReadoutProps {
  items: ReadoutItem[];
  title?: BiText;
  /** Which lane computed these values, and what data they rest on (required, failure class 17). */
  lane: Lane;
  provenance: Provenance;
  /** The workbench state key these values were computed for; differing from the current key shows them as stale. */
  dataKey?: string;
}

/** The live readout: labelled values with units that update with every control (ADR-0017 s3.3). */
export function Readout({ items, title, lane, provenance, dataKey }: ReadoutProps) {
  const lang = useShellLang();
  const ws = useWorkbenchState();
  const stale = isStale(dataKey, ws);
  if (!lane || !provenance) console.error('[caos-app-shell] Readout needs lane and provenance');
  return (
    <div
      className={stale ? 'caos-readout caos-stale' : 'caos-readout'}
      data-readout=""
      data-lane={lane}
      data-provenance={provenance}
      data-state-key={dataKey ?? ''}
      data-stale={stale ? '1' : '0'}
    >
      <div className="caos-readout-head">
        {title && <p className="caos-readout-title">{pick(title, lang)}</p>}
        <LaneBadge lane={lane} provenance={provenance} />
      </div>
      <dl>
        {items.map((it, i) => {
          const label = pick(it.label, lang);
          checkItem(it, label);
          const shown =
            it.text !== undefined ? pick(it.text, lang) : formatNumber(it.value, lang, it.format ?? {});
          return (
            <div key={i} className={`caos-readout-row tone-${toneOf(it)}`} title={pick(it.hint, lang) || undefined}>
              <dt>{label}</dt>
              <dd>
                <span className="caos-readout-value">{shown}</span>
                {it.unit && it.text === undefined && <span className="caos-readout-unit"> {it.unit}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
      {stale && <p className="caos-stale-note">{lang === 'es' ? 'Recalculando para la selección actual' : 'Recomputing for the current selection'}</p>}
    </div>
  );
}

export interface GaugeZone {
  from: number;
  to: number;
  tone: Tone;
  label: BiText;
}

export interface GaugeProps {
  title: BiText;
  value: number | null | undefined;
  min: number;
  max: number;
  zones: GaugeZone[];
  unit?: string;
  unitless?: boolean;
  format?: FormatOptions;
}

/** A value against labelled zones on a linear scale, the needle at the value (ADR-0017 s3.3). */
export function Gauge({ title, value, min, max, zones, unit, unitless, format }: GaugeProps) {
  const lang = useShellLang();
  checkItem({ label: title, value, unit, unitless }, pick(title, lang));
  const span = max - min || 1;
  const finite = value !== null && value !== undefined && Number.isFinite(value);
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / span) * 100))}%`;
  const fmt = (v: number | null | undefined) => formatNumber(v, lang, format ?? {});
  return (
    <div className="caos-gauge" data-gauge="">
      <p className="caos-gauge-title">{pick(title, lang)}</p>
      <div
        className="caos-gauge-track"
        role="meter"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={finite ? (value as number) : undefined}
        aria-label={pick(title, lang)}
      >
        {zones.map((z, i) => (
          <span key={i} className={`caos-gauge-zone tone-${z.tone}`} style={{ left: pos(z.from), width: `calc(${pos(z.to)} - ${pos(z.from)})` }} />
        ))}
        {finite && <span className="caos-gauge-needle" style={{ left: pos(value as number) }} />}
      </div>
      <div className="caos-gauge-scale">
        <span>{fmt(min)}</span>
        <span className="caos-gauge-value">
          {fmt(value)}
          {finite && unit ? ` ${unit}` : ''}
        </span>
        <span>{fmt(max)}</span>
      </div>
      <div className="caos-gauge-legend">
        {zones.map((z, i) => (
          <span key={i}>
            <i className={`dot tone-${z.tone}`} aria-hidden="true" />
            {pick(z.label, lang)}
          </span>
        ))}
      </div>
    </div>
  );
}

export type VerdictProps = { title: BiText; children?: ReactNode } & (
  | { code: string; messages: Record<string, { tone: Tone; text: BiText }> }
  | { tone: Tone; verdict: BiText }
);

/** The verdict panel: the current diagnosis in one line, coloured by its tone. A status code goes through a
 * `messages` map, and an unmapped code is reported (failure class 23: raw status codes on screen). */
export function Verdict(props: VerdictProps) {
  const lang = useShellLang();
  let tone: Tone;
  let text: string;
  if ('code' in props) {
    const m = props.messages[props.code];
    if (!m) console.error(`[caos-app-shell] Verdict code "${props.code}" has no message`);
    tone = m?.tone ?? 'neutral';
    text = m ? pick(m.text, lang) : lang === 'es' ? 'estado desconocido' : 'unknown status';
  } else {
    tone = props.tone;
    text = pick(props.verdict, lang);
  }
  return (
    <div className={`caos-verdict tone-${tone}`} data-verdict={tone}>
      <p className="caos-verdict-title">{pick(props.title, lang)}</p>
      <p className="caos-verdict-text">{text}</p>
      {props.children}
    </div>
  );
}

export interface PlotCardProps {
  title: BiText;
  /** Which lane produced this view and what data it rests on (required, failure class 17). */
  lane: Lane;
  provenance: Provenance;
  /** The workbench state key the data was computed for; a different key shows the view as stale. */
  dataKey?: string;
  actions?: ReactNode;
  note?: BiText;
  children: ReactNode;
}

/** A framed view with a title row, its lane and provenance, the unit every chart or table sits in. Its body is
 * protected by an error boundary, so one failing chart never blanks the page (failure class 20). */
export function PlotCard({ title, lane, provenance, dataKey, actions, note, children }: PlotCardProps) {
  const lang = useShellLang();
  const ws = useWorkbenchState();
  const stale = isStale(dataKey, ws);
  const name = pick(title, lang);
  if (!lane || !provenance) console.error(`[caos-app-shell] PlotCard "${name}" needs lane and provenance`);
  return (
    <figure
      className={stale ? 'caos-plot caos-stale' : 'caos-plot'}
      data-plot={name}
      data-lane={lane}
      data-provenance={provenance}
      data-state-key={dataKey ?? ''}
      data-stale={stale ? '1' : '0'}
    >
      <figcaption className="caos-plot-head">
        <span className="caos-plot-title">{name}</span>
        <span className="caos-plot-actions">
          {actions}
          <LaneBadge lane={lane} provenance={provenance} />
        </span>
      </figcaption>
      <div className="caos-plot-body">
        <PanelBoundary panel={name}>{children}</PanelBoundary>
        {stale && (
          <div className="caos-stale-overlay" role="status">
            {lang === 'es' ? 'Recalculando para la selección actual' : 'Recomputing for the current selection'}
          </div>
        )}
      </div>
      {note && <p className="caos-plot-note">{pick(note, lang)}</p>}
    </figure>
  );
}
