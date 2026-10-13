import { useEffect, useState, type ReactNode } from 'react';
import { useShellLang } from '../lib/lang';
import type { Lang } from '../lib/lang';
import {
  EXECUTIVE_SCHEMA_VERSION,
  EXEC_SECTION_DEFS,
  FOUR_CS,
  PENDING_FOUR_CS,
  SECTION_QUESTIONS,
  SECTION_TITLES,
  figureFields,
  validateExecutive,
  type BiTextValue,
  type ExecutiveData,
  type ExecutiveIllustration,
} from './executive';
import { Question } from './Question';
import { SubTabs } from './SubTabs';

/** The words the view itself writes (the product writes none of them). */
const UI = {
  executive: { en: 'Executive', es: 'Ejecutivo' },
  organisation: { en: 'Organisation', es: 'Organización' },
  whyNow: { en: 'Why now', es: 'Por qué ahora' },
  vision: { en: 'Vision', es: 'Visión' },
  does: { en: 'What it does', es: 'Qué hace' },
  result: { en: 'Business result', es: 'Resultado de negocio' },
  proof: { en: 'Proof', es: 'Prueba' },
  sources: { en: 'Sources', es: 'Fuentes' },
  sections: { en: 'The sections of the executive view', es: 'Las secciones de la vista ejecutiva' },
  source: { en: 'Source', es: 'Fuente' },
  errorTitle: { en: 'The executive view data is not valid', es: 'Los datos de la vista ejecutiva no son válidos' },
  errorLead: {
    en: 'Fix content/executive.json against executive.schema.json; the view shows nothing until it is valid.',
    es: 'Corrija content/executive.json según executive.schema.json; la vista no muestra nada hasta que sea válido.',
  },
  loading: { en: 'Loading the illustration', es: 'Cargando la ilustración' },
  missing: { en: 'The illustration file did not load', es: 'No cargó el archivo de la ilustración' },
} satisfies Record<string, BiTextValue>;

const t = (text: BiTextValue, lang: Lang) => text[lang];

/**
 * Parses an SVG the product ships and makes it safe to insert: no script, no foreign content, no event handler, no
 * script link; the root scales with its column (its width and height are dropped, the viewBox stays). Null when the text is
 * not an SVG document.
 */
export function cleanSvg(text: string): string | null {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg' || doc.querySelector('parsererror')) return null;
  for (const bad of Array.from(doc.querySelectorAll('script, foreignObject'))) bad.remove();
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name) || (/^(xlink:)?href$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value))) el.removeAttribute(attr.name);
    }
  }
  root.removeAttribute('width');
  root.removeAttribute('height');
  if (!root.getAttribute('viewBox')) return null;
  if (!root.getAttribute('role')) root.setAttribute('role', 'img');
  return new XMLSerializer().serializeToString(root);
}

type Loaded = { status: 'loading' } | { status: 'ready'; svg: string } | { status: 'error'; why: string };

function Illustration({ name, spec, base, lang }: { name: string; spec: ExecutiveIllustration; base: string; lang: Lang }) {
  const file = typeof spec.file === 'string' ? spec.file : spec.file[lang];
  const url = /^([a-z]+:)?\/\//i.test(file) || file.startsWith('/') ? file : `${base}${file}`;
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    setLoaded({ status: 'loading' });
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        const svg = cleanSvg(text);
        if (!svg) throw new Error('not an SVG document with a viewBox');
        if (live) setLoaded({ status: 'ready', svg });
      })
      .catch((e: Error) => {
        if (live) setLoaded({ status: 'error', why: e.message });
      });
    return () => {
      live = false;
    };
  }, [url]);
  return (
    <figure
      className="figure caos-exec-fig"
      data-exec-illustration={name}
      data-lang={lang}
      data-exec-file={file}
      data-state={loaded.status === 'ready' ? undefined : loaded.status}
    >
      {loaded.status === 'ready' ? (
        <div className="caos-exec-art" dangerouslySetInnerHTML={{ __html: loaded.svg }} />
      ) : loaded.status === 'error' ? (
        <p className="caos-exec-fig-error" role="alert">
          {t(UI.missing, lang)}: <code>{file}</code> ({loaded.why})
        </p>
      ) : (
        <div className="caos-exec-art caos-exec-art-wait" aria-busy="true" aria-label={t(UI.loading, lang)} />
      )}
      <figcaption className="figure-caption" data-exec-field={`illustrations.${name}.caption`}>
        {t(spec.caption, lang)}
      </figcaption>
    </figure>
  );
}

