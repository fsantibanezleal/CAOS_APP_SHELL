import type { ReactNode } from 'react';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';

export type Tone = 'good' | 'warn' | 'bad' | 'accent' | 'neutral';

export interface ReadoutItem {
  label: BiText;
  value: string | number;
  unit?: string;
  /** What the quantity is, in one line (ADR-0017 §3.8: every variable is self-explanatory). */
  hint?: BiText;
  tone?: Tone;
}

/** The live readout: labelled values with units that update with every control (ADR-0017 §3.3). */
export function Readout({ items, title }: { items: ReadoutItem[]; title?: BiText }) {
  const lang = useShellLang();
  return (
    <div className="caos-readout" data-readout="">
      {title && <p className="caos-readout-title">{pick(title, lang)}</p>}
      <dl>
        {items.map((it, i) => (
          <div key={i} className={`caos-readout-row tone-${it.tone ?? 'neutral'}`} title={pick(it.hint, lang) || undefined}>
            <dt>{pick(it.label, lang)}</dt>
            <dd>
              <span className="caos-readout-value">{it.value}</span>
              {it.unit && <span className="caos-readout-unit"> {it.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
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
  value: number;
  min: number;
  max: number;
  zones: GaugeZone[];
  unit?: string;
  format?: (v: number) => string;
}

/** A value against labelled zones on a linear scale, the needle at the value (ADR-0017 §3.3). */
export function Gauge({ title, value, min, max, zones, unit, format }: GaugeProps) {
  const lang = useShellLang();
  const span = max - min || 1;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / span) * 100))}%`;
  const fmt = format ?? ((v: number) => v.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US', { maximumFractionDigits: 3 }));
  return (
    <div className="caos-gauge" data-gauge="">
      <p className="caos-gauge-title">{pick(title, lang)}</p>
      <div className="caos-gauge-track" role="meter" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-label={pick(title, lang)}>
        {zones.map((z, i) => (
          <span
            key={i}
            className={`caos-gauge-zone tone-${z.tone}`}
            style={{ left: pos(z.from), width: `calc(${pos(z.to)} - ${pos(z.from)})` }}
          />
        ))}
        <span className="caos-gauge-needle" style={{ left: pos(value) }} />
      </div>
      <div className="caos-gauge-scale">
        <span>{fmt(min)}</span>
        <span className="caos-gauge-value">
          {fmt(value)}
          {unit ? ` ${unit}` : ''}
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

/** The verdict panel: the current diagnosis in one line, coloured by its tone, with its evidence below. */
export function Verdict({ tone, title, verdict, children }: { tone: Tone; title: BiText; verdict: BiText; children?: ReactNode }) {
  const lang = useShellLang();
  return (
    <div className={`caos-verdict tone-${tone}`} data-verdict={tone}>
      <p className="caos-verdict-title">{pick(title, lang)}</p>
      <p className="caos-verdict-text">{pick(verdict, lang)}</p>
      {children}
    </div>
  );
}

/** A framed view with a title row (and optional controls), the unit every chart or table sits in. */
export function PlotCard({ title, actions, note, children }: { title: BiText; actions?: ReactNode; note?: BiText; children: ReactNode }) {
  const lang = useShellLang();
  return (
    <figure className="caos-plot" data-plot="">
      <figcaption className="caos-plot-head">
        <span className="caos-plot-title">{pick(title, lang)}</span>
        {actions && <span className="caos-plot-actions">{actions}</span>}
      </figcaption>
      <div className="caos-plot-body">{children}</div>
      {note && <p className="caos-plot-note">{pick(note, lang)}</p>}
    </figure>
  );
}
