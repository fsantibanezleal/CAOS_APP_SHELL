// The documentation pages of the gate's fixture (ADR-0017 section 2.1): every page carries the areas its page must have,
// in plain, truthful filler about the fixture itself (a test product that exists to exercise the gate). The self-test
// plants one defect per floor through `plant` (`window.__PLANT__`); clean, every floor holds in both languages.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Callout, DocSection, Equation, ExecutiveView, Figure, Glossary, SubTabs, Tabs, pick, type BiText } from '../../src/index';
import executiveData from './executive/executive.json';
import { SECTION_QUESTIONS, SECTION_TITLES } from '../../src/content/executive';

type Lang = 'en' | 'es';
const REFS = ['km1927', 'hethcote2000'];

export const PARAGRAPH = {
  en: 'The model divides the population into those who can be infected, those who are infected, and those who have recovered. Each day, contacts between the first two groups produce new infections in proportion to the contact rate, and a fixed share of the infected recover. The epidemic grows while the effective reproduction number stays above one, peaks when the susceptible share falls to the inverse of the basic reproduction number, and ends with part of the population never infected.',
  es: 'El modelo divide la población entre quienes pueden contagiarse, quienes están contagiados y quienes se recuperaron. Cada día, los contactos entre los dos primeros grupos producen contagios nuevos en proporción a la tasa de contacto, y una fracción fija de los contagiados se recupera. La epidemia crece mientras el número reproductivo efectivo es mayor que uno, alcanza su pico cuando la fracción susceptible cae al inverso del número reproductivo básico, y termina con parte de la población sin contagiarse.',
};

const LEDES: Record<string, BiText> = {
  introduction: {
    en: 'This page introduces the fixture product, a small epidemic simulator that exists only to exercise the gate of the shell. It says what the product models, what it leaves out, and how to read its two views, one for a decision maker and one for an engineer. It is not a real forecast.',
    es: 'Esta página presenta el producto de prueba, un pequeño simulador de epidemias que existe solo para ejercitar el verificador del shell. Dice qué modela el producto, qué deja fuera y cómo leer sus dos vistas, una para quien decide y otra para quien construye. No es un pronóstico real.',
  },
  methodology: {
    en: 'This page describes the six method families of the fixture product, four classical and two learned, one per topic. Each topic states what the build computes, the equations it uses and where the description stops being exact. The learned methods here are stand-ins; the fixture trains nothing and predicts nothing real.',
    es: 'Esta página describe las seis familias de métodos del producto de prueba, cuatro clásicas y dos aprendidas, una por tema. Cada tema dice qué calcula el producto, qué ecuaciones usa y dónde la descripción deja de ser exacta. Los métodos aprendidos son marcadores de posición; el producto de prueba no entrena nada ni predice nada real.',
  },
  implementation: {
    en: 'This page explains how the fixture product is built: the architecture, how a result is reproduced, the two engines, the live and precompute boundary, the data contract and the deployment. Every part is deliberately small, because the product exists to exercise the gate and not to serve readers.',
    es: 'Esta página explica cómo se construye el producto de prueba: la arquitectura, cómo se reproduce un resultado, los dos motores, el límite entre lo vivo y lo precalculado, el contrato de datos y el despliegue. Cada parte es deliberadamente pequeña, porque el producto existe para ejercitar el verificador y no para atender lectores.',
  },
  experiments: {
    en: 'This page lists the experiments of the fixture product: two questions, the metrics that answer them, the protocol that keeps them honest and the datasets they use. All of it is synthetic and small on purpose, so the gate can measure its content in seconds. Nothing here is a claim about a real epidemic.',
    es: 'Esta página enumera los experimentos del producto de prueba: dos preguntas, las métricas que las responden, el protocolo que las mantiene honestas y los conjuntos de datos que usan. Todo es sintético y pequeño a propósito, para que el verificador mida su contenido en segundos. Nada de esto afirma algo sobre una epidemia real.',
  },
  benchmark: {
    en: 'This page compares what the fixture product computes with what it should compute, reading its numbers from one committed artifact. It shows the results, a robustness curve, a live control and the provenance of every row, and it states the limits. It is a test page: the numbers are fixtures, not measurements.',
    es: 'Esta página compara lo que calcula el producto de prueba con lo que debería calcular, leyendo sus cifras de un artefacto versionado. Muestra los resultados, una curva de robustez, un control en vivo y la procedencia de cada fila, y declara los límites. Es una página de prueba: las cifras son datos de prueba, no mediciones.',
  },
};

/** The lede of a page; the floor-lede-short plant cuts the experiments lede under the floor. */
export const ledeOf = (id: string, lang: Lang, plant: string) => (plant === 'floor-lede-short' && id === 'experiments' ? pick({ en: 'A short lede.', es: 'Un lede corto.' }, lang) : pick(LEDES[id], lang));

// ------------------------------------------------------------------------------------------------ the building blocks
const para = (lang: Lang, tag: string, n: number) =>
  pick(
    {
      en: `Paragraph ${n} of the ${tag} part, from a test product that exists only to exercise the gate. ${PARAGRAPH.en}`,
      es: `Párrafo ${n} de la parte ${tag}, de un producto de prueba que existe solo para ejercitar el verificador. ${PARAGRAPH.es}`,
    },
    lang,
  );