const Label = ({ children }: { children: ReactNode }) => <span className="caos-exec-label">{children}</span>;

function Section({ n, lang, children }: { n: 1 | 2 | 3 | 4; lang: Lang; children: ReactNode }) {
  return (
    <section className="caos-exec-section" data-exec-section={n} aria-label={t(SECTION_TITLES[n - 1], lang)}>
      <h2>{t(SECTION_TITLES[n - 1], lang)}</h2>
      <p className="caos-exec-question" data-exec-question="">
        {t(SECTION_QUESTIONS[n - 1], lang)}
      </p>
      {children}
    </section>
  );
}

export interface ExecutiveViewProps {
  /** The parsed `content/executive.json` of the product (validated against `executive.schema.json` in the page). */
  data: unknown;
  /** Where the product's site is served from; the illustration files are fetched from here (default `/`; a Pages site passes its base URL). */
  base?: string;
}


/**
 * The executive view of an Introduction (CAOS_MANAGE conventions/problem-context-first.md, Felipe 2026-10-12 and
 * 2026-10-13): the sections of `EXEC_SECTION_DEFS` as the sub-tabs of `SubTabs`, in order, the first
 * selected; the three illustrations in their places; section 3 (the 4 C's, pending while FOUR_CS is empty); the sources as
 * numbered notes that link to the publication, under the sub-tabs, whichever one is open. A product fills
 * `content/executive.json`; it does not design this view, so the component takes no children. Invalid data renders an
 * error state that lists each field path, never a blank.
 */
export function ExecutiveView({ data, base }: ExecutiveViewProps) {
  return <ExecutiveViewBody data={data} base={base} fourCs={FOUR_CS} />;
}

