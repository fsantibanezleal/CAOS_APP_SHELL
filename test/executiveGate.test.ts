import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXEC_FLOORS, EXEC_FOUR_CS, EXEC_LINKS, EXEC_SECTIONS, executiveFailures } from '../gate/areas.mjs';

/**
 * The executive-view check of the gate (gate/areas.mjs executiveFailures) on facts shaped as gate/inpage.mjs reports
 * them, one entry per state the walk visited (shell 0.13.0: the five sections are sub-tabs, so one state shows one section).
 */

type Lang = 'en' | 'es';
const illustration = (name: string, section: number) => ({ name, section, file: `executive/${name}.svg`, state: null, why: '', svg: true, img: 0, chart: 0, caption: true, literal: [], outside: [], small: [], labels: 4 });
const notes = (lang: Lang) => [0, 1, 2, 3, 4, 5, 6].map((i) => ({ href: `https://example.org/source-${i}`, title: lang === 'en' ? `Publication ${i}` : `Publicación ${i}`, note: lang === 'en' ? 'Page 4.' : 'Página 4.' }));
/** The rows each sub-tab shows at the floor (the minimum), and the landing's headline figures in every state. */
const ITEMS: Record<number, Record<string, number>> = {
  1: { 'pain.paragraphs': 2, 'pain.bearers': 3, 'pain.figures': 2, 'pain.causes': 3 },
  2: { 'context.paragraphs': 1, 'context.forces': 3, 'context.evidence': 1 },
  3: { 'situation.roles': 3, 'situation.state_of_the_art': 3 },
  4: { 'trends.items': 3 },
  5: { 'proposal.paragraphs': 1, 'proposal.four_cs': 4, 'proposal.actions': 3, 'proposal.risks': 1, 'proposal.unknowns': 1 },
};
const CITES: Record<number, string[]> = { 1: ['#exec-note-4'], 2: ['#exec-note-5'], 3: ['#exec-note-6'], 4: ['#exec-note-7'], 5: [] };

/** The facts of the state in which sub-tab `n` (1 to 5) is open, as a correct view reports them. */
function state(n: number, lang: Lang, edit: (f: any) => void = () => undefined) {
  const f: any = {
    count: 1,
    schema: '2.0.0',
    valid: 'true',
    errors: '',
    inOpenView: true,
    docSections: 0,
    docSectionTitles: [],
    strangers: [],
    landing: { present: true, title: 'A title', statement: 'A key statement.' },
    tabs: EXEC_SECTIONS.map((s) => s.title[lang]),
    activeTab: n - 1,
    sections: [{ n, title: EXEC_SECTIONS[n - 1].title[lang], keyFirst: true, keyMessage: 'A key message.' }],
    items: { headline_figures: 3, ...ITEMS[n] },
    cs: n === 5 ? EXEC_FOUR_CS.map((c) => ({ name: c.name[lang], def: c.definition[lang], applies: 'What it means.' })) : [],
    links: [
      { kind: 'technical', text: EXEC_LINKS.technical[lang], href: '#technical' },
      { kind: 'app', text: EXEC_LINKS.app[lang], href: '/app' },
    ],
    fields: [{ path: 'title', text: 'A title', readable: true }],
    notes: notes(lang),
    cites: ['#exec-note-1', '#exec-note-2', '#exec-note-3', ...CITES[n]],
    illustrations: n === 1 ? [illustration('pain', 1)] : n === 3 ? [illustration('situation', 3)] : n === 5 ? [illustration('proposal', 5)] : [],
    narrow: [],
    column: 1152,
    text: 'Plain text of the view.',
  };
  edit(f);
  return f;
}
const walk = (lang: Lang, edit: (n: number, f: any) => void = () => undefined, visit = [1, 2, 3, 4, 5]) => visit.map((n) => state(n, lang, (f) => edit(n, f)));
const msgs = (list: any[], lang: Lang) => executiveFailures(list, lang);
const has = (m: string[], re: RegExp) => m.some((x) => re.test(x));