const Paras = ({ lang, tag, n, from = 1 }: { lang: Lang; tag: string; n: number; from?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <p key={i}>{para(lang, tag, from + i)}</p>
    ))}
  </>
);

const EQUATIONS = [
  { tex: '\\frac{dS}{dt} = -\\beta \\frac{S I}{N}', en: 'Rate of change of the susceptible group.', es: 'Tasa de cambio del grupo susceptible.' },
  { tex: '\\frac{dI}{dt} = \\beta \\frac{S I}{N} - \\gamma I', en: 'Rate of change of the infected group.', es: 'Tasa de cambio del grupo contagiado.' },
  { tex: '\\frac{dR}{dt} = \\gamma I', en: 'Rate of change of the recovered group.', es: 'Tasa de cambio del grupo recuperado.' },
  { tex: 'R_0 = \\frac{\\beta}{\\gamma}', en: 'The basic reproduction number.', es: 'El número reproductivo básico.' },
];
const Eqs = ({ lang, n, from = 0 }: { lang: Lang; n: number; from?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const e = EQUATIONS[(from + i) % EQUATIONS.length];
      return <Equation key={i} tex={e.tex} caption={pick(e, lang)} />;
    })}
  </>
);

/** A captioned figure whose labels stay inside its drawing. */
const Fig = ({ lang, label }: { lang: Lang; label: { en: string; es: string } }) => (
  <Figure caption={pick({ en: `A schematic of ${label.en}.`, es: `Un esquema de ${label.es}.` }, lang)}>
    <svg className="fig-svg" viewBox="0 0 320 120" role="img" aria-label={pick(label, lang)}>
      <rect x="10" y="20" width="300" height="80" rx="6" fill="var(--color-surface-2)" stroke="var(--color-border)" />
      <text x="24" y="52" fontSize="13" fill="var(--color-fg)">
        {pick(label, lang)}
      </text>
      <text x="24" y="78" fontSize="11" fill="var(--color-fg-subtle)">
        {pick({ en: 'a drawing of the test product', es: 'un dibujo del producto de prueba' }, lang)}
      </text>
    </svg>
  </Figure>
);

const Honest = ({ lang, tag }: { lang: Lang; tag: string }) => (
  <Callout variant="honest" title={pick({ en: 'What is exact here', es: 'Qué es exacto aquí' }, lang)}>
    {pick({ en: `The ${tag} part is exact for the fixture and illustrative for any real epidemic; the fixture predicts nothing.`, es: `La parte ${tag} es exacta para el producto de prueba e ilustrativa para cualquier epidemia real; el producto de prueba no predice nada.` }, lang)}
  </Callout>
);

const Note = ({ lang }: { lang: Lang }) => (
  <Callout variant="note" title={pick({ en: 'Where it works and where it fails', es: 'Dónde funciona y dónde falla' }, lang)}>
    {pick({ en: 'It works for a well-mixed population of fixed size and fails when people move between groups.', es: 'Funciona para una población bien mezclada de tamaño fijo y falla cuando las personas pasan de un grupo a otro.' }, lang)}
  </Callout>
);

/** CSS that makes the text of the executive view unreadable while it stays in the page, one per plant (each used to pass the old gate). */
const HIDE_STYLE: Record<string, string> = {
  'area-hidden-textindent': '.caos-exec p, .caos-exec dd, .caos-exec li > div { text-indent: -10000px; white-space: nowrap; }',
  'area-hidden-tinyfont': '.caos-exec [data-exec-field] { font-size: 1px !important; line-height: 16px; }',
  'area-hidden-clippath': '.caos-exec [data-exec-field] { clip-path: inset(0 0 100% 0); }',
  'area-hidden-filler': '.caos-exec [data-exec-field] { opacity: 0; }',
  // the lede held to a narrow measure, and the executive view held to a fraction of the column (Felipe, 2026-10-13)
  'lede-narrow': '.lede { max-width: 40ch; }',
  'exec-narrow': '.caos-exec { max-width: 40rem; }',
  // sub-tabs 2 to 4 cannot be reached: the gate's walk never opens them
  'exec-tab-unreachable': '.caos-exec [data-exec-tabs] [role="tab"]:not(.active) { display: none; }',
};
const HIDE_ES = '.caos-exec p, .caos-exec dd, .caos-exec span, .caos-exec strong { color: transparent !important; }';

