// The required areas of the documentation pages (ADR-0017 section 2.1), in ONE table. The gate's page library
// (inpage.mjs) measures what a section holds; this module says what each area must hold, and run.mjs applies it.
// docs/04_views.md transcribes the table and a unit test keeps the two in step: a rule is never written twice.
//
// A "topic" is a leaf panel of a page (a tab, a sub-tab or a tab-group item) that holds sections; a page without tabs is
// one topic. A tab list inside a section belongs to that section: its panels are not topics, and what they hold counts
// for the section across every state the gate visited.
// A "dense paragraph" is a visible `<p>` of at least DENSE_WORDS words in the displayed language, equations removed,
// counted once per distinct text. Hidden elements never count.

export const DENSE_WORDS = 40;
export const LEDE_WORDS = 35;
export const REASON_MIN = 12;
export const METHOD_KINDS = ['classical', 'learned'];

/** What a rule counts in a section: the key of the measurement taken by `G.docSections` and how it reads in a message. */
export const RULES = {
  dense: { noun: 'dense paragraph(s)', min: true },
  equations: { noun: 'captioned equation(s)', min: true },
  figures: { noun: 'figure(s) with a caption', min: true },
  callouts: { noun: 'callout(s)', min: true },
  glossary: { noun: 'glossary item(s)', min: true },
  steps: { noun: 'step(s) in an ordered list', min: true },
  controls: { noun: 'control(s)', min: true },
  refs: { noun: 'reference(s) cited', min: true },
  stats: { noun: 'quantified statement(s) (value, unit, source)', min: true },
  rows: { noun: 'row(s) of capability, outcome and proof point', min: true },
  rowsNoStat: { noun: 'row(s) whose proof point is not a quantified statement', max: true },
  items: { noun: 'item(s)', exact: true },
  thinItems: { noun: 'item(s) without a sentence', max: true },
  qa: { noun: 'question and answer pair(s)', min: true },
  honest: { noun: 'honest callout(s)', exact: true },
  honestOrStrong: { noun: 'honest or strong callout(s)', exact: true },
  // derived: tables and charts are alternatives in some areas
  table: { noun: 'table(s)', min: true },
  chart: { noun: 'chart(s)', min: true },
  tableOrChart: { noun: 'table(s) or chart(s)', min: true, of: ['tables', 'charts'] },
  tableOrCode: { noun: 'table(s) or code block(s)', min: true, of: ['tables', 'codes'] },
};

const measureOf = (m, key) => {
  const r = RULES[key];
  if (r.of) return r.of.reduce((a, k) => a + (m[k] ?? 0), 0);
  if (key === 'table') return m.tables ?? 0;
  if (key === 'chart') return m.charts ?? 0;
  if (key === 'honestOrStrong') return (m.honest ?? 0) + (m.strong ?? 0);
  return m[key] ?? 0;
};

/**
 * The floors a section fails. `m` is the measurement of the section (see `G.docSections`), `rule` the area's rule
 * (`{ dense: 2, equations: 1, honest: 1 }`: a number is a minimum, or the exact count for `honest` and `honestOrStrong`).
 * @returns {string[]} one text per failed rule, with the measured number and the floor
 */
export function failedRules(m, rule) {
  const out = [];
  for (const [key, want] of Object.entries(rule)) {
    const def = RULES[key];
    if (!def) throw new Error(`gate/areas.mjs: unknown rule ${key}`);
    const n = measureOf(m, key);
    if (def.max ? n > want : def.exact ? n !== want : n < want) out.push(`${n} ${plural(def.noun, n)}, ${def.max ? `at most ${want} is allowed` : def.exact ? `exactly ${want} is required` : `the floor is ${want}`}`);
  }
  return out;
}

/** The rule as a sentence, for the docs and the gate's messages. */
export function describeRule(rule) {
  return Object.entries(rule)
    .map(([key, want]) => `${RULES[key].max ? 'at most' : RULES[key].exact ? 'exactly' : 'at least'} ${want} ${RULES[key].noun.replace('(s)', want === 1 ? '' : 's')}`)
    .join(', ');
}

const A = (en, es, requires, extra = {}) => ({ what: { en, es }, requires, ...extra });

