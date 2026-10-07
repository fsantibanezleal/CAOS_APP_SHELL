import { useId, useRef } from 'react';
import { type FormatOptions, formatNumber, NBSP } from '../lib/format';
import { useShellLang } from '../lib/lang';
import { useOverflowFade } from '../lib/overflow';
import { type BiText, pick } from '../lib/text';

export interface KnobProps {
  /** Stable id, written as `data-control` so the gate can enumerate and move every control. */
  id: string;
  label: BiText;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: BiText;
  /** What the parameter is (ADR-0017 s3.8). */
  hint?: BiText;
  format?: FormatOptions;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/**
 * A continuous parameter of the case (ADR-0017 s3.2): a labelled slider with its value and unit shown. Registered as
 * a control (`data-control`), so the gate can change it and require that some view's state key changes (failure
 * class 8: controls that change nothing).
 */
export function Knob({ id, label, value, min, max, step, unit, hint, format, disabled, onChange }: KnobProps) {
  const lang = useShellLang();
  const inputId = useId();
  return (
    <div className="caos-knob" data-control={id} title={pick(hint, lang) || undefined}>
      <label htmlFor={inputId} className="caos-knob-head">
        <span>{pick(label, lang)}</span>
        <span className="caos-knob-value">
          {formatNumber(value, lang, format ?? {})}
          {unit ? `${NBSP}${pick(unit, lang)}` : ''}
        </span>
      </label>
      <input
        id={inputId}
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export interface ChipOption {
  id: string;
  label: BiText;
  hint?: BiText;
  disabled?: boolean;
}

export interface ChipGroupProps {
  id: string;
  label: BiText;
  options: ChipOption[];
  value: string;
  onChange: (id: string) => void;
}

/** A small one-of-N choice as chips on one row, registered as a control. For a categorised or long list use the
 * `CaseSelector` select mode instead (ADR-0071 rule 7). */
export function ChipGroup({ id, label, options, value, onChange }: ChipGroupProps) {
  const lang = useShellLang();
  const rowRef = useRef<HTMLDivElement | null>(null);
  useOverflowFade(rowRef, '.chip.on', [value, options.length, lang]);
  return (
    <div className="caos-chipgroup" data-control={id}>
      <span className="caos-chipgroup-label">{pick(label, lang)}</span>
      <div className="caos-chip-row" role="radiogroup" aria-label={pick(label, lang)} ref={rowRef}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === value}
            className={o.id === value ? 'chip on' : 'chip'}
            disabled={o.disabled}
            title={pick(o.hint, lang) || undefined}
            onClick={() => onChange(o.id)}
          >
            {pick(o.label, lang)}
          </button>
        ))}
      </div>
    </div>
  );
}
