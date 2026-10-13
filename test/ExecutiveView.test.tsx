import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExecutiveView, ExecutiveViewBody } from '../src/content/ExecutiveView.tsx';
import { FOUR_CS } from '../src/content/executive.ts';

/** The executive view (CAOS_MANAGE conventions/problem-context-first.md): the landing block, five sub-tabs, three illustrations, linked numbered sources, two onward links. */

const fixture = JSON.parse(readFileSync(new URL('./gate-fixture/executive/executive.json', import.meta.url), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(fixture));
/** `open` is the sub-tab shown first (the test seam of ExecutiveViewBody; the product-facing view always opens the first). */
const render = (data: unknown, lang: 'en' | 'es' = 'en', open?: number) => renderToStaticMarkup(<ExecutiveViewBody data={data} lang={lang} open={open} />);
const at = (html: string, needle: string) => {
  const i = html.indexOf(needle);
  assert.ok(i >= 0, `"${needle}" is not in the markup`);
  return i;
};
const count = (html: string, needle: RegExp) => (html.match(needle) ?? []).length;
const sections = [1, 2, 3, 4, 5] as const;

const TITLES = {
  en: ['The pain', 'The context', 'The current situation', 'The trends', 'The proposal'],
  es: ['El problema', 'El contexto', 'La situación actual', 'Las tendencias', 'La propuesta'],
};
// the rubric's labels and questions are never printed (Felipe, 2026-10-13)
const RUBRIC = ['Industry &amp; Exec Tailoring', 'AI Transformation Story', '4Cs Positioning', 'Delivery &amp; Credibility', 'Built for a C-suite exec?', 'Outcomes, not a feature tour', 'Value story, not features dump', 'Trust them in front of a CxO?', 'Industria y foco ejecutivo', 'Historia de transformación con IA', 'Posicionamiento 4C', 'Entrega y credibilidad', 'Resultados, no un recorrido de funciones', 'Historia de valor, no lista de funciones'];

test('the landing block shows the title, the key statement and two or three headline figures above the sub-tabs', () => {
  for (const lang of ['en', 'es'] as const) {
    const html = render(fixture, lang);
    const landing = html.slice(at(html, 'data-exec-landing'), at(html, 'data-exec-tabs'));
    assert.ok(landing.includes(fixture.title[lang]), `${lang}: the title`);
    assert.ok(landing.includes(fixture.key_statement[lang]), `${lang}: the key statement`);
    assert.equal(count(landing, /data-exec-item="headline_figures"/g), 3);
    fixture.headline_figures.forEach((f: any, i: number) => {
      assert.ok(landing.includes(f.heading[lang]) && landing.includes(f.unit[lang]), `${lang}: headline figure ${i + 1}`);
      assert.match(landing, new RegExp(`<sup class="caos-exec-cite"><a href="#exec-note-${i + 1}"`), `${lang}: its source`);
    });
    assert.ok(at(html, 'data-exec-landing') < at(html, 'role="tablist"'), 'the landing block sits above the sub-tabs');
  }
});

test('the five sections are five sub-tabs, the first selected, each opening with its key message and holding no rubric label or question', () => {
  for (const lang of ['en', 'es'] as const) {
    const first = render(fixture, lang);
    assert.match(first, /data-executive-view="" data-executive-schema="2\.0\.0" data-executive-valid="true"/);
    const list = first.slice(at(first, 'role="tablist"'), at(first, 'class="subtabpanels"'));
    const tabs = [...list.matchAll(/<button[^>]*role="tab"[^>]*>(.*?)<\/button>/g)];
    assert.equal(tabs.length, 5, `${lang}: five sub-tabs`);
    tabs.forEach((m, i) => {
      assert.equal(m[1], TITLES[lang][i], `${lang}: tab ${i + 1} is labelled with the title of section ${i + 1}`);
      assert.match(m[0], i === 0 ? /aria-selected="true"/ : /aria-selected="false"/, `${lang}: only the first is selected`);
    });
    for (const n of sections) {
      const html = render(fixture, lang, n);
      assert.equal(count(html, /data-exec-section="/g), 1, `${lang}: one section at a time (tab ${n} open)`);
      const panel = html.slice(at(html, 'role="tabpanel"'), at(html, 'data-exec-notes'));
      const section = panel.slice(at(panel, `<section class="caos-exec-section" data-exec-section="${n}"`));
      // the key message line comes first, inside the section
      assert.match(section, /^<section[^>]*>\s*<p class="caos-exec-key" data-exec-key-message=""/, `${lang}: tab ${n} opens with its key message`);
      assert.match(html.slice(at(html, 'role="tablist"'), at(html, 'class="subtabpanels"')), new RegExp(`<button[^>]*aria-selected="true"[^>]*>${TITLES[lang][n - 1]}</button>`), `${lang}: tab ${n} is the selected one`);
      assert.doesNotMatch(html, /data-exec-question|caos-exec-question/, `${lang}: no question line`);
      for (const x of RUBRIC) assert.ok(!html.includes(x), `${lang}: tab ${n} prints the rubric text "${x}"`);
    }
  }
});

test('each sub-tab shows its supporting content at the floors of the structure', () => {
  const pain = render(fixture, 'en', 1);
  assert.equal(count(pain, /data-exec-item="pain\.paragraphs"/g), 2);
  assert.equal(count(pain, /data-exec-item="pain\.bearers"/g), 3);
  assert.equal(count(pain, /data-exec-item="pain\.figures"/g), 2);
  assert.equal(count(pain, /data-exec-item="pain\.causes"/g), 3);
  assert.match(pain, /data-exec-weight="45"[^>]*>.*?45%/s, 'a cause with its weight');
  const context = render(fixture, 'en', 2);
  assert.equal(count(context, /data-exec-item="context\.paragraphs"/g), 1);
  assert.equal(count(context, /data-exec-item="context\.forces"/g), 3);
  assert.match(context, /data-exec-direction="rising"/);
  assert.match(context, /<span class="caos-exec-badge">Rising<\/span>/);
  assert.equal(count(context, /data-exec-item="context\.evidence"/g), 2);
  assert.ok(context.includes(fixture.context.setting.en));
  const situation = render(fixture, 'en', 3);
  assert.equal(count(situation, /data-exec-item="situation\.roles"/g), 3);
  assert.equal(count(situation, /data-exec-item="situation\.state_of_the_art"/g), 3);
  assert.equal(count(situation, /data-exec-item="situation\.status"/g), 1);
  assert.ok(situation.includes(fixture.situation.interaction.en));
  assert.ok(situation.includes(fixture.situation.status.date.en));
  const trends = render(fixture, 'en', 4);
  assert.equal(count(trends, /data-exec-item="trends\.items"/g), 3);
  for (const word of ['Regulatory', 'Technological', 'Market', 'Now', 'In two years', 'In ten years', 'Confidence: High']) assert.ok(trends.includes(word), `trend badge ${word}`);
  const proposal = render(fixture, 'en', 5);
  assert.equal(count(proposal, /data-exec-item="proposal\.paragraphs"/g), 1);
  assert.equal(count(proposal, /data-exec-item="proposal\.actions"/g), 3);
  assert.equal(count(proposal, /data-exec-item="proposal\.risks"/g), 2);
  assert.equal(count(proposal, /data-exec-item="proposal\.unknowns"/g), 1);
  assert.ok(proposal.includes(fixture.proposal.handoff.en));
  // every action names an owner that is a role of the situation
  for (const a of fixture.proposal.actions) assert.ok(proposal.includes(a.owner.en));
  const noHandoff = clone();
  delete noHandoff.proposal.handoff;
  assert.doesNotMatch(render(noHandoff, 'en', 5), /caos-exec-handoff/);
});

test('the three illustrations sit in their places with their captions', () => {
  const one = render(fixture, 'en', 1);
  const three = render(fixture, 'en', 3);
  const five = render(fixture, 'en', 5);
  assert.ok(at(one, 'data-exec-item="pain.paragraphs"') < at(one, 'data-exec-illustration="pain"'), 'the pain drawing follows the paragraphs');
  assert.equal(count(one, /data-exec-illustration="/g), 1);
  assert.equal(count(three, /data-exec-illustration="situation"/g), 1);
  assert.equal(count(five, /data-exec-illustration="proposal"/g), 1);
  assert.doesNotMatch(render(fixture, 'en', 2) + render(fixture, 'en', 4), /data-exec-illustration/);
  for (const [html, name] of [[one, 'pain'], [three, 'situation'], [five, 'proposal']] as const) {
    const figure = html.slice(at(html, `<figure class="figure caos-exec-fig" data-exec-illustration="${name}"`));
    const caption = figure.slice(0, figure.indexOf('</figure>'));
    assert.match(caption, new RegExp(`<figcaption[^>]*>${fixture.illustrations[name].caption.en.replace(/[.]/g, '\\.')}</figcaption>`));
    assert.doesNotMatch(caption, /<img/);
  }
  assert.doesNotMatch(one + three + five, /<img/);
  assert.match(render(fixture, 'es', 1), /Hoy la brecha entre ingresos y personal aparece demasiado tarde\./);
});

test('the sources are numbered linked notes under the sub-tabs, always visible, and none is inline', () => {
  for (const n of sections) {
    const html = render(fixture, 'en', n);
    const notes = html.slice(at(html, 'data-exec-notes'));
    assert.equal(count(notes, /<li /g), 7, `tab ${n}: the seven notes are there`);
    assert.ok(at(html, 'data-exec-notes') > at(html, 'class="subtabpanels"') + html.slice(at(html, 'class="subtabpanels"')).indexOf('</div></div>'), `tab ${n}: the notes come after the sub-tab panel`);
    const body = html.slice(0, at(html, 'data-exec-notes'));
    for (const s of fixture.sources) assert.ok(!body.includes(s.title.en), `tab ${n}: no source title outside the notes`);
  }
  // numbered in the order of first use: the landing, then the sub-tabs
  assert.match(render(fixture, 'en', 1), /<sup[^>]*><a href="#exec-note-3"[^>]*>3<\/a><\/sup>/);
  assert.match(render(fixture, 'en', 3), /<sup[^>]*><a href="#exec-note-7"[^>]*>7<\/a><\/sup>/);
});

test('every source note is its title as a link to its https url, then its note', () => {
  for (const lang of ['en', 'es'] as const) {
    const html = render(fixture, lang);
    const notes = html.slice(at(html, 'data-exec-notes'));
    const items = [...notes.matchAll(/<li [^>]*id="exec-note-(\d)"[^>]*>(.*?)<\/li>/g)];
    assert.equal(items.length, 7);
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

test('two onward links under the sources: the technical view and the App', () => {
  for (const [lang, technical, app] of [['en', 'How the work explores this problem', 'Open the App'], ['es', 'Cómo explora el trabajo este problema', 'Abrir la App']] as const) {
    const html = render(fixture, lang);
    const links = html.slice(at(html, 'data-exec-links'));
    assert.ok(at(html, 'data-exec-links') > at(html, 'data-exec-notes'), 'the links come after the sources');
    assert.match(links, new RegExp(`data-exec-link="technical">${technical}</a>`));
    assert.match(links, new RegExp(`href="/app"[^>]*data-exec-link="app">${app}</a>|data-exec-link="app"[^>]*>${app}</a>`));
    assert.equal(count(links, /<a /g), 2);
  }
});

test('an invalid data file renders an error state with the field paths and no section', () => {
  const bad = clone();
  bad.pain.bearers.pop();
  bad.pain.bearers.pop();
  bad.tagline = 'x';
  const html = render(bad);
  assert.match(html, /data-executive-valid="false"/);
  assert.match(html, /data-state="error"/);
  assert.match(html, /pain\.bearers/);
  assert.match(html, /tagline/);
  assert.doesNotMatch(html, /data-exec-section|role="tablist"|data-exec-landing/);
  assert.ok(html.length > 200, 'never a blank');
  assert.match(render(null), /data-state="error"/);
  assert.match(render(undefined), /data-state="error"/);
  // the 4 C's are required: a file without them is an error state, never a section with a gap
  const noCs = clone();
  delete noCs.proposal.four_cs;
  assert.match(render(noCs), /proposal\.four_cs/);
  assert.match(render(noCs), /data-executive-valid="false"/);
  // a source without a link is an error state naming the field
  const noLink = clone();
  delete noLink.sources[2].url;
  assert.match(render(noLink), /sources\[2\]\.url/);
  // a client-bound word is an error state naming the field
  const pitch = clone();
  pitch.title.en = 'Contact us about winter staffing gaps';
  assert.match(render(pitch), /title\.en/);
});

test("the proposal shows each of the 4 C's with its name, its definition and what it means for the proposal, in both languages", () => {
  for (const lang of ['en', 'es'] as const) {
    const html = render(fixture, lang, 5);
    const cs = html.slice(at(html, 'class="caos-exec-cs"'), at(html, 'caos-exec-actions'));
    assert.equal(count(cs, /data-exec-c="/g), 4);
    let last = -1;
    FOUR_CS.forEach((c, i) => {
      const row = at(cs, `data-exec-c="${i}"`);
      assert.ok(row > last, `${lang}: C ${i + 1} follows C ${i}`);
      last = row;
      const item = cs.slice(row, i < 3 ? at(cs, `data-exec-c="${i + 1}"`) : undefined);
      assert.match(item, new RegExp(`data-exec-cname="">${c.name[lang]}</strong>`));
      assert.match(item, new RegExp(`class="caos-exec-cdef"[^>]*data-exec-cdef="">${c.definition[lang].replace(/[.]/g, '\\.')}</small>`));
      assert.ok(item.includes(fixture.proposal.four_cs[i].applies[lang]), `${lang}: what C ${i + 1} means for the proposal`);
      assert.ok(item.indexOf(c.name[lang]) < item.indexOf(c.definition[lang]) && item.indexOf(c.definition[lang]) < item.indexOf(fixture.proposal.four_cs[i].applies[lang]), 'name, definition, then the application');
    });
  }
});

test('the view ignores children and cannot be extended', () => {
  const props = { data: fixture, children: <section data-doc-section="">a fifth section</section> } as unknown as React.ComponentProps<typeof ExecutiveView>;
  const html = renderToStaticMarkup(<ExecutiveView {...props} />);
  assert.doesNotMatch(html, /a fifth section/);
  assert.equal(count(html, /data-exec-section="/g), 1, 'the open sub-tab shows its section');
  assert.equal(count(html, /role="tab"/g), 5, 'five sub-tabs, no more');
  assert.equal(count(html, /data-exec-illustration="/g), 1, 'section 1 holds the pain drawing');
});
