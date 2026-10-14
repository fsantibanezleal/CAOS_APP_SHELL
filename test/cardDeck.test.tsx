import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardDeck, DECK_TEXT, deckPosition, deckWindow, perPageFor, type DeckCard } from '../src/content/CardDeck.tsx';

/** CardDeck (shell 0.14.0, BL-061): cards plain, as flip cards, and as a carousel above `carouselAbove` (default 4). */

const cards = (n: number): DeckCard[] =>
  Array.from({ length: n }, (_, i) => ({ id: i, title: `Card ${i + 1}`, label: `Card ${i + 1}`, body: <p>Body of card {i + 1}</p> }));
const render = (n: number, props: Partial<React.ComponentProps<typeof CardDeck>> = {}) =>
  renderToStaticMarkup(<CardDeck ariaLabel="Cards" cards={cards(n)} {...props} />);

test('four or fewer cards are a row and five or more are a carousel', () => {
  for (const n of [1, 3, 4]) assert.match(render(n), /data-deck-mode="row"/, `${n} cards`);
  for (const n of [5, 6, 9]) assert.match(render(n), /data-deck-mode="carousel"/, `${n} cards`);
  assert.match(render(3, { carouselAbove: 2 }), /data-deck-mode="carousel"/, 'carouselAbove moves the threshold');
  assert.match(render(6, { carouselAbove: 6 }), /data-deck-mode="row"/);
});

test('plain cards show the body; flip cards turn it into a back; every card stays in the markup', () => {
  const plain = render(5);
  assert.doesNotMatch(plain, /data-flip-card/);
  const flip = render(5, { flip: true });
  assert.equal((flip.match(/data-flip-card=""/g) ?? []).length, 5, 'one flip card per card');
  for (let i = 1; i <= 5; i += 1) assert.ok(flip.includes(`Body of card ${i}`) && plain.includes(`Body of card ${i}`), `card ${i} is in the markup, shown or not`);
});

test('the carousel has previous and next buttons, a polite position and no autoplay, in both languages', () => {
  for (const lang of ['en', 'es'] as const) {
    const html = render(5, { lang });
    assert.match(html, /role="group"[^>]*aria-roledescription="carousel"|aria-roledescription="carousel"[^>]*role="group"/);
    assert.ok(html.includes(`aria-label="${DECK_TEXT.previous[lang]}"`), `${lang}: previous`);
    assert.ok(html.includes(`aria-label="${DECK_TEXT.next[lang]}"`), `${lang}: next`);
    assert.match(html, /data-deck-position=""[^>]*aria-live="polite"|aria-live="polite"[^>]*data-deck-position=""/);
  }
  assert.doesNotMatch(render(5), /autoplay|setInterval/i);
  assert.equal(deckPosition(0, 1, 5, 'en'), '1 of 5');
  assert.equal(deckPosition(1, 1, 5, 'en'), '2 of 5');
  assert.equal(deckPosition(1, 1, 5, 'es'), '2 de 5');
  assert.equal(deckPosition(0, 3, 5, 'en'), '1 to 3 of 5');
  assert.equal(deckPosition(2, 3, 5, 'es'), '3 a 5 de 5');
  assert.equal(DECK_TEXT.previous.es, 'Anterior');
  assert.equal(DECK_TEXT.next.es, 'Siguiente');
});

test('the window arithmetic keeps at least one card and never passes the end', () => {
  assert.equal(perPageFor(0, 240, 14), 1, 'no width: one card');
  assert.equal(perPageFor(100, 240, 14), 1, 'a width narrower than a card: one card');
  assert.equal(perPageFor(390 - 32, 240, 14), 1);
  assert.equal(perPageFor(768, 240, 14), 3);
  assert.equal(perPageFor(1200, 240, 14), 4);
  assert.deepEqual(deckWindow(5, 3, 0), { start: 0, end: 3 });
  assert.deepEqual(deckWindow(5, 3, 4), { start: 2, end: 5 }, 'a start past the end is pulled back so the window is full');
  assert.deepEqual(deckWindow(5, 3, -2), { start: 0, end: 3 });
  assert.deepEqual(deckWindow(5, 9, 1), { start: 0, end: 5 }, 'everything fits: all cards, from the first');
  assert.deepEqual(deckWindow(5, 0, 1), { start: 1, end: 2 }, 'a page of zero is one card');
});

test('a card the product marks keeps its attributes on its list item (the gate and the tests read them)', () => {
  const html = renderToStaticMarkup(<CardDeck ariaLabel="Cards" flip cards={[{ id: 0, title: 'A', label: 'A', body: <p>b</p>, attrs: { 'data-exec-item': 'pain.bearers' } }]} />);
  assert.match(html, /<li[^>]*data-exec-item="pain\.bearers"/);
});
