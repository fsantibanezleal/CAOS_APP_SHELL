import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExecutiveViewBody } from '../src/content/ExecutiveView.tsx';
import { FOUR_CS } from '../src/content/executive.ts';

/** The executive view's flip groups (shell 0.14.0, decision 3 of the plan): the rule of use, applied. */

const fixture = JSON.parse(readFileSync(new URL('./gate-fixture/executive/executive.json', import.meta.url), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(fixture));
const render = (data: unknown, open: number, lang: 'en' | 'es' = 'en') => renderToStaticMarkup(<ExecutiveViewBody data={data} lang={lang} open={open} />);
const flipsIn = (html: string, kind: string) => {
  const items = [...html.matchAll(new RegExp(`<li[^>]*data-exec-item="${kind.replace('.', '\\.')}"[^>]*>(.*?)</li>`, 'g'))];
  return { items: items.length, flips: items.filter((m) => m[1].includes('data-flip-card')).length };
};
const deckAround = (html: string, kind: string) => {
  const at = html.indexOf(`data-exec-item="${kind}"`);
  assert.ok(at > 0, kind);
  const start = html.lastIndexOf('data-card-deck', at);
  return html.slice(start, start + 200);
};

test('pain.bearers, situation.roles, situation.state_of_the_art and proposal.four_cs are flip cards; the other card groups stay plain', () => {
  const sections: Array<[number, string, boolean]> = [
    [1, 'pain.bearers', true],
    [2, 'context.forces', false],
    [3, 'situation.roles', true],
    [3, 'situation.state_of_the_art', true],
    [4, 'trends.items', false],
    [5, 'proposal.four_cs', true],
    [5, 'proposal.actions', false],
  ];
  for (const [open, kind, flips] of sections) {
    const html = render(clone(), open);
    const r = flipsIn(html, kind);
    assert.ok(r.items >= 3, `${kind}: ${r.items} cards`);
    assert.equal(r.flips, flips ? r.items : 0, `${kind}: ${flips ? 'every card flips' : 'no card flips'}`);
  }
});

test('five cards in a flip group make a carousel and four or fewer make a row', () => {
  const five = render(clone(), 1);
  assert.equal(flipsIn(five, 'pain.bearers').items, 5);
  assert.match(deckAround(five, 'pain.bearers'), /data-deck-mode="carousel"/);
  const four = clone();
  four.pain.bearers.pop();
  assert.match(deckAround(render(four, 1), 'pain.bearers'), /data-deck-mode="row"/);
  assert.match(deckAround(render(clone(), 5), 'proposal.four_cs'), /data-deck-mode="row"/, 'the 4 C\'s are four cards, a row');
});

test('the back of every flip card stays in the markup, and the four Cs keep their name, definition and meaning in both languages', () => {
  for (const lang of ['en', 'es'] as const) {
    const html = render(clone(), 5, lang);
    FOUR_CS.forEach((c, i) => {
      assert.ok(html.includes(`data-exec-cname="">${c.name[lang]}</span>`) || html.includes(`>${c.name[lang]}</span>`), `${lang}: the name of C ${i + 1}`);
      assert.ok(html.includes(c.definition[lang]), `${lang}: the definition of C ${i + 1} is in the back`);
      assert.ok(html.includes(fixture.proposal.four_cs[i].applies[lang]), `${lang}: what C ${i + 1} means is in the back`);
      assert.match(html, new RegExp(`data-exec-c="${i}"`));
    });
    const bearers = render(clone(), 1, lang);
    for (const b of fixture.pain.bearers) assert.ok(bearers.includes(b.cost[lang]) && bearers.includes(b.measure[lang]), `${lang}: cost and measure of a bearer are in the back`);
  }
});

test('the data-exec-field of a flip card appears once, on the face, never repeated on the back', () => {
  const html = render(clone(), 3);
  const paths = [...html.matchAll(/data-exec-field="(situation\.roles\[\d+\]\.role)"/g)].map((m) => m[1]);
  assert.equal(new Set(paths).size, paths.length, 'a field path is declared once');
  assert.equal(paths.length, 3);
});