/** The text a plant writes into a rendered field, bypassing the component's own validation (the gate must catch it on the page). */
const WORDS31 = Array.from({ length: 31 }, (_, i) => `word${i}`).join(' ');
const DOM_PLANT: Record<string, Record<'en' | 'es', string>> = {
  'exec-long-sentence': { en: `${WORDS31}.`, es: `${WORDS31}.` },
  'exec-es-only-long': { en: 'A short vision for the English reader.', es: `${WORDS31}.` },
  'exec-citation-inline': { en: 'Admissions rose (Smith et al., 2019).', es: 'Los ingresos subieron (Smith et al., 2019).' },
  'exec-equation-text': { en: 'Admissions follow $x = y$.', es: 'Los ingresos siguen $x = y$.' },
  // promotional or client-bound wording (Felipe, 2026-10-13): one plant per word, written into the vision of the rendered view
  'exec-promo-our-client': { en: 'Our client cuts agency hours in every ward.', es: 'Una red reduce las horas de agencia en cada sala.' },
  'exec-promo-nuestro-cliente': { en: 'A network cuts agency hours in every ward.', es: 'Nuestro cliente reduce las horas de agencia en cada sala.' },
  'exec-promo-contact-us': { en: 'Contact us to see the ward forecast.', es: 'Una red ve el pronóstico por sala.' },
  'exec-promo-contactenos': { en: 'A network sees the ward forecast.', es: 'Contáctenos para ver el pronóstico por sala.' },
  'exec-promo-buy': { en: 'Buy the forecast before winter.', es: 'Una red ve el pronóstico antes del invierno.' },
  'exec-promo-comprar': { en: 'A network sees the forecast before winter.', es: 'Hay que comprar el pronóstico antes del invierno.' },
  'exec-promo-price': { en: 'The price falls as wards join.', es: 'Una red suma salas.' },
  'exec-promo-precio': { en: 'A network adds wards.', es: 'El precio baja a medida que se suman salas.' },
  'exec-promo-offer': { en: 'The offer ends in December.', es: 'La red termina en diciembre.' },
  'exec-promo-oferta': { en: 'The network ends in December.', es: 'La oferta termina en diciembre.' },
};

/** The data file of the fixture, with the defect of a data plant. */
function executiveDataFor(plant: string) {
  const d = JSON.parse(JSON.stringify(executiveData));
  if (plant === 'exec-invalid-data') {
    delete d.why_now.figure;
    d.tagline = 'an extra field';
  }
  if (plant === 'exec-outcomes-two') d.outcomes.splice(2, 1);
  if (plant === 'exec-dialogue-six') d.dialogue = Array.from({ length: 6 }, () => d.dialogue[0]);
  if (plant === 'exec-four-cs-present') d.four_cs = ['A', 'B', 'C', 'D'].map((c) => ({ c: { en: c, es: c }, exec_problem: { en: 'It ties to the problem.', es: 'Se ata al problema.' } }));
  if (plant === 'exec-source-no-url') delete d.sources[0].url;
  if (plant === 'exec-source-http') d.sources[0].url = 'http://example.org/report';
  if (plant === 'exec-source-file-citation') d.sources[0].note = { en: 'Report file 2026080375, section 2', es: 'Informe archivo 2026080375, sección 2' };
  return d;
}

