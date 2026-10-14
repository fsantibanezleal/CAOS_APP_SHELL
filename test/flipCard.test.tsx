import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FLIP_LIMITS, FLIP_TEXT, FlipCard } from '../src/content/FlipCard.tsx';
import { FLIP_LIMITS as GATE_FLIP_LIMITS } from '../gate/areas.mjs';

/** FlipCard (shell 0.14.0, BL-060): a small card whose face shows its title and whose back shows its content after a click or a key press. */

const render = (props: Partial<React.ComponentProps<typeof FlipCard>> = {}) =>
  renderToStaticMarkup(
    <FlipCard title="Patients on a surgical list" label="Patients on a surgical list" {...props}>
      <p>A cancelled operation and weeks of extra waiting.</p>
    </FlipCard>,
  );

test('a closed flip card shows the title on a real button and keeps the back in the DOM, hidden from assistive technology', () => {
  const html = render();
  assert.match(html, /<button[^>]*type="button"[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+"[^>]*data-flip-toggle="front"/, 'the face is a real button with aria-expanded and aria-controls');
  const controls = /data-flip-toggle="front"[^>]*aria-controls="([^"]+)"|aria-controls="([^"]+)"[^>]*data-flip-toggle="front"/.exec(html);
  const id = controls?.[1] ?? controls?.[2];
  assert.ok(id, 'the toggle names the back it controls');
  assert.match(html, new RegExp(`id="${id}"[^>]*data-flip-back|data-flip-back[^>]*id="${id}"`), 'the back carries the id the toggle controls');
  assert.match(html, /data-flip-open="false"/);
  assert.match(html, /<span class="caos-flip-title" data-flip-title="">Patients on a surgical list<\/span>/, 'the title is on the face');
  assert.match(html, /A cancelled operation and weeks of extra waiting\./, 'the back content stays in the markup (search, copy and the gate read it)');
  assert.match(html, /class="caos-flip-face caos-flip-back"[^>]*aria-hidden="true"/, 'the closed back is out of the accessibility tree');
  assert.doesNotMatch(html, /class="caos-flip-face caos-flip-front"[^>]*aria-hidden/, 'the visible face is in the tree');
});

test('an open flip card shows the back and hides the face from assistive technology', () => {
  const html = render({ defaultOpen: true });
  assert.match(html, /data-flip-open="true"/);
  assert.match(html, /class="caos-flip-face caos-flip-front"[^>]*aria-hidden="true"/, 'the face is hidden while the back shows');
  assert.doesNotMatch(html, /class="caos-flip-face caos-flip-back"[^>]*aria-hidden/, 'the shown back is in the tree');
  assert.match(html, /aria-expanded="true"/);
});

test('the face and the back name the action in both languages with a hidden label and a turn icon', () => {
  for (const lang of ['en', 'es'] as const) {
    const html = render({ lang });
    assert.ok(html.includes(`<span class="sr-only">${FLIP_TEXT.show[lang]}</span>`), `${lang}: the face carries "${FLIP_TEXT.show[lang]}"`);
    assert.ok(html.includes(`<span class="sr-only">${FLIP_TEXT.hide[lang]}</span>`), `${lang}: the back carries "${FLIP_TEXT.hide[lang]}"`);
    assert.match(html, /<svg[^>]*class="[^"]*caos-flip-icon[^"]*"[^>]*aria-hidden="true"|<svg[^>]*aria-hidden="true"[^>]*class="[^"]*caos-flip-icon/, `${lang}: a turn icon hidden from assistive technology`);
  }
  assert.equal(FLIP_TEXT.show.es, 'Mostrar detalles');
  assert.equal(FLIP_TEXT.hide.es, 'Ocultar detalles');
});

test('the flip limits of the component and of the gate are equal', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(FLIP_LIMITS)), JSON.parse(JSON.stringify(GATE_FLIP_LIMITS)));
  assert.deepEqual(FLIP_LIMITS, { title: { en: 8, es: 10 }, back: { en: 40, es: 50 } });
});

test('the flip card and deck rules use theme tokens and no literal colour, and reduced motion removes the turn', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const rules = [...css.matchAll(/([^{}]*\.caos-(?:flip|deck)[^{}]*)\{([^{}]*)\}/g)].map((m) => `${m[1].trim()} { ${m[2].trim()} }`);
  assert.ok(rules.length >= 10, `the stylesheet defines the flip and deck rules (${rules.length})`);
  for (const r of rules) assert.doesNotMatch(r, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, `a literal colour in: ${r}`);
  const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*caos-flip-inner[^@]*\}/.exec(css);
  assert.ok(reduced, 'a reduced-motion block names the flip card');
  assert.match(reduced![0], /transform:\s*none/, 'reduced motion turns nothing');
});
