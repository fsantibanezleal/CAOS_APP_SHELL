import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DOC_AREAS } from '../src/content/DocPage.tsx';
import { COMMON_FLOORS, DOC_ROUTES, PAGES, REASON_MIN, describeRule, docFloorFailures, failedRules, parseWaivers, waivable } from '../gate/areas.mjs';

/** The area table of the gate (gate/areas.mjs, ADR-0017 section 2.1) and what it does with the facts a page shows. */

const views = readFileSync(new URL('../docs/04_views.md', import.meta.url), 'utf8');

test('the area table names the areas of ADR-0017 section 2.1 and the docs list each one', () => {
  assert.deepEqual(DOC_ROUTES, ['/introduction', '/methodology', '/implementation', '/experiments', '/benchmark']);
  const names = Object.fromEntries(DOC_ROUTES.map((r) => [r, Object.keys(PAGES[r].areas)]));
  assert.deepEqual(names['/introduction'], ['initiative', 'outcomes', 'positioning', 'credibility', 'problem', 'principles', 'math', 'pipeline', 'honesty']);
  assert.deepEqual(names['/methodology'], ['method']);
  assert.deepEqual(names['/implementation'], ['architecture', 'reproducibility', 'engine', 'lanes', 'contract', 'deployment']);
  assert.deepEqual(names['/experiments'], ['question', 'metrics', 'protocol', 'datasets']);
  assert.deepEqual(names['/benchmark'], ['results', 'comparison', 'robustness', 'live', 'provenance', 'caveat']);
  assert.deepEqual(DOC_AREAS, names, 'DOC_AREAS (src/content/DocPage.tsx) must list the areas of the table');
  for (const r of DOC_ROUTES) {
    for (const [name, def] of Object.entries(PAGES[r].areas) as [string, { requires: Record<string, number> }][]) {
      assert.ok(views.includes(`\`${name}\``), `docs/04_views.md does not list the area ${name}`);
      assert.ok(views.includes(describeRule(def.requires)), `docs/04_views.md does not state the rule of ${name}: ${describeRule(def.requires)}`);
    }
    for (const id of Object.keys(PAGES[r].floors)) assert.ok(views.includes(`\`${id}\``), `docs/04_views.md does not list the floor ${id}`);
  }
  for (const id of Object.keys(COMMON_FLOORS)) assert.ok(views.includes(`\`${id}\``), `docs/04_views.md does not list the floor ${id}`);
});

test('the numbers of the table are those of ADR-0017 section 2.1', () => {
  assert.deepEqual(PAGES['/introduction'].areas.math.requires, { equations: 1, glossary: 10 });
  assert.deepEqual(PAGES['/introduction'].areas.positioning.requires, { items: 4, thinItems: 0 });
  assert.deepEqual(PAGES['/introduction'].areas.credibility.requires, { qa: 3, honest: 1 });
  assert.deepEqual(PAGES['/methodology'].areas.method.requires, { dense: 4, equations: 2, figures: 1, honest: 1 });
  assert.equal(PAGES['/methodology'].floors['method-topics'].min, 6);
  assert.equal(PAGES['/methodology'].floors['method-learned'].min, 2);
  assert.equal(PAGES['/implementation'].floors['impl-topics'].min, 8);
  assert.equal(PAGES['/experiments'].floors['exp-topics'].min, 6);
  assert.equal(COMMON_FLOORS['lede-words'].min, 35);
});

test('failedRules reports the measured number and the floor, exact and bounded rules included', () => {
  assert.deepEqual(failedRules({ dense: 3 }, { dense: 4 }), ['3 dense paragraphs, the floor is 4']);
  assert.deepEqual(failedRules({ honest: 2 }, { honest: 1 }), ['2 honest callouts, exactly 1 is required']);
  assert.deepEqual(failedRules({ rowsNoStat: 1 }, { rowsNoStat: 0 }), ['1 row whose proof point is not a quantified statement, at most 0 is allowed']);
  assert.deepEqual(failedRules({ dense: 4 }, { dense: 4 }), []);
});

