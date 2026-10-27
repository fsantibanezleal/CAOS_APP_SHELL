import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** A reader who chose Spanish: the stored language is read when the shell loads, so it is set before the import. */
(globalThis as { localStorage?: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
  getItem: (k: string) => (k === 'caos.lang' ? 'es' : null),
  setItem: () => undefined,
};

test('the lane badges read in Spanish without the English word "offline" (found by the CAOS_Contraste capture review U16-R3)', async () => {
  const { LaneBadge } = await import('../src/workbench/LaneBadge.tsx');
  const html = renderToStaticMarkup(
    <>
      <LaneBadge lane="replay" />
      <LaneBadge lane="offline" />
      <LaneBadge lane="live" />
    </>,
  );
  assert.match(html, /Reproduce el resultado precalculado/);
  assert.match(html, /Solo precalculado/);
  assert.doesNotMatch(html, />[^<]*offline[^<]*</i);
});

test('a reference without a DOI is linked as "enlace" on a Spanish page, never the English "link"', async () => {
  const { CitationsProvider, DocReferences } = await import('../src/content/Cite.tsx');
  const html = renderToStaticMarkup(
    <CitationsProvider items={[{ id: 'a', label: { en: 'A 2020', es: 'A 2020' }, citation: 'A. Author (2020). A title.', url: 'https://example.org/a' }]}>
      <DocReferences ids={['a']} />
    </CitationsProvider>,
  );
  assert.match(html, />enlace</);
  assert.doesNotMatch(html, />link</);
});
