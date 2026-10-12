// The documentation pages of the gate's fixture (ADR-0017 section 2.1): every page carries the areas its page must have,
// in plain, truthful filler about the fixture itself (a test product that exists to exercise the gate). The self-test
// plants one defect per floor through `plant` (`window.__PLANT__`); clean, every floor holds in both languages.
import type { ReactNode } from 'react';
import { Callout, DocSection, Equation, Figure, Glossary, Question, Stat, SubTabs, Tabs, pick, type BiText } from '../../src/index';

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

const NO_REFS = { en: 'A business summary of the fixture; its evidence is in the technical view.', es: 'Un resumen de negocio del producto de prueba; su evidencia está en la vista técnica.' };

const stat = (v: string, unit: BiText, source: BiText) => <Stat value={v} unit={unit} source={source} />;
const SRC = { en: 'the gate self-test', es: 'la autoprueba del verificador' };

// ------------------------------------------------------------------------------------------------------ Introduction
function Executive({ lang, plant }: { lang: Lang; plant: string }) {
  const rows = [
    { cap: { en: 'Simulate', es: 'Simular' }, out: { en: 'Faster answers', es: 'Respuestas más rápidas' }, v: '40', unit: { en: 'percent faster', es: 'por ciento más rápido' } },
    { cap: { en: 'Compare', es: 'Comparar' }, out: { en: 'Fewer reviews', es: 'Menos revisiones' }, v: '3', unit: { en: 'reviews saved', es: 'revisiones ahorradas' } },
    { cap: { en: 'Explain', es: 'Explicar' }, out: { en: 'Trusted numbers', es: 'Cifras confiables' }, v: '100', unit: { en: 'percent traceable', es: 'por ciento trazable' } },
  ].slice(0, plant === 'floor-outcomes-two' ? 2 : 3);
  const four = [
    { en: 'Every figure shown can be traced to its source, which answers the audit question.', es: 'Cada cifra mostrada se rastrea hasta su fuente, lo que responde la pregunta de auditoría.' },
    { en: 'A change is checked before release, which answers the question of risk.', es: 'Un cambio se verifica antes de publicarse, lo que responde la pregunta de riesgo.' },
    { en: 'The product is small and fast, which answers the question of cost.', es: 'El producto es pequeño y rápido, lo que responde la pregunta de costo.' },
    { en: 'Limits are stated openly, which answers the question of trust.', es: 'Los límites se declaran abiertamente, lo que responde la pregunta de confianza.' },
  ].slice(0, plant === 'floor-positioning-three' ? 3 : 4);
  const qa = [
    { q: { en: 'What does it cost to adopt?', es: '¿Cuánto cuesta adoptarlo?' }, a: { en: 'Nothing: it is a test product with no customers and no price.', es: 'Nada: es un producto de prueba sin clientes ni precio.' } },
    { q: { en: 'How do we know the numbers hold?', es: '¿Cómo sabemos que las cifras se sostienen?' }, a: { en: 'The gate measures every page before release, and its own plants prove it can fail.', es: 'El verificador mide cada página antes de publicar, y sus propias plantas prueban que puede fallar.' } },
    { q: { en: 'What is it not?', es: '¿Qué no es?' }, a: { en: 'It is not a forecast and it serves no real decision.', es: 'No es un pronóstico y no sirve a ninguna decisión real.' } },
  ].slice(0, plant === 'floor-credibility-two' ? 2 : 3);
  return (
    <>
      <DocSection title={{ en: 'The initiative', es: 'La iniciativa' }} area="initiative" noRefsReason={NO_REFS}>
        <p>{para(lang, pick({ en: 'initiative', es: 'iniciativa' }, lang), 1)}</p>
        {plant !== 'floor-initiative-nostat' && (
          <p>
            {pick({ en: 'A decision maker who owns a release pipeline gains ', es: 'Quien decide sobre una cadena de publicación gana ' }, lang)}
            {stat('12', { en: 'minutes per release', es: 'minutos por publicación' }, SRC)}.
          </p>
        )}
        {plant === 'floor-exec-equation' && <Equation tex="R_0 = \frac{\beta}{\gamma}" caption={pick({ en: 'A planted equation.', es: 'Una ecuación plantada.' }, lang)} />}
      </DocSection>
      <DocSection title={{ en: 'The outcomes', es: 'Los resultados' }} area="outcomes" noRefsReason={NO_REFS}>
        <p>{para(lang, pick({ en: 'outcomes', es: 'resultados' }, lang), 1)}</p>
        <table>
          <thead>
            <tr>
              <th>{pick({ en: 'Capability', es: 'Capacidad' }, lang)}</th>
              <th>{pick({ en: 'Outcome', es: 'Resultado' }, lang)}</th>
              <th>{pick({ en: 'Proof', es: 'Prueba' }, lang)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.v}>
                <td>{pick(r.cap, lang)}</td>
                <td>{pick(r.out, lang)}</td>
                <td>{stat(r.v, r.unit, SRC)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocSection>
      <DocSection title={{ en: 'The positioning', es: 'El posicionamiento' }} area="positioning" noRefsReason={NO_REFS}>
        <ul>
          {four.map((f, i) => (
            <li key={i}>{pick(f, lang)}</li>
          ))}
        </ul>
      </DocSection>
      <DocSection title={{ en: 'The credibility', es: 'La credibilidad' }} area="credibility" noRefsReason={NO_REFS}>
        {qa.map((x, i) => (
          <Question key={i} question={pick(x.q, lang)} answer={<p>{pick(x.a, lang)}</p>} />
        ))}
        <Callout variant="honest" title={pick({ en: 'Honest limit', es: 'Límite honesto' }, lang)}>
          {pick({ en: 'This view is written about a test product; none of its numbers is a customer result.', es: 'Esta vista trata de un producto de prueba; ninguna de sus cifras es un resultado de cliente.' }, lang)}
        </Callout>
      </DocSection>
    </>
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

function Technical({ lang, plant }: { lang: Lang; plant: string }) {
  const glossary = GLOSSARY.slice(0, plant === 'floor-glossary-nine' ? 9 : 10).map(([term, def]) => ({ term, definition: def }));
  const mathArea = plant === 'floor-five-sections' || plant === 'floor-waiver-other' ? undefined : 'math';
  return (
    <>
      <DocSection title={{ en: 'The problem', es: 'El problema' }} area="problem" refs={REFS}>
        <Paras lang={lang} tag={pick({ en: 'problem', es: 'problema' }, lang)} n={2} />
      </DocSection>
      <DocSection title={{ en: 'The principles', es: 'Los principios' }} area="principles" refs={REFS}>
        <Paras lang={lang} tag={pick({ en: 'principles', es: 'principios' }, lang)} n={2} />
      </DocSection>
      <DocSection title={{ en: 'The governing mathematics', es: 'La matemática que gobierna' }} area={mathArea} refs={REFS}>
        <Eqs lang={lang} n={3} />
        <Glossary entries={glossary} ariaLabel={{ en: 'Symbols', es: 'Símbolos' }} />
      </DocSection>
      <DocSection title={{ en: 'The pipeline', es: 'El flujo' }} area="pipeline" refs={REFS}>
        <Fig lang={lang} label={{ en: 'the pipeline', es: 'el flujo' }} />
        {plant === 'floor-pipeline-unordered' || plant === 'floor-waiver-other' ? (
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
    { id: 'executive', label: pick({ en: 'Executive', es: 'Ejecutiva' }, lang), content: <Executive lang={lang} plant={plant} /> },
    { id: 'technical', label: pick({ en: 'Technical', es: 'Técnica' }, lang), content: <Technical lang={lang} plant={plant} /> },
  ];
  return <Tabs ariaLabel={pick({ en: 'Views of the introduction', es: 'Vistas de la introducción' }, lang)} tabs={plant === 'floor-exec-second' ? [tabs[1], tabs[0]] : tabs} />;
}

// ----------------------------------------------------------------------------------------------------- Methodology
type Method = { id: string; label: BiText; kind: 'classical' | 'learned'; extra?: ReactNode };

function MethodSection({ lang, m, plant }: { lang: Lang; m: Method; plant: string }) {
  const is = (p: string) => plant === p && m.id === 'theory';
  const eqs = plant === 'floor-method-equations' && m.id === 'numerics' ? 1 : 2;
  const dense = is('floor-method-dense') ? 3 : is('floor-hidden') ? 2 : 4;
  const tag = pick(m.label as { en: string; es: string }, lang);
  return (
    <DocSection title={m.label} area="method" kind={m.kind} refs={REFS}>
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
          <Paras lang={lang} tag="stepping" n={2} />
          <Eqs lang={lang} n={2} from={1} />
          <Note lang={lang} />
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
        <label>
          {lbl('Contact rate', 'Tasa de contacto')} <input type="range" min={1} max={9} defaultValue={4} />
        </label>
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
    waivers.push({ floor: 'comparison', reason: plant === 'floor-waiver-reason' ? 'short' : noModel });
    if (plant === 'floor-waiver-unknown') waivers.push({ floor: 'nonsense', reason: { en: 'A planted waiver naming no floor.', es: 'Una exención plantada que no nombra ningún piso.' } });
  }
  if (id === 'introduction' && plant === 'floor-waiver-other') waivers.push({ floor: 'math', reason: { en: 'A planted waiver for the math area only.', es: 'Una exención plantada solo para el área de matemática.' } });
  const body =
    id === 'introduction' ? <Introduction lang={lang} plant={plant} /> : id === 'methodology' ? <Methodology lang={lang} plant={plant} /> : id === 'implementation' ? <Implementation lang={lang} plant={plant} /> : id === 'experiments' ? <Experiments lang={lang} plant={plant} /> : <Benchmark lang={lang} plant={plant} status={status} />;
  return { lede: ledeOf(id, lang, plant), waivers, body };
}