test('a correct walk of the five sub-tabs passes in both languages', () => {
  for (const lang of ['en', 'es'] as const) assert.deepEqual(msgs(walk(lang), lang), [], lang);
});

test('a sub-tab that was never visited fails and every visited one is checked', () => {
  for (const lang of ['en', 'es'] as const) {
    const m = msgs(walk(lang, () => undefined, [1, 2, 4, 5]), lang);
    assert.ok(m.some((x) => x.includes(`sub-tab "${EXEC_SECTIONS[2].title[lang]}" was never visited`)), `${lang}: ${m.join(' | ')}`);
    // only the first sub-tab visited: four are never visited
    const one = msgs(walk(lang, () => undefined, [1]), lang);
    assert.equal(one.filter((x) => /was never visited/.test(x)).length, 4);
    // the checks reach what a later sub-tab shows: a long sentence in sub-tab 2 is found
    const words = Array.from({ length: 31 }, (_, i) => `w${i}`).join(' ');
    const long = msgs(walk(lang, (n, f) => n === 2 && (f.fields = [{ path: 'context.key_message', text: `${words}.`, readable: true }])), lang);
    assert.ok(has(long, /field "context\.key_message": a sentence of 31 words/), long.join(' | '));
    // and an illustration that fails in sub-tab 3
    const bad = msgs(walk(lang, (n, f) => n === 3 && (f.illustrations[0].literal = ['fill: #1f77b4'])), lang);
    assert.ok(has(bad, /illustration "situation" uses literal colour/), bad.join(' | '));
    const place = msgs(walk(lang, (n, f) => n === 5 && (f.illustrations[0].section = 4)), lang);
    assert.ok(has(place, /illustration "proposal" sits in section 4, it belongs in section 5/), place.join(' | '));
  }
});

test('the sections must be five sub-tabs, the first selected, one section shown at a time', () => {
  for (const lang of ['en', 'es'] as const) {
    // stacked: no sub-tab list at all, every section in one state
    const stacked = state(1, lang, (f) => {
      f.tabs = [];
      f.activeTab = -1;
      f.sections = [1, 2, 3, 4, 5].map((n) => ({ n, title: EXEC_SECTIONS[n - 1].title[lang], keyFirst: true, keyMessage: 'A key message.' }));
    });
    const m = msgs([stacked], lang);
    assert.ok(has(m, /sub-tab/) && has(m, /no sub-tabs|not sub-tabs/), `${lang}: ${m.join(' | ')}`);
    assert.ok(has(m, /5 sections shown at once/), `${lang}: ${m.join(' | ')}`);
    // four tabs only
    const four = msgs(walk(lang, (n, f) => (f.tabs = f.tabs.slice(0, 4))), lang);
    assert.ok(has(four, /the executive view shows 4 sub-tab\(s\), exactly 5 are required/), four.join(' | '));
    // tabs out of order or mislabelled
    const swapped = msgs(walk(lang, (n, f) => (f.tabs = [f.tabs[1], f.tabs[0], f.tabs[2], f.tabs[3], f.tabs[4]])), lang);
    assert.ok(has(swapped, /sub-tab 1 is labelled/), swapped.join(' | '));
    // the first state opens the second tab
    const second = msgs(walk(lang, (n, f) => n === 1 && (f.activeTab = 1)), lang);
    assert.ok(has(second, /first sub-tab is not the one selected/), second.join(' | '));
    // a section in the wrong tab, and a wrong title
    const wrongTab = msgs(walk(lang, (n, f) => n === 2 && (f.activeTab = 4)), lang);
    assert.ok(has(wrongTab, /section 2 sits in sub-tab 5/), wrongTab.join(' | '));
    const title = msgs(walk(lang, (n, f) => n === 4 && (f.sections[0].title = 'Something else')), lang);
    assert.ok(has(title, /section 4 is titled "Something else"/), title.join(' | '));
  }
});

