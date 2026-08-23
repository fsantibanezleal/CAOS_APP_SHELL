import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArchitectureModal } from '../src/shell/ArchitectureModal.tsx';

// One diagram file carries BOTH languages; the wrapper picks one. See ADR-0058.
//
// What this file can and cannot prove. These are server renders, and two things do not happen in
// one: zustand's server snapshot returns the store's INITIAL state, so the language cannot be
// switched here, and `useEffect` never runs, so the SVG is never fetched or inlined. Asserting
// Spanish output from `renderToStaticMarkup` would therefore be asserting nothing.
//
// So this file proves the contract that SSR can actually see: the diagram is wrapped in an element
// carrying `data-arch-lang`, which is the hook the shell stylesheet keys on. That the Spanish text
// is the visible one, and that it stays inside its viewBox once Spanish makes every string longer,
// is verified in a real browser by the consuming app's architecture gate.
const SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" class="arch-svg">',
  '  <text class="ttl l-en" x="10" y="20">Block model</text>',
  '  <text class="ttl l-es" x="10" y="20">Modelo de bloques</text>',
  '  <text class="mono" x="10" y="44">case-results.json</text>',
  '</svg>',
].join('\n');

const config = {
  tabs: [
    {
      id: 'app',
      en: 'The app',
      es: 'La aplicacion',
      body_en: 'What the app is.',
      body_es: 'Que es la aplicacion.',
      svg: SVG,
    },
  ],
};

test('the diagram is wrapped in the element the language stylesheet keys on', () => {
  const html = renderToStaticMarkup(<ArchitectureModal config={config} onClose={() => {}} />);

  // The hook exists and defaults to English, which is ADR-0011: English is the default, always.
  assert.match(html, /data-arch-lang="en"/);

  // The tab and its body render from the same default.
  assert.match(html, /The app/);
  assert.match(html, /What the app is\./);
});

test('an inline svg string is recognised and not treated as a fetch path', () => {
  // A path would leave the panel in its loading state with no error; an inline string must not
  // reach the network at all. There is no fetch in this environment, so a regression would throw.
  const html = renderToStaticMarkup(<ArchitectureModal config={config} onClose={() => {}} />);
  assert.doesNotMatch(html, /SVG: /);
});
