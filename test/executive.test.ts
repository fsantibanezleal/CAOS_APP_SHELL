import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  EXEC_FLOORS as GATE_FLOORS,
  EXEC_FOUR_CS as GATE_FOUR_CS,
  EXEC_LIMITS as GATE_LIMITS,
  EXEC_LINKS as GATE_LINKS,
  EXEC_SECTIONS as GATE_SECTIONS,
  execMinWords,
  execSentenceLimit,
  execSourceTextProblems as gateSourceProblems,
} from '../gate/areas.mjs';
import {
  EXEC_FLOORS,
  EXEC_LIMITS,
  EXEC_SECTION_DEFS,
  EXECUTIVE_SCHEMA_VERSION,
  FOUR_CS,
  ONWARD_LINKS,
  executiveCitations,
  executiveTextFields,
  sentencesOf,
  sourceOrder,
  sourceTextProblems,
  validateExecutive,
  wordsIn,
} from '../src/content/executive.ts';
import schema from '../src/content/executive.schema.json' with { type: 'json' };

/** The executive view data file (CAOS_MANAGE conventions/problem-context-first.md; docs/06_executive-view.md). */

const fixture = JSON.parse(readFileSync(new URL('./gate-fixture/executive/executive.json', import.meta.url), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(fixture));
const paths = (data: unknown) => validateExecutive(data).map((p) => p.path);
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const get = (d: any, path: string) => path.split('.').reduce((o, k) => o[k], d);

test('the schema accepts the fixture and the validator reports no problem', () => {
  assert.equal(EXECUTIVE_SCHEMA_VERSION, '2.0.0');
  assert.match(schema.title, /version 2\.0\.0/);
  assert.equal(schema.$id.endsWith('executive.schema.json'), true);
  assert.deepEqual(validateExecutive(fixture), []);
  // the 0.12.0 fields are gone
  for (const old of ['executive', 'organisation', 'initiative', 'why_now', 'vision', 'outcomes', 'four_cs', 'dialogue']) {
    assert.ok(!(old in schema.properties), `${old} is not a top-level field any more`);
  }
  assert.deepEqual(Object.keys(schema.properties), ['title', 'key_statement', 'headline_figures', 'pain', 'context', 'situation', 'trends', 'proposal', 'illustrations', 'sources']);
  assert.deepEqual(Object.keys(schema.properties.illustrations.properties), ['pain', 'situation', 'proposal']);
});

test('each defect of the data file fails with the path of its field', () => {
  const plants: Array<[string, (d: any) => void, string]> = [
    ['a missing title', (d) => delete d.title, 'title'],
    ['a missing key statement', (d) => delete d.key_statement, 'key_statement'],
    ['the 0.12.0 executive field', (d) => (d.executive = d.title), 'executive'],
    ['the 0.12.0 why_now field', (d) => (d.why_now = {}), 'why_now'],
    ['a missing pain', (d) => delete d.pain, 'pain'],
    ['a missing key message', (d) => delete d.context.key_message, 'context.key_message'],
    ['an extra field', (d) => (d.tagline = { en: 'x', es: 'x' }), 'tagline'],
    ['an extra field in a nested object', (d) => (d.pain.bearers[0].extra = 'x'), 'pain.bearers[0].extra'],
    ['a text without its Spanish', (d) => delete d.pain.key_message.es, 'pain.key_message.es'],
    ['an empty English text', (d) => (d.title.en = ''), 'title.en'],
    ['a bearer without a measure', (d) => delete d.pain.bearers[1].measure, 'pain.bearers[1].measure'],
    ['a force with an unknown direction', (d) => (d.context.forces[0].direction = 'sideways'), 'context.forces[0].direction'],
    ['a trend with an unknown kind', (d) => (d.trends.items[0].kind = 'fashion'), 'trends.items[0].kind'],
    ['a trend with an unknown horizon', (d) => (d.trends.items[1].horizon = 'next_week'), 'trends.items[1].horizon'],
    ['a trend with an unknown confidence', (d) => (d.trends.items[2].confidence = 'certain'), 'trends.items[2].confidence'],
    ['a cause weight as text', (d) => (d.pain.causes[0].weight = 'a lot'), 'pain.causes[0].weight'],
    ['a cause weight with a decimal', (d) => (d.pain.causes[0].weight = 12.5), 'pain.causes[0].weight'],
    ['a cause weight of zero', (d) => (d.pain.causes[0].weight = 0), 'pain.causes[0].weight'],
    ['a trend without a signal source', (d) => delete d.trends.items[0].signal.source, 'trends.items[0].signal.source'],
    ['a status figure without a date', (d) => delete d.situation.status.date, 'situation.status.date'],
    ['an action without a check', (d) => delete d.proposal.actions[0].check, 'proposal.actions[0].check'],
    ['a missing illustration', (d) => delete d.illustrations.proposal, 'illustrations.proposal'],
    ['the 0.12.0 illustration names', (d) => (d.illustrations.initiative = d.illustrations.pain), 'illustrations.initiative'],
    ['an extra illustration', (d) => (d.illustrations.fourth = d.illustrations.pain), 'illustrations.fourth'],
    ['an illustration without a caption', (d) => delete d.illustrations.situation.caption, 'illustrations.situation.caption'],
    ['an illustration file as a number', (d) => (d.illustrations.pain.file = 4), 'illustrations.pain.file'],
    ['a headline figure without a unit', (d) => delete d.headline_figures[0].unit, 'headline_figures[0].unit'],
  ];
  for (const [name, mutate, path] of plants) {
    const d = clone();
    mutate(d);
    const found = paths(d);
    assert.ok(found.includes(path), `${name}: expected a problem at "${path}", got ${JSON.stringify(found)}`);
  }
  assert.ok(paths(null).includes(''), 'not an object');
  // the message names the rule as well as the path
  const two = clone();
  two.pain.bearers.pop();
  two.pain.bearers.pop();
  const m = validateExecutive(two).find((p) => p.path === 'pain.bearers');
  assert.match(m?.message ?? '', /at least 3/);
  // one illustration file per language is allowed
  const perLang = clone();
  perLang.illustrations.pain.file = { en: 'a-en.svg', es: 'a-es.svg' };
  assert.deepEqual(validateExecutive(perLang), []);
});

test('every floor of the structure holds: too few rows and too many rows fail, in the schema and in the gate', () => {
  const rowsAt = (d: any, key: string) => get(d, key);
  // the same counts in the validator, the schema and the gate
  const fromSchema: Record<string, [number, number]> = {};
  const walk = (node: any, key: string) => {
    const resolved = node.$ref ? (schema.$defs as any)[node.$ref.replace('#/$defs/', '')] : node;
    if (resolved.type === 'array' && resolved.minItems !== undefined && key !== 'sources') fromSchema[key] = [resolved.minItems, resolved.maxItems];
    if (resolved.type === 'object') for (const [k, v] of Object.entries(resolved.properties ?? {})) walk(v, key ? `${key}.${k}` : k);
  };
  walk(schema, '');
  for (const key of ['pain.bearers', 'pain.causes']) assert.ok(key in fromSchema, key);
  // trends.items etc. are nested under objects: compare every floor
  for (const [key, [min, max]] of Object.entries(EXEC_FLOORS)) {
    assert.deepEqual(fromSchema[key], [min, max], `schema floor of ${key}`);
    assert.deepEqual(GATE_FLOORS[key as keyof typeof GATE_FLOORS], [min, max], `gate floor of ${key}`);
  }
  assert.deepEqual(Object.keys(GATE_FLOORS), Object.keys(EXEC_FLOORS));
  assert.deepEqual(Object.keys(fromSchema).sort(), Object.keys(EXEC_FLOORS).sort(), 'every array of the schema has a floor');
  for (const [key, [min, max]] of Object.entries(EXEC_FLOORS)) {
    const below = clone();
    const listBelow = rowsAt(below, key);
    listBelow.length = min - 1;
    if (min - 1 === 0 && key !== 'proposal.four_cs') assert.ok(paths(below).includes(key), `${key}: no rows`);
    else assert.ok(paths(below).includes(key), `${key}: ${min - 1} rows`);
    if (max < 8) {
      const above = clone();
      const list = rowsAt(above, key);
      while (list.length <= max) list.push(JSON.parse(JSON.stringify(list[0])));
      assert.ok(paths(above).includes(key), `${key}: ${max + 1} rows`);
    }
  }
  // the named floors of the brief
  const msg = (mutate: (d: any) => void, key: string) => {
    const d = clone();
    mutate(d);
    return validateExecutive(d).find((p) => p.path === key)?.message ?? '';
  };
  assert.match(msg((d) => d.pain.paragraphs.pop(), 'pain.paragraphs'), /at least 2/);
  assert.match(msg((d) => (d.pain.figures.length = 1), 'pain.figures'), /at least 2/);
  assert.match(msg((d) => (d.context.evidence.length = 0), 'context.evidence'), /at least 1/);
  assert.match(msg((d) => (d.headline_figures.length = 1), 'headline_figures'), /at least 2/);
  assert.match(msg((d) => d.headline_figures.push(d.headline_figures[0]), 'headline_figures'), /at most 3/);
  assert.match(msg((d) => (d.proposal.actions.length = 2), 'proposal.actions'), /at least 3/);
  assert.match(msg((d) => (d.proposal.risks.length = 0), 'proposal.risks'), /at least 1/);
  assert.match(msg((d) => (d.proposal.unknowns.length = 0), 'proposal.unknowns'), /at least 1/);
  assert.match(msg((d) => (d.situation.roles.length = 2), 'situation.roles'), /at least 3/);
  assert.match(msg((d) => (d.situation.state_of_the_art.length = 2), 'situation.state_of_the_art'), /at least 3/);
  assert.match(msg((d) => (d.trends.items.length = 2), 'trends.items'), /at least 3/);
  assert.match(msg((d) => (d.context.forces.length = 2), 'context.forces'), /at least 3/);
  assert.match(msg((d) => (d.pain.causes.length = 2), 'pain.causes'), /at least 3/);
  // an optional handoff line
  const noHandoff = clone();
  delete noHandoff.proposal.handoff;
  assert.deepEqual(validateExecutive(noHandoff), []);
});

test('the writing limits hold in both languages: sentence length, one-sentence fields, paragraph length, equations, citations', () => {
  for (const lang of ['en', 'es'] as const) {
    const long = clone();
    long.pain.key_message[lang] = `${words(31)}.`;
    assert.ok(validateExecutive(long).some((p) => p.path === `pain.key_message.${lang}` && /31 words/.test(p.message)), `${lang}: a sentence of 31 words`);
    const ok = clone();
    ok.pain.key_message[lang] = `${words(30)}.`;
    assert.deepEqual(validateExecutive(ok), [], `${lang}: 30 words is the limit`);

    const two = clone();
    two.trends.key_message[lang] = 'First part. Second part.';
    assert.ok(validateExecutive(two).some((p) => p.path === `trends.key_message.${lang}` && /one sentence/.test(p.message)), `${lang}: a key message is one sentence`);
    const statement = clone();
    statement.key_statement[lang] = 'One fact. Two facts. Three facts.';
    assert.ok(validateExecutive(statement).some((p) => p.path === `key_statement.${lang}` && /3 sentences/.test(p.message)), `${lang}: the key statement allows two`);
    const interaction = clone();
    interaction.situation.interaction[lang] = 'First. Second.';
    assert.ok(paths(interaction).includes(`situation.interaction.${lang}`));

    const short = clone();
    short.pain.paragraphs[0][lang] = 'Too short to be a paragraph of substance.';
    assert.ok(validateExecutive(short).some((p) => p.path === `pain.paragraphs[0].${lang}` && /at least 25/.test(p.message)), `${lang}: a one-line paragraph`);
    const shortProposal = clone();
    shortProposal.proposal.paragraphs[0][lang] = 'The title again.';
    assert.ok(paths(shortProposal).includes(`proposal.paragraphs[0].${lang}`));

    for (const bad of ['The cost is $5 million.', 'The cost is \\(x\\).', 'The cost is \\[x\\].', 'It is \\frac{a}{b}.', 'The loss fell (Source: the bank).', 'The loss fell [1].', 'The loss fell (ECB report).', 'The loss fell (Smith et al., 2019).']) {
      const d = clone();
      d.pain.bearers[0].cost[lang] = bad;
      assert.ok(validateExecutive(d).some((p) => p.path === `pain.bearers[0].cost.${lang}`), `${lang}: "${bad}" must fail`);
    }
    // a decimal is not a sentence end, and a source may carry a citation
    const dec = clone();
    dec.pain.bearers[0].cost[lang] = 'Shift calls fell by 3.5 percent in the pilot ward';
    dec.sources[0].note[lang] = 'Smith (2019), table 3.';
    assert.deepEqual(validateExecutive(dec), [], `${lang}: decimals and sources`);
  }
  assert.deepEqual(sentencesOf('One two. Three four? Five! Six 3.5 seven'), ['One two.', 'Three four?', 'Five!', 'Six 3.5 seven']);
  assert.equal(wordsIn('a, b - c 3.5'), 4);
});

test("the 4 C's are Felipe's four, in his order, with his names and definitions in both languages", () => {
  // Felipe, 2026-10-13, verbatim
  const want = [
    ['Choice', 'Elección', 'flexibility across proprietary and open models.', 'flexibilidad entre modelos propietarios y abiertos.'],
    ['Context', 'Contexto', 'AI grounded in business meaning, so decisions are accurate.', 'IA anclada en el significado del negocio, para que las decisiones sean exactas.'],
    ['Cost', 'Costo', 'visibility of what the AI spends.', 'visibilidad de lo que gasta la IA.'],
    ['Control', 'Control', 'one governance over data, models and agents.', 'una sola gobernanza sobre datos, modelos y agentes.'],
  ];
  assert.equal(FOUR_CS.length, 4);
  FOUR_CS.forEach((c, i) => {
    assert.deepEqual([c.name.en, c.name.es, c.definition.en, c.definition.es], want[i]);
  });
});

test("the 4 C's are required in the proposal: exactly four, named and ordered as Felipe gave them, each applied", () => {
  const missing = clone();
  delete missing.proposal.four_cs;
  assert.ok(paths(missing).includes('proposal.four_cs'), 'a missing four_cs');
  const three = clone();
  three.proposal.four_cs.pop();
  assert.ok(paths(three).includes('proposal.four_cs'), 'three Cs');
  const five = clone();
  five.proposal.four_cs.push(five.proposal.four_cs[0]);
  assert.ok(paths(five).includes('proposal.four_cs'), 'five Cs');
  const renamed = clone();
  renamed.proposal.four_cs[1].c.en = 'Contexts';
  assert.ok(paths(renamed).includes('proposal.four_cs[1].c'), 'a renamed C (English)');
  const renamedEs = clone();
  renamedEs.proposal.four_cs[2].c.es = 'Coste';
  assert.ok(paths(renamedEs).includes('proposal.four_cs[2].c'), 'a renamed C (Spanish)');
  const reordered = clone();
  [reordered.proposal.four_cs[0], reordered.proposal.four_cs[1]] = [reordered.proposal.four_cs[1], reordered.proposal.four_cs[0]];
  const found = paths(reordered);
  assert.ok(found.includes('proposal.four_cs[0].c') && found.includes('proposal.four_cs[1].c'), 'reordered Cs');
  const noApplies = clone();
  delete noApplies.proposal.four_cs[3].applies;
  assert.ok(paths(noApplies).includes('proposal.four_cs[3].applies'), 'a C without what it means for the proposal');
  const long = clone();
  long.proposal.four_cs[0].applies.en = 'First sentence. Second sentence.';
  assert.ok(paths(long).includes('proposal.four_cs[0].applies.en'), 'what a C means is one sentence');
});

test('the causes are non-overlapping branches: their weights add to at most 100', () => {
  const over = clone();
  over.pain.causes.forEach((c: any) => (c.weight = 40));
  assert.match(validateExecutive(over).find((p) => p.path === 'pain.causes')?.message ?? '', /add to 120 percent/);
  const exact = clone();
  exact.pain.causes.forEach((c: any, i: number) => (c.weight = [50, 30, 20][i]));
  assert.deepEqual(validateExecutive(exact), []);
});

test('every action has an owner that is a role of the current situation, written as there', () => {
  const stranger = clone();
  stranger.proposal.actions[0].owner = { en: 'The minister', es: 'La ministra' };
  assert.match(validateExecutive(stranger).find((p) => p.path === 'proposal.actions[0].owner')?.message ?? '', /roles of the current situation/);
  const oneLanguage = clone();
  oneLanguage.proposal.actions[1].owner.es = 'Otra jefatura';
  assert.ok(paths(oneLanguage).includes('proposal.actions[1].owner'));
  const empty = clone();
  delete empty.proposal.actions[2].owner;
  assert.ok(paths(empty).includes('proposal.actions[2].owner'));
});

test('every figure and claim cites a source by id and every source is cited', () => {
  const unknown = clone();
  unknown.pain.figures[0].source = 'nothing';
  assert.match(validateExecutive(unknown).find((p) => p.path === 'pain.figures[0].source')?.message ?? '', /not the id of any source/);
  for (const path of ['headline_figures[1]', 'pain.figures[1]', 'context.evidence[0]', 'situation.state_of_the_art[2]', 'situation.status', 'trends.items[0].signal']) {
    const d = clone();
    const holder = path.split('.').reduce((o: any, k) => (k.includes('[') ? o[k.slice(0, k.indexOf('['))][Number(/\[(\d+)\]/.exec(k)![1])] : o[k]), d);
    delete holder.source;
    assert.ok(paths(d).includes(`${path}.source`), `${path}: a claim without a source`);
  }
  const uncited = clone();
  uncited.sources.push({ id: 'spare', title: { en: 'A spare source', es: 'Una fuente de repuesto' }, url: 'https://example.org/spare' });
  assert.match(validateExecutive(uncited).find((p) => p.path === 'sources[7].id')?.message ?? '', /cited by no figure/);
  const twice = clone();
  twice.sources.push({ ...twice.sources[0] });
  assert.ok(paths(twice).includes('sources[7].id'), 'a duplicate id');
  // the notes are numbered in the order of first use, across the landing and the sub-tabs
  assert.deepEqual(sourceOrder(fixture), ['admissions', 'cancellations', 'notice', 'overtime', 'target', 'practice', 'forecast']);
  assert.deepEqual(executiveCitations(fixture).map((c) => c.tab), [0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 4, 4, 4]);
});

test('a source is a link: the url is required and is https only', () => {
  const noUrl = clone();
  delete noUrl.sources[0].url;
  assert.ok(paths(noUrl).includes('sources[0].url'), 'no url');
  const old = clone();
  old.sources[1] = { id: old.sources[1].id, source: { en: 'A report, section 2.', es: 'Un informe, sección 2.' } };
  const oldPaths = paths(old);
  assert.ok(oldPaths.includes('sources[1].title') && oldPaths.includes('sources[1].url') && oldPaths.includes('sources[1].source'), `the prose form of 0.12.0 fails: ${oldPaths}`);
  for (const bad of ['http://example.org/report', 'ftp://example.org/report', 'example.org/report', 'file:///report.pdf', 'javascript:alert(1)', 'https://', 'https:// spaced', '']) {
    const d = clone();
    d.sources[0].url = bad;
    assert.ok(paths(d).includes('sources[0].url'), `"${bad}" must fail`);
  }
  const num = clone();
  num.sources[0].url = 7;
  assert.ok(paths(num).includes('sources[0].url'), 'a url as a number');
  const noTitle = clone();
  delete noTitle.sources[2].title.es;
  assert.ok(paths(noTitle).includes('sources[2].title.es'));
  const extra = clone();
  extra.sources[0].page = 4;
  assert.ok(paths(extra).includes('sources[0].page'), 'nothing outside the fields');
  const badId = clone();
  badId.sources[0].id = 'Not An Id';
  assert.ok(paths(badId).includes('sources[0].id'));
  const noNote = clone();
  delete noNote.sources[0].note;
  assert.deepEqual(validateExecutive(noNote), [], 'the note is optional');
  const ok = clone();
  ok.sources[0].url = 'https://www.cmfchile.cl/portal/principal/613/w3-channel.html';
  assert.deepEqual(validateExecutive(ok), []);
});

test('a source title and note stay within the writing limits and never cite a file in place of the link', () => {
  for (const lang of ['en', 'es'] as const) {
    for (const bad of ['Report file 2026080375', 'Informe archivo 2026080375', 'file 7', 'informe-estabilidad.pdf', 'Published on 3 August 2026']) {
      for (const field of ['title', 'note'] as const) {
        const d = clone();
        d.sources[0][field][lang] = bad;
        assert.ok(paths(d).includes(`sources[0].${field}.${lang}`), `${lang} ${field}: "${bad}" must fail`);
      }
    }
    const long = clone();
    long.sources[0].title[lang] = `${words(31)}.`;
    assert.ok(validateExecutive(long).some((p) => p.path === `sources[0].title.${lang}` && /31 words/.test(p.message)), `${lang}: a title of 31 words`);
    const two = clone();
    two.sources[0].note[lang] = 'Page 4. Table 2.';
    assert.ok(validateExecutive(two).some((p) => p.path === `sources[0].note.${lang}` && /one sentence/.test(p.message)), `${lang}: a note of two sentences`);
    const ok = clone();
    ok.sources[0].note[lang] = 'Page 4, table 2.';
    ok.sources[0].title[lang] = 'Financial stability report (2026), first half';
    assert.deepEqual(validateExecutive(ok), [], `${lang}: a page number and a year in the title are fine`);
  }
  // a .pdf name is accepted only beside a link written out in the text
  assert.deepEqual(sourceTextProblems('See https://example.org/a.pdf'), []);
  assert.equal(sourceTextProblems('a.pdf').length, 1);
});

test('promotional or client-bound wording fails in every text field, in both languages', () => {
  const samples: Array<[string, 'en' | 'es', string]> = [
    ['our client', 'en', 'Our client reduces its staffing cost.'],
    ['nuestro cliente', 'es', 'Nuestro cliente reduce su costo de dotación.'],
    ['contact us', 'en', 'Contact us to see the ward forecast.'],
    ['contáctenos', 'es', 'Contáctenos para ver el pronóstico por sala.'],
    ['buy', 'en', 'Buy the forecast before winter.'],
    ['comprar', 'es', 'Hay que comprar el pronóstico antes del invierno.'],
    ['price', 'en', 'The price falls as wards join.'],
    ['precio', 'es', 'El precio baja a medida que se suman salas.'],
    ['offer', 'en', 'The offer ends in December.'],
    ['oferta', 'es', 'La oferta termina en diciembre.'],
  ];
  const fields: Array<[string, (d: any, lang: 'en' | 'es', text: string) => void]> = [
    ['title', (d, l, t) => (d.title[l] = t)],
    ['key_statement', (d, l, t) => (d.key_statement[l] = t)],
    ['headline_figures[0].heading', (d, l, t) => (d.headline_figures[0].heading[l] = t)],
    ['pain.key_message', (d, l, t) => (d.pain.key_message[l] = t)],
    ['pain.bearers[2].cost', (d, l, t) => (d.pain.bearers[2].cost[l] = t)],
    ['context.setting', (d, l, t) => (d.context.setting[l] = t)],
    ['situation.state_of_the_art[1].achieves', (d, l, t) => (d.situation.state_of_the_art[1].achieves[l] = t)],
    ['trends.items[2].effect', (d, l, t) => (d.trends.items[2].effect[l] = t)],
    ['proposal.four_cs[2].applies', (d, l, t) => (d.proposal.four_cs[2].applies[l] = t)],
    ['proposal.actions[0].check', (d, l, t) => (d.proposal.actions[0].check[l] = t)],
    ['proposal.risks[1]', (d, l, t) => (d.proposal.risks[1][l] = t)],
  ];
  for (const [word, lang, text] of samples) {
    for (const [path, set] of fields) {
      const d = clone();
      set(d, lang, text);
      assert.ok(validateExecutive(d).some((p) => p.path === `${path}.${lang}` && /promotional or client-bound/.test(p.message)), `${path}.${lang}: "${word}" must fail`);
    }
    // case does not matter
    const upper = clone();
    upper.pain.key_message[lang] = text.toUpperCase();
    assert.ok(validateExecutive(upper).some((p) => /promotional/.test(p.message)), `${word}: upper case`);
  }
  const clean = clone();
  clean.pain.key_message.en = 'Pricing studies, offered services and a bypass stay out of scope.';
  assert.deepEqual(validateExecutive(clean).filter((p) => /promotional/.test(p.message)), [], 'whole words only');
});

test('the sub-tabs, the links and the four Cs of the gate are those of the validator', () => {
  assert.equal(EXEC_SECTION_DEFS.length, 5);
  assert.deepEqual(EXEC_SECTION_DEFS.map((d) => d.title.en), ['The pain', 'The context', 'The current situation', 'The trends', 'The proposal']);
  assert.deepEqual(EXEC_SECTION_DEFS.map((d) => d.title.es), ['El problema', 'El contexto', 'La situación actual', 'Las tendencias', 'La propuesta']);
  assert.deepEqual(GATE_SECTIONS, EXEC_SECTION_DEFS.map((d) => ({ title: d.title })));
  assert.equal(new Set(EXEC_SECTION_DEFS.map((d) => d.id)).size, EXEC_SECTION_DEFS.length, 'unique tab ids');
  assert.deepEqual(GATE_FOUR_CS, FOUR_CS);
  assert.deepEqual(GATE_LINKS, ONWARD_LINKS);
  assert.deepEqual(ONWARD_LINKS.technical, { en: 'How the work explores this problem', es: 'Cómo explora el trabajo este problema' });
  assert.deepEqual(ONWARD_LINKS.app, { en: 'Open the App', es: 'Abrir la App' });
});

test('the limits of the gate and those of the validator are the same', () => {
  assert.deepEqual(GATE_LIMITS, EXEC_LIMITS);
  assert.equal(EXEC_LIMITS.maxWords, 30);
  assert.equal(EXEC_LIMITS.minParagraphWords, 25);
  // the gate's copy of the source-text rules judges the same samples the same way
  for (const sample of ['Report file 2026080375', 'archivo 12', 'a.pdf', 'See https://example.org/a.pdf', 'Published on 3 May', 'Page 4, table 2.', `${words(31)}.`]) {
    assert.deepEqual(gateSourceProblems(sample, 1), sourceTextProblems(sample, 1), sample);
  }
  // gate/inpage.mjs is serialised into the page and cannot import: its label floor is a literal that must equal the table's
  const inpage = readFileSync(new URL('../gate/inpage.mjs', import.meta.url), 'utf8');
  assert.equal(Number(/const EXEC_MIN_LABEL_PX = (\d+);/.exec(inpage)?.[1]), EXEC_LIMITS.minLabelPx);
  // the sentence and word limits the gate applies to a rendered field are the validator's for every field of the fixture
  for (const f of executiveTextFields(fixture)) {
    assert.equal(execSentenceLimit(f.path), f.sentences, `sentence limit of ${f.path}`);
    assert.equal(execMinWords(f.path), f.minWords, `minimum words of ${f.path}`);
  }
});
