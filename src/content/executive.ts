import schema from './executive.schema.json';

/**
 * The executive view standard (CAOS_MANAGE conventions/problem-context-first.md, Felipe 2026-10-12 and 2026-10-13): the
 * types of the data file `content/executive.json`, its validator, its floors and its writing limits. The structure lives
 * ONLY in `executive.schema.json` (this module interprets it); the rules a schema cannot say (the limits, the 4 C's, the
 * sources by id, the owners that are roles, the wording) are here. `gate/areas.mjs` keeps the same limits and floors for
 * the rendered page; a unit test keeps them equal.
 */

export const EXECUTIVE_SCHEMA_VERSION = '2.0.0';

export interface BiTextValue {
  en: string;
  es: string;
}

export interface FourC {
  name: BiTextValue;
  definition: BiTextValue;
}

/**
 * The 4 C's of the proposal (sub-tab 5), in order, with the names and definitions Felipe gave on 2026-10-13 (verbatim,
 * English and Spanish). `proposal.four_cs` is required in every data file with exactly these four rows in this order, each
 * `c` equal to the name and each with what the C means for the proposal (`applies`); the view shows the definition in small
 * type beside the name. `gate/areas.mjs` EXEC_FOUR_CS holds the same values; a unit test keeps them equal.
 */
export const FOUR_CS: readonly FourC[] = [
  { name: { en: 'Choice', es: 'Elección' }, definition: { en: 'flexibility across proprietary and open models.', es: 'flexibilidad entre modelos propietarios y abiertos.' } },
  { name: { en: 'Context', es: 'Contexto' }, definition: { en: 'AI grounded in business meaning, so decisions are accurate.', es: 'IA anclada en el significado del negocio, para que las decisiones sean exactas.' } },
  { name: { en: 'Cost', es: 'Costo' }, definition: { en: 'visibility of what the AI spends.', es: 'visibilidad de lo que gasta la IA.' } },
  { name: { en: 'Control', es: 'Control' }, definition: { en: 'one governance over data, models and agents.', es: 'una sola gobernanza sobre datos, modelos y agentes.' } },
];

