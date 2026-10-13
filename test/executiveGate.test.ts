import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXEC_PENDING, EXEC_SECTIONS, executiveFailures } from '../gate/areas.mjs';

/**
 * The executive-view check of the gate (gate/areas.mjs executiveFailures) on facts shaped as gate/inpage.mjs reports
 * them, one entry per state the walk visited (shell 0.13.0: the four sections are sub-tabs, so one state shows one section).
 */

type Lang = 'en' | 'es';
const URL_OF = (i: number) => `https://example.org/source-${i}`;
const illustration = (name: string, section: number) => ({ name, section, file: `executive/${name}.svg`, state: null, why: '', svg: true, img: 0, chart: 0, caption: true, literal: [], outside: [], small: [], labels: 4 });
const notes = (lang: Lang) => [0, 1, 2, 3].map((i) => ({ href: URL_OF(i), title: lang === 'en' ? `Publication ${i}` : `Publicación ${i}`, note: lang === 'en' ? 'Page 4.' : 'Página 4.' }));

/** The facts of the state in which sub-tab `n` (1 to 4) is open, as a correct view reports them. */
function state(n: number, lang: Lang, edit: (f: any) => void = () => undefined) {
  const section = {
    n,
    title: EXEC_SECTIONS[n - 1].title[lang],
    question: EXEC_SECTIONS[n - 1].question[lang],
    pending: n === 3 ? 1 : 0,
    pendingText: n === 3 ? EXEC_PENDING[lang] : '',
    pendingState: n === 3 ? 'unavailable' : null,
    rows: 0,
  };
  const f: any = {
    count: 1,
    schema: '2.0.0',
    valid: 'true',
    errors: '',
    inOpenView: true,
    docSections: 0,
    docSectionTitles: [],
    strangers: [],
    tabs: EXEC_SECTIONS.map((s) => s.title[lang]),
    activeTab: n - 1,
    sections: [section],
    fields: n === 1 ? [{ path: 'initiative', text: 'One sentence of the initiative.', readable: true }] : [{ path: 'vision', text: 'One sentence of the vision.', readable: true }],
    notes: notes(lang),
    cites: n === 1 ? [`#exec-note-1`] : n === 2 ? ['#exec-note-2', '#exec-note-3', '#exec-note-4'] : [],
    illustrations: n === 1 ? [illustration('initiative', 1), illustration('problem', 1)] : n === 2 ? [illustration('solution', 2)] : [],
  };
  // the first state shows the why-now figure of section 1 and the proofs of section 2: four figures in all
  if (n === 1) f.cites = ['#exec-note-1'];
  edit(f);
  return f;
}
const walk = (lang: Lang, edit: (n: number, f: any) => void = () => undefined, visit = [1, 2, 3, 4]) => visit.map((n) => state(n, lang, (f) => edit(n, f)));
const msgs = (list: any[], lang: Lang) => executiveFailures(list, lang);

test('a correct walk of the four sub-tabs passes in both languages', () => {
  for (const lang of ['en', 'es'] as const) assert.deepEqual(msgs(walk(lang), lang), [], lang);
});

test('a sub-tab that was never visited fails and every visited one is checked', () => {
  for (const lang of ['en', 'es'] as const) {
    const m = msgs(walk(lang, () => undefined, [1, 2, 4]), lang);
    assert.ok(m.some((x) => x.includes(`sub-tab "${EXEC_SECTIONS[2].title[lang]}" was never visited`)), `${lang}: ${m.join(' | ')}`);
    // only the first sub-tab visited: three are never visited
    const one = msgs(walk(lang, () => undefined, [1]), lang);
    assert.equal(one.filter((x) => /was never visited/.test(x)).length, 3);
    // the checks reach what a later sub-tab shows: a long sentence in sub-tab 2 is found
    const words = Array.from({ length: 31 }, (_, i) => `w${i}`).join(' ');
    const long = msgs(walk(lang, (n, f) => n === 2 && (f.fields = [{ path: 'vision', text: `${words}.`, readable: true }])), lang);
    assert.ok(long.some((x) => /field "vision": a sentence of 31 words/.test(x)), long.join(' | '));
    // and an illustration that fails in sub-tab 2
    const bad = msgs(walk(lang, (n, f) => n === 2 && (f.illustrations[0].literal = ['fill: #1f77b4'])), lang);
    assert.ok(bad.some((x) => /illustration "solution" uses literal colour/.test(x)), bad.join(' | '));
  }
});

