import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startHarness, type Harness } from './harness';

// CardDeck (shell 0.14.0, BL-061) in a real browser: a carousel that moves by buttons, arrow keys and swipe, reaches every
// card, never scrolls the page sideways and never slides under reduced motion.

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { createRoot } from 'react-dom/client';
    import { CardDeck, useLangStore } from './src/index';
    window.__setLang = (l) => useLangStore.getState().setLang(l);
    const n = Number(new URLSearchParams(location.search).get('n') ?? 7);
    const cards = Array.from({ length: n }, (_, i) => ({
      id: i,
      title: 'Title ' + (i + 1),
      label: 'Title ' + (i + 1),
      body: <p>Back of card {i + 1}: some words that fill the back of a small card.</p>,
    }));
    createRoot(document.getElementById('root')).render(
      <div style={{ padding: 16 }}>
        <button id="before" type="button">before</button>
        <CardDeck ariaLabel="Seven cards" flip cards={cards} />
        <button id="after" type="button">after</button>
      </div>,
    );
  `);
});
after(async () => {
  await h?.close();
});

const shown = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-card-deck] li[data-deck-card]')]
      .filter((li) => (li as HTMLElement).checkVisibility({ checkVisibilityCSS: true }))
      .map((li) => (li.querySelector('[data-flip-title]') as HTMLElement).textContent),
  );
const position = (page: Page) => page.locator('[data-deck-position]').textContent();
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('the carousel moves by button at 390, 768 and 1280 px, reaches every card and never scrolls the page sideways', async () => {
  for (const width of [390, 768, 1280]) {
    const page = await h.browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(h.address);
    await page.waitForSelector('[data-card-deck]');
    const per = Number(await page.locator('[data-card-deck]').getAttribute('data-deck-per'));
    assert.ok(per >= 1 && per <= 6, `${width}px shows ${per} card(s) per page`);
    assert.equal(per, (await shown(page)).length, 'the window shows exactly that many');
    const visited = new Set<string>();
    for (const t of await shown(page)) visited.add(t!);
    for (let i = 0; i < 12; i += 1) {
      const next = page.locator('[data-deck-next]');
      if ((await next.getAttribute('aria-disabled')) === 'true') break;
      await next.click();
      for (const t of await shown(page)) visited.add(t!);
      assert.ok(await noSideways(page), `${width}px: no sideways page scroll after step ${i + 1}`);
    }
    assert.equal(visited.size, 7, `${width}px: every card was shown (${[...visited].join(', ')})`);
    assert.equal(await page.locator('[data-deck-next]').getAttribute('aria-disabled'), 'true', 'the end: next is disabled');
    assert.equal(await page.locator('[data-deck-prev]').getAttribute('aria-disabled'), 'false');
    // the hidden cards are not in the tab order: Tab walks only the shown faces
    await page.locator('#before').focus();
    let toggles = 0;
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute('data-flip-toggle') || '');
      if (id === 'front') toggles += 1;
      if (id === 'after') break;
    }
    assert.equal(toggles, per, `${width}px: the keyboard reaches ${toggles} faces, the ${per} shown`);
    await page.close();
  }
});

test('the arrow keys move the carousel, the position reads "n of m" in both languages, and focus never lands on a hidden card', async () => {
  const page = await h.browser.newPage({ viewport: { width: 390, height: 800 } });
  await page.goto(h.address);
  await page.waitForSelector('[data-card-deck]');
  assert.equal(await position(page), '1 of 7');
  await page.locator('[data-flip-toggle="front"]').first().focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await position(page), '2 of 7');
  assert.deepEqual(await shown(page), ['Title 2']);
  const active = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    return { visible: a.checkVisibility({ checkVisibilityCSS: true }), inDeck: !!a.closest('[data-card-deck]') };
  });
  assert.ok(active.visible, 'focus is on a visible control after the card it was on left the window');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await position(page), '1 of 7');
  await page.keyboard.press('End');
  assert.equal(await position(page), '7 of 7');
  await page.keyboard.press('Home');
  assert.equal(await position(page), '1 of 7');
  // the previous button at the start is disabled but stays focusable
  assert.equal(await page.locator('[data-deck-prev]').getAttribute('aria-disabled'), 'true');
  await page.evaluate(() => (window as unknown as { __setLang: (l: string) => void }).__setLang('es'));
  assert.equal(await position(page), '1 de 7');
  assert.equal(await page.locator('[data-deck-next]').getAttribute('aria-label'), 'Siguiente');
  assert.equal(await page.locator('[data-deck-prev]').getAttribute('aria-label'), 'Anterior');
  await page.close();
});

test('a swipe on touch moves the carousel and a vertical drag does not', async () => {
  const ctx = await h.browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(h.address);
  await page.waitForSelector('[data-card-deck]');
  const swipe = (dx: number, dy: number) =>
    page.evaluate(`(() => {
      const track = document.querySelector('[data-deck-track]');
      const r = track.getBoundingClientRect();
      const mk = (type, cx, cy) => {
        const t = new Touch({ identifier: 1, target: track, clientX: cx, clientY: cy });
        track.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
      };
      const sx = r.left + r.width / 2;
      const sy = r.top + 20;
      mk('touchstart', sx, sy);
      mk('touchend', sx + (${dx}), sy + (${dy}));
    })()`);
  await swipe(-90, 4);
  assert.equal(await position(page), '2 of 7', 'a swipe left shows the next card');
  await swipe(90, 4);
  assert.equal(await position(page), '1 of 7', 'a swipe right shows the previous card');
  await swipe(-90, 120);
  assert.equal(await position(page), '1 of 7', 'a mostly vertical drag is a scroll, not a swipe');
  await swipe(-10, 0);
  assert.equal(await position(page), '1 of 7', 'a short touch is a tap');
  await ctx.close();
});

test('five cards that all fit make no controls, and cards beyond the fit make them', async () => {
  const wide = await h.browser.newPage({ viewport: { width: 1920, height: 800 } });
  await wide.goto(`${h.address}/?n=5`);
  await wide.waitForSelector('[data-card-deck]');
  assert.equal((await shown(wide)).length, 5, 'all five show at 1920 px');
  assert.equal(await wide.locator('[data-deck-next]').count(), 0, 'nothing to move: no controls');
  await wide.close();
  const narrow = await h.browser.newPage({ viewport: { width: 700, height: 800 } });
  await narrow.goto(`${h.address}/?n=5`);
  await narrow.waitForSelector('[data-card-deck]');
  assert.ok((await shown(narrow)).length < 5);
  assert.equal(await narrow.locator('[data-deck-next]').count(), 1);
  await narrow.close();
});

test('under reduced motion the carousel does not slide, and with motion the entering cards animate', async () => {
  for (const [motion, expectAnimated] of [['reduce', false], ['no-preference', true]] as const) {
    const ctx = await h.browser.newContext({ reducedMotion: motion, viewport: { width: 390, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(h.address);
    await page.waitForSelector('[data-card-deck]');
    await page.locator('[data-deck-next]').click();
    const m = await page.evaluate(() => {
      const li = [...document.querySelectorAll('[data-deck-card]')].find((e) => (e as HTMLElement).checkVisibility({ checkVisibilityCSS: true })) as HTMLElement;
      return { name: getComputedStyle(li).animationName, running: document.getAnimations().filter((a) => (a as CSSAnimation).animationName === 'caos-deck-in').length };
    });
    if (expectAnimated) assert.notEqual(m.name, 'none', 'the entering card slides in');
    else {
      assert.equal(m.name, 'none', 'no slide');
      assert.equal(m.running, 0, 'no slide animation runs');
    }
    await ctx.close();
  }
});
