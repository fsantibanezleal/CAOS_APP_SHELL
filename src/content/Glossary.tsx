import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';

export interface GlossaryEntry {
  /** The symbol or term: a plain string (a symbol such as `S(t)`) or both languages. */
  term: BiText;
  definition: BiText;
}

/**
 * The symbol glossary of the governing mathematics (ADR-0017 section 2.1, area `math`): one `<dt>` and `<dd>` per entry,
 * in a `<dl>` that declares `data-glossary`. The gate counts its items and requires at least 10.
 */
export function Glossary({ entries, ariaLabel }: { entries: GlossaryEntry[]; ariaLabel?: BiText }) {
  const lang = useShellLang();
  return (
    <dl className="caos-glossary" data-glossary="" aria-label={ariaLabel === undefined ? undefined : pick(ariaLabel, lang)}>
      {entries.map((e, i) => (
        <div className="caos-glossary-item" data-glossary-item="" key={`${pick(e.term, 'en')}-${i}`}>
          <dt>{pick(e.term, lang)}</dt>
          <dd>{pick(e.definition, lang)}</dd>
        </div>
      ))}
    </dl>
  );
}
