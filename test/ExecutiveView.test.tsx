import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExecutiveView, ExecutiveViewBody } from '../src/content/ExecutiveView.tsx';

/** The executive view (CAOS_MANAGE conventions/problem-context-first.md): four sections as sub-tabs, three illustrations, linked numbered sources. */

const fixture = JSON.parse(readFileSync(new URL('./gate-fixture/executive/executive.json', import.meta.url), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(fixture));
/** `open` is the sub-tab shown first (the test seam of ExecutiveViewBody; the product-facing view always opens the first). */
const render = (data: unknown, lang: 'en' | 'es' = 'en', open?: 1 | 2 | 3 | 4, fourCs: readonly string[] = []) => renderToStaticMarkup(<ExecutiveViewBody data={data} lang={lang} open={open} fourCs={fourCs} />);
const at = (html: string, needle: string) => {
  const i = html.indexOf(needle);
  assert.ok(i >= 0, `"${needle}" is not in the markup`);
  return i;
};

const TITLES = {
  en: ['Industry &amp; Exec Tailoring', 'AI Transformation Story', '4Cs Positioning', 'Delivery &amp; Credibility'],
  es: ['Industria y foco ejecutivo', 'Historia de transformación con IA', 'Posicionamiento 4C', 'Entrega y credibilidad'],
};
const QUESTIONS = {
  en: ['Built for a C-suite exec?', 'Outcomes, not a feature tour', 'Value story, not features dump', 'Trust them in front of a CxO?'],
  es: ['¿Pensado para un ejecutivo de primer nivel?', 'Resultados, no un recorrido de funciones', 'Historia de valor, no lista de funciones', '¿Confiaría en ellos frente a un ejecutivo?'],
};
const sections = [1, 2, 3, 4] as const;

test('the four sections are four sub-tabs, the first selected, each with its title, question and content', () => {
  for (const lang of ['en', 'es'] as const) {
    const first = render(fixture, lang);
    assert.match(first, /data-executive-view="" data-executive-schema="2\.0\.0" data-executive-valid="true"/);
    // one tab list of four tabs, in order, labelled with the rubric titles
    const list = first.slice(at(first, 'role="tablist"'), at(first, 'class="subtabpanels"'));
    const tabs = [...list.matchAll(/<button[^>]*role="tab"[^>]*>(.*?)<\/button>/g)];
    assert.equal(tabs.length, 4, `${lang}: four sub-tabs`);
    tabs.forEach((m, i) => {
      assert.equal(m[1], TITLES[lang][i], `${lang}: tab ${i + 1} is labelled with the title of section ${i + 1}`);
      assert.match(m[0], i === 0 ? /aria-selected="true"/ : /aria-selected="false"/, `${lang}: only the first is selected`);
    });
    assert.equal((first.match(/class="subtab[ "]/g) ?? []).length, 4);
    // each section sits in its own tab: only the open one is rendered, with its title and question
    for (const n of sections) {
      const html = render(fixture, lang, n);
      assert.equal((html.match(/data-exec-section="/g) ?? []).length, 1, `${lang}: one section at a time (tab ${n} open)`);
      const panel = html.slice(at(html, 'role="tabpanel"'), at(html, 'data-exec-notes'));
      const section = at(panel, `data-exec-section="${n}"`);
      const title = at(panel, `<h2>${TITLES[lang][n - 1]}</h2>`);
      const question = at(panel, `>${QUESTIONS[lang][n - 1]}</p>`);
      assert.ok(title > section && question > title, `${lang}: the question of section ${n} sits under its title`);
      assert.match(html.slice(at(html, 'role="tablist"'), at(html, 'class="subtabpanels"')), new RegExp(`<button[^>]*aria-selected="true"[^>]*>${TITLES[lang][n - 1]}</button>`), `${lang}: tab ${n} is the selected one`);
    }
  }
});

test('the three illustrations sit in their places with their captions', () => {
  const one = render(fixture, 'en', 1);
  const two = render(fixture, 'en', 2);
  const order = [
    at(one, 'data-exec-section="1"'),
    at(one, 'data-exec-field="initiative"'),
    at(one, 'data-exec-illustration="initiative"'),
    at(one, 'data-exec-line="why_now"'),
    at(one, 'data-exec-illustration="problem"'),
  ];
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'section 1: initiative, figure, why-now, figure');
  assert.doesNotMatch(one, /data-exec-illustration="solution"/, 'the solution is not in section 1');
  assert.deepEqual(
    [at(two, 'data-exec-section="2"'), at(two, 'data-exec-field="vision"'), at(two, 'data-exec-illustration="solution"')].sort((a, b) => a - b),
    [at(two, 'data-exec-section="2"'), at(two, 'data-exec-field="vision"'), at(two, 'data-exec-illustration="solution"')],
    'section 2: vision, then the solution',
  );
  assert.doesNotMatch(two, /data-exec-illustration="(initiative|problem)"/);
  for (const [html, name] of [[one, 'initiative'], [one, 'problem'], [two, 'solution']] as const) {
    const figure = html.slice(at(html, `<figure class="figure caos-exec-fig" data-exec-illustration="${name}"`));
    const caption = figure.slice(0, figure.indexOf('</figure>'));
    assert.match(caption, new RegExp(`<figcaption[^>]*>${fixture.illustrations[name].caption.en.replace(/[.]/g, '\\.')}</figcaption>`));
    assert.doesNotMatch(caption, /<img/);
  }
  assert.doesNotMatch(one + two, /<img/);
  // the Spanish caption in Spanish
  assert.match(render(fixture, 'es', 1), /Hoy la brecha entre ingresos y personal aparece demasiado tarde\./);
});

test('the sources are numbered linked notes under the sub-tabs, always visible, and none is inline', () => {
  for (const n of sections) {
    const html = render(fixture, 'en', n);
    const notes = html.slice(at(html, 'data-exec-notes'));
    assert.equal((notes.match(/<li /g) ?? []).length, 4, `tab ${n}: the four notes are there`);
    assert.ok(at(html, 'data-exec-notes') > at(html, 'class="subtabpanels"') + html.slice(at(html, 'class="subtabpanels"')).indexOf('</div></div>'), `tab ${n}: the notes come after the sub-tab panel`);
    const body = html.slice(0, at(html, 'data-exec-notes'));
    for (const s of fixture.sources) assert.ok(!body.includes(s.title.en), `tab ${n}: no source title outside the notes`);
  }
  const html = render(fixture, 'en', 1);
  const body = html.slice(0, at(html, 'data-exec-notes'));
  assert.match(body, /<sup[^>]*><a href="#[^"]*note-1"[^>]*>1<\/a><\/sup>/);
  assert.match(body, /note-4|note-1/);
  assert.match(render(fixture, 'en', 2), /<sup[^>]*><a href="#[^"]*note-4"[^>]*>4<\/a><\/sup>/);
});

test('every source note is its title as a link to its https url, then its note', () => {
  for (const lang of ['en', 'es'] as const) {
    const html = render(fixture, lang);
    const notes = html.slice(at(html, 'data-exec-notes'));
    const items = [...notes.matchAll(/<li [^>]*id="exec-note-(\d)"[^>]*>(.*?)<\/li>/g)];
    assert.equal(items.length, 4);
    items.forEach((m, i) => {
      const s = fixture.sources[i];
      const link = /<a [^>]*href="(https:\/\/[^"]+)"[^>]*>(.*?)<\/a>/.exec(m[2]);
      assert.ok(link, `${lang}: note ${i + 1} holds a link`);
      assert.equal(link![1], s.url);
      assert.equal(link![2], s.title[lang]);
      assert.match(m[2], /rel="noopener noreferrer"/);
      assert.ok(m[2].indexOf(s.note[lang]) > m[2].indexOf('</a>'), `${lang}: the note follows the link`);
    });
  }
  // a note is optional: the title alone
  const noNote = clone();
  delete noNote.sources[0].note;
  const html = render(noNote);
  const first = /<li [^>]*id="exec-note-1"[^>]*>(.*?)<\/li>/.exec(html.slice(at(html, 'data-exec-notes')));
  assert.ok(first && /^<a [^>]*>.*<\/a>$/.test(first[1]));
});

