import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Callout } from '../src/content/Callout.tsx';
import { DocPage, DocSection } from '../src/content/DocPage.tsx';
import { Glossary } from '../src/content/Glossary.tsx';
import { Question } from '../src/content/Question.tsx';
import { Stat } from '../src/content/Stat.tsx';

/** 0.11.0: the product-side contracts of the required areas (ADR-0017 section 2.1; gate/areas.mjs). */

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);

test('DocSection renders its area and method kind as data-area and data-method-kind', () => {
  const out = html(
    <DocSection title="T" area="method" kind="learned" noRefsReason="a stated reason">
      <p>x</p>
    </DocSection>,
  );
  assert.match(out, /data-doc-section="" data-area="method" data-method-kind="learned"/);
  const plain = html(
    <DocSection title="T" noRefsReason="a stated reason">
      <p>x</p>
    </DocSection>,
  );
  assert.doesNotMatch(plain, /data-area|data-method-kind/);
});

test('Glossary renders a data-glossary list with one item per entry in the displayed language', () => {
  const entries = [
    { term: 'β', definition: { en: 'the contact rate', es: 'la tasa de contacto' } },
    { term: 'γ', definition: { en: 'the recovery rate', es: 'la tasa de recuperación' } },
  ];
  const en = html(<Glossary entries={entries} />);
  assert.match(en, /<dl class="caos-glossary" data-glossary="">/);
  assert.equal((en.match(/<dt>/g) ?? []).length, 2);
  assert.match(en, /<dd>the contact rate<\/dd>/);
});

test('DocPage renders floorWaivers as data-floor-waiver in the displayed language', () => {
  const waivers = [
    { floor: 'math', reason: { en: 'No governing equation exists.', es: 'No existe una ecuación gobernante.' } },
    { floor: 'live', reason: 'A plain reason that holds in both.' },
  ];
  const page = html(
    <DocPage title="T" lede="L" floorWaivers={waivers}>
      <p>x</p>
    </DocPage>,
  );
  assert.match(page, /data-floor-waiver="math: No governing equation exists\.; live: A plain reason that holds in both\."/);
  assert.doesNotMatch(
    html(
      <DocPage title="T" lede="L">
        <p>x</p>
      </DocPage>,
    ),
    /data-floor-waiver/,
  );
});

test('Callout renders its variant as data-callout', () => {
  for (const v of ['note', 'honest', 'strong'] as const) assert.match(html(<Callout variant={v}>x</Callout>), new RegExp(`data-callout="${v}"`));
  assert.match(html(<Callout>x</Callout>), /data-callout="note"/);
});

test('Stat renders a data-stat with its unit and its source, and Question a data-qa with both halves', () => {
  const stat = html(<Stat value="12" unit={{ en: 'minutes', es: 'minutos' }} source={{ en: 'a log', es: 'un registro' }} />);
  assert.match(stat, /data-stat="" data-stat-unit="minutes" data-stat-source="a log"/);
  assert.match(stat, /<strong class="caos-stat-value">12<\/strong>/);
  const qa = html(<Question question="Why?" answer={<p>Because.</p>} />);
  assert.match(qa, /data-qa=""/);
  assert.match(qa, /<p class="caos-qa-question" data-question="">Why\?<\/p>/);
  assert.match(qa, /data-answer=""><p>Because\.<\/p>/);
});