test('each sub-tab opens with its key message line', () => {
  for (const lang of ['en', 'es'] as const) {
    const notFirst = msgs(walk(lang, (n, f) => n === 3 && (f.sections[0].keyFirst = false)), lang);
    assert.ok(has(notFirst, /section 3 \(".*"\) does not open with its key message line/), notFirst.join(' | '));
    const empty = msgs(walk(lang, (n, f) => n === 4 && (f.sections[0].keyMessage = '')), lang);
    assert.ok(has(empty, /section 4 \(".*"\) has an empty key message line/), empty.join(' | '));
    const noLanding = msgs(walk(lang, (n, f) => (f.landing = { present: false, title: '', statement: '' })), lang);
    assert.ok(has(noLanding, /no landing block above the sub-tabs/), noLanding.join(' | '));
    const noTitle = msgs(walk(lang, (n, f) => (f.landing.title = '')), lang);
    assert.ok(has(noTitle, /the landing block has no title/), noTitle.join(' | '));
    const noStatement = msgs(walk(lang, (n, f) => (f.landing.statement = '')), lang);
    assert.ok(has(noStatement, /the landing block has no key statement/), noStatement.join(' | '));
  }
});

test('every floor of the structure holds on the page: too few rows and too many rows fail', () => {
  const tabOf = (key: string) => ({ headline_figures: 1, pain: 1, context: 2, situation: 3, trends: 4, proposal: 5 })[key.split('.')[0]]!;
  for (const lang of ['en', 'es'] as const) {
    for (const [key, [min, max]] of Object.entries(EXEC_FLOORS)) {
      const tab = tabOf(key);
      const below = msgs(walk(lang, (n, f) => (n === tab || key === 'headline_figures') && (f.items[key] = min - 1)), lang);
      assert.ok(below.some((x) => x.includes(`${key}: ${min - 1} row(s) are shown, at least ${min} are required`)), `${key} below: ${below.join(' | ')}`);
      const above = msgs(walk(lang, (n, f) => (n === tab || key === 'headline_figures') && (f.items[key] = max + 1)), lang);
      assert.ok(above.some((x) => x.includes(`${key}: ${max + 1} row(s) are shown, at most ${max} are allowed`)), `${key} above: ${above.join(' | ')}`);
    }
    // a part that is not rendered at all counts as zero rows
    const gone = msgs(walk(lang, (n, f) => n === 1 && delete f.items['pain.bearers']), lang);
    assert.ok(has(gone, /pain\.bearers: 0 row\(s\) are shown, at least 3 are required/), gone.join(' | '));
    // the landing's headline figures sit in every state
    const headline = msgs(walk(lang, (n, f) => (f.items.headline_figures = 1)), lang);
    assert.ok(has(headline, /headline_figures: 1 row\(s\) are shown, at least 2 are required/), headline.join(' | '));
    // a floor of a sub-tab nobody opened is not reported as empty: the unvisited sub-tab is
    const partial = msgs(walk(lang, () => undefined, [1]), lang);
    assert.ok(!has(partial, /proposal\.actions: 0 row/), partial.join(' | '));
  }
});