/** The view with the language and the open sub-tab as parameters, so the tests can render each section; the product-facing entry is `ExecutiveView`. */
export function ExecutiveViewBody({ data, base = '/', fourCs, lang: forced, open = 1 }: ExecutiveViewProps & { fourCs: readonly string[]; lang?: Lang; open?: 1 | 2 | 3 | 4 }) {
  const stored = useShellLang();
  const lang = forced ?? stored;
  const problems = validateExecutive(data, { fourCs });
  if (problems.length > 0) {
    return (
      <div
        className="caos-exec caos-exec-error"
        data-executive-view=""
        data-executive-schema={EXECUTIVE_SCHEMA_VERSION}
        data-executive-valid="false"
        data-executive-errors={problems.map((p) => `${p.path || '(file)'}: ${p.message}`).join(' | ')}
        data-state="error"
        role="alert"
      >
        <h2>{t(UI.errorTitle, lang)}</h2>
        <p>{t(UI.errorLead, lang)}</p>
        <ul>
          {problems.map((p, i) => (
            <li key={i}>
              <code>{p.path || '(file)'}</code>: {p.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const d = data as ExecutiveData;
  const figures = figureFields(d);
  const note = (field: string) => figures.indexOf(field) + 1;
  const sourceOf = (field: string) => d.sources.find((s) => s.field === field)!;
  const Cite = ({ field }: { field: string }) => (
    <sup className="caos-exec-cite">
      <a href={`#exec-note-${note(field)}`} aria-label={`${t(UI.source, lang)} ${note(field)}`}>
        {note(field)}
      </a>
    </sup>
  );
  const field = (path: string, text: BiTextValue) => <span data-exec-field={path}>{t(text, lang)}</span>;
  const sectionOne = (
    <Section n={1} lang={lang}>
      <dl className="caos-exec-facts">
        <div>
          <dt>{t(UI.executive, lang)}</dt>
          <dd data-exec-field="executive">{t(d.executive, lang)}</dd>
        </div>
        <div>
          <dt>{t(UI.organisation, lang)}</dt>
          <dd data-exec-field="organisation">{t(d.organisation, lang)}</dd>
        </div>
      </dl>
      <p className="caos-exec-initiative" data-exec-field="initiative">
        {t(d.initiative, lang)}
      </p>
      <Illustration name="initiative" spec={d.illustrations.initiative} base={base} lang={lang} />
      <p className="caos-exec-whynow" data-exec-line="why_now">
        <Label>{t(UI.whyNow, lang)}</Label> <strong className="caos-exec-value" data-exec-field="why_now.figure.value">{t(d.why_now.figure.value, lang)}</strong>{' '}
        {field('why_now.figure.unit', d.why_now.figure.unit)} <span className="caos-exec-sep">&middot;</span> {field('why_now.deadline', d.why_now.deadline)}
        <Cite field="why_now.figure" />
      </p>
      <Illustration name="problem" spec={d.illustrations.problem} base={base} lang={lang} />
    </Section>
  );
  const sectionTwo = (
    <Section n={2} lang={lang}>
      <p className="caos-exec-vision" data-exec-field="vision">
        {t(d.vision, lang)}
      </p>
      <Illustration name="solution" spec={d.illustrations.solution} base={base} lang={lang} />
      <ul className="caos-exec-outcomes">
        {d.outcomes.map((o, i) => (
          <li key={i} className="caos-exec-outcome" data-exec-outcome={i}>
            <div>
              <Label>{t(UI.does, lang)}</Label> {field(`outcomes[${i}].capability`, o.capability)}
            </div>
            <div>
              <Label>{t(UI.result, lang)}</Label> {field(`outcomes[${i}].outcome`, o.outcome)}
            </div>
            <div className="caos-exec-proof">
              <Label>{t(UI.proof, lang)}</Label> <strong className="caos-exec-value" data-exec-field={`outcomes[${i}].proof.value`}>{t(o.proof.value, lang)}</strong>{' '}
              {field(`outcomes[${i}].proof.unit`, o.proof.unit)}. {field(`outcomes[${i}].proof.statement`, o.proof.statement)}
              <Cite field={`outcomes[${i}].proof`} />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
  const sectionThree = (
    <Section n={3} lang={lang}>
      {fourCs.length === 0 ? (
        <p className="caos-exec-pending" data-state="unavailable" data-exec-pending="">
          {t(PENDING_FOUR_CS, lang)}
        </p>
      ) : (
        <ul className="caos-exec-cs">
          {d.four_cs!.map((r, i) => (
            <li key={i} data-exec-c={i}>
              <strong data-exec-field={`four_cs[${i}].c`}>{t(r.c, lang)}</strong> {field(`four_cs[${i}].exec_problem`, r.exec_problem)}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
  const sectionFour = (
    <Section n={4} lang={lang}>
      {d.dialogue.map((q, i) => (
        <Question key={i} question={field(`dialogue[${i}].question`, q.question)} answer={<p>{field(`dialogue[${i}].answer`, q.answer)}</p>} />
      ))}
    </Section>
  );
  const bodies = [sectionOne, sectionTwo, sectionThree, sectionFour];
  return (
    <div className="caos-exec" data-executive-view="" data-executive-schema={EXECUTIVE_SCHEMA_VERSION} data-executive-valid="true">
      <div className="caos-exec-tabs" data-exec-tabs="">
        <SubTabs
          ariaLabel={t(UI.sections, lang)}
          initial={EXEC_SECTION_DEFS[open - 1]?.id}
          tabs={EXEC_SECTION_DEFS.map((def, i) => ({ id: def.id, label: t(def.title, lang), content: bodies[i] }))}
        />
      </div>
      <aside className="caos-exec-notes-wrap" aria-label={t(UI.sources, lang)}>
        <h3 className="caos-exec-notes-title">{t(UI.sources, lang)}</h3>
        <ol className="caos-exec-notes" data-exec-notes="">
          {figures.map((f, i) => {
            const src = sourceOf(f);
            return (
              <li key={f} id={`exec-note-${i + 1}`} data-exec-source={f}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" data-exec-source-title="">
                  {t(src.title, lang)}
                </a>
                {src.note && (
                  <>
                    {' '}
                    <span className="caos-exec-note-text" data-exec-source-note="">
                      {t(src.note, lang)}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