test('an invalid data file renders an error state with the field paths and no section', () => {
  const bad = clone();
  bad.outcomes.pop();
  bad.tagline = 'x';
  const html = render(bad);
  assert.match(html, /data-executive-valid="false"/);
  assert.match(html, /data-state="error"/);
  assert.match(html, /outcomes/);
  assert.match(html, /tagline/);
  assert.doesNotMatch(html, /data-exec-section|role="tablist"/);
  assert.ok(html.length > 200, 'never a blank');
  assert.match(render(null), /data-state="error"/);
  assert.match(render(undefined), /data-state="error"/);
  // a source without a link is an error state naming the field
  const noLink = clone();
  delete noLink.sources[2].url;
  assert.match(render(noLink), /sources\[2\]\.url/);
});

test('section 3 is pending while FOUR_CS is empty and lists the rows once it is filled', () => {
  const en = render(fixture, 'en', 3);
  const s3 = en.slice(at(en, 'data-exec-section="3"'), at(en, 'data-exec-notes'));
  assert.match(s3, /data-state="unavailable"/);
  assert.match(s3, /Pending: the 4 C&#x27;s are defined by the product owner/);
  assert.match(render(fixture, 'es', 3), /Pendiente: las 4 C las define el responsable del producto/);
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta'];
  const filled = clone();
  filled.four_cs = names.map((c) => ({ c: { en: c, es: c }, exec_problem: { en: `${c} ties to the executive problem.`, es: `${c} se ata al problema.` } }));
  const html = render(filled, 'en', 3, names);
  const rows = html.slice(at(html, 'data-exec-section="3"'), at(html, 'data-exec-notes'));
  assert.doesNotMatch(rows, /data-state="unavailable"/);
  assert.equal((rows.match(/data-exec-c=/g) ?? []).length, 4);
  assert.ok(rows.indexOf('Alpha') < rows.indexOf('Beta') && rows.indexOf('Gamma') < rows.indexOf('Delta'));
  // a four_cs the product wrote while the names are unset is a data error, not a rendering
  const early = clone();
  early.four_cs = filled.four_cs;
  assert.match(render(early), /data-executive-valid="false"/);
});

test('the view ignores children and cannot be extended', () => {
  const props = { data: fixture, children: <section data-doc-section="">a fifth section</section> } as unknown as React.ComponentProps<typeof ExecutiveView>;
  const html = renderToStaticMarkup(<ExecutiveView {...props} />);
  assert.doesNotMatch(html, /a fifth section/);
  assert.equal((html.match(/data-exec-section="/g) ?? []).length, 1, 'the open sub-tab shows its section');
  assert.equal((html.match(/role="tab"/g) ?? []).length, 4, 'four sub-tabs, no more');
  assert.equal((html.match(/data-exec-illustration="/g) ?? []).length, 2, 'section 1 holds the initiative and the problem');
});