/** The writing limits (the same in both languages); `gate/areas.mjs` EXEC_LIMITS holds the same values. */
export const EXEC_LIMITS = {
  maxWords: 30,
  /** The fewest words of a paragraph: no one-line sections, no restating the title. */
  minParagraphWords: 25,
  /** An equation or a TeX marker: a dollar sign, `\(`, `\[` or a backslash command. */
  equation: /\$|\\\(|\\\[|\\[a-zA-Z]+/,
  /** An inline citation: `(Source`, `[1]`, `(ECB`, or a parenthesised author-year such as `(Smith et al., 2019)`. */
  citations: [/\(\s*Source/i, /\[\d+\]/, /\(\s*ECB/, /\(\w[^()]*\d{4}\)/],
  /** The smallest rendered size of an illustration label, in CSS pixels (the gate reads it from the drawing). */
  minLabelPx: 9,
  /** A source that cites a file name or number in place of its link (a `.pdf` is allowed only beside a written-out https link). */
  fileCitations: [/\bfile\s*\d/i, /\barchivo\s*\d/i, /\.pdf\b/i, /\bPublished on\b/i],
  /** Promotional or client-bound wording (the view is general: never a client, never a pitch; Felipe 2026-10-13). Whole words, either case. */
  promotional: [/\bour\s+clients?\b/i, /\bnuestros?\s+clientes?\b/i, /\bcontact\s+us\b/i, /\bcontáctenos\b/i, /\bbuy\b/i, /\bcomprar\b/i, /\bprices?\b/i, /\bprecios?\b/i, /\boffers?\b/i, /\bofertas?\b/i],
} as const;

/**
 * The floors of the view as [min, max] counts of rows (the structure of problem-context-first.md); the schema holds the same
 * numbers as minItems and maxItems, `gate/areas.mjs` EXEC_FLOORS holds them for the rendered page, and a unit test keeps the
 * three equal.
 */
export const EXEC_FLOORS: Readonly<Record<string, readonly [number, number]>> = {
  headline_figures: [2, 3],
  'pain.paragraphs': [2, 3],
  'pain.bearers': [3, 5],
  'pain.figures': [2, 4],
  'pain.causes': [3, 5],
  'context.paragraphs': [1, 2],
  'context.forces': [3, 4],
  'context.evidence': [1, 4],
  'situation.roles': [3, 5],
  'situation.state_of_the_art': [3, 5],
  'trends.items': [3, 5],
  'proposal.paragraphs': [1, 2],
  'proposal.four_cs': [4, 4],
  'proposal.actions': [3, 6],
  'proposal.risks': [1, 4],
  'proposal.unknowns': [1, 4],
};

export type Direction = 'rising' | 'easing' | 'steady';
export type TrendKind = 'regulatory' | 'technological' | 'market' | 'practice';
export type Horizon = 'now' | 'two_years' | 'ten_years';
export type Confidence = 'low' | 'medium' | 'high';

export interface ExecutiveFigure {
  heading: BiTextValue;
  value: BiTextValue;
  unit: BiTextValue;
  /** The id of an entry of `sources`. */
  source: string;
}
export interface ExecutiveIllustration {
  /** The SVG file (a path under the site root), or one per language. */
  file: string | BiTextValue;
  caption: BiTextValue;
}
export interface ExecutiveSource {
  id: string;
  /** The publication, in plain words. */
  title: BiTextValue;
  /** The page or document itself: an https link. */
  url: string;
  /** At most one sentence (for example a page number). */
  note?: BiTextValue;
}
export interface ExecutiveData {
  title: BiTextValue;
  key_statement: BiTextValue;
  headline_figures: ExecutiveFigure[];
  pain: {
    key_message: BiTextValue;
    paragraphs: BiTextValue[];
    bearers: Array<{ who: BiTextValue; cost: BiTextValue; measure: BiTextValue }>;
    figures: ExecutiveFigure[];
    causes: Array<{ cause: BiTextValue; weight: number }>;
  };
  context: {
    key_message: BiTextValue;
    paragraphs: BiTextValue[];
    setting: BiTextValue;
    forces: Array<{ force: BiTextValue; direction: Direction }>;
    evidence: Array<{ statement: BiTextValue; source: string }>;
  };
  situation: {
    key_message: BiTextValue;
    roles: Array<{ role: BiTextValue; decides: BiTextValue; needs: BiTextValue }>;
    interaction: BiTextValue;
    state_of_the_art: Array<{ approach: BiTextValue; achieves: BiTextValue; falls_short: BiTextValue; source: string }>;
    status: { heading: BiTextValue; value: BiTextValue; unit: BiTextValue; date: BiTextValue; source: string };
  };
  trends: {
    key_message: BiTextValue;
    items: Array<{
      trend: BiTextValue;
      kind: TrendKind;
      direction: Direction;
      horizon: Horizon;
      signal: { statement: BiTextValue; source: string };
      effect: BiTextValue;
      confidence: Confidence;
    }>;
  };
  proposal: {
    key_message: BiTextValue;
    paragraphs: BiTextValue[];
    four_cs: Array<{ c: BiTextValue; applies: BiTextValue }>;
    actions: Array<{ action: BiTextValue; owner: BiTextValue; horizon: BiTextValue; check: BiTextValue }>;
    risks: BiTextValue[];
    unknowns: BiTextValue[];
    handoff?: BiTextValue;
  };
  illustrations: { pain: ExecutiveIllustration; situation: ExecutiveIllustration; proposal: ExecutiveIllustration };
  sources: ExecutiveSource[];
}

export interface ExecutiveProblem {
  /** The field path, for example `pain.bearers[1].cost.en` (empty for the document itself). */
  path: string;
  message: string;
}

// ------------------------------------------------------------------------------------------------ text measures
/** The sentences of a text: split on `.`, `?` or `!` followed by a space or the end (a decimal point is not a split). */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The words of a text: the whitespace-separated tokens that hold a letter or a digit. */
export function wordsIn(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

// ------------------------------------------------------------------------------- the schema interpreter (a subset)
type Node = { [k: string]: any };

const ROOT = schema as Node;
const typeOf = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const join = (base: string, key: string) => (base ? `${base}.${key}` : key);

function resolve(node: Node): Node {
  if (typeof node.$ref !== 'string') return node;
  const name = node.$ref.replace('#/$defs/', '');
  return { ...(ROOT.$defs as Node)[name], ...(node.description ? { description: node.description } : {}) };
}

/**
 * Validates `value` against `node`; the supported keywords are type (also integer), properties, required,
 * additionalProperties: false, items, minItems, maxItems, minLength, pattern (with x-pattern-message), enum, minimum,
 * maximum, anyOf and $ref.
 */
function check(value: unknown, rawNode: Node, path: string, out: ExecutiveProblem[]): void {
  const node = resolve(rawNode);
  if (node.anyOf) {
    const ok = (node.anyOf as Node[]).some((alt) => {
      const sub: ExecutiveProblem[] = [];
      check(value, alt, path, sub);
      return sub.length === 0;
    });
    if (!ok) out.push({ path, message: `matches none of the allowed forms (${(node.anyOf as Node[]).map((a) => resolve(a).type).join(' or ')})` });
    return;
  }
  const t = typeOf(value);
  const wanted = node.type === 'integer' ? 'number' : node.type;
  if (node.type && t !== wanted) {
    out.push({ path, message: `must be ${node.type === 'object' ? 'an object' : node.type === 'array' ? 'an array' : `a ${node.type}`}, not ${t === 'undefined' ? 'missing' : t === 'array' ? 'an array' : t === 'object' ? 'an object' : `a ${t}`}` });
    return;
  }
  if (node.type === 'integer' && !Number.isInteger(value)) out.push({ path, message: 'must be a whole number' });
  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) out.push({ path, message: `must be at least ${node.minimum}` });
    if (node.maximum !== undefined && value > node.maximum) out.push({ path, message: `must be at most ${node.maximum}` });
  }
  if (node.enum && !(node.enum as unknown[]).includes(value)) out.push({ path, message: `must be one of ${(node.enum as unknown[]).join(', ')}` });
  if (node.type === 'string' && typeof value === 'string' && node.minLength && value.trim().length < node.minLength) {
    out.push({ path, message: 'must not be empty' });
  } else if (node.type === 'string' && typeof value === 'string' && node.pattern && !new RegExp(node.pattern).test(value)) {
    out.push({ path, message: (node['x-pattern-message'] as string | undefined) ?? `must match ${node.pattern}` });
  }
  if (node.type === 'array') {
    const list = value as unknown[];
    if (node.minItems !== undefined && list.length < node.minItems) out.push({ path, message: `needs at least ${node.minItems} item(s), has ${list.length}` });
    if (node.maxItems !== undefined && list.length > node.maxItems) out.push({ path, message: `allows at most ${node.maxItems} item(s), has ${list.length}` });
    if (node.items) list.forEach((item, i) => check(item, node.items, `${path}[${i}]`, out));
  }
  if (node.type === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of (node.required as string[] | undefined) ?? []) {
      if (!(key in obj) || obj[key] === undefined) out.push({ path: join(path, key), message: 'is required and missing' });
    }
    const props = (node.properties as Node | undefined) ?? {};
    for (const key of Object.keys(obj)) {
      if (props[key]) check(obj[key], props[key], join(path, key), out);
      else if (node.additionalProperties === false) out.push({ path: join(path, key), message: 'is not a field of the executive view (nothing else is allowed)' });
    }
  }
}

// ------------------------------------------------------------------------------------------- the rules on top
export interface TextField {
  path: string;
  text: BiTextValue;
  /** At most this many sentences. */
  sentences?: number;
  /** At least this many words. */
  minWords?: number;
}

/** Every text field with its path and what it may hold; the `sources` have their own rules (`sourceTextProblems`: a source may cite). */
export function executiveTextFields(d: ExecutiveData): TextField[] {
  const out: TextField[] = [];
  const add = (path: string, text: BiTextValue, sentences?: number, minWords?: number) => out.push({ path, text, sentences, minWords });
  const figure = (base: string, f: ExecutiveFigure) => {
    add(`${base}.heading`, f.heading);
    add(`${base}.value`, f.value);
    add(`${base}.unit`, f.unit);
  };
  add('title', d.title, 1);
  add('key_statement', d.key_statement, 2);
  d.headline_figures.forEach((f, i) => figure(`headline_figures[${i}]`, f));
  const { pain, context, situation, trends, proposal } = d;
  add('pain.key_message', pain.key_message, 1);
  pain.paragraphs.forEach((p, i) => add(`pain.paragraphs[${i}]`, p, undefined, EXEC_LIMITS.minParagraphWords));
  pain.bearers.forEach((b, i) => {
    add(`pain.bearers[${i}].who`, b.who);
    add(`pain.bearers[${i}].cost`, b.cost);
    add(`pain.bearers[${i}].measure`, b.measure);
  });
  pain.figures.forEach((f, i) => figure(`pain.figures[${i}]`, f));
  pain.causes.forEach((c, i) => add(`pain.causes[${i}].cause`, c.cause));
  add('context.key_message', context.key_message, 1);
  context.paragraphs.forEach((p, i) => add(`context.paragraphs[${i}]`, p, undefined, EXEC_LIMITS.minParagraphWords));
  add('context.setting', context.setting);
  context.forces.forEach((f, i) => add(`context.forces[${i}].force`, f.force));
  context.evidence.forEach((e, i) => add(`context.evidence[${i}].statement`, e.statement, 1));
  add('situation.key_message', situation.key_message, 1);
  situation.roles.forEach((r, i) => {
    add(`situation.roles[${i}].role`, r.role);
    add(`situation.roles[${i}].decides`, r.decides);
    add(`situation.roles[${i}].needs`, r.needs);
  });
  add('situation.interaction', situation.interaction, 1);
  situation.state_of_the_art.forEach((a, i) => {
    add(`situation.state_of_the_art[${i}].approach`, a.approach);
    add(`situation.state_of_the_art[${i}].achieves`, a.achieves);
    add(`situation.state_of_the_art[${i}].falls_short`, a.falls_short);
  });
  figure('situation.status', situation.status);
  add('situation.status.date', situation.status.date);
  add('trends.key_message', trends.key_message, 1);
  trends.items.forEach((t, i) => {
    add(`trends.items[${i}].trend`, t.trend);
    add(`trends.items[${i}].signal.statement`, t.signal.statement, 1);
    add(`trends.items[${i}].effect`, t.effect);
  });
  add('proposal.key_message', proposal.key_message, 1);
  proposal.paragraphs.forEach((p, i) => add(`proposal.paragraphs[${i}]`, p, undefined, EXEC_LIMITS.minParagraphWords));
  proposal.four_cs.forEach((c, i) => {
    add(`proposal.four_cs[${i}].c`, c.c);
    add(`proposal.four_cs[${i}].applies`, c.applies, 1);
  });
  proposal.actions.forEach((a, i) => {
    add(`proposal.actions[${i}].action`, a.action, 1);
    add(`proposal.actions[${i}].owner`, a.owner);
    add(`proposal.actions[${i}].horizon`, a.horizon);
    add(`proposal.actions[${i}].check`, a.check, 1);
  });
  proposal.risks.forEach((r, i) => add(`proposal.risks[${i}]`, r, 1));
  proposal.unknowns.forEach((u, i) => add(`proposal.unknowns[${i}]`, u, 1));
  if (proposal.handoff) add('proposal.handoff', proposal.handoff, 1);
  for (const name of ['pain', 'situation', 'proposal'] as const) add(`illustrations.${name}.caption`, d.illustrations[name].caption, 1);
  return out;
}

/**
 * Every citation of a source in the order the view shows them (the landing, then the sub-tabs 1 to 5), each with the path of
 * the field that cites and the sub-tab it sits in (0 for the landing). The notes are numbered in the order of first use.
 */
export function executiveCitations(d: ExecutiveData): Array<{ path: string; source: string; tab: number }> {
  const out: Array<{ path: string; source: string; tab: number }> = [];
  d.headline_figures.forEach((f, i) => out.push({ path: `headline_figures[${i}].source`, source: f.source, tab: 0 }));
  d.pain.figures.forEach((f, i) => out.push({ path: `pain.figures[${i}].source`, source: f.source, tab: 1 }));
  d.context.evidence.forEach((e, i) => out.push({ path: `context.evidence[${i}].source`, source: e.source, tab: 2 }));
  d.situation.state_of_the_art.forEach((a, i) => out.push({ path: `situation.state_of_the_art[${i}].source`, source: a.source, tab: 3 }));
  out.push({ path: 'situation.status.source', source: d.situation.status.source, tab: 3 });
  d.trends.items.forEach((t, i) => out.push({ path: `trends.items[${i}].signal.source`, source: t.signal.source, tab: 4 }));
  return out;
}

/** The ids of the sources in the order of first use: the order of the numbered notes. */
export function sourceOrder(d: Pick<ExecutiveData, 'headline_figures' | 'pain' | 'context' | 'situation' | 'trends'>): string[] {
  return [...new Set(executiveCitations(d as ExecutiveData).map((c) => c.source))];
}

/** The problems with the writing of one text, one per rule it breaks; used by the validator and by the tests of the gate. */
export function writingProblems(text: string, maxSentences?: number, minWords?: number): string[] {
  const out: string[] = [];
  const sentences = sentencesOf(text);
  for (const s of sentences) {
    const n = wordsIn(s);
    if (n > EXEC_LIMITS.maxWords) out.push(`a sentence of ${n} words; the limit is ${EXEC_LIMITS.maxWords}`);
  }
  if (maxSentences !== undefined && sentences.length > maxSentences) {
    out.push(maxSentences === 1 ? `must be one sentence, has ${sentences.length}` : `has ${sentences.length} sentences; the limit is ${maxSentences}`);
  }
  if (minWords !== undefined && wordsIn(text) < minWords) out.push(`has ${wordsIn(text)} words; a paragraph needs at least ${minWords} (no one-line sections)`);
  if (EXEC_LIMITS.equation.test(text)) out.push('holds an equation or a TeX marker; the executive view holds none');
  if (EXEC_LIMITS.citations.some((re) => re.test(text))) out.push('holds an inline citation; give the source in "sources"');
  for (const re of EXEC_LIMITS.promotional) {
    const m = re.exec(text);
    if (m) out.push(`holds promotional or client-bound wording ("${m[0]}"); the executive view is general, never a client, never a pitch`);
  }
  return out;
}

/**
 * The problems with the title or the note of one source: a sentence over the word limit, more than `maxSentences`
 * sentences, and a citation of a file name or number in place of the link. An inline citation is allowed here (a source
 * names a publication). `gate/areas.mjs` execSourceTextProblems keeps the same rules for the rendered note.
 */
export function sourceTextProblems(text: string, maxSentences?: number): string[] {
  const out: string[] = [];
  const sentences = sentencesOf(text);
  for (const sentence of sentences) {
    const n = wordsIn(sentence);
    if (n > EXEC_LIMITS.maxWords) out.push(`a sentence of ${n} words; the limit is ${EXEC_LIMITS.maxWords}`);
  }
  if (maxSentences !== undefined && sentences.length > maxSentences) out.push(maxSentences === 1 ? `must be one sentence, has ${sentences.length}` : `has ${sentences.length} sentences; the limit is ${maxSentences}`);
  const written = /https?:\/\//i.test(text);
  for (const re of EXEC_LIMITS.fileCitations) {
    if (re.source.includes('pdf') && written) continue;
    const m = re.exec(text);
    if (m) out.push(`cites a file name or number in place of the link ("${m[0]}"); give the publication as the title and its https link as the url`);
  }
  return out;
}

const sameText = (a: BiTextValue | undefined, b: BiTextValue | undefined) => Boolean(a && b && a.en === b.en && a.es === b.es);

/**
 * Validates a product's `content/executive.json` against `executive.schema.json` and the rules on top of it. Pure; an
 * empty array means valid.
 */
export function validateExecutive(data: unknown): ExecutiveProblem[] {
  const out: ExecutiveProblem[] = [];
  check(data, ROOT, '', out);
  // the rules below read the structure: run them only on a structurally sound file, so a typo never throws
  if (out.length > 0) return out;
  const d = data as ExecutiveData;

  // the 4 C's: exactly the four of FOUR_CS, in order, each named as Felipe named it (in both languages)
  d.proposal.four_cs.forEach((r, i) => {
    const want = FOUR_CS[i].name;
    if (!sameText(r.c, want)) {
      out.push({ path: `proposal.four_cs[${i}].c`, message: `must be "${want.en}" in English and "${want.es}" in Spanish (the ${i + 1}${['st', 'nd', 'rd', 'th'][i]} of the 4 C's, in Felipe's order); found "${r.c.en}" and "${r.c.es}"` });
    }
  });

  // the causes are non-overlapping branches weighted by size: the weights cannot add to more than the whole
  const total = d.pain.causes.reduce((sum, c) => sum + c.weight, 0);
  if (total > 100) out.push({ path: 'pain.causes', message: `the weights add to ${total} percent; non-overlapping causes add to at most 100` });

  // each action has an owner that is a role of the current situation
  d.proposal.actions.forEach((a, i) => {
    if (!d.situation.roles.some((r) => sameText(r.role, a.owner))) {
      out.push({ path: `proposal.actions[${i}].owner`, message: `must be one of the roles of the current situation (${d.situation.roles.map((r) => `"${r.role.en}"`).join(', ')}), written the same in both languages` });
    }
  });

  // the writing, field by field, in both languages
  for (const f of executiveTextFields(d)) {
    for (const lang of ['en', 'es'] as const) {
      for (const m of writingProblems(f.text[lang], f.sentences, f.minWords)) out.push({ path: `${f.path}.${lang}`, message: m });
    }
  }

  // sources: unique ids, every citation names one, none is left uncited, each a link (the floors keep a sub-tab to at most six sources)
  const ids = new Map<string, number>();
  d.sources.forEach((s, i) => {
    if (ids.has(s.id)) out.push({ path: `sources[${i}].id`, message: `"${s.id}" is already the id of sources[${ids.get(s.id)}]` });
    else ids.set(s.id, i);
    for (const lang of ['en', 'es'] as const) {
      for (const m of sourceTextProblems(s.title[lang])) out.push({ path: `sources[${i}].title.${lang}`, message: m });
      if (s.note) for (const m of sourceTextProblems(s.note[lang], 1)) out.push({ path: `sources[${i}].note.${lang}`, message: m });
    }
  });
  const cited = new Set<string>();
  for (const c of executiveCitations(d)) {
    if (!ids.has(c.source)) {
      out.push({ path: c.path, message: `"${c.source}" is not the id of any source (the ids are ${[...ids.keys()].join(', ')})` });
      continue;
    }
    cited.add(c.source);
  }
  d.sources.forEach((s, i) => {
    if (!cited.has(s.id)) out.push({ path: `sources[${i}].id`, message: `"${s.id}" is cited by no figure or claim; every source backs a figure or a claim` });
  });
  return out;
}

/** The data key of each sub-tab, in order. */
export const SECTION_PATHS = ['pain', 'context', 'situation', 'trends', 'proposal'] as const;

/**
 * The ONE definition of the sub-tabs of the view: how many there are, their ids, the key of their data and their titles
 * (problem-context-first.md, "The structure (decided 2026-10-13 from the research)"). The view renders one sub-tab per
 * entry; the gate keeps a copy in `gate/areas.mjs` (EXEC_SECTIONS) that a unit test holds equal. The rubric's labels and
 * questions are never printed.
 */
export const EXEC_SECTION_DEFS: ReadonlyArray<{ id: string; key: (typeof SECTION_PATHS)[number]; title: BiTextValue }> = [
  { id: 'pain', key: 'pain', title: { en: 'The pain', es: 'El problema' } },
  { id: 'context', key: 'context', title: { en: 'The context', es: 'El contexto' } },
  { id: 'situation', key: 'situation', title: { en: 'The current situation', es: 'La situación actual' } },
  { id: 'trends', key: 'trends', title: { en: 'The trends', es: 'Las tendencias' } },
  { id: 'proposal', key: 'proposal', title: { en: 'The proposal', es: 'La propuesta' } },
];
export const SECTION_TITLES: Array<BiTextValue> = EXEC_SECTION_DEFS.map((d) => d.title);

/** The onward links under the sources, worded as destinations (the technical view, the App). */
export const ONWARD_LINKS = {
  technical: { en: 'How the work explores this problem', es: 'Cómo explora el trabajo este problema' },
  app: { en: 'Open the App', es: 'Abrir la App' },
} as const;