test("the 4 C's of the proposal must show Felipe's names and definitions in order, each applied", () => {
  for (const lang of ['en', 'es'] as const) {
    const three = msgs(walk(lang, (n, f) => n === 5 && (f.cs = f.cs.slice(0, 3))), lang);
    assert.ok(has(three, /the proposal holds 3 row\(s\) of the 4 C's, exactly 4 are required/), three.join(' | '));
    const five = msgs(walk(lang, (n, f) => n === 5 && f.cs.push({ name: 'Cause', def: 'x', applies: 'y' })), lang);
    assert.ok(has(five, /the proposal holds 5 row\(s\)/), five.join(' | '));
    const renamed = msgs(walk(lang, (n, f) => n === 5 && (f.cs[1].name = 'Contexts')), lang);
    assert.ok(has(renamed, /C 2 is named "Contexts", expected "/), renamed.join(' | '));
    const reordered = msgs(walk(lang, (n, f) => n === 5 && f.cs.reverse()), lang);
    assert.ok(has(reordered, /C 1 is named/) && has(reordered, /C 4 is named/), reordered.join(' | '));
    const def = msgs(walk(lang, (n, f) => n === 5 && (f.cs[2].def = 'visibility of spending')), lang);
    assert.ok(has(def, /C 3 \("[^"]+"\) defines itself as "visibility of spending", expected "/), def.join(' | '));
    const applies = msgs(walk(lang, (n, f) => n === 5 && (f.cs[3].applies = '')), lang);
    assert.ok(has(applies, /C 4 \("[^"]+"\) says nothing about what it means for the proposal/), applies.join(' | '));
  }
  // the names and definitions are Felipe's, verbatim (2026-10-13)
  assert.deepEqual(EXEC_FOUR_CS.map((c) => [c.name.en, c.name.es, c.definition.en, c.definition.es]), [
    ['Choice', 'Elección', 'flexibility across proprietary and open models.', 'flexibilidad entre modelos propietarios y abiertos.'],
    ['Context', 'Contexto', 'AI grounded in business meaning, so decisions are accurate.', 'IA anclada en el significado del negocio, para que las decisiones sean exactas.'],
    ['Cost', 'Costo', 'visibility of what the AI spends.', 'visibilidad de lo que gasta la IA.'],
    ['Control', 'Control', 'one governance over data, models and agents.', 'una sola gobernanza sobre datos, modelos y agentes.'],
  ]);
});

test('no rubric label or question is printed anywhere in the view', () => {
  for (const lang of ['en', 'es'] as const) {
    for (const [text, kind] of [['Industry & Exec Tailoring', 'label'], ['Built for a C-suite exec?', 'question'], ['Posicionamiento 4C', 'label'], ['¿Pensado para un ejecutivo de primer nivel?', 'question'], ['Trust them in front of a CxO?', 'question']] as const) {
      const printed = msgs(walk(lang, (n, f) => n === 2 && (f.text = `Some text ${text} more text`)), lang);
      assert.ok(printed.some((x) => x.includes(`prints the rubric's ${kind} "${text}"`)), `${text}: ${printed.join(' | ')}`);
    }
  }
});

test('writing, wording and paragraph length are checked on the page, in every sub-tab', () => {
  const samples: Array<[Lang, string]> = [['en', 'Our client cuts agency hours.'], ['es', 'Nuestro cliente reduce horas.'], ['en', 'Contact us today.'], ['es', 'Contáctenos hoy.'], ['en', 'Buy it now.'], ['es', 'Hay que comprar ya.'], ['en', 'The price drops.'], ['es', 'El precio baja.'], ['en', 'The offer ends.'], ['es', 'La oferta termina.']];
  for (const [lang, text] of samples) {
    const m = msgs(walk(lang, (n, f) => n === 4 && (f.fields = [{ path: 'trends.items[0].effect', text, readable: true }])), lang);
    assert.ok(has(m, /field "trends\.items\[0\]\.effect": holds promotional or client-bound wording/), `${lang}: "${text}" ${m.join(' | ')}`);
  }
  const clean = msgs(walk('en', (n, f) => n === 1 && (f.fields = [{ path: 'pain.bearers[0].cost', text: 'Pricing studies and offered services are out of scope.', readable: true }])), 'en');
  assert.deepEqual(clean, []);
  for (const lang of ['en', 'es'] as const) {
    const short = msgs(walk(lang, (n, f) => n === 1 && (f.fields = [{ path: 'pain.paragraphs[0]', text: 'Too short to be a paragraph.', readable: true }])), lang);
    assert.ok(has(short, /field "pain\.paragraphs\[0\]": 6 words; a paragraph needs at least 25/), short.join(' | '));
    const two = msgs(walk(lang, (n, f) => n === 2 && (f.fields = [{ path: 'context.key_message', text: 'One. Two.', readable: true }])), lang);
    assert.ok(has(two, /field "context\.key_message": 2 sentences; the limit is 1/), two.join(' | '));
    const statement = msgs(walk(lang, (n, f) => n === 1 && (f.fields = [{ path: 'key_statement', text: 'One. Two. Three.', readable: true }])), lang);
    assert.ok(has(statement, /field "key_statement": 3 sentences; the limit is 2/), statement.join(' | '));
    const hidden = msgs(walk(lang, (n, f) => n === 3 && (f.fields = [{ path: 'situation.interaction', text: 'A line.', readable: false }])), lang);
    assert.ok(has(hidden, /1 field\(s\) are in the page and a reader cannot read them: situation\.interaction/), hidden.join(' | '));
  }
});

test('every source note is a https link with a title and no file citation', () => {
  for (const lang of ['en', 'es'] as const) {
    const noLink = msgs(walk(lang, (n, f) => (f.notes[0] = { href: null, title: '', note: 'Report file 2026080375, page 4' })), lang);
    assert.ok(has(noLink, /source note 1 has no link/), noLink.join(' | '));
    const http = msgs(walk(lang, (n, f) => (f.notes[1].href = 'http://example.org/a')), lang);
    assert.ok(has(http, /source note 2 links to "http:\/\/example\.org\/a"; a source is an https:\/\/ link/), http.join(' | '));
    const file = msgs(walk(lang, (n, f) => (f.notes[2].note = 'Informe archivo 2026080375')), lang);
    assert.ok(has(file, /source note 3: .*cites a file name or number/), file.join(' | '));
    const titleFile = msgs(walk(lang, (n, f) => (f.notes[3].title = 'informe.pdf')), lang);
    assert.ok(has(titleFile, /source note 4: .*cites a file name or number/), titleFile.join(' | '));
    const count = msgs(walk(lang, (n, f) => (f.notes = f.notes.slice(0, 5))), lang);
    assert.ok(has(count, /5 source note\(s\) for 7 source\(s\) cited/), count.join(' | '));
    const published = msgs(walk(lang, (n, f) => (f.notes[0].note = 'Published on 3 August 2026')), lang);
    assert.ok(has(published, /source note 1: .*cites a file name or number/), published.join(' | '));
  }
});

test('the two onward links are under the sources and worded as destinations', () => {
  for (const lang of ['en', 'es'] as const) {
    const none = msgs(walk(lang, (n, f) => (f.links = [])), lang);
    assert.ok(has(none, /no onward link to the technical view/) && has(none, /no onward link to the App/), none.join(' | '));
    const worded = msgs(walk(lang, (n, f) => (f.links[0].text = 'Read more')), lang);
    assert.ok(has(worded, new RegExp(`the onward link to the technical view reads "Read more", expected "${EXEC_LINKS.technical[lang]}"`)), worded.join(' | '));
    const app = msgs(walk(lang, (n, f) => (f.links[1].href = '/methodology')), lang);
    assert.ok(has(app, /the onward link to the App goes to "\/methodology", not to the App route/), app.join(' | '));
  }
});

test('the view must take the full width of the document column', () => {
  for (const lang of ['en', 'es'] as const) {
    const narrow = msgs(walk(lang, (n, f) => n === 2 && (f.narrow = ['section.caos-exec-section 640px'])), lang);
    assert.ok(has(narrow, /1 block\(s\) narrower than the 1152px document column: section\.caos-exec-section 640px/), narrow.join(' | '));
  }
});

test('invalid data in the page ends the check with the reason of the validator', () => {
  const m = msgs(walk('en', (n, f) => Object.assign(f, { valid: 'false', errors: 'proposal.four_cs: is required and missing' })), 'en');
  assert.deepEqual(m, ['Introduction, executive view (EN): the data file is not valid in the page: proposal.four_cs: is required and missing']);
  assert.ok(has(msgs([], 'en'), /no ExecutiveView/));
  assert.ok(has(msgs([{ count: 0 }], 'en'), /no ExecutiveView/));
  const old = msgs(walk('es', (n, f) => (f.schema = '1.0.0')), 'es');
  assert.ok(has(old, /the view declares schema "1\.0\.0", expected "2\.0\.0"/));
});
