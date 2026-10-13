import schema from './executive.schema.json';

/**
 * The executive view standard (CAOS_MANAGE conventions/problem-context-first.md, Felipe 2026-10-12): the types of the
 * data file `content/executive.json`, its validator and its writing limits. The structure lives ONLY in
 * `executive.schema.json` (this module interprets it); the rules a schema cannot say (the limits, the 4 C's, the
 * sources by field) are here. `gate/areas.mjs` keeps the same limits for the rendered page; a unit test keeps them equal.
 */

export const EXECUTIVE_SCHEMA_VERSION = '2.0.0';

/**
 * The names of the 4 C's, in the order of the 4Cs Positioning section. EMPTY ON PURPOSE: the names, their order and their
 * place in the view are being redefined from research (the section structure comes in a follow-up of shell 0.13.0). While
 * it is empty `four_cs` must be absent from every data file and section 3 renders its declared pending state; once it
 * holds 4 names `four_cs` is required in that order.
 */
export const FOUR_CS: readonly string[] = [];

/** The writing limits (the same in both languages); `gate/areas.mjs` EXEC_LIMITS holds the same values. */
export const EXEC_LIMITS = {
  maxWords: 30,
  maxAnswerSentences: 2,
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

export interface BiTextValue {
  en: string;
  es: string;
}
export interface ExecutiveFigure {
  value: BiTextValue;
  unit: BiTextValue;
}
export interface ExecutiveOutcome {
  capability: BiTextValue;
  outcome: BiTextValue;
  proof: ExecutiveFigure & { statement: BiTextValue };
}
export interface ExecutiveIllustration {
  /** The SVG file (a path under the site root), or one per language. */
  file: string | BiTextValue;
  caption: BiTextValue;
}
export interface ExecutiveSource {
  field: string;
  /** The publication, in plain words. */
  title: BiTextValue;
  /** The page or document itself: an https link. */
  url: string;
  /** At most one sentence (for example a page number). */
  note?: BiTextValue;
}
export interface ExecutiveData {
  executive: BiTextValue;
  organisation: BiTextValue;
  initiative: BiTextValue;
  why_now: { figure: ExecutiveFigure; deadline: BiTextValue };
  vision: BiTextValue;
  outcomes: ExecutiveOutcome[];
  four_cs?: Array<{ c: BiTextValue; exec_problem: BiTextValue }>;
  dialogue: Array<{ question: BiTextValue; answer: BiTextValue }>;
  illustrations: { initiative: ExecutiveIllustration; problem: ExecutiveIllustration; solution: ExecutiveIllustration };
  sources: ExecutiveSource[];
}

export interface ExecutiveProblem {
  /** The field path, for example `outcomes[1].proof.unit` (empty for the document itself). */
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

/** Validates `value` against `node`; the supported keywords are type, properties, required, additionalProperties: false, items, minItems, maxItems, minLength, pattern (with x-pattern-message), anyOf and $ref. */
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
  if (node.type && t !== node.type) {
    out.push({ path, message: `must be ${node.type === 'object' ? 'an object' : node.type === 'array' ? 'an array' : `a ${node.type}`}, not ${t === 'undefined' ? 'missing' : t === 'array' ? 'an array' : t === 'object' ? 'an object' : `a ${t}`}` });
    return;
  }
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
/** Every text field with its path and what it may hold; `sources` have their own rules (`sourceTextProblems`: a source may cite). */
function textFields(d: ExecutiveData): Array<{ path: string; text: BiTextValue; sentences?: number }> {
  const out: Array<{ path: string; text: BiTextValue; sentences?: number }> = [
    { path: 'executive', text: d.executive },
    { path: 'organisation', text: d.organisation },
    { path: 'initiative', text: d.initiative, sentences: 1 },
    { path: 'why_now.figure.value', text: d.why_now.figure.value },
    { path: 'why_now.figure.unit', text: d.why_now.figure.unit },
    { path: 'why_now.deadline', text: d.why_now.deadline },
    { path: 'vision', text: d.vision, sentences: 1 },
  ];
  d.outcomes.forEach((o, i) => {
    out.push({ path: `outcomes[${i}].capability`, text: o.capability }, { path: `outcomes[${i}].outcome`, text: o.outcome });
    out.push({ path: `outcomes[${i}].proof.value`, text: o.proof.value }, { path: `outcomes[${i}].proof.unit`, text: o.proof.unit }, { path: `outcomes[${i}].proof.statement`, text: o.proof.statement, sentences: 1 });
  });
  (d.four_cs ?? []).forEach((r, i) => out.push({ path: `four_cs[${i}].c`, text: r.c }, { path: `four_cs[${i}].exec_problem`, text: r.exec_problem, sentences: 1 }));
  d.dialogue.forEach((q, i) => out.push({ path: `dialogue[${i}].question`, text: q.question }, { path: `dialogue[${i}].answer`, text: q.answer, sentences: EXEC_LIMITS.maxAnswerSentences }));
  for (const name of ['initiative', 'problem', 'solution'] as const) out.push({ path: `illustrations.${name}.caption`, text: d.illustrations[name].caption, sentences: 1 });
  return out;
}

/** The fields that carry a figure and so need a source, in the order they appear in the view. */
export function figureFields(d: Pick<ExecutiveData, 'outcomes'>): string[] {
  return ['why_now.figure', ...d.outcomes.map((_, i) => `outcomes[${i}].proof`)];
}

/** The problems with the writing of one text, one per rule it breaks; used by the validator and by the tests of the gate. */
export function writingProblems(text: string, maxSentences?: number): string[] {
  const out: string[] = [];
  const sentences = sentencesOf(text);
  for (const s of sentences) {
    const n = wordsIn(s);
    if (n > EXEC_LIMITS.maxWords) out.push(`a sentence of ${n} words; the limit is ${EXEC_LIMITS.maxWords}`);
  }
  if (maxSentences !== undefined && sentences.length > maxSentences) {
    out.push(maxSentences === 1 ? `must be one sentence, has ${sentences.length}` : `has ${sentences.length} sentences; the limit is ${maxSentences}`);
  }
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

/**
 * Validates a product's `content/executive.json` against `executive.schema.json` and the rules on top of it. Pure; an
 * empty array means valid. `fourCs` is the set of names the 4Cs Positioning section expects (default `FOUR_CS`).
 */
export function validateExecutive(data: unknown, opts: { fourCs?: readonly string[] } = {}): ExecutiveProblem[] {
  const fourCs = opts.fourCs ?? FOUR_CS;
  const out: ExecutiveProblem[] = [];
  const root = { ...ROOT, required: (ROOT.required as string[]).filter((k) => k !== 'four_cs') };
  check(data, root, '', out);
  const structural = out.length;
  const d = data as Partial<ExecutiveData> | null;
  // the 4 C's: absent until named, then required in the owner's order
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    if (fourCs.length === 0) {
      if ('four_cs' in d) out.push({ path: 'four_cs', message: "is not allowed yet: the 4 C's are not named (FOUR_CS is empty), so the view shows section 3 as pending" });
    } else if (!('four_cs' in d)) {
      out.push({ path: 'four_cs', message: `is required: the 4 C's are named (${fourCs.join(', ')})` });
    } else {
      const rows = Array.isArray(d.four_cs) ? d.four_cs : [];
      if (rows.length === 4) {
        rows.forEach((r, i) => {
          if (r?.c && r.c.en !== fourCs[i]) out.push({ path: `four_cs[${i}].c`, message: `must be "${fourCs[i]}" (the ${i + 1}${['st', 'nd', 'rd', 'th'][i]} C, in the owner's order), not "${r.c.en}"` });
        });
      }
    }
  }
  // the rules below read the structure: run them only on a structurally sound file, so a typo never throws
  if (structural > 0) return out;
  if (!d || typeof d !== 'object') return out;
  const full = d as ExecutiveData;
  for (const f of textFields(full)) {
    for (const lang of ['en', 'es'] as const) {
      const text = f.text?.[lang];
      if (typeof text !== 'string') continue;
      for (const m of writingProblems(text, f.sentences)) out.push({ path: `${f.path}.${lang}`, message: m });
    }
  }
  // every figure has one source, by field path, and a source names a field that exists
  const wanted = figureFields(full);
  const seen = new Set<string>();
  full.sources.forEach((s, i) => {
    if (!wanted.includes(s.field)) out.push({ path: `sources[${i}].field`, message: `"${s.field}" is not a figure of this view (the figures are ${wanted.join(', ')})` });
    else if (seen.has(s.field)) out.push({ path: `sources[${i}].field`, message: `"${s.field}" already has a source` });
    seen.add(s.field);
  });
  // a source is a link: its title and note stay within the writing limits and cite no file
  full.sources.forEach((src, i) => {
    for (const lang of ['en', 'es'] as const) {
      for (const m of sourceTextProblems(src.title[lang])) out.push({ path: `sources[${i}].title.${lang}`, message: m });
      if (src.note) for (const m of sourceTextProblems(src.note[lang], 1)) out.push({ path: `sources[${i}].note.${lang}`, message: m });
    }
  });
  const missing = wanted.filter((f) => !seen.has(f));
  if (missing.length > 0) out.push({ path: 'sources', message: `no source for ${missing.join(', ')}` });
  return out;
}

/**
 * The ONE definition of the sections of the view: how many there are, their ids, their titles and the rubric question under
 * each (Felipe's rubric, verbatim). The view renders one sub-tab per entry, the gate reads the same list (`gate/areas.mjs`
 * EXEC_SECTIONS keeps a copy that a unit test holds equal). The section structure is being redefined from research: change
 * the list here, and only here, when it is.
 */
export const EXEC_SECTION_DEFS: ReadonlyArray<{ id: string; title: BiTextValue; question: BiTextValue }> = [
  { id: 'industry', title: { en: 'Industry & Exec Tailoring', es: 'Industria y foco ejecutivo' }, question: { en: 'Built for a C-suite exec?', es: '¿Pensado para un ejecutivo de primer nivel?' } },
  { id: 'transformation', title: { en: 'AI Transformation Story', es: 'Historia de transformación con IA' }, question: { en: 'Outcomes, not a feature tour', es: 'Resultados, no un recorrido de funciones' } },
  { id: 'positioning', title: { en: '4Cs Positioning', es: 'Posicionamiento 4C' }, question: { en: 'Value story, not features dump', es: 'Historia de valor, no lista de funciones' } },
  { id: 'credibility', title: { en: 'Delivery & Credibility', es: 'Entrega y credibilidad' }, question: { en: 'Trust them in front of a CxO?', es: '¿Confiaría en ellos frente a un ejecutivo?' } },
];
export const SECTION_TITLES: Array<{ en: string; es: string }> = EXEC_SECTION_DEFS.map((d) => d.title);
/** The rubric question under each title. */
export const SECTION_QUESTIONS: Array<{ en: string; es: string }> = EXEC_SECTION_DEFS.map((d) => d.question);

/** The declared state of section 3 while FOUR_CS is empty. */
export const PENDING_FOUR_CS: BiTextValue = {
  en: "Pending: the 4 C's are defined by the product owner",
  es: 'Pendiente: las 4 C las define el responsable del producto',
};
