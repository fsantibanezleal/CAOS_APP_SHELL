import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startHarness, type Harness } from './harness';

// FlipCard (shell 0.14.0, BL-060) in a real browser: the toggle by pointer and keyboard, the focus, the accessibility tree,
// reduced motion, both themes and languages, phone and desktop.

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { createRoot } from 'react-dom/client';
    import { FlipCard, CardDeck, useLangStore } from './src/index';
    window.__setLang = (l) => useLangStore.getState().setLang(l);
    function App() {
      return (
        <div style={{ padding: 16 }}>
          <button id="before" type="button">before</button>
          <ul className="caos-deck-track" style={{ listStyle: 'none', padding: 0 }}>
            {['One', 'Two', 'Three'].map((t) => (
              <li key={t} style={{ display: 'contents' }}>
                <FlipCard title={t + ' title'} label={t + ' title'}>
                  <p>BACK-{t}: the content of the back.</p>
                </FlipCard>
              </li>
            ))}
          </ul>
          <button id="after" type="button">after</button>
        </div>
      );
    }
    createRoot(document.getElementById('root')).render(<App />);
  `);
});
after(async () => {
  await h?.close();
});

/** Waits for the turn and its delayed visibility switch to end, then reads the card: which face shows, and where focus is. */
const state = async (page: import('@playwright/test').Page, n = 0) => {
  await page.waitForFunction('document.getAnimations().length === 0', undefined, { timeout: 4000 });
  return (await page.evaluate(`(() => {
    const card = document.querySelectorAll('[data-flip-card]')[${n}];
    const vis = (e) => !!e && e.checkVisibility({ checkVisibilityCSS: true });
    const a = document.activeElement;
    return {
      open: card.getAttribute('data-flip-open'),
      expanded: [...card.querySelectorAll('button[aria-expanded]')].map((b) => b.getAttribute('aria-expanded')),
      frontVisible: vis(card.querySelector('.caos-flip-front')),
      backVisible: vis(card.querySelector('.caos-flip-back')),
      activeToggle: a ? a.getAttribute('data-flip-toggle') : null,
      activeVisible: vis(a),
      activeInCard: !!a && card.contains(a),
    };
  })()`)) as { open: string; expanded: string[]; frontVisible: boolean; backVisible: boolean; activeToggle: string | null; activeVisible: boolean; activeInCard: boolean };
};

test('a flip card toggles by pointer, Enter and Space and focus never lands on a hidden face', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(h.address);
  await page.waitForSelector('[data-flip-card]');
  let s = await state(page);
  assert.deepEqual([s.open, s.frontVisible, s.backVisible], ['false', true, false], 'closed: the face shows');
  // pointer
  await page.locator('[data-flip-toggle="front"]').first().click();
  s = await state(page);
  assert.deepEqual([s.open, s.frontVisible, s.backVisible], ['true', false, true], 'a click turns it');
  assert.ok(s.activeInCard && s.activeVisible && s.activeToggle === 'back', 'focus moved to the visible face (the back toggle)');
  await page.locator('[data-flip-toggle="back"]').first().click();
  s = await state(page);
  assert.deepEqual([s.open, s.frontVisible, s.backVisible], ['false', true, false], 'a click on the back turns it again');
  assert.ok(s.activeInCard && s.activeVisible && s.activeToggle === 'front', 'focus is back on the face');
  // keyboard: Enter, then Space
  await page.locator('#before').focus();
  await page.keyboard.press('Tab');
  assert.equal((await state(page)).activeToggle, 'front', 'Tab reaches the first face');
  await page.keyboard.press('Enter');
  s = await state(page);
  assert.equal(s.open, 'true', 'Enter turns it');
  assert.ok(s.activeVisible && s.activeToggle === 'back', 'focus follows to the back');
  await page.keyboard.press('Space');
  s = await state(page);
  assert.equal(s.open, 'false', 'Space turns it back');
  assert.ok(s.activeVisible && s.activeToggle === 'front', 'focus is on the face again');
  // Escape on the back closes it
  await page.keyboard.press('Enter');
  assert.equal((await state(page)).open, 'true');
  await page.keyboard.press('Escape');
  s = await state(page);
  assert.equal(s.open, 'false', 'Escape closes an open card');
  assert.ok(s.activeVisible, 'and focus is on a visible control');
  // the other cards were not touched
  assert.equal((await state(page, 1)).open, 'false');
  await page.close();
});

test('the hidden face is out of the accessibility tree and out of the tab order', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(h.address);
  await page.waitForSelector('[data-flip-card]');
  const card = page.locator('[data-flip-card]').first();
  let snap = await card.ariaSnapshot();
  assert.match(snap, /One title/, 'the closed card exposes its title');
  assert.match(snap, /Show details/, 'and names the action');
  assert.doesNotMatch(snap, /BACK-One/, 'the closed back is not in the accessibility tree');
  assert.doesNotMatch(snap, /Hide details/);
  await card.locator('[data-flip-toggle="front"]').click();
  snap = await card.ariaSnapshot();
  assert.match(snap, /BACK-One/, 'the open card exposes the back');
  assert.match(snap, /Hide details/);
  assert.doesNotMatch(snap, /Show details/, 'and no longer the face');
  await card.locator('[data-flip-toggle="back"]').click();
  await state(page);
  // the tab order: before, the three faces, after; never a back toggle of a closed card
  await page.locator('#before').focus();
  const seen: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute('data-flip-toggle') ?? (document.activeElement as HTMLElement).id));
  }
  assert.deepEqual(seen.slice(0, 4), ['front', 'front', 'front', 'after'], `tab order ${seen.join(',')}`);
  await page.close();
});

test('under reduced motion the faces swap without a turn, and with motion the card turns', async () => {
  const still = await h.browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  const p1 = await still.newPage();
  await p1.goto(h.address);
  await p1.waitForSelector('[data-flip-card]');
  await p1.locator('[data-flip-toggle="front"]').first().click();
  const reduced = await p1.evaluate(() => {
    const inner = document.querySelector('[data-flip-card] .caos-flip-inner') as HTMLElement;
    const cs = getComputedStyle(inner);
    const back = document.querySelector('[data-flip-card] .caos-flip-back') as HTMLElement;
    return { transform: cs.transform, duration: cs.transitionDuration, running: document.getAnimations().filter((a) => (a as CSSTransition).transitionProperty === 'transform').length, backVisible: back.checkVisibility({ checkVisibilityCSS: true }) };
  });
  assert.equal(reduced.transform, 'none', 'no turn');
  assert.ok(/^0(\.0+1)?m?s/.test(reduced.duration) || reduced.duration === '0s', `no transition (${reduced.duration})`);
  assert.equal(reduced.running, 0, 'no transform transition runs');
  assert.equal(reduced.backVisible, true, 'the back shows');
  await still.close();
  const moving = await h.browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });
  const p2 = await moving.newPage();
  await p2.goto(h.address);
  await p2.waitForSelector('[data-flip-card]');
  await p2.locator('[data-flip-toggle="front"]').first().click();
  await p2.waitForTimeout(900);
  const turned = await p2.evaluate(() => getComputedStyle(document.querySelector('[data-flip-card] .caos-flip-inner') as HTMLElement).transform);
  assert.notEqual(turned, 'none', 'the open card is turned');
  await moving.close();
});

test('the card stays inside the page at 390 and 1280 px, in both themes and both languages, with the back readable', async () => {
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const lang of ['en', 'es']) {
        const page = await h.browser.newPage({ viewport: { width, height: 800 } });
        await page.addInitScript(`try { localStorage.setItem('caos.lang', '${lang}'); } catch (e) {}`);
        await page.goto(h.address);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.waitForSelector('[data-flip-card]');
        const label = lang === 'es' ? 'Mostrar detalles' : 'Show details';
        assert.equal(await page.locator('[data-flip-toggle="front"] .sr-only').first().textContent(), label, `${width} ${theme} ${lang}`);
        await page.locator('[data-flip-toggle="front"]').first().click();
        const m = await page.evaluate(() => {
          const back = document.querySelector('[data-flip-card] .caos-flip-back') as HTMLElement;
          const r = back.getBoundingClientRect();
          const c = back.querySelector('[data-flip-content]') as HTMLElement;
          return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, right: r.right, h: r.height, text: c.innerText, color: getComputedStyle(c).color };
        });
        assert.ok(m.scrollW <= m.innerW, `${width} ${theme} ${lang}: no sideways scroll`);
        assert.ok(m.right <= m.innerW && m.h > 20, `${width} ${theme} ${lang}: the back is inside the page`);
        assert.match(m.text, /BACK-One/);
        await page.close();
      }
    }
  }
});