/** The executive view of the fixture: the shell's ExecutiveView on the fixture data file, plus the plants of the gate's executive check. */
function ExecutiveFixture({ lang, plant }: { lang: Lang; plant: string }) {
  const box = useRef<HTMLDivElement | null>(null);
  const injected = DOM_PLANT[plant];
  useEffect(() => {
    // write the plant into the vision of the rendered view whenever it is on the page (the vision sits in a sub-tab that is
    // rendered only while it is open), and a source note as prose, the way the 0.12.0 data wrote it: no link
    const apply = () => {
      const el = box.current?.querySelector('[data-exec-field="vision"]');
      if (el && injected && el.textContent !== injected[lang]) el.textContent = injected[lang];
      const note = box.current?.querySelector('[data-exec-notes] > li');
      const prose = lang === 'en' ? 'Stability report, section 2, page 14, file 2026080375.' : 'Informe de estabilidad, sección 2, página 14, archivo 2026080375.';
      if (note && plant === 'exec-note-no-link' && note.textContent !== prose) note.textContent = prose;
    };
    apply();
    if (!box.current) return undefined;
    const watch = new MutationObserver(apply);
    watch.observe(box.current, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [injected, lang, plant]);
  if (plant === 'exec-sections-stacked') {
    // the four sections stacked in one scroll, the way shell 0.12.0 showed them: they are not sub-tabs
    return (
      <div className="caos-exec" data-executive-view="" data-executive-schema="2.0.0" data-executive-valid="true">
        {[1, 2, 3, 4].map((n) => (
          <section key={n} className="caos-exec-section" data-exec-section={n}>
            <h2>{pick(SECTION_TITLES[n - 1], lang)}</h2>
            <p className="caos-exec-question" data-exec-question="">
              {pick(SECTION_QUESTIONS[n - 1], lang)}
            </p>
          </section>
        ))}
        <aside>
          <ol data-exec-notes="" />
        </aside>
      </div>
    );
  }
  if (plant === 'exec-old-areas') {
    // the four areas of shell 0.11, composed by hand: they are not an executive view
    return (
      <>
        <DocSection title={{ en: 'The initiative', es: 'La iniciativa' }} area="initiative" noRefsReason={{ en: 'A business summary of the fixture.', es: 'Un resumen de negocio del producto de prueba.' }}>
          <Paras lang={lang} tag={pick({ en: 'initiative', es: 'iniciativa' }, lang)} n={1} />
        </DocSection>
        <DocSection title={{ en: 'The outcomes', es: 'Los resultados' }} area="outcomes" noRefsReason={{ en: 'A business summary of the fixture.', es: 'Un resumen de negocio del producto de prueba.' }}>
          <Paras lang={lang} tag={pick({ en: 'outcomes', es: 'resultados' }, lang)} n={1} />
        </DocSection>
      </>
    );
  }
  const css = HIDE_STYLE[plant] ?? (plant === 'floor-exec-transparent-es' && lang === 'es' ? HIDE_ES : undefined);
  return (
    <div ref={box}>
      {css && <style>{css}</style>}
      <ExecutiveView data={executiveDataFor(plant)} base="/" />
      {plant === 'exec-fifth-section' && (
        <DocSection title={{ en: 'A fifth section', es: 'Una quinta sección' }} noRefsReason={{ en: 'A planted section that cites nothing.', es: 'Una sección plantada que no cita nada.' }}>
          <Paras lang={lang} tag="fifth" n={1} />
        </DocSection>
      )}
      {plant === 'exec-stranger-text' && <p>{pick({ en: 'A paragraph a product placed beside the executive view.', es: 'Un párrafo que un producto puso junto a la vista ejecutiva.' }, lang)}</p>}
      {plant === 'floor-exec-equation' && <Equation tex="R_0 = \frac{\beta}{\gamma}" caption={pick({ en: 'A planted equation.', es: 'Una ecuación plantada.' }, lang)} />}
    </div>
  );
}

const GLOSSARY = [
  ['S(t)', { en: 'susceptible people at day t', es: 'personas susceptibles el día t' }],
  ['I(t)', { en: 'infected people at day t', es: 'personas contagiadas el día t' }],
  ['R(t)', { en: 'recovered people at day t', es: 'personas recuperadas el día t' }],
  ['N', { en: 'the fixed population size', es: 'el tamaño fijo de la población' }],
  ['β', { en: 'the contact rate', es: 'la tasa de contacto' }],
  ['γ', { en: 'the recovery rate', es: 'la tasa de recuperación' }],
  ['R0', { en: 'the basic reproduction number', es: 'el número reproductivo básico' }],
  ['Re', { en: 'the effective reproduction number', es: 'el número reproductivo efectivo' }],
  ['t', { en: 'time in days', es: 'tiempo en días' }],
  ['Ipeak', { en: 'the largest infected count', es: 'el mayor número de contagiados' }],
] as const;

/** The governing mathematics: three captioned equations and the symbol glossary. `area` is what the section declares. */
function MathSection({ lang, plant, area }: { lang: Lang; plant: string; area: string | undefined }) {
  const glossary = GLOSSARY.slice(0, plant === 'floor-glossary-nine' ? 9 : 10).map(([term, def]) => ({ term, definition: def }));
  return (
    <DocSection title={{ en: 'The governing mathematics', es: 'La matemática que gobierna' }} area={area} refs={REFS}>
      <Eqs lang={lang} n={3} />
      {plant === 'floor-glossary-hidden' ? (
        // ten items in the page, one of them visible
        <dl className="caos-glossary" data-glossary="" aria-label={pick({ en: 'Symbols', es: 'Símbolos' }, lang)}>
          {GLOSSARY.map(([term, def], i) => (
            <div className="caos-glossary-item" data-glossary-item="" key={term} style={i === 0 ? undefined : { display: 'none' }}>
              <dt>{term}</dt>
              <dd>{pick(def, lang)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Glossary entries={glossary} ariaLabel={{ en: 'Symbols', es: 'Símbolos' }} />
      )}
    </DocSection>
  );
}

function Technical({ lang, plant }: { lang: Lang; plant: string }) {
  const mathArea = plant === 'floor-five-sections' || plant === 'floor-waiver-other' ? undefined : 'math';
  return (
    <>
      <DocSection title={{ en: 'The problem', es: 'El problema' }} area="problem" refs={REFS}>
        <Paras lang={lang} tag={pick({ en: 'problem', es: 'problema' }, lang)} n={2} />
      </DocSection>
      <DocSection title={{ en: 'The principles', es: 'Los principios' }} area="principles" refs={REFS}>
        <Paras lang={lang} tag={pick({ en: 'principles', es: 'principios' }, lang)} n={2} />
      </DocSection>
      {plant === 'floor-math-outside' ? (
        // the area is declared outside both views; the technical view keeps its three equations in a section with no area
        <DocSection title={{ en: 'The equations', es: 'Las ecuaciones' }} refs={REFS}>
          <Eqs lang={lang} n={3} />
        </DocSection>
      ) : (
        <MathSection lang={lang} plant={plant} area={mathArea} />
      )}
      <DocSection title={{ en: 'The pipeline', es: 'El flujo' }} area="pipeline" refs={REFS}>
        <Fig lang={lang} label={{ en: 'the pipeline', es: 'el flujo' }} />
        {plant === 'floor-steps-hidden' ? (
          <ol>
            <li>{pick({ en: 'Read the artifact', es: 'Leer el artefacto' }, lang)}</li>
            <li style={{ display: 'none' }}>{pick({ en: 'Integrate the model', es: 'Integrar el modelo' }, lang)}</li>
            <li style={{ display: 'none' }}>{pick({ en: 'Draw the result', es: 'Dibujar el resultado' }, lang)}</li>
            <li style={{ display: 'none' }}>{pick({ en: 'Report the state', es: 'Informar el estado' }, lang)}</li>
          </ol>
        ) : plant === 'floor-steps-empty' ? (
          <ol>
            <li />
            <li />
            <li />
            <li />
          </ol>
        ) : plant === 'floor-pipeline-unordered' || plant === 'floor-waiver-other' ? (
          <ul>
            <li>{pick({ en: 'Read the artifact', es: 'Leer el artefacto' }, lang)}</li>
            <li>{pick({ en: 'Integrate the model', es: 'Integrar el modelo' }, lang)}</li>
            <li>{pick({ en: 'Draw the result', es: 'Dibujar el resultado' }, lang)}</li>
            <li>{pick({ en: 'Report the state', es: 'Informar el estado' }, lang)}</li>
          </ul>
        ) : (
          <ol>
            <li>{pick({ en: 'Read the artifact', es: 'Leer el artefacto' }, lang)}</li>
            <li>{pick({ en: 'Integrate the model', es: 'Integrar el modelo' }, lang)}</li>
            <li>{pick({ en: 'Draw the result', es: 'Dibujar el resultado' }, lang)}</li>
            <li>{pick({ en: 'Report the state', es: 'Informar el estado' }, lang)}</li>
          </ol>
        )}
      </DocSection>
      <DocSection title={{ en: 'What is exact', es: 'Qué es exacto' }} area="honesty" refs={REFS}>
        <p>{para(lang, pick({ en: 'honesty', es: 'honestidad' }, lang), 1)}</p>
        {plant !== 'floor-honesty-none' && <Honest lang={lang} tag={pick({ en: 'honesty', es: 'honestidad' }, lang)} />}
      </DocSection>
      {plant === 'floor-area-unknown' && (
        <DocSection title={{ en: 'An extra part', es: 'Una parte extra' }} area="extras" refs={REFS}>
          <Paras lang={lang} tag="extra" n={1} />
        </DocSection>
      )}
    </>
  );
}

function Introduction({ lang, plant }: { lang: Lang; plant: string }) {
  if (plant === 'floor-no-executive') return <Technical lang={lang} plant={plant} />;
  const tabs = [
    { id: 'executive', label: pick({ en: 'Executive', es: 'Ejecutiva' }, lang), content: <ExecutiveFixture lang={lang} plant={plant} /> },
    { id: 'technical', label: pick({ en: 'Technical', es: 'Técnica' }, lang), content: <Technical lang={lang} plant={plant} /> },
  ];
  const views = (
    <Tabs
      ariaLabel={pick({ en: 'Views of the introduction', es: 'Vistas de la introducción' }, lang)}
      tabs={plant === 'floor-exec-second' ? [tabs[1], tabs[0]] : tabs}
      // refs-mid needs a references block in the open view, and only the technical view cites works
      initial={plant === 'floor-exec-not-default' || plant === 'refs-mid' ? 'technical' : undefined}
    />
  );
  // the math section above the views: it shows in the executive view too
  return plant === 'floor-math-outside' ? (
    <>
      <MathSection lang={lang} plant={plant} area="math" />
      {views}
    </>
  ) : (
    views
  );
}

// ----------------------------------------------------------------------------------------------------- Methodology
type Method = { id: string; label: BiText; kind: 'classical' | 'learned'; extra?: ReactNode };

function MethodSection({ lang, m, plant }: { lang: Lang; m: Method; plant: string }) {
  const is = (p: string) => plant === p && m.id === 'theory';
  const eqs = plant === 'floor-method-equations' && m.id === 'numerics' ? 1 : 2;
  const dense = is('floor-method-dense') ? 3 : is('floor-hidden') ? 2 : 4;
  const tag = pick(m.label as { en: string; es: string }, lang);
  return (
    <DocSection
      title={m.label}
      area="method"
      kind={m.kind}
      refs={is('floor-method-norefs') ? undefined : REFS}
      noRefsReason={is('floor-method-norefs') ? { en: 'A planted method that cites nothing and says so.', es: 'Un método plantado que no cita nada y lo dice.' } : undefined}
    >
      {is('floor-duplicate') ? Array.from({ length: 4 }, (_, i) => <p key={i}>{para(lang, tag, 1)}</p>) : <Paras lang={lang} tag={tag} n={dense} />}
      {is('floor-hidden') && (
        <>
          <p style={{ display: 'none' }}>{para(lang, tag, 91)}</p>
          <p style={{ display: 'none' }}>{para(lang, tag, 92)}</p>
        </>
      )}
      <Eqs lang={lang} n={eqs} />
      {!(plant === 'floor-method-figure' && m.id === 'numerics') && <Fig lang={lang} label={{ en: `the ${(m.label as { en: string }).en} method`, es: `el método ${(m.label as { es: string }).es}` }} />}
      <Honest lang={lang} tag={tag} />
      {is('floor-method-honest') && <Honest lang={lang} tag={`${tag} (second)`} />}
      {is('legit-method-view-tabs') && (
        // view tabs of one figure inside the method section: they belong to the section, they are not topics
        <SubTabs
          ariaLabel={pick({ en: 'Views of the method', es: 'Vistas del método' }, lang)}
          tabs={[
            { id: 'one-d', label: '1D', content: <p>{pick({ en: 'In one dimension the groups mix evenly along a line and the epidemic moves as a front.', es: 'En una dimensión los grupos se mezclan por igual a lo largo de una línea y la epidemia avanza como un frente.' }, lang)}</p> },
            { id: 'two-d', label: '2D', content: <p>{pick({ en: 'In two dimensions the front becomes a ring that spreads out from the first infected place.', es: 'En dos dimensiones el frente se vuelve un anillo que se extiende desde el primer lugar contagiado.' }, lang)}</p> },
          ]}
        />
      )}
    </DocSection>
  );
}

const MARGIN_REGION = (lang: Lang) => (
  <div>
    <div style={{ height: 400 }}>
      <p>{pick(PARAGRAPH, lang)}</p>
    </div>
    <div role="region" aria-label={pick({ en: 'Nearly as tall as the page', es: 'Casi tan alto como la página' }, lang)} tabIndex={0} style={{ height: 'calc(100vh - 91px)' }}>
      <p>{pick(PARAGRAPH, lang)}</p>
    </div>
  </div>
);

function Methodology({ lang, plant }: { lang: Lang; plant: string }) {
  const methods: Method[] = [
    { id: 'theory', label: { en: 'Theory', es: 'Teoría' }, kind: 'classical' },
    { id: 'numerics', label: { en: 'Numerics', es: 'Numérica' }, kind: 'classical' },
    // taller than the page's scroll box and shorter than the window: reachable (known shell defect 18)
    { id: 'notes', label: { en: 'Notes', es: 'Notas' }, kind: 'classical', extra: <div style={{ height: 'calc(100vh - 40px)' }}><p>{pick(PARAGRAPH, lang)}</p></div> },
    // a focusable block below the fold, a few pixels shorter than the page's scroll box (known shell defect 25)
    { id: 'margins', label: { en: 'Margins', es: 'Márgenes' }, kind: 'classical', extra: MARGIN_REGION(lang) },
    { id: 'surrogate', label: { en: 'Surrogate', es: 'Sustituto' }, kind: 'learned' },
    { id: 'ood', label: { en: 'Novelty', es: 'Novedad' }, kind: plant === 'floor-method-learned' ? 'classical' : 'learned' },
  ];
  const shown = plant === 'floor-method-topics' ? methods.slice(0, 5) : methods;
  return (
    <Tabs
      ariaLabel={pick({ en: 'Methodology parts', es: 'Partes de la metodología' }, lang)}
      tabs={shown.map((m) => ({
        id: m.id,
        label: pick(m.label, lang),
        content: (
          <>
            {m.extra}
            <MethodSection lang={lang} m={m} plant={plant} />
          </>
        ),
      }))}
    />
  );
}

// -------------------------------------------------------------------------------------------------- Implementation
/** The five parts of the old long section, kept so the sticky list has a long section to stay in view of (G12). */
const LongParts = ({ lang }: { lang: Lang }) => (
  <>
    {[1, 2, 3, 4, 5].map((k) => (
      <DocSection key={k} title={{ en: `Part ${k}`, es: `Parte ${k}` }} refs={k === 5 ? undefined : REFS} noRefsReason={k === 5 ? { en: 'A summary of the parts above.', es: 'Un resumen de las partes anteriores.' } : undefined}>
        <p>{pick(PARAGRAPH, lang)}</p>
        {k === 1 && <Eqs lang={lang} n={1} from={1} />}
      </DocSection>
    ))}
  </>
);

function Implementation({ lang, plant }: { lang: Lang; plant: string }) {
  const lbl = (en: string, es: string) => pick({ en, es }, lang);
  const sub = (label: string, tabs: { id: string; label: string; content: ReactNode }[]) => (
    <SubTabs orientation="vertical" ariaLabel={label} tabs={tabs} />
  );
  const arch = plant !== 'floor-impl-architecture';
  const lanesEs = plant === 'floor-es-area' && lang === 'es';
  const core = [
    {
      id: 'architecture',
      label: lbl('Architecture', 'Arquitectura'),
      content: (
        <>
          {arch ? (
            <DocSection title={{ en: 'The architecture', es: 'La arquitectura' }} area="architecture" refs={REFS}>
              <Fig lang={lang} label={{ en: 'the architecture', es: 'la arquitectura' }} />
            </DocSection>
          ) : (
            <DocSection title={{ en: 'The architecture', es: 'La arquitectura' }} refs={REFS}>
              <Paras lang={lang} tag="architecture" n={1} />
            </DocSection>
          )}
          <LongParts lang={lang} />
        </>
      ),
    },
    {
      id: 'reproducibility',
      label: lbl('Reproducibility', 'Reproducibilidad'),
      content: (
        <DocSection title={{ en: 'Reproducibility', es: 'Reproducibilidad' }} area="reproducibility" refs={REFS}>
          <Paras lang={lang} tag="reproducibility" n={1} />
          <Note lang={lang} />
        </DocSection>
      ),
    },
    {
      id: 'engine-sir',
      label: lbl('Engine: SIR', 'Motor: SIR'),
      content: (
        <DocSection title={{ en: 'The SIR engine', es: 'El motor SIR' }} area="engine" refs={REFS}>
          <Paras lang={lang} tag="engine" n={2} />
          <Eqs lang={lang} n={1} />
          <Note lang={lang} />
        </DocSection>
      ),
    },
    {
      id: 'engine-step',
      label: lbl('Engine: step', 'Motor: paso'),
      content: (
        <DocSection title={{ en: 'The stepping engine', es: 'El motor de pasos' }} area="engine" refs={REFS}>
          {plant === 'legit-engine-subtabs' ? (
            // everything the area asks for, spread over the sub-tabs of the section
            <SubTabs
              ariaLabel={lbl('Parts of the engine', 'Partes del motor')}
              tabs={[
                {
                  id: 'steps',
                  label: lbl('Steps', 'Pasos'),
                  content: (
                    <>
                      <Paras lang={lang} tag="stepping" n={2} />
                      <Eqs lang={lang} n={2} from={1} />
                      <Note lang={lang} />
                    </>
                  ),
                },
                { id: 'constants', label: lbl('Constants', 'Constantes'), content: <pre>{'{ "dt": 0.1, "beta": 0.3, "gamma": 0.1 }'}</pre> },
              ]}
            />
          ) : (
            <>
              <Paras lang={lang} tag="stepping" n={2} />
              <Eqs lang={lang} n={2} from={1} />
              <Note lang={lang} />
            </>
          )}
        </DocSection>
      ),
    },
  ];
  const ops = [
    {
      id: 'lanes',
      label: lbl('Lanes', 'Carriles'),
      content: lanesEs ? (
        <DocSection title={{ en: 'The lanes', es: 'Los carriles' }} refs={REFS}>
          <Paras lang={lang} tag="lanes" n={1} />
        </DocSection>
      ) : (
        <DocSection title={{ en: 'The lanes', es: 'Los carriles' }} area="lanes" refs={REFS}>
          <Paras lang={lang} tag="lanes" n={2} />
        </DocSection>
      ),
    },
    {
      id: 'contract',
      label: lbl('Contract', 'Contrato'),
      content: (
        <DocSection title={{ en: 'The artifact contract', es: 'El contrato del artefacto' }} area="contract" refs={REFS}>
          <Paras lang={lang} tag="contract" n={1} />
          <pre>{'{ "cases": 3 }'}</pre>
        </DocSection>
      ),
    },
    {
      id: 'deployment',
      label: lbl('Deployment', 'Despliegue'),
      content: (
        <DocSection title={{ en: 'Deployment', es: 'Despliegue' }} area="deployment" refs={REFS}>
          <Paras lang={lang} tag="deployment" n={1} />
        </DocSection>
      ),
    },
    {
      id: 'notes',
      label: lbl('Notes', 'Notas'),
      content: (
        <DocSection title={{ en: 'Notes', es: 'Notas' }} refs={REFS}>
          <Paras lang={lang} tag="notes" n={1} />
        </DocSection>
      ),
    },
  ];
  return (
    <Tabs
      ariaLabel={lbl('Implementation groups', 'Grupos de la implementación')}
      tabs={[
        { id: 'core', label: lbl('Core', 'Núcleo'), content: sub(lbl('Core parts', 'Partes del núcleo'), core) },
        { id: 'operations', label: lbl('Operations', 'Operación'), content: sub(lbl('Operations parts', 'Partes de la operación'), ops) },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------------------------------- Experiments
function Experiments({ lang, plant }: { lang: Lang; plant: string }) {
  const lbl = (en: string, es: string) => pick({ en, es }, lang);
  const datasets = plant !== 'floor-exp-datasets';
  const tabs = [
    { id: 'q1', label: lbl('Question 1', 'Pregunta 1'), content: <DocSection title={{ en: 'Does the peak move?', es: '¿Se mueve el pico?' }} area="question" refs={REFS}><Paras lang={lang} tag="question one" n={2} /></DocSection> },
    { id: 'q2', label: lbl('Question 2', 'Pregunta 2'), content: <DocSection title={{ en: 'Does the step matter?', es: '¿Importa el paso?' }} area="question" refs={REFS}><Paras lang={lang} tag="question two" n={2} /></DocSection> },
    { id: 'metrics', label: lbl('Metrics', 'Métricas'), content: <DocSection title={{ en: 'The metrics', es: 'Las métricas' }} area="metrics" refs={REFS}><Eqs lang={lang} n={2} from={2} /></DocSection> },
    { id: 'protocol', label: lbl('Protocol', 'Protocolo'), content: <DocSection title={{ en: 'The protocol', es: 'El protocolo' }} area="protocol" refs={REFS}><Fig lang={lang} label={{ en: 'the held-out protocol', es: 'el protocolo con datos retenidos' }} /></DocSection> },
    {
      id: 'datasets',
      label: lbl('Datasets', 'Datos'),
      content: (
        <DocSection title={{ en: 'The datasets', es: 'Los conjuntos de datos' }} area={datasets ? 'datasets' : undefined} refs={REFS}>
          {datasets ? (
            <table>
              <thead>
                <tr>
                  <th>{lbl('Set', 'Conjunto')}</th>
                  <th>{lbl('Access', 'Acceso')}</th>
                  <th>{lbl('Status', 'Estado')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{lbl('Synthetic', 'Sintético')}</td>
                  <td>{lbl('Mirrored', 'Copiado')}</td>
                  <td>{lbl('Live', 'Vivo')}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <Paras lang={lang} tag="datasets" n={1} />
          )}
        </DocSection>
      ),
    },
    {
      id: 'notes',
      label: lbl('Notes', 'Notas'),
      content: (
        <DocSection title={{ en: 'Notes', es: 'Notas' }} refs={REFS}>
          <Paras lang={lang} tag="notes" n={1} />
          <figure className="figure">
            <svg className="fig-svg" viewBox="0 0 320 120" role="img" aria-label="A figure below the fold">
              <rect x="10" y="20" width="300" height="80" rx="6" fill="var(--color-surface-2)" stroke="var(--color-border)" />
              <text x="24" y="52" fontSize="13" fill="var(--color-fg)">{lbl('A figure below the fold', 'Una figura bajo el pliegue')}</text>
              <text x="24" y="78" fontSize="11" fill="var(--color-fg-subtle)">{lbl('its labels stay inside it', 'sus rótulos quedan dentro')}</text>
            </svg>
            <figcaption className="figure-caption">{lbl('A documentation figure after the notes.', 'Una figura de documentación tras las notas.')}</figcaption>
          </figure>
        </DocSection>
      ),
    },
  ];
  return <Tabs ariaLabel={lbl('Experiments parts', 'Partes de los experimentos')} tabs={tabs} />;
}

// ------------------------------------------------------------------------------------------------------- Benchmark
function Benchmark({ lang, plant, status }: { lang: Lang; plant: string; status: ReactNode }) {
  const lbl = (en: string, es: string) => pick({ en, es }, lang);
  const table = (a: string, b: string) => (
    <table>
      <thead>
        <tr>
          <th>{lbl('Row', 'Fila')}</th>
          <th>{a}</th>
          <th>{b}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{lbl('Peak day', 'Día del pico')}</td>
          <td>41</td>
          <td>41</td>
        </tr>
      </tbody>
    </table>
  );
  return (
    <>
      <DocSection title={{ en: 'The results', es: 'Los resultados' }} area="results" refs={REFS}>
        {table(lbl('Fixture', 'Prueba'), lbl('Expected', 'Esperado'))}
      </DocSection>
      <DocSection title={{ en: 'The robustness', es: 'La robustez' }} area="robustness" refs={REFS}>
        <svg className="fig-svg" data-chart="" viewBox="0 0 320 140" role="img" aria-label={lbl('Peak day against the contact rate', 'Día del pico contra la tasa de contacto')}>
          <polyline points="40,110 120,80 200,60 280,30" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
          <text x="40" y="132" fontSize="11" fill="var(--color-fg-subtle)">{lbl('contact rate', 'tasa de contacto')}</text>
          <text x="40" y="16" fontSize="11" fill="var(--color-fg-subtle)">{lbl('peak day', 'día del pico')}</text>
        </svg>
      </DocSection>
      <DocSection title={{ en: 'The live panel', es: 'El panel en vivo' }} area="live" refs={REFS}>
        {plant === 'floor-live-button' ? (
          // a button that is not a registered control of the panel
          <button type="button">{lbl('Copy the setting', 'Copiar el ajuste')}</button>
        ) : (
        <label>
          {lbl('Contact rate', 'Tasa de contacto')} <input type="range" min={1} max={9} defaultValue={4} data-control="contact" />
        </label>
        )}
        {status}
      </DocSection>
      <DocSection title={{ en: 'The provenance', es: 'La procedencia' }} area="provenance" refs={REFS}>
        {table(lbl('Source', 'Fuente'), lbl('Access', 'Acceso'))}
      </DocSection>
      {plant !== 'floor-bench-caveat' && (
        <DocSection title={{ en: 'The caveat', es: 'La salvedad' }} area="caveat" refs={REFS}>
          <Honest lang={lang} tag={lbl('benchmark', 'comparación')} />
        </DocSection>
      )}
    </>
  );
}

/** What a documentation page of the fixture holds, for the plant named. `status` is the benchmark's artifact line. */
export function fixtureDoc(id: string, lang: Lang, plant: string, status: ReactNode): { lede: string; waivers: Array<{ floor: string; reason: BiText }>; body: ReactNode } {
  const waivers: Array<{ floor: string; reason: BiText }> = [];
  const noModel = { en: 'The fixture has no learned model to compare.', es: 'El producto de prueba no tiene modelo aprendido que comparar.' };
  if (id === 'benchmark') {
    // the clean fixture walks the waiver path: it has no learned model to compare against a baseline
    waivers.push({ floor: 'comparison', reason: plant === 'floor-waiver-reason' ? 'short' : plant === 'floor-waiver-punct' ? '............' : noModel });
    if (plant === 'floor-waiver-unknown') waivers.push({ floor: 'nonsense', reason: { en: 'A planted waiver naming no floor.', es: 'Una exención plantada que no nombra ningún piso.' } });
  }
  if (id === 'introduction' && plant === 'floor-waiver-other') waivers.push({ floor: 'math', reason: { en: 'A planted waiver for the math area only.', es: 'Una exención plantada solo para el área de matemática.' } });
  const body =
    id === 'introduction' ? <Introduction lang={lang} plant={plant} /> : id === 'methodology' ? <Methodology lang={lang} plant={plant} /> : id === 'implementation' ? <Implementation lang={lang} plant={plant} /> : id === 'experiments' ? <Experiments lang={lang} plant={plant} /> : <Benchmark lang={lang} plant={plant} status={status} />;
  return { lede: ledeOf(id, lang, plant), waivers, body };
}