/**
 * The five tables of ADR-0017 section 2.1. `areas`: the vocabulary of the page (name, what it is in both languages,
 * what the gate requires in a section of that area). `floors`: the page-level floors by their stable slug (`min` over
 * the topics, learned methods, figures or captioned equations the page shows, or the words of its lede).
 */
export const PAGES = {
  '/introduction': {
    name: 'Introduction',
    // two top-level topics: the executive view first (the default), then the technical view. The executive view has no
    // areas: it is the shell's ExecutiveView, checked by executiveFailures below (0.12.0, problem-context-first.md).
    views: ['executive', 'technical'],
    areas: {
      problem: A('the industrial or scientific problem, with the concrete equipment, setting and who it serves', 'el problema industrial o científico, con el equipo concreto, el contexto y a quién sirve', { dense: 2 }, { view: 'technical' }),
      principles: A('the physics or the domain principles the product rests on', 'la física o los principios del dominio en que se apoya el producto', { dense: 2 }, { view: 'technical' }),
      math: A('the governing mathematics', 'la matemática que gobierna', { equations: 1, glossary: 10 }, { view: 'technical' }),
      pipeline: A('the end-to-end pipeline, from the data to the screen', 'el flujo completo, desde los datos hasta la pantalla', { steps: 4 }, { view: 'technical' }),
      honesty: A('what is exact and what is illustrative; what the product is not', 'qué es exacto y qué es ilustrativo; qué no es el producto', { honest: 1, dense: 1 }, { view: 'technical' }),
    },
    floors: {
      'intro-figure': { what: 'at least 1 overview figure in the technical view', measure: 'figures', min: 1, noun: 'figure(s) in the technical view' },
      'intro-equations': { what: 'at least 3 captioned equations in the technical view', measure: 'equations', min: 3, noun: 'captioned equation(s) in the technical view' },
    },
  },
  '/methodology': {
    name: 'Methodology',
    areas: {
      method: A(
        'one method family, as the build runs it: its exact behaviour and constants',
        'una familia de métodos, tal como la ejecuta el producto: su comportamiento exacto y sus constantes',
        { dense: 4, equations: 2, figures: 1, honest: 1, refs: 1 },
        { perTopic: true, kinds: METHOD_KINDS },
      ),
    },
    floors: {
      'method-topics': { what: 'at least 6 topics, one per method family', measure: 'topics', min: 6, noun: 'topic(s)' },
      'method-learned': { what: 'at least 2 topics of kind learned', measure: 'learned', min: 2, noun: 'topic(s) of kind learned' },
    },
  },
  '/implementation': {
    name: 'Implementation',
    areas: {
      architecture: A('offline pipeline, compact artifacts, the thin live lane, the browser', 'el flujo offline, los artefactos compactos, el carril vivo delgado y el navegador', { figures: 1 }),
      reproducibility: A('determinism, seeds, versions, how a result is reproduced', 'determinismo, semillas, versiones, cómo se reproduce un resultado', { callouts: 1, dense: 1 }),
      engine: A('the exact algorithm steps, constants, windows and scaling of one engine', 'los pasos exactos del algoritmo, las constantes, las ventanas y la escala de un motor', { dense: 2, equations: 1, callouts: 1 }),
      lanes: A('the live and precompute boundary, and what admits a feature to the live lane', 'el límite entre lo vivo y lo precalculado, y qué admite una función en el carril vivo', { dense: 2 }),
      contract: A('the artifact and data contracts', 'los contratos de artefactos y de datos', { tableOrCode: 1, dense: 1 }),
      deployment: A('where and how it is deployed', 'dónde y cómo se despliega', { dense: 1 }),
    },
    floors: {
      'impl-topics': { what: 'at least 8 topics', measure: 'topics', min: 8, noun: 'topic(s)' },
    },
  },
  '/experiments': {
    name: 'Experiments',
    areas: {
      question: A('a distinct experimental question and its answer (one section per question)', 'una pregunta experimental distinta y su respuesta (una sección por pregunta)', { dense: 2 }),
      metrics: A('the exact metric equations with their real constants', 'las ecuaciones exactas de las métricas con sus constantes reales', { equations: 2 }),
      protocol: A('the leakage-safe, held-out protocol, with the forbidden anti-pattern shown', 'el protocolo sin fuga y con datos retenidos, con el antipatrón prohibido a la vista', { figures: 1 }),
      datasets: A('the datasets, their redistribution class and their live or roadmap status', 'los conjuntos de datos, su clase de redistribución y su estado (vivo o en hoja de ruta)', { table: 1 }),
    },
    floors: {
      'exp-topics': { what: 'at least 6 topics', measure: 'topics', min: 6, noun: 'topic(s)' },
    },
  },
  '/benchmark': {
    name: 'Benchmark',
    areas: {
      results: A('held-out numbers read from committed artifacts', 'cifras de datos retenidos, leídas de artefactos versionados', { tableOrChart: 1 }),
      comparison: A('a learned model and a classical baseline on the same real data', 'un modelo aprendido y una línea base clásica sobre los mismos datos reales', { tableOrChart: 1 }),
      robustness: A('an honest robustness or degradation curve', 'una curva honesta de robustez o degradación', { chart: 1 }),
      live: A('a live in-browser inference panel on real held-out data', 'un panel de inferencia en vivo en el navegador sobre datos reales retenidos', { controls: 1 }),
      provenance: A('per row: dataset, difficulty source, redistribution', 'por fila: conjunto de datos, fuente de la dificultad, redistribución', { table: 1 }),
      caveat: A('the honest limits of the comparison', 'los límites honestos de la comparación', { honestOrStrong: 1 }),
    },
    floors: {},
  },
};

