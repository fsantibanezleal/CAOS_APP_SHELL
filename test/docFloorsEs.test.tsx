import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** A reader who chose Spanish: the stored language is read when the shell loads, so it is set before the import. */
(globalThis as { localStorage?: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
  getItem: (k: string) => (k === 'caos.lang' ? 'es' : null),
  setItem: () => undefined,
};

test('in Spanish the Glossary, the Stat and the waivers of a DocPage show the Spanish text', async () => {
  const { DocPage } = await import('../src/content/DocPage.tsx');
  const { Glossary } = await import('../src/content/Glossary.tsx');
  const { Stat } = await import('../src/content/Stat.tsx');
  const html = renderToStaticMarkup(
    <DocPage title="T" lede="L" floorWaivers={[{ floor: 'math', reason: { en: 'No governing equation exists.', es: 'No existe una ecuación gobernante.' } }]}>
      <Glossary entries={[{ term: 'γ', definition: { en: 'the recovery rate', es: 'la tasa de recuperación' } }]} />
      <Stat value="12" unit={{ en: 'minutes', es: 'minutos' }} source={{ en: 'a log', es: 'un registro' }} />
    </DocPage>,
  );
  assert.match(html, /data-floor-waiver="math: No existe una ecuación gobernante\."/);
  assert.match(html, /<dd>la tasa de recuperación<\/dd>/);
  assert.match(html, /data-stat-unit="minutos" data-stat-source="un registro"/);
});
