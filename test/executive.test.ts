import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EXEC_LIMITS as GATE_LIMITS, EXEC_SECTIONS as GATE_SECTIONS, execSourceTextProblems as gateSourceProblems } from '../gate/areas.mjs';
import { EXEC_LIMITS, EXEC_SECTION_DEFS, EXECUTIVE_SCHEMA_VERSION, FOUR_CS, sentencesOf, sourceTextProblems, validateExecutive, wordsIn } from '../src/content/executive.ts';
import schema from '../src/content/executive.schema.json' with { type: 'json' };

/** The executive view data file (CAOS_MANAGE conventions/problem-context-first.md; docs/06_executive-view.md). */

const fixture = JSON.parse(readFileSync(new URL('./gate-fixture/executive/executive.json', import.meta.url), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(fixture));
const paths = (data: unknown, fourCs: readonly string[] = []) => validateExecutive(data, { fourCs }).map((p) => p.path);
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

test('the schema accepts the fixture and the validator reports no problem', () => {
  assert.equal(EXECUTIVE_SCHEMA_VERSION, '2.0.0');
  assert.match(schema.title, /version 2\.0\.0/);
  assert.equal(schema.$id.endsWith('executive.schema.json'), true);
  assert.deepEqual(validateExecutive(fixture), []);
  assert.deepEqual(FOUR_CS, [], "the 4 C's are being redefined from research (follow-up of 0.13.0)");
});

test('each defect of the data file fails with the path of its field', () => {
  const plants: Array<[string, (d: any) => void, string]> = [
    ['a second executive', (d) => (d.executive = [d.executive, d.executive]), 'executive'],
    ['a missing why-now figure', (d) => delete d.why_now.figure, 'why_now.figure'],
    ['a missing deadline', (d) => delete d.why_now.deadline, 'why_now.deadline'],
    ['two outcomes', (d) => d.outcomes.splice(2, 1), 'outcomes'],
    ['six outcomes', (d) => (d.outcomes = Array.from({ length: 6 }, () => d.outcomes[0])), 'outcomes'],
    ['two dialogue pairs', (d) => (d.dialogue.length = 2), 'dialogue'],
    ['six dialogue pairs', (d) => (d.dialogue = Array.from({ length: 6 }, () => d.dialogue[0])), 'dialogue'],
    ['an extra field', (d) => (d.tagline = { en: 'x', es: 'x' }), 'tagline'],
    ['an extra field in a nested object', (d) => (d.why_now.figure.extra = 'x'), 'why_now.figure.extra'],
    ['a text without its Spanish', (d) => delete d.vision.es, 'vision.es'],
    ['an empty English text', (d) => (d.initiative.en = ''), 'initiative.en'],
    ['a missing illustration', (d) => delete d.illustrations.solution, 'illustrations.solution'],
    ['an extra illustration', (d) => (d.illustrations.fourth = d.illustrations.solution), 'illustrations.fourth'],
    ['an illustration without a caption', (d) => delete d.illustrations.problem.caption, 'illustrations.problem.caption'],
    ['an illustration file as a number', (d) => (d.illustrations.initiative.file = 4), 'illustrations.initiative.file'],
    ['a proof without a unit', (d) => delete d.outcomes[1].proof.unit, 'outcomes[1].proof.unit'],
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
  two.outcomes.pop();
  const m = validateExecutive(two).find((p) => p.path === 'outcomes');
  assert.match(m?.message ?? '', /at least 3/);
  // one illustration file per language is allowed
  const perLang = clone();
  perLang.illustrations.initiative.file = { en: 'a-en.svg', es: 'a-es.svg' };
  assert.deepEqual(validateExecutive(perLang), []);
});

test('the writing limits hold in both languages: sentence length, answer length, equations and inline citations', () => {
  for (const lang of ['en', 'es'] as const) {
    const long = clone();
    long.vision[lang] = `${words(31)}.`;
    assert.ok(validateExecutive(long).some((p) => p.path === `vision.${lang}` && /31 words/.test(p.message)), `${lang}: a sentence of 31 words`);
    const ok = clone();
    ok.vision[lang] = `${words(30)}.`;
    assert.deepEqual(validateExecutive(ok), [], `${lang}: 30 words is the limit`);

    const answers = clone();
    answers.dialogue[0].answer[lang] = 'One fact. Two facts. Three facts.';
    assert.ok(validateExecutive(answers).some((p) => p.path === `dialogue[0].answer.${lang}` && /3 sentences/.test(p.message)), `${lang}: a 3-sentence answer`);

    const one = clone();
    one.initiative[lang] = 'First part. Second part.';
    assert.ok(validateExecutive(one).some((p) => p.path === `initiative.${lang}` && /one sentence/.test(p.message)), `${lang}: initiative is one sentence`);

    for (const bad of ['The cost is $5 million.', 'The cost is \\(x\\).', 'The cost is \\[x\\].', 'It is \\frac{a}{b}.', 'The loss fell (Source: the bank).', 'The loss fell [1].', 'The loss fell (ECB report).', 'The loss fell (Smith et al., 2019).']) {
      const d = clone();
      d.outcomes[0].outcome[lang] = bad;
      assert.ok(validateExecutive(d).some((p) => p.path === `outcomes[0].outcome.${lang}`), `${lang}: "${bad}" must fail`);
    }
    // a decimal is not a sentence end, and a source may carry a citation
    const dec = clone();
    dec.outcomes[0].outcome[lang] = 'Shift calls fell by 3.5 percent in the pilot ward';
    dec.sources[0].note[lang] = 'Smith (2019), table 3.';
    assert.deepEqual(validateExecutive(dec), [], `${lang}: decimals and sources`);
  }
  assert.deepEqual(sentencesOf('One two. Three four? Five! Six 3.5 seven'), ['One two.', 'Three four?', 'Five!', 'Six 3.5 seven']);
  assert.equal(wordsIn('a, b - c 3.5'), 4);
});

test('four_cs is absent while FOUR_CS is empty and required in order once it is filled', () => {
  const rows = (names: string[]) => names.map((c) => ({ c: { en: c, es: c }, exec_problem: { en: 'It ties to the executive problem.', es: 'Se ata al problema del ejecutivo.' } }));
  const withRows = clone();
  withRows.four_cs = rows(['A', 'B', 'C', 'D']);
  assert.ok(paths(withRows).includes('four_cs'), 'present while FOUR_CS is empty');
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta'];
  assert.ok(paths(fixture, names).includes('four_cs'), 'missing once FOUR_CS is filled');
  const ok = clone();
  ok.four_cs = rows(names);
  assert.deepEqual(paths(ok, names), []);
  const wrongOrder = clone();
  wrongOrder.four_cs = rows(['Beta', 'Alpha', 'Gamma', 'Delta']);
  assert.ok(paths(wrongOrder, names).includes('four_cs[0].c'));
  const three = clone();
  three.four_cs = rows(names).slice(0, 3);
  assert.ok(paths(three, names).includes('four_cs'));
});

test('the sections of the view come from one definition that the gate keeps a copy of', () => {
  assert.equal(EXEC_SECTION_DEFS.length, 4);
  assert.deepEqual(GATE_SECTIONS, EXEC_SECTION_DEFS.map((d) => ({ title: d.title, question: d.question })));
  assert.equal(new Set(EXEC_SECTION_DEFS.map((d) => d.id)).size, EXEC_SECTION_DEFS.length, 'unique tab ids');
});

test('every figure has a source by its field path', () => {
  const missing = clone();
  missing.sources = missing.sources.filter((s: any) => s.field !== 'outcomes[1].proof');
  assert.ok(paths(missing).includes('sources'), 'a figure without a source');
  const unknown = clone();
  unknown.sources.push({ ...unknown.sources[0], field: 'outcomes[9].proof' });
  assert.ok(paths(unknown).includes('sources[4].field'), 'a source for a field that does not exist');
  const twice = clone();
  twice.sources.push(twice.sources[0]);
  assert.ok(paths(twice).includes('sources[4].field'), 'a field sourced twice');
});

test('a source is a link: the url is required and is https only', () => {
  const noUrl = clone();
  delete noUrl.sources[0].url;
  assert.ok(paths(noUrl).includes('sources[0].url'), 'no url');
  const old = clone();
  old.sources[1] = { field: old.sources[1].field, source: { en: 'A report, section 2.', es: 'Un informe, sección 2.' } };
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

test('the limits of the gate and those of the validator are the same', () => {
  assert.deepEqual(GATE_LIMITS, EXEC_LIMITS);
  assert.equal(EXEC_LIMITS.maxWords, 30);
  assert.equal(EXEC_LIMITS.maxAnswerSentences, 2);
  // the gate's copy of the source-text rules judges the same samples the same way
  for (const sample of ['Report file 2026080375', 'archivo 12', 'a.pdf', 'See https://example.org/a.pdf', 'Published on 3 May', 'Page 4, table 2.', `${words(31)}.`]) {
    assert.deepEqual(gateSourceProblems(sample, 1), sourceTextProblems(sample, 1), sample);
  }
  // gate/inpage.mjs is serialised into the page and cannot import: its label floor is a literal that must equal the table's
  const inpage = readFileSync(new URL('../gate/inpage.mjs', import.meta.url), 'utf8');
  assert.equal(Number(/const EXEC_MIN_LABEL_PX = (\d+);/.exec(inpage)?.[1]), EXEC_LIMITS.minLabelPx);
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
    ['executive', (d, l, t) => (d.executive[l] = t)],
    ['organisation', (d, l, t) => (d.organisation[l] = t)],
    ['initiative', (d, l, t) => (d.initiative[l] = t)],
    ['vision', (d, l, t) => (d.vision[l] = t)],
    ['outcomes[1].outcome', (d, l, t) => (d.outcomes[1].outcome[l] = t)],
    ['dialogue[0].answer', (d, l, t) => (d.dialogue[0].answer[l] = t)],
  ];
  for (const [word, lang, text] of samples) {
    for (const [path, set] of fields) {
      const d = clone();
      set(d, lang, text);
      assert.ok(validateExecutive(d).some((p) => p.path === `${path}.${lang}` && /promotional or client-bound/.test(p.message)), `${path}.${lang}: "${word}" must fail`);
    }
    // case does not matter, a longer word does not match, and the gate's list is the same
    assert.ok(validateExecutive(Object.assign(clone(), { vision: { en: text.toUpperCase(), es: text.toUpperCase() } })).some((p) => /promotional/.test(p.message)), `${word}: upper case`);
  }
  const clean = clone();
  clean.vision.en = 'Pricing studies, offered services and a bypass stay out of scope.';
  assert.deepEqual(validateExecutive(clean).filter((p) => /promotional/.test(p.message)), [], 'whole words only');
  assert.deepEqual(GATE_LIMITS.promotional, EXEC_LIMITS.promotional);
});