/** Every documentation page: the lede. */
export const COMMON_FLOORS = {
  'lede-words': { what: `a lede of at least ${LEDE_WORDS} words`, measure: 'ledeWords', min: LEDE_WORDS, noun: 'word(s) in the lede' },
};

export const DOC_ROUTES = Object.keys(PAGES);

/** The floor ids a page's waiver may name: its areas, its page-level floors and the lede. */
export const waivable = (route) => [
  ...Object.entries(PAGES[route].areas).filter(([, a]) => a.view !== 'executive').map(([k]) => k),
  ...Object.keys(PAGES[route].floors),
  ...Object.keys(COMMON_FLOORS),
];
/** The executive view of the Introduction is the decision maker's page: none of its areas, and not the view, can be waived. */
export const NOT_WAIVABLE_NOTE = 'the executive view of the Introduction cannot be waived';
/** What a waiver may not name: the executive view and the four areas it replaced (0.12.0). */
export const EXECUTIVE_FLOORS = ['executive', 'executive-view', 'initiative', 'outcomes', 'positioning', 'credibility'];

// ------------------------------------------------------------------------------------------------ the executive view
// The executive view of the Introduction is the shell's ExecutiveView fed by the product's content/executive.json
// (conventions/problem-context-first.md). Its structure is `src/content/executive.schema.json`; its writing limits are
// here AND in `src/content/executive.ts` (test/executive.test.ts keeps the two equal): the gate measures the rendered
// page, the component validates the data.
export const EXEC_SCHEMA_VERSION = '1.0.0';
export const EXEC_LIMITS = {
  maxWords: 30,
  maxAnswerSentences: 2,
  equation: /\$|\\\(|\\\[|\\[a-zA-Z]+/,
  citations: [/\(\s*Source/i, /\[\d+\]/, /\(\s*ECB/, /\(\w[^()]*\d{4}\)/],
  minLabelPx: 9,
};
/** The four sections of the view: title and rubric question (Felipe's rubric, verbatim). */
export const EXEC_SECTIONS = [
  { title: { en: 'Industry & Exec Tailoring', es: 'Industria y foco ejecutivo' }, question: { en: 'Built for a C-suite exec?', es: '¿Pensado para un ejecutivo de primer nivel?' } },
  { title: { en: 'AI Transformation Story', es: 'Historia de transformación con IA' }, question: { en: 'Outcomes, not a feature tour', es: 'Resultados, no un recorrido de funciones' } },
  { title: { en: '4Cs Positioning', es: 'Posicionamiento 4C' }, question: { en: 'Value story, not features dump', es: 'Historia de valor, no lista de funciones' } },
  { title: { en: 'Delivery & Credibility', es: 'Entrega y credibilidad' }, question: { en: 'Trust them in front of a CxO?', es: '¿Confiaría en ellos frente a un ejecutivo?' } },
];
/** The illustrations in the order of the page and the section each sits in. */
export const EXEC_ILLUSTRATIONS = [
  { name: 'initiative', section: 1 },
  { name: 'problem', section: 1 },
  { name: 'solution', section: 2 },
];
export const EXEC_PENDING = { en: "Pending: the 4 C's are defined by the product owner", es: 'Pendiente: las 4 C las define el responsable del producto' };

/** How many sentences a field of the view may hold: one for the single-sentence fields, two for an answer, no limit otherwise. */
export const execSentenceLimit = (path) =>
  /^(initiative|vision)$|^outcomes\[\d+\]\.proof\.statement$|^four_cs\[\d+\]\.exec_problem$|^illustrations\.\w+\.caption$/.test(path)
    ? 1
    : /^dialogue\[\d+\]\.answer$/.test(path)
      ? EXEC_LIMITS.maxAnswerSentences
      : undefined;

const sentencesOf = (text) =>
  text
    .split(/(?<=[.?!])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
const wordsIn = (text) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/**
 * The problems of the executive view in one language, from what the page showed (`G.docPage().executive` of
 * gate/inpage.mjs). Pure. `facts` is null or {count: 0} when the page renders no ExecutiveView.
 * @returns {string[]} one text per problem
 */
export function executiveFailures(facts, lang) {
  const L = lang.toUpperCase();
  const out = [];
  const bad = (m) => out.push(`Introduction, executive view (${L}): ${m}`);
  if (!facts || facts.count === 0) {
    bad("no ExecutiveView ([data-executive-view]); the executive view is the shell's ExecutiveView fed by content/executive.json (docs/06_executive-view.md)");
    return out;
  }
  if (facts.count > 1) bad(`${facts.count} ExecutiveView elements; exactly 1 is required`);
  if (facts.schema !== EXEC_SCHEMA_VERSION) bad(`the view declares schema "${facts.schema ?? 'none'}", expected "${EXEC_SCHEMA_VERSION}"`);
  if (facts.valid !== 'true') {
    bad(`the data file is not valid in the page: ${String(facts.errors || 'no reason given').slice(0, 400)}`);
    return out;
  }
  if (facts.docSections > 0) bad(`${facts.docSections} DocSection(s) placed in the executive view (${facts.docSectionTitles.join(', ')}); the view has exactly its four sections and takes none`);
  if (facts.strangers.length > 0) bad(`${facts.strangers.length} block(s) beside the ExecutiveView (${facts.strangers.slice(0, 3).map((x) => `"${x}"`).join(', ')}); the view is the whole of the executive view`);
  if (!facts.inOpenView) bad('the ExecutiveView is not in the open executive view');
  // the four sections, in order, with their titles and questions
  if (facts.sections.length !== 4) bad(`${facts.sections.length} section(s), exactly 4 are required`);
  EXEC_SECTIONS.forEach((def, i) => {
    const got = facts.sections[i];
    if (!got) return;
    if (got.n !== i + 1) bad(`section ${i + 1} is out of order (it declares ${got.n})`);
    if (got.title !== def.title[lang]) bad(`section ${i + 1} is titled "${got.title}", expected "${def.title[lang]}"`);
    if (got.question !== def.question[lang]) bad(`section ${i + 1} asks "${got.question}", expected "${def.question[lang]}"`);
  });
  const s3 = facts.sections[2];
  if (s3) {
    if (s3.pending === 1 && s3.rows === 0) {
      if (s3.pendingText !== EXEC_PENDING[lang]) bad(`section 3 declares the pending state "${s3.pendingText}", expected "${EXEC_PENDING[lang]}"`);
      if (s3.pendingState !== 'unavailable') bad('section 3 is pending without data-state="unavailable"');
    } else if (s3.rows !== 4) bad(`section 3 holds ${s3.rows} row(s) of the 4 C's, exactly 4 are required (or the pending state)`);
  }
  // the writing limits, on the text a reader sees
  const unreadable = [];
  for (const f of facts.fields) {
    if (!f.readable) {
      unreadable.push(f.path);
      continue;
    }
    const sentences = sentencesOf(f.text);
    for (const s of sentences) {
      const n = wordsIn(s);
      if (n > EXEC_LIMITS.maxWords) bad(`field "${f.path}": a sentence of ${n} words; the limit is ${EXEC_LIMITS.maxWords}`);
    }
    const max = execSentenceLimit(f.path);
    if (max !== undefined && sentences.length > max) bad(`field "${f.path}": ${sentences.length} sentences; the limit is ${max}`);
    if (EXEC_LIMITS.equation.test(f.text)) bad(`field "${f.path}": holds an equation or a TeX marker`);
    if (EXEC_LIMITS.citations.some((re) => re.test(f.text))) bad(`field "${f.path}": holds an inline citation (sources are numbered notes)`);
  }
  if (unreadable.length > 0) bad(`${unreadable.length} field(s) are in the page and a reader cannot read them: ${unreadable.slice(0, 4).join(', ')}`);
  if (facts.notes !== facts.figures) bad(`${facts.notes} numbered source note(s) for ${facts.figures} figure(s)`);
  // the three illustrations, in their places
  const names = facts.illustrations.map((x) => x.name);
  if (names.join() !== EXEC_ILLUSTRATIONS.map((x) => x.name).join()) bad(`the illustrations are [${names.join(', ')}], expected [initiative, problem, solution] in that order`);
  for (const ill of facts.illustrations) {
    const want = EXEC_ILLUSTRATIONS.find((x) => x.name === ill.name);
    const name = `illustration "${ill.name}"`;
    if (want && ill.section !== want.section) bad(`${name} sits in section ${ill.section}, it belongs in section ${want.section}`);
    if (ill.state === 'error') {
      bad(`${name}: the file "${ill.file}" did not load (${ill.why})`);
      continue;
    }
    if (!ill.svg) bad(`${name} is not an inline SVG`);
    if (ill.img > 0) bad(`${name} is drawn through an img tag; it must be inline so it reads the theme`);
    if (ill.chart > 0) bad(`${name} declares a chart (data-chart); the executive illustrations are drawings, not charts`);
    if (ill.literal.length > 0) bad(`${name} uses literal colour(s) ${ill.literal.slice(0, 4).join(', ')}; colour only with var(--...) theme tokens, none or currentColor`);
    if (ill.outside.length > 0) bad(`${name}: label(s) outside the viewBox: ${ill.outside.slice(0, 3).map((x) => `"${x}"`).join(', ')}`);
    if (ill.labels === 0) bad(`${name} carries no label in this language`);
    if (ill.small.length > 0) bad(`${name}: label(s) smaller than ${EXEC_LIMITS.minLabelPx}px as rendered: ${ill.small.slice(0, 3).join(', ')}`);
    if (!ill.caption) bad(`${name} has no caption under it`);
  }
  return [...new Set(out)];
}

/** Parses `data-floor-waiver` ("floor: reason; floor: reason") into entries. */
export function parseWaivers(attr) {
  return String(attr ?? '')
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const i = x.indexOf(':');
      return i < 0 ? { floor: x, reason: '' } : { floor: x.slice(0, i).trim(), reason: x.slice(i + 1).trim() };
    });
}

const plural = (noun, n) => noun.replaceAll('(s)', n === 1 ? '' : 's');

/** What a waiver's reason holds that a reader can read: letters and digits, and the words that carry one (as the unavailable reason is judged). */
export const reasonStats = (reason) => ({
  chars: reason.replace(/[^\p{L}\p{N}]+/gu, '').length,
  words: reason.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length,
});
export const REASON_WORDS = 2;
const reasonOk = (reason) => {
  const s = reasonStats(reason);
  return s.chars >= REASON_MIN && s.words >= REASON_WORDS;
};

/** Sets of distinct things a section holds: seen again in another state they count once (a sub-tab shows others). */
const SET_KEYS = { dense: 'denseKeys', equations: 'equationKeys', figures: 'figureKeys', callouts: 'calloutKeys', honest: 'honestKeys', strong: 'strongKeys' };

/**
 * One section seen in several states (the sub-tabs of a section show different parts of it): the union of what is
 * distinct (dense paragraphs, equations, figures, callouts), the maximum of every other count. A fact without the
 * distinct keys falls back to the maximum.
 */
export function mergeSections(list) {
  const out = { ...list[0] };
  for (const key of Object.keys(list[0])) if (typeof list[0][key] === 'number') out[key] = Math.max(...list.map((s) => s[key] ?? 0));
  for (const [key, keys] of Object.entries(SET_KEYS)) {
    if (list.every((s) => Array.isArray(s[keys]))) out[key] = new Set(list.flatMap((s) => s[keys])).size;
  }
  return out;
}

/**
 * Applies the table to what a documentation page showed across its visited states (`G.docPage` of gate/inpage.mjs, one
 * entry per state) in one language. Pure: the runner passes the facts, this returns the failures and the waivers.
 * @param {{ route: string, lang: string, states: object[], expectedTopics: number }} o
 * @returns {{ failures: { trail: string, message: string }[], waivers: { floor: string, reason: string, valid: boolean }[], topics: number }}
 */
export function docFloorFailures({ route, lang, states, expectedTopics }) {
  const P = PAGES[route];
  const L = lang.toUpperCase();
  const failures = [];
  const bad = (trail, message) => failures.push({ trail, message });
  const first = states[0];
  if (!P || !first) return { failures, waivers: [], topics: 0 };
  const NAME = P.name;

  // ---- the waivers: parsed, validated, and applied only when valid
  const entries = parseWaivers(first.waiver);
  const ok = new Set(waivable(route));
  const waivers = entries.map((w) => ({ ...w, valid: ok.has(w.floor) && reasonOk(w.reason) }));
  for (const w of entries) {
    if (!ok.has(w.floor)) {
      const exec = route === '/introduction' && EXECUTIVE_FLOORS.includes(w.floor);
      bad('', `${NAME} (${L}): the waiver for "${w.floor}" is refused: ${exec ? NOT_WAIVABLE_NOTE : `it names no floor of this page (${[...ok].join(', ')})`}`);
    } else if (!reasonOk(w.reason)) {
      const s = reasonStats(w.reason);
      bad('', `${NAME} (${L}): the waiver for "${w.floor}" has a reason of ${w.reason.length} character(s) (${s.chars} letter(s) or digit(s) in ${s.words} word(s)), the floor is ${REASON_MIN} letters or digits in ${REASON_WORDS} words`);
    }
  }
  const waived = new Set(waivers.filter((w) => w.valid).map((w) => w.floor));

  // ---- the topics and the sections, gathered across the states (a section seen twice counts once)
  const topics = new Map();
  const sections = new Map();
  const figures = new Set();
  const equations = new Set();
  const execMessages = new Set();
  for (const st of states) {
    for (const t of st.topics) topics.set(t.key, t.label);
    const ordinal = new Map();
    for (const sec of st.sections) {
      const n = ordinal.get(sec.topicKey) ?? 0;
      ordinal.set(sec.topicKey, n + 1);
      const k = `${sec.topicKey}#${n}`;
      sections.set(k, [...(sections.get(k) ?? []), sec]);
    }
    if (st.view !== 'executive') {
      for (const f of st.figures) figures.add(`${st.topics.map((t) => t.key).join('|')}::${f}`);
      for (const e of st.equations) equations.add(`${st.topics.map((t) => t.key).join('|')}::${e}`);
    }
    if (route === '/introduction' && st.view !== 'executive' && st.executive && st.executive.count > 0) {
      bad('', `${NAME} (${L}): the ExecutiveView sits in the "${st.view ?? 'none'}" view; it belongs to the executive view`);
    }
    if (route === '/introduction' && st.view === 'executive') {
      for (const m of executiveFailures(st.executive, lang)) execMessages.add(m);
      if (st.viewEquations > 0) bad(st.topics[0]?.label ?? '', `${NAME}, executive view (${L}): ${st.viewEquations} equation(s); the executive view holds no equation`);
      if (st.viewGlossaries > 0) bad(st.topics[0]?.label ?? '', `${NAME}, executive view (${L}): ${st.viewGlossaries} symbol glossary(ies); the executive view holds none`);
    }
  }
  for (const m of execMessages) bad('', m);
  const seen = [...sections.values()].map(mergeSections);
  const tname = (label) => (label ? `topic "${label}"` : 'the page');

  if (expectedTopics > topics.size) bad('', `${NAME} (${L}): the walk visited ${topics.size} of ${expectedTopics} topics; the floors of an unvisited topic were never checked`);

  // ---- the lede
  if (!waived.has('lede-words') && first.ledeWords < LEDE_WORDS) bad('', `${NAME} (${L}): the lede holds ${first.ledeWords} word(s), the floor is ${LEDE_WORDS}`);

  // ---- the Introduction's views: the executive one first
  if (route === '/introduction') {
    const v = first.views ?? [];
    if (!v.includes('executive')) bad('', `${NAME} (${L}): no executive view; the top-level topics are [${v.join(', ') || 'none'}] and the executive view must be the first (ADR-0017 2.1)`);
    else if (v[0] !== 'executive') bad('', `${NAME} (${L}): the executive view is not the first topic (the first is "${v[0]}")`);
    if (v.includes('executive') && first.view !== 'executive') bad('', `${NAME} (${L}): the executive view is not the view the page opens on (it opens on "${first.view ?? 'none'}")`);
    if (!v.includes('technical')) bad('', `${NAME} (${L}): no technical view; the top-level topics are [${v.join(', ') || 'none'}]`);
  }

  // ---- each section that declares an area
  const present = new Set();
  for (const sec of seen) {
    if (route === '/introduction' && (first.views ?? []).length > 0 && sec.view !== 'executive' && sec.view !== 'technical') {
      bad(sec.topic, `${NAME} (${L}): section "${sec.title}" sits outside the two views (the executive view and the technical view hold every section of the Introduction)`);
    }
    if (!sec.area) continue;
    const def = P.areas[sec.area];
    if (!def) {
      bad(sec.topic, `${NAME}, ${tname(sec.topic)} (${L}): section "${sec.title}" declares the unknown area "${sec.area}" (this page knows: ${Object.keys(P.areas).join(', ')})`);
      continue;
    }
    present.add(sec.area);
    if (waived.has(sec.area)) continue;
    if (def.view && (def.view === 'executive') !== (sec.view === 'executive')) {
      bad(sec.topic, `${NAME}, ${sec.area} area, ${tname(sec.topic)} (${L}): the area belongs to the ${def.view} view and sits in the ${sec.view === 'executive' ? 'executive' : 'technical'} view`);
    }
    if (def.kinds && !def.kinds.includes(sec.kind)) bad(sec.topic, `${NAME}, ${sec.area} area, ${tname(sec.topic)} (${L}): section "${sec.title}" has the kind "${sec.kind ?? 'none'}", expected ${def.kinds.join(' or ')}`);
    for (const t of failedRules(sec, def.requires)) bad(sec.topic, `${NAME}, ${sec.area} area, ${tname(sec.topic)} (${L}): ${t}`);
  }

  // ---- every area of the page is declared at least once
  for (const [name, def] of Object.entries(P.areas)) {
    if (waived.has(name) || present.has(name)) continue;
    bad('', `${NAME} (${L}): no section declares the area "${name}" (${def.what.en})`);
  }

  // ---- Methodology: one method section per topic
  if (route === '/methodology' && !waived.has('method')) {
    for (const [key, label] of topics) {
      const n = seen.filter((s) => s.topicKey === key && s.area === 'method').length;
      if (n !== 1) bad(label, `${NAME}, ${tname(label)} (${L}): ${n} method section(s), exactly 1 is required`);
    }
  }

  // ---- the page-level floors
  const kinds = new Set(seen.filter((s) => s.area === 'method' && s.kind === 'learned').map((s) => s.topicKey));
  const measured = { topics: topics.size, learned: kinds.size, figures: figures.size, equations: equations.size };
  for (const [id, f] of Object.entries(P.floors)) {
    if (waived.has(id)) continue;
    if (measured[f.measure] < f.min) bad('', `${NAME} (${L}): ${measured[f.measure]} ${plural(f.noun, measured[f.measure])}, the floor is ${f.min}`);
  }
  return { failures, waivers, topics: topics.size };
}
