import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExecutiveView, ExecutiveViewBody } from '../src/content/ExecutiveView.tsx';

/** The executive view (CAOS_MANAGE conventions/problem-context-first.md): four sections, three illustrations, numbered sources. */

const fixture = JSON.parse(readFileSync(new URL('./gate-fixture/executive/executive.json', import.meta.url), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(fixture));
const render = (data: unknown, fourCs: readonly string[] = [], lang: 'en' | 'es' = 'en') => {
  return renderToStaticMarkup(<ExecutiveViewBody data={data} fourCs={fourCs} lang={lang} />);
};
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

test('the four sections come with their titles and questions in order, in both languages', () => {
  for (const lang of ['en', 'es'] as const) {
    const html = render(fixture, [], lang);
    assert.match(html, /data-executive-view="" data-executive-schema="1\.0\.0" data-executive-valid="true"/);
    let last = -1;
    for (let n = 0; n < 4; n += 1) {
      const section = at(html, `data-exec-section="${n + 1}"`);
      assert.ok(section > last, `section ${n + 1} follows section ${n}`);
      last = section;
      const title = at(html, `<h2>${TITLES[lang][n]}</h2>`);
      const question = at(html, `>${QUESTIONS[lang][n]}</p>`);
      assert.ok(title > section && question > title, `${lang}: the question of section ${n + 1} sits under its title`);
    }
    assert.equal((html.match(/data-exec-section="/g) ?? []).length, 4);
  }
});

test('the three illustrations sit in their places with their captions', () => {
  const html = render(fixture);
  const order = [
    at(html, 'data-exec-section="1"'),
    at(html, 'data-exec-field="initiative"'),
    at(html, 'data-exec-illustration="initiative"'),
    at(html, 'data-exec-line="why_now"'),
    at(html, 'data-exec-illustration="problem"'),
    at(html, 'data-exec-section="2"'),
    at(html, 'data-exec-field="vision"'),
    at(html, 'data-exec-illustration="solution"'),
    at(html, 'data-exec-section="3"'),
  ];
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'initiative, figure, why-now, figure, then section 2: vision, figure');
  for (const name of ['initiative', 'problem', 'solution']) {
    const figure = html.slice(at(html, `<figure class="figure caos-exec-fig" data-exec-illustration="${name}"`));
    const caption = figure.slice(0, figure.indexOf('</figure>'));
    assert.match(caption, new RegExp(`<figcaption[^>]*>${fixture.illustrations[name].caption.en.replace(/[.]/g, '\\.')}</figcaption>`));
    assert.doesNotMatch(caption, /<img/);
  }
  assert.doesNotMatch(html, /<img/);
  // the Spanish caption in Spanish
  assert.match(render(fixture, [], 'es'), /Hoy la brecha entre ingresos y personal aparece demasiado tarde\./);
});

test('the sources are numbered notes under the view and none is inline', () => {
  const html = render(fixture);
  const notes = html.slice(at(html, 'data-exec-notes'));
  assert.equal((notes.match(/<li /g) ?? []).length, 4);
  assert.match(notes, /Fixture record, not a real hospital\./);
  assert.ok(at(html, 'data-exec-notes') > at(html, 'data-exec-section="4"'), 'the notes come after the last section');
  const body = html.slice(0, at(html, 'data-exec-notes'));
  assert.doesNotMatch(body, /Fixture record|Pilot ward log|Audit trail/, 'no source text outside the notes');
  assert.match(body, /<sup[^>]*><a href="#[^"]*note-1"[^>]*>1<\/a><\/sup>/);
  assert.match(body, /note-4/);
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
  assert.doesNotMatch(html, /data-exec-section/);
  assert.ok(html.length > 200, 'never a blank');
  assert.match(render(null), /data-state="error"/);
  assert.match(render(undefined), /data-state="error"/);
});

test('section 3 is pending while FOUR_CS is empty and lists the rows once it is filled', () => {
  const en = render(fixture);
  const s3 = en.slice(at(en, 'data-exec-section="3"'), at(en, 'data-exec-section="4"'));
  assert.match(s3, /data-state="unavailable"/);
  assert.match(s3, /Pending: the 4 C&#x27;s are defined by the product owner/);
  assert.match(render(fixture, [], 'es'), /Pendiente: las 4 C las define el responsable del producto/);
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta'];
  const filled = clone();
  filled.four_cs = names.map((c) => ({ c: { en: c, es: c }, exec_problem: { en: `${c} ties to the executive problem.`, es: `${c} se ata al problema.` } }));
  const html = render(filled, names);
  const rows = html.slice(at(html, 'data-exec-section="3"'), at(html, 'data-exec-section="4"'));
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
  assert.equal((html.match(/data-exec-section="/g) ?? []).length, 4);
  assert.equal((html.match(/data-exec-illustration="/g) ?? []).length, 3);
});
