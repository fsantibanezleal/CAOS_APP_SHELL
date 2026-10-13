import { useEffect, useState, type ReactNode } from 'react';
import { Link, useInRouterContext } from 'react-router';
import { useShellLang } from '../lib/lang';
import type { Lang } from '../lib/lang';
import { APP_ROUTE } from '../shell/routes';
import {
  EXECUTIVE_SCHEMA_VERSION,
  EXEC_SECTION_DEFS,
  FOUR_CS,
  ONWARD_LINKS,
  SECTION_TITLES,
  sourceOrder,
  validateExecutive,
  type BiTextValue,
  type ExecutiveData,
  type ExecutiveFigure,
  type ExecutiveIllustration,
} from './executive';
import { SubTabs } from './SubTabs';

/** The words the view itself writes (the product writes none of them). */
const UI = {
  bearers: { en: 'Who bears it', es: 'Quién lo soporta' },
  cost: { en: 'Cost', es: 'Costo' },
  measure: { en: 'Measured by', es: 'Se mide por' },
  causes: { en: 'Where it comes from', es: 'De dónde viene' },
  setting: { en: 'Setting', es: 'Entorno' },
  forces: { en: 'What keeps it going', es: 'Qué lo mantiene' },
  evidence: { en: 'Rules and figures', es: 'Reglas y cifras' },
  roles: { en: 'The roles involved', es: 'Los roles involucrados' },
  decides: { en: 'Decides', es: 'Decide' },
  needs: { en: 'Needs', es: 'Necesita' },
  sota: { en: 'How it is handled today', es: 'Cómo se maneja hoy' },
  achieves: { en: 'Achieves', es: 'Logra' },
  fallsShort: { en: 'Falls short', es: 'Se queda corto' },
  signal: { en: 'Signal', es: 'Señal' },
  effect: { en: 'Effect on the roles', es: 'Efecto en los roles' },
  confidence: { en: 'Confidence', es: 'Confianza' },
  fourCs: { en: 'The 4 C\'s applied', es: 'Las 4 C aplicadas' },
  actions: { en: 'Actions', es: 'Acciones' },
  owner: { en: 'Owner', es: 'Responsable' },
  horizon: { en: 'When', es: 'Cuándo' },
  check: { en: 'How we would know', es: 'Cómo lo sabremos' },
  risks: { en: 'Risks', es: 'Riesgos' },
  unknowns: { en: 'What is still unknown', es: 'Lo que aún se desconoce' },
  sources: { en: 'Sources', es: 'Fuentes' },
  onward: { en: 'Onward', es: 'Continuar' },
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

const DIRECTION: Record<string, BiTextValue> = {
  rising: { en: 'Rising', es: 'En aumento' },
  easing: { en: 'Easing', es: 'Cediendo' },
  steady: { en: 'Steady', es: 'Estable' },
};
const KIND: Record<string, BiTextValue> = {
  regulatory: { en: 'Regulatory', es: 'Regulatoria' },
  technological: { en: 'Technological', es: 'Tecnológica' },
  market: { en: 'Market', es: 'De mercado' },
  practice: { en: 'Practice', es: 'De práctica' },
};
const HORIZON: Record<string, BiTextValue> = {
  now: { en: 'Now', es: 'Ahora' },
  two_years: { en: 'In two years', es: 'En dos años' },
  ten_years: { en: 'In ten years', es: 'En diez años' },
};
const CONFIDENCE: Record<string, BiTextValue> = {
  low: { en: 'Low', es: 'Baja' },
  medium: { en: 'Medium', es: 'Media' },
  high: { en: 'High', es: 'Alta' },
};

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

/** One section: the key message line first (a reader can stop at the five lines), then the supporting content. */
function Section({ n, lang, keyMessage, keyPath, children }: { n: number; lang: Lang; keyMessage: BiTextValue; keyPath: string; children: ReactNode }) {
  return (
    <section className="caos-exec-section" data-exec-section={n} aria-label={t(SECTION_TITLES[n - 1], lang)}>
      <p className="caos-exec-key" data-exec-key-message="" data-exec-field={keyPath}>
        {t(keyMessage, lang)}
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
  /** Opens the technical view of the Introduction (default: selects the sibling tab `technical` of the tab that holds the view). */
  onOpenTechnical?: () => void;
}

/** Selects the `technical` tab next to the tab that holds the view; a no-op when the page has none. */
function openSiblingTechnical(from: HTMLElement) {
  const panel = from.closest('[role="tabpanel"]');
  const own = panel?.getAttribute('aria-labelledby');
  const tab = own ? document.getElementById(own) : null;
  const target = tab?.closest('[role="tablist"]')?.querySelector<HTMLElement>('[role="tab"][data-tab="technical"]');
  target?.click();
  target?.focus();
}

/**
 * The executive view of an Introduction (CAOS_MANAGE conventions/problem-context-first.md, Felipe 2026-10-12 and
 * 2026-10-13): the industry's problem framed for a decision maker. Above the sub-tabs, the landing block (the title, the key
 * statement, two or three headline figures); then the five sections of `EXEC_SECTION_DEFS` as the sub-tabs of `SubTabs`, the
 * first selected, each opening with its key message line; below them the numbered linked sources and two onward links (the
 * technical view, the App). General, never a client, never a pitch. A product fills `content/executive.json`; it does not
 * design this view, so the component takes no children. Invalid data renders an error state that lists each field path,
 * never a blank.
 */
export function ExecutiveView({ data, base, onOpenTechnical }: ExecutiveViewProps) {
  return <ExecutiveViewBody data={data} base={base} onOpenTechnical={onOpenTechnical} />;
}

/** The view with the language and the open sub-tab as parameters, so the tests can render each section; the product-facing entry is `ExecutiveView`. */
export function ExecutiveViewBody({ data, base = '/', lang: forced, open = 1, onOpenTechnical }: ExecutiveViewProps & { lang?: Lang; open?: number }) {
  const stored = useShellLang();
  const lang = forced ?? stored;
  const routed = useInRouterContext();
  const problems = validateExecutive(data);
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
  const order = sourceOrder(d);
  const sourceOf = (id: string) => d.sources.find((s) => s.id === id)!;
  const note = (id: string) => order.indexOf(id) + 1;
  const Cite = ({ id }: { id: string }) => (
    <sup className="caos-exec-cite">
      <a href={`#exec-note-${note(id)}`} aria-label={`${t(UI.source, lang)} ${note(id)}`}>
        {note(id)}
      </a>
    </sup>
  );
  const field = (path: string, text: BiTextValue) => <span data-exec-field={path}>{t(text, lang)}</span>;
  const Figure = ({ f, path, kind }: { f: ExecutiveFigure; path: string; kind: string }) => (
    <li className="caos-exec-figure" data-exec-item={kind}>
      <Label>{field(`${path}.heading`, f.heading)}</Label>
      <strong className="caos-exec-value" data-exec-field={`${path}.value`}>
        {t(f.value, lang)}
      </strong>{' '}
      {field(`${path}.unit`, f.unit)}
      <Cite id={f.source} />
    </li>
  );
  const Paragraphs = ({ list, path }: { list: BiTextValue[]; path: string }) => (
    <>
      {list.map((p, i) => (
        <p key={i} className="caos-exec-paragraph" data-exec-item={path}>
          {field(`${path}[${i}]`, p)}
        </p>
      ))}
    </>
  );
  const art = (name: 'pain' | 'situation' | 'proposal') => <Illustration name={name} spec={d.illustrations[name]} base={base} lang={lang} />;
  const enumLabel = (map: Record<string, BiTextValue>, key: string) => t(map[key], lang);

  const bodies = [
    // 1. the pain
    <Section key="pain" n={1} lang={lang} keyMessage={d.pain.key_message} keyPath="pain.key_message">
      <Paragraphs list={d.pain.paragraphs} path="pain.paragraphs" />
      {art('pain')}
      <ul className="caos-exec-figures">
        {d.pain.figures.map((f, i) => (
          <Figure key={i} f={f} path={`pain.figures[${i}]`} kind="pain.figures" />
        ))}
      </ul>
      <h3 className="caos-exec-sub">{t(UI.bearers, lang)}</h3>
      <ul className="caos-exec-cards">
        {d.pain.bearers.map((b, i) => (
          <li key={i} className="caos-exec-card" data-exec-item="pain.bearers">
            <strong>{field(`pain.bearers[${i}].who`, b.who)}</strong>
            <div>
              <Label>{t(UI.cost, lang)}</Label> {field(`pain.bearers[${i}].cost`, b.cost)}
            </div>
            <div>
              <Label>{t(UI.measure, lang)}</Label> {field(`pain.bearers[${i}].measure`, b.measure)}
            </div>
          </li>
        ))}
      </ul>
      <h3 className="caos-exec-sub">{t(UI.causes, lang)}</h3>
      <ul className="caos-exec-causes">
        {d.pain.causes.map((c, i) => (
          <li key={i} className="caos-exec-cause" data-exec-item="pain.causes" data-exec-weight={c.weight}>
            <div className="caos-exec-cause-head">
              {field(`pain.causes[${i}].cause`, c.cause)} <strong className="caos-exec-value">{c.weight}%</strong>
            </div>
            <div className="caos-exec-bar" aria-hidden="true">
              <span style={{ width: `${c.weight}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Section>,
    // 2. the context
    <Section key="context" n={2} lang={lang} keyMessage={d.context.key_message} keyPath="context.key_message">
      <Paragraphs list={d.context.paragraphs} path="context.paragraphs" />
      <p className="caos-exec-setting">
        <Label>{t(UI.setting, lang)}</Label> {field('context.setting', d.context.setting)}
      </p>
      <h3 className="caos-exec-sub">{t(UI.forces, lang)}</h3>
      <ul className="caos-exec-cards">
        {d.context.forces.map((f, i) => (
          <li key={i} className="caos-exec-card" data-exec-item="context.forces" data-exec-direction={f.direction}>
            {field(`context.forces[${i}].force`, f.force)}
            <span className="caos-exec-badge">{enumLabel(DIRECTION, f.direction)}</span>
          </li>
        ))}
      </ul>
      <h3 className="caos-exec-sub">{t(UI.evidence, lang)}</h3>
      <ul className="caos-exec-evidence">
        {d.context.evidence.map((e, i) => (
          <li key={i} data-exec-item="context.evidence">
            {field(`context.evidence[${i}].statement`, e.statement)}
            <Cite id={e.source} />
          </li>
        ))}
      </ul>
    </Section>,
    // 3. the current situation
    <Section key="situation" n={3} lang={lang} keyMessage={d.situation.key_message} keyPath="situation.key_message">
      <h3 className="caos-exec-sub">{t(UI.roles, lang)}</h3>
      <ul className="caos-exec-cards">
        {d.situation.roles.map((r, i) => (
          <li key={i} className="caos-exec-card" data-exec-item="situation.roles">
            <strong>{field(`situation.roles[${i}].role`, r.role)}</strong>
            <div>
              <Label>{t(UI.decides, lang)}</Label> {field(`situation.roles[${i}].decides`, r.decides)}
            </div>
            <div>
              <Label>{t(UI.needs, lang)}</Label> {field(`situation.roles[${i}].needs`, r.needs)}
            </div>
          </li>
        ))}
      </ul>
      <p className="caos-exec-interaction">{field('situation.interaction', d.situation.interaction)}</p>
      {art('situation')}
      <h3 className="caos-exec-sub">{t(UI.sota, lang)}</h3>
      <ul className="caos-exec-cards">
        {d.situation.state_of_the_art.map((a, i) => (
          <li key={i} className="caos-exec-card" data-exec-item="situation.state_of_the_art">
            <strong>
              {field(`situation.state_of_the_art[${i}].approach`, a.approach)}
              <Cite id={a.source} />
            </strong>
            <div>
              <Label>{t(UI.achieves, lang)}</Label> {field(`situation.state_of_the_art[${i}].achieves`, a.achieves)}
            </div>
            <div>
              <Label>{t(UI.fallsShort, lang)}</Label> {field(`situation.state_of_the_art[${i}].falls_short`, a.falls_short)}
            </div>
          </li>
        ))}
      </ul>
      <p className="caos-exec-status" data-exec-item="situation.status">
        <Label>{field('situation.status.heading', d.situation.status.heading)}</Label>{' '}
        <strong className="caos-exec-value" data-exec-field="situation.status.value">
          {t(d.situation.status.value, lang)}
        </strong>{' '}
        {field('situation.status.unit', d.situation.status.unit)} <span className="caos-exec-sep">&middot;</span> {field('situation.status.date', d.situation.status.date)}
        <Cite id={d.situation.status.source} />
      </p>
    </Section>,
    // 4. the trends
    <Section key="trends" n={4} lang={lang} keyMessage={d.trends.key_message} keyPath="trends.key_message">
      <ul className="caos-exec-cards">
        {d.trends.items.map((it, i) => (
          <li key={i} className="caos-exec-card" data-exec-item="trends.items" data-exec-horizon={it.horizon}>
            <strong>{field(`trends.items[${i}].trend`, it.trend)}</strong>
            <div className="caos-exec-badges">
              <span className="caos-exec-badge">{enumLabel(KIND, it.kind)}</span>
              <span className="caos-exec-badge">{enumLabel(DIRECTION, it.direction)}</span>
              <span className="caos-exec-badge">{enumLabel(HORIZON, it.horizon)}</span>
              <span className="caos-exec-badge">
                {t(UI.confidence, lang)}: {enumLabel(CONFIDENCE, it.confidence)}
              </span>
            </div>
            <div>
              <Label>{t(UI.signal, lang)}</Label> {field(`trends.items[${i}].signal.statement`, it.signal.statement)}
              <Cite id={it.signal.source} />
            </div>
            <div>
              <Label>{t(UI.effect, lang)}</Label> {field(`trends.items[${i}].effect`, it.effect)}
            </div>
          </li>
        ))}
      </ul>
    </Section>,
    // 5. the proposal
    <Section key="proposal" n={5} lang={lang} keyMessage={d.proposal.key_message} keyPath="proposal.key_message">
      <Paragraphs list={d.proposal.paragraphs} path="proposal.paragraphs" />
      {art('proposal')}
      <h3 className="caos-exec-sub">{t(UI.fourCs, lang)}</h3>
      <ul className="caos-exec-cs">
        {d.proposal.four_cs.map((r, i) => (
          <li key={i} className="caos-exec-card" data-exec-c={i} data-exec-item="proposal.four_cs">
            <strong data-exec-field={`proposal.four_cs[${i}].c`} data-exec-cname="">
              {t(FOUR_CS[i].name, lang)}
            </strong>
            <small className="caos-exec-cdef" data-exec-cdef="">
              {t(FOUR_CS[i].definition, lang)}
            </small>
            <span>{field(`proposal.four_cs[${i}].applies`, r.applies)}</span>
          </li>
        ))}
      </ul>
      <h3 className="caos-exec-sub">{t(UI.actions, lang)}</h3>
      <ol className="caos-exec-actions">
        {d.proposal.actions.map((a, i) => (
          <li key={i} className="caos-exec-card" data-exec-item="proposal.actions">
            <strong>{field(`proposal.actions[${i}].action`, a.action)}</strong>
            <div>
              <Label>{t(UI.owner, lang)}</Label> {field(`proposal.actions[${i}].owner`, a.owner)} <span className="caos-exec-sep">&middot;</span> <Label>{t(UI.horizon, lang)}</Label>{' '}
              {field(`proposal.actions[${i}].horizon`, a.horizon)}
            </div>
            <div>
              <Label>{t(UI.check, lang)}</Label> {field(`proposal.actions[${i}].check`, a.check)}
            </div>
          </li>
        ))}
      </ol>
      <h3 className="caos-exec-sub">{t(UI.risks, lang)}</h3>
      <ul className="caos-exec-list">
        {d.proposal.risks.map((r, i) => (
          <li key={i} data-exec-item="proposal.risks">
            {field(`proposal.risks[${i}]`, r)}
          </li>
        ))}
      </ul>
      <h3 className="caos-exec-sub">{t(UI.unknowns, lang)}</h3>
      <ul className="caos-exec-list">
        {d.proposal.unknowns.map((u, i) => (
          <li key={i} data-exec-item="proposal.unknowns">
            {field(`proposal.unknowns[${i}]`, u)}
          </li>
        ))}
      </ul>
      {d.proposal.handoff && <p className="caos-exec-handoff">{field('proposal.handoff', d.proposal.handoff)}</p>}
    </Section>,
  ];

  return (
    <div className="caos-exec" data-executive-view="" data-executive-schema={EXECUTIVE_SCHEMA_VERSION} data-executive-valid="true">
      <header className="caos-exec-landing" data-exec-landing="">
        <h2 className="caos-exec-title" data-exec-field="title">
          {t(d.title, lang)}
        </h2>
        <p className="caos-exec-statement" data-exec-field="key_statement">
          {t(d.key_statement, lang)}
        </p>
        <ul className="caos-exec-headline">
          {d.headline_figures.map((f, i) => (
            <Figure key={i} f={f} path={`headline_figures[${i}]`} kind="headline_figures" />
          ))}
        </ul>
      </header>
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
          {order.map((id, i) => {
            const src = sourceOf(id);
            return (
              <li key={id} id={`exec-note-${i + 1}`} data-exec-source={id}>
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
      <nav className="caos-exec-links" data-exec-links="" aria-label={t(UI.onward, lang)}>
        <a
          href="#technical"
          className="caos-exec-link"
          data-exec-link="technical"
          onClick={(e) => {
            e.preventDefault();
            if (onOpenTechnical) onOpenTechnical();
            else openSiblingTechnical(e.currentTarget);
          }}
        >
          {t(ONWARD_LINKS.technical, lang)}
        </a>
        {routed ? (
          <Link to={APP_ROUTE} className="caos-exec-link" data-exec-link="app">
            {t(ONWARD_LINKS.app, lang)}
          </Link>
        ) : (
          <a href={`${base}${APP_ROUTE.slice(1)}`} className="caos-exec-link" data-exec-link="app">
            {t(ONWARD_LINKS.app, lang)}
          </a>
        )}
      </nav>
    </div>
  );
}