test('the waiver parser splits entries and keeps the reason; the executive view is not waivable', () => {
  assert.deepEqual(parseWaivers('math: no equation here; live: nothing to run'), [
    { floor: 'math', reason: 'no equation here' },
    { floor: 'live', reason: 'nothing to run' },
  ]);
  assert.ok(waivable('/introduction').includes('math'));
  for (const a of ['initiative', 'outcomes', 'positioning', 'credibility']) assert.ok(!waivable('/introduction').includes(a), a);
  assert.equal(REASON_MIN, 12);
});

const section = (o: object) => ({ title: 'S', area: null, kind: null, topic: '', topicKey: '', view: null, dense: 0, equations: 0, figures: 0, callouts: 0, honest: 0, strong: 0, glossary: 0, steps: 0, tables: 0, codes: 0, charts: 0, controls: 0, stats: 0, rows: 0, rowsNoStat: 0, items: 0, thinItems: 0, qa: 0, ...o });
const state = (o: object) => ({ ledeWords: 40, waiver: null, topics: [{ label: '', key: '', head: null }], views: [], view: null, viewEquations: 0, viewGlossaries: 0, sections: [], figures: [], equations: [], ...o });

test('docFloorFailures: an empty section that declares an area fails, and a page of five plain sections has no area', () => {
  const r = docFloorFailures({ route: '/benchmark', lang: 'en', expectedTopics: 1, states: [state({ sections: [section({ area: 'results' })] })] });
  assert.ok(r.failures.some((f) => /results area.*0 tables or charts, the floor is 1/.test(f.message)), JSON.stringify(r.failures));
  const plain = docFloorFailures({ route: '/benchmark', lang: 'es', expectedTopics: 1, states: [state({ sections: [1, 2, 3, 4, 5].map((k) => section({ title: `P${k}`, dense: 5 })) })] });
  for (const a of ['results', 'comparison', 'robustness', 'live', 'provenance', 'caveat']) assert.ok(plain.failures.some((f) => f.message.includes(`no section declares the area "${a}"`) && f.message.includes('(ES)')), a);
});

test('docFloorFailures: a waiver skips only the floor it names and a short reason is refused', () => {
  const states = (waiver: string) => [state({ waiver, sections: [] })];
  const ok = docFloorFailures({ route: '/benchmark', lang: 'en', expectedTopics: 1, states: states('comparison: the fixture has no learned model') });
  assert.ok(!ok.failures.some((f) => f.message.includes('"comparison"')));
  assert.ok(ok.failures.some((f) => f.message.includes('"live"')));
  assert.equal(ok.waivers[0].valid, true);
  const short = docFloorFailures({ route: '/benchmark', lang: 'en', expectedTopics: 1, states: states('comparison: no') });
  assert.ok(short.failures.some((f) => /waiver for "comparison" has a reason of 2 character/.test(f.message)));
  assert.ok(short.failures.some((f) => f.message.includes('no section declares the area "comparison"')));
  const unknown = docFloorFailures({ route: '/benchmark', lang: 'en', expectedTopics: 1, states: states('nonsense: a long enough reason') });
  assert.ok(unknown.failures.some((f) => /waiver for "nonsense" is refused/.test(f.message)));
  const exec = docFloorFailures({ route: '/introduction', lang: 'en', expectedTopics: 1, states: states('initiative: a long enough reason') });
  assert.ok(exec.failures.some((f) => /cannot be waived/.test(f.message)));
});

test('docFloorFailures: the executive view holds no glossary and an unvisited topic fails', () => {
  const exec = docFloorFailures({ route: '/introduction', lang: 'en', expectedTopics: 1, states: [state({ views: ['executive', 'technical'], view: 'executive', viewGlossaries: 1 })] });
  assert.ok(exec.failures.some((f) => /executive view \(EN\): 1 symbol glossary/.test(f.message)), JSON.stringify(exec.failures));
  const walked = docFloorFailures({ route: '/benchmark', lang: 'en', expectedTopics: 3, states: [state({ sections: [] })] });
  assert.ok(walked.failures.some((f) => /visited 1 of 3 topics/.test(f.message)));
});