test('the four sections must be four sub-tabs, the first selected, one section shown at a time', () => {
  for (const lang of ['en', 'es'] as const) {
    // stacked: no sub-tab list at all, every section in one state
    const stacked = state(1, lang, (f) => {
      f.tabs = [];
      f.activeTab = -1;
      f.sections = [1, 2, 3, 4].map((n) => ({ n, title: EXEC_SECTIONS[n - 1].title[lang], question: EXEC_SECTIONS[n - 1].question[lang], pending: n === 3 ? 1 : 0, pendingText: n === 3 ? EXEC_PENDING[lang] : '', pendingState: n === 3 ? 'unavailable' : null, rows: 0 }));
    });
    const m = msgs([stacked], lang);
    assert.ok(m.some((x) => /sub-tab/.test(x) && /no sub-tabs|not sub-tabs/.test(x)), `${lang}: ${m.join(' | ')}`);
    assert.ok(m.some((x) => /4 sections shown at once/.test(x)), `${lang}: ${m.join(' | ')}`);
    // three tabs only
    const three = msgs(walk(lang, (n, f) => (f.tabs = f.tabs.slice(0, 3))), lang);
    assert.ok(three.some((x) => /the executive view shows 3 sub-tab\(s\)/.test(x)), three.join(' | '));
    // tabs out of order or mislabelled
    const swapped = msgs(walk(lang, (n, f) => (f.tabs = [f.tabs[1], f.tabs[0], f.tabs[2], f.tabs[3]])), lang);
    assert.ok(swapped.some((x) => /sub-tab 1 is labelled/.test(x)), swapped.join(' | '));
    // the first state opens the second tab
    const second = msgs(walk(lang, (n, f) => n === 1 && (f.activeTab = 1)), lang);
    assert.ok(second.some((x) => /first sub-tab is not the one selected/.test(x)), second.join(' | '));
    // a section in the wrong tab, and a wrong title or question
    const wrongTab = msgs(walk(lang, (n, f) => n === 2 && (f.activeTab = 3)), lang);
    assert.ok(wrongTab.some((x) => /section 2 sits in sub-tab 4/.test(x)), wrongTab.join(' | '));
    const title = msgs(walk(lang, (n, f) => n === 4 && (f.sections[0].title = 'Something else')), lang);
    assert.ok(title.some((x) => /section 4 is titled "Something else"/.test(x)), title.join(' | '));
    const question = msgs(walk(lang, (n, f) => n === 1 && (f.sections[0].question = 'Other?')), lang);
    assert.ok(question.some((x) => /section 1 asks "Other\?"/.test(x)), question.join(' | '));
  }
});

test('section 3 is the declared pending state or four rows (its structure is being redefined)', () => {
  for (const lang of ['en', 'es'] as const) {
    const wrongText = msgs(walk(lang, (n, f) => n === 3 && (f.sections[0].pendingText = 'Soon')), lang);
    assert.ok(wrongText.some((x) => /section 3 declares the pending state "Soon"/.test(x)), wrongText.join(' | '));
    const noState = msgs(walk(lang, (n, f) => n === 3 && (f.sections[0].pendingState = null)), lang);
    assert.ok(noState.some((x) => /pending without data-state="unavailable"/.test(x)), noState.join(' | '));
    const three = msgs(walk(lang, (n, f) => n === 3 && Object.assign(f.sections[0], { pending: 0, pendingText: '', rows: 3 })), lang);
    assert.ok(three.some((x) => /section 3 holds 3 row\(s\) of the 4 C's, exactly 4 are required/.test(x)), three.join(' | '));
    const four = msgs(walk(lang, (n, f) => n === 3 && Object.assign(f.sections[0], { pending: 0, pendingText: '', rows: 4 })), lang);
    assert.deepEqual(four, []);
  }
});

test('every source note is a https link with a title and no file citation', () => {
  for (const lang of ['en', 'es'] as const) {
    const noLink = msgs(walk(lang, (n, f) => (f.notes[0] = { href: null, title: '', note: 'Report file 2026080375, page 4' })), lang);
    assert.ok(noLink.some((x) => /source note 1 has no link/.test(x)), noLink.join(' | '));
    const http = msgs(walk(lang, (n, f) => (f.notes[1].href = 'http://example.org/a')), lang);
    assert.ok(http.some((x) => /source note 2 links to "http:\/\/example\.org\/a"; a source is an https:\/\/ link/.test(x)), http.join(' | '));
    const file = msgs(walk(lang, (n, f) => (f.notes[2].note = 'Informe archivo 2026080375')), lang);
    assert.ok(file.some((x) => /source note 3: .*cites a file name or number/.test(x)), file.join(' | '));
    const titleFile = msgs(walk(lang, (n, f) => (f.notes[3].title = 'informe.pdf')), lang);
    assert.ok(titleFile.some((x) => /source note 4: .*cites a file name or number/.test(x)), titleFile.join(' | '));
    const count = msgs(walk(lang, (n, f) => (f.notes = f.notes.slice(0, 3))), lang);
    assert.ok(count.some((x) => /3 source note\(s\) for 4 figure\(s\)/.test(x)), count.join(' | '));
    const published = msgs(walk(lang, (n, f) => (f.notes[0].note = 'Published on 3 August 2026')), lang);
    assert.ok(published.some((x) => /source note 1: .*cites a file name or number/.test(x)), published.join(' | '));
  }
});

test('promotional or client-bound wording on the page fails, whole words only', () => {
  const samples: Array<[Lang, string]> = [['en', 'Our client cuts agency hours.'], ['es', 'Nuestro cliente reduce horas.'], ['en', 'Contact us today.'], ['es', 'Contáctenos hoy.'], ['en', 'Buy it now.'], ['es', 'Hay que comprar ya.'], ['en', 'The price drops.'], ['es', 'El precio baja.'], ['en', 'The offer ends.'], ['es', 'La oferta termina.']];
  for (const [lang, text] of samples) {
    const m = msgs(walk(lang, (n, f) => n === 1 && (f.fields = [{ path: 'executive', text, readable: true }])), lang);
    assert.ok(m.some((x) => /field "executive": holds promotional or client-bound wording/.test(x)), `${lang}: "${text}" ${m.join(' | ')}`);
  }
  const clean = msgs(walk('en', (n, f) => n === 1 && (f.fields = [{ path: 'executive', text: 'Pricing studies and offered services are out of scope.', readable: true }])), 'en');
  assert.deepEqual(clean, []);
});
