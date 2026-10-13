import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EXEC_LIMITS as GATE_LIMITS } from '../gate/areas.mjs';
import { EXEC_LIMITS, EXECUTIVE_SCHEMA_VERSION, FOUR_CS, sentencesOf, validateExecutive, wordsIn } from '../src/content/executive.ts';
import schema from '../src/content/executive.schema.json' with { type: 'json' };

/** The executive view data file (CAOS_MANAGE conventions/problem-context-first.md; docs/06_executive-view.md). */

const fixture = JSON.parse(readFileSync(new URL('./gate-fixture/executive/executive.json', import.meta.url), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(fixture));
const paths = (data: unknown, fourCs: readonly string[] = []) => validateExecutive(data, { fourCs }).map((p) => p.path);
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

test('the schema accepts the fixture and the validator reports no problem', () => {
  assert.equal(EXECUTIVE_SCHEMA_VERSION, '1.0.0');
  assert.equal(schema.$id.endsWith('executive.schema.json'), true);
  assert.deepEqual(validateExecutive(fixture), []);
  assert.deepEqual(FOUR_CS, [], "the 4 C's are the product owner's to name");
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
    dec.sources[0].source[lang] = 'Smith (2019), table 3. Second part of the note.';
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

test('every figure has a source by its field path', () => {
  const missing = clone();
  missing.sources = missing.sources.filter((s: any) => s.field !== 'outcomes[1].proof');
  assert.ok(paths(missing).includes('sources'), 'a figure without a source');
  const unknown = clone();
  unknown.sources.push({ field: 'outcomes[9].proof', source: { en: 'x', es: 'x' } });
  assert.ok(paths(unknown).includes('sources[4].field'), 'a source for a field that does not exist');
  const twice = clone();
  twice.sources.push(twice.sources[0]);
  assert.ok(paths(twice).includes('sources[4].field'), 'a field sourced twice');
});

test('the limits of the gate and those of the validator are the same', () => {
  assert.deepEqual(GATE_LIMITS, EXEC_LIMITS);
  assert.equal(EXEC_LIMITS.maxWords, 30);
  assert.equal(EXEC_LIMITS.maxAnswerSentences, 2);
  // gate/inpage.mjs is serialised into the page and cannot import: its label floor is a literal that must equal the table's
  const inpage = readFileSync(new URL('../gate/inpage.mjs', import.meta.url), 'utf8');
  assert.equal(Number(/const EXEC_MIN_LABEL_PX = (\d+);/.exec(inpage)?.[1]), EXEC_LIMITS.minLabelPx);
});
