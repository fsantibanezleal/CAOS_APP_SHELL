import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startHarness, type Harness } from './harness';

// Focus mode for the App (shell 0.14.0, BL-063): the control opens the selected case's open group in the full viewport, the
// URL keeps the case, the group and `?focus=1`, Escape and the exit button return to the same place, and the page never scrolls.

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { CaseWorkbench, SubTabs, Knob, useLangStore, useThemeStore } from './src/index';
    window.__setLang = (l) => useLangStore.getState().setLang(l);
    const CASES = [{ id: 'c-low', name: 'Low' }, { id: 'c-mid', name: 'Mid' }, { id: 'c-high', name: 'High' }];
    // a title that wraps to two or three lines in the stage label (Contraste C10 at 1280px, shell 0.14.3)
    const LONG_TITLE = {
      en: 'Portfolio credit capital: ASRF, Vasicek fit, copula MC with a long tail and a second line of context',
      es: 'Capital de credito de cartera: ASRF, ajuste Vasicek, copula MC con cola larga y una segunda linea de contexto',
    };
    function App() {
      const [caseId, setCaseId] = useState(new URLSearchParams(location.search).get('case') ?? 'c-low');
      const [scale, setScale] = useState(1);
      window.__changes = (window.__changes ?? 0);
      return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <header><a id="bg-head" href="#top">header link</a></header>
          <main id="app-main" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <CaseWorkbench
            caseId={caseId}
            cases={{ cases: CASES, selectedId: caseId, onSelect: setCaseId, layout: 'select', deepLink: true }}
            controls={{ scale }}
            focus={{
              title: new URLSearchParams(location.search).get('short') ? undefined : LONG_TITLE,
              hud: new URLSearchParams(location.search).get('hud') ? [{ label: { en: 'Alpha', es: 'Alfa' }, value: '1' }, { label: { en: 'Beta', es: 'Beta' }, value: '2' }] : undefined,
              onChange: (on) => { window.__focusEvents = [...(window.__focusEvents ?? []), on]; },
            }}
            rail={<Knob id="scale" label={{ en: 'Scale', es: 'Escala' }} value={scale} min={0.5} max={2} step={0.1} onChange={setScale} />}
            groups={[
              { id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <p data-probe="model">MODEL {caseId} {scale}</p> },
              {
                id: 'validation', label: { en: 'Validation', es: 'Validación' },
                content: (
                  <SubTabs ariaLabel="Validation views" tabs={[
                    { id: 'phase', label: 'Phase', content: <p data-probe="phase">PHASE {caseId}</p> },
                    { id: 'table', label: 'Table', content: <p data-probe="table">TABLE {caseId} scale {scale}</p> },
                  ]} />
                ),
              },
            ]}
            context={{ content: <p>CONTEXT</p> }}
          />
          </main>
          <footer><a id="bg-foot" href="#top">footer link</a></footer>
        </div>
      );
    }
    createRoot(document.getElementById('root')).render(<App />);
  `);
});
after(async () => {
  await h?.close();
});

const q = (page: Page) => new URL(page.url()).searchParams;
const inFocus = (page: Page) => page.locator('[data-focus-shell]').count();
const probe = (page: Page) => page.evaluate(() => [...document.querySelectorAll('[data-probe]')].map((e) => e.textContent).join('|'));
const noScroll = (page: Page) => page.evaluate(() => ({ w: document.documentElement.scrollWidth <= innerWidth, h: document.documentElement.scrollHeight <= innerHeight + 1 }));

test('Focus opens the selected case in the full viewport, keeps the rail, and the exit button returns to the same case, group and sub-view', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?case=c-mid`);
  await page.waitForSelector('[data-focus-enter]');
  await page.getByRole('tab', { name: 'Validation' }).click();
  await page.getByRole('tab', { name: 'Table' }).click();
  await page.locator('input[type="range"]').first().press('ArrowRight');
  const before = await probe(page);
  assert.match(before, /TABLE c-mid scale 1\.1/);
  await page.locator('[data-focus-enter]').click();
  assert.equal(await inFocus(page), 1, 'the focus shell is open');
  assert.equal(q(page).get('focus'), '1', 'the URL says so');
  assert.equal(q(page).get('case'), 'c-mid', 'and keeps the case');
  assert.equal(q(page).get('view'), 'validation', 'and the group');
  assert.equal(await page.locator('[data-workbench]').count(), 0, 'the App frame is replaced');
  assert.equal(await page.locator('[data-case-workbench]').getAttribute('data-case'), 'c-mid');
  assert.equal(await probe(page), before, 'the sub-view and the values are the ones the reader left');
  assert.equal(await page.locator('[data-focus-shell] input[type="range"]').count(), 1, 'the rail stays, with its control');
  const stage = await page.locator('.caos-focus-stage').boundingBox();
  assert.ok(stage && stage.width * stage.height >= 0.5 * 1280 * 800, 'the stage takes at least half of the viewport');
  assert.deepEqual(await noScroll(page), { w: true, h: true }, 'the page does not scroll');
  assert.equal(await page.locator('.caos-focus-rail').evaluate((e) => e.scrollHeight <= e.clientHeight + 1), true, 'the rail does not scroll');
  const f = await page.evaluate(() => document.activeElement?.getAttribute('data-focus-exit'));
  assert.notEqual(f, null, 'keyboard focus moved to the exit control');
  // a change in the rail acts on the stage
  await page.locator('[data-focus-shell] input[type="range"]').press('ArrowRight');
  assert.match(await probe(page), /scale 1\.2/);
  await page.locator('[data-focus-exit]').click();
  assert.equal(await inFocus(page), 0, 'back in the App');
  assert.equal(await page.locator('[data-workbench]').count(), 1);
  assert.equal(q(page).get('focus'), null, 'the focus parameter is gone');
  assert.equal(q(page).get('case'), 'c-mid');
  assert.equal(q(page).get('view'), 'validation');
  assert.match(await probe(page), /TABLE c-mid scale 1\.2/, 'the same case, group and sub-view, with the changed value');
  const back = await page.evaluate(() => document.activeElement?.hasAttribute('data-focus-enter'));
  assert.equal(back, true, 'focus returns to the control that opened it');
  assert.deepEqual(await page.evaluate(() => (window as unknown as { __focusEvents: boolean[] }).__focusEvents), [true, false]);
  await page.close();
});

test('Escape returns from Focus, and ?focus=1 opens it directly on the case and group the link names', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?case=c-high&view=validation&focus=1`);
  await page.waitForSelector('[data-focus-shell]');
  assert.equal(await page.locator('[data-case-workbench]').getAttribute('data-case'), 'c-high');
  assert.match(await probe(page), /PHASE c-high/);
  await page.keyboard.press('Escape');
  assert.equal(await inFocus(page), 0, 'Escape closes Focus');
  assert.equal(q(page).get('focus'), null);
  assert.equal(q(page).get('case'), 'c-high');
  assert.equal(q(page).get('view'), 'validation');
  await page.close();
});

test('Focus never scrolls the page and the stage keeps one tab row, at phone and desktop, in both languages and themes', async () => {
  for (const width of [390, 768, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const lang of ['en', 'es']) {
        const page = await h.browser.newPage({ viewport: { width, height: width < 800 ? 844 : 800 } });
        await page.addInitScript(`try { localStorage.setItem('caos.lang', '${lang}'); } catch (e) {}`);
        await page.goto(`${h.address}/?view=validation`);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        assert.equal(await page.locator('[data-focus-enter]').getAttribute('aria-label'), lang === 'es' ? 'Abrir este caso en modo enfoque' : 'Open this case in focus mode', `${width}px ${theme} ${lang}: the control is named`);
        await page.locator('[data-focus-enter]').click();
        const m = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('[data-focus-shell] [role="tablist"]')].map((t) => new Set([...t.querySelectorAll('[role="tab"]')].map((b) => Math.round(b.getBoundingClientRect().top))).size);
          const exit = document.querySelector('[data-focus-exit]') as HTMLElement;
          const r = exit.getBoundingClientRect();
          return { w: document.documentElement.scrollWidth <= innerWidth, h: document.documentElement.scrollHeight <= innerHeight + 1, rows, exit: exit.textContent, exitIn: r.right <= innerWidth && r.bottom <= innerHeight && r.width > 0 };
        });
        const where = `${width}px ${theme} ${lang}`;
        assert.ok(m.w && m.h, `${where}: the page does not scroll`);
        assert.ok(m.rows.length === 1 && m.rows[0] === 1, `${where}: one tab row (${m.rows})`);
        assert.equal(m.exit, lang === 'es' ? 'Volver a la App' : 'Back to the App', where);
        assert.ok(m.exitIn, `${where}: the exit control is inside the viewport`);
        await page.close();
      }
    }
  }
});

test('Focus mode makes the page behind it inert, keeps the keyboard in its frame and holds one main', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(h.address);
  await page.waitForSelector('[data-focus-enter]');
  await page.locator('[data-focus-enter]').click();
  assert.equal(await page.locator('main').count(), 1, 'one main landmark');
  assert.equal(await page.evaluate(() => document.querySelector('main main') === null), true, 'no main inside a main');
  assert.equal(await page.evaluate(() => document.getElementById('bg-head')!.closest('[inert]') !== null && document.getElementById('bg-foot')!.closest('[inert]') !== null), true, 'the header and the footer are inert');
  const seen = new Set<string>();
  for (let i = 0; i < 16; i += 1) {
    await page.keyboard.press('Tab');
    seen.add(await page.evaluate(() => { const a = document.activeElement as HTMLElement; return a.closest('[data-focus-shell]') ? 'in' : a.id || a.tagName; }));
  }
  seen.delete('BODY');
  assert.deepEqual([...seen], ['in'], 'Tab stays inside the Focus frame');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.querySelectorAll('[inert]').length), 0, 'nothing stays inert after the return');
  assert.equal(await page.evaluate(() => { document.getElementById('bg-head')!.focus(); return document.activeElement!.id; }), 'bg-head', 'the page is reachable again');
  await page.close();
});

const CLEAR_JS = () => {
  const stage = document.querySelector('.caos-focus-stage') as HTMLElement;
  const label = document.querySelector('.caos-focus-label') as HTMLElement;
  const lb = label.getBoundingClientRect();
  const controls = [...stage.querySelectorAll('.caos-focus-instrument [role="tab"], .caos-focus-instrument button')].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  });
  const hits = controls.filter((e) => {
    const r = e.getBoundingClientRect();
    return r.left < lb.right - 1 && r.right > lb.left + 1 && r.top < lb.bottom - 1 && r.bottom > lb.top + 1;
  }).map((e) => e.textContent);
  const lowest = Math.min(...controls.map((e) => e.getBoundingClientRect().top));
  const exit = document.querySelector('[data-focus-exit]') as HTMLElement;
  const er = exit.getBoundingClientRect();
  return {
    n: controls.length, hits, labelBottom: lb.bottom, firstControlTop: lowest,
    labelHeight: lb.height,
    exitIn: er.right <= innerWidth && er.bottom <= innerHeight && er.width > 0,
    h: document.documentElement.scrollHeight <= innerHeight + 1,
    clearTop: stage.style.getPropertyValue('--caos-focus-clear-top'),
  };
};

test('a wrapping Focus title never covers the stage controls, at phone, tablet and desktop, in both languages', async () => {
  for (const width of [390, 768, 1280]) {
    for (const lang of ['en', 'es']) {
      const page = await h.browser.newPage({ viewport: { width, height: width < 800 ? 844 : 800 } });
      await page.addInitScript(`try { localStorage.setItem('caos.lang', '${lang}'); } catch (e) {}`);
      await page.goto(`${h.address}/?view=validation&focus=1`);
      await page.waitForSelector('[data-focus-shell] [role="tab"]');
      const m = await page.evaluate(CLEAR_JS);
      const where = `${width}px ${lang}`;
      assert.ok(m.n >= 2, `${where}: the stage has controls (${m.n})`);
      assert.ok(width === 768 || m.labelHeight > 70, `${where}: the title wraps (label ${m.labelHeight}px high)`);
      assert.deepEqual(m.hits, [], `${where}: the label covers no control`);
      assert.ok(m.labelBottom <= m.firstControlTop, `${where}: the label (${m.labelBottom}) ends above the first control (${m.firstControlTop})`);
      assert.ok(m.exitIn, `${where}: the exit control is inside the viewport`);
      assert.ok(m.h, `${where}: the page does not scroll`);
      await page.close();
    }
  }
});

test('the clearance follows a language change and a resize inside Focus, and a one-line title keeps the old clearance', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?view=validation&focus=1`);
  await page.waitForSelector('[data-focus-shell] [role="tab"]');
  const before = await page.evaluate(CLEAR_JS);
  assert.deepEqual(before.hits, []);
  await page.evaluate(() => (window as unknown as { __setLang: (l: string) => void }).__setLang('es'));
  await page.waitForFunction(() => document.querySelector('.caos-focus-label strong')?.textContent?.startsWith('Capital'));
  await page.waitForTimeout(150);
  const es = await page.evaluate(CLEAR_JS);
  assert.deepEqual(es.hits, [], 'after the switch to Spanish the label still covers nothing');
  assert.ok(es.labelBottom <= es.firstControlTop, 'and the clearance followed the new text');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const narrow = await page.evaluate(CLEAR_JS);
  assert.deepEqual(narrow.hits, [], 'after a resize to a phone the label still covers nothing');
  assert.ok(narrow.labelBottom <= narrow.firstControlTop);
  await page.close();
  const one = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await one.goto(`${h.address}/?view=validation&focus=1&short=1`);
  await one.waitForSelector('[data-focus-shell] [role="tab"]');
  const s = await one.evaluate(CLEAR_JS);
  assert.deepEqual(s.hits, []);
  assert.ok(s.firstControlTop <= 4.6 * 16 + 12, `a one-line title keeps the old clearance (first control at ${s.firstControlTop}px; was 73.6px)`);
  await one.close();
});

test('the HUD follows the wrapped label on a desktop and the stage clears it at the bottom on a phone', async () => {
  for (const width of [1280, 390]) {
    const page = await h.browser.newPage({ viewport: { width, height: width < 800 ? 844 : 800 } });
    await page.goto(`${h.address}/?view=validation&focus=1&hud=1`);
    await page.waitForSelector('[data-focus-shell] [role="tab"]');
    const m = await page.evaluate(`(() => {
      const lb = document.querySelector('.caos-focus-label').getBoundingClientRect();
      const tiles = [...document.querySelectorAll('.caos-focus-hud > div')].map((e) => e.getBoundingClientRect());
      const controls = [...document.querySelectorAll('.caos-focus-instrument [role="tab"], .caos-focus-instrument button')].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0);
      const hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      return {
        labelBottom: lb.bottom,
        hudTop: Math.min(...tiles.map((t) => t.top)),
        tileOnLabel: tiles.some((t) => hit(t, lb)),
        tileOnControl: tiles.some((t) => controls.some((c) => hit(t, c))),
        clearBottom: document.querySelector('.caos-focus-stage').style.getPropertyValue('--caos-focus-clear-bottom'),
      };
    })()`) as { labelBottom: number; hudTop: number; tileOnLabel: boolean; tileOnControl: boolean; clearBottom: string };
    assert.equal(m.tileOnLabel, false, `${width}px: no HUD tile on the label`);
    assert.equal(m.tileOnControl, false, `${width}px: no HUD tile on a stage control`);
    if (width > 900) assert.ok(m.hudTop >= m.labelBottom, `${width}px: the HUD starts below the label (${m.hudTop} vs ${m.labelBottom})`);
    else assert.match(m.clearBottom, /^\d+px$/, `${width}px: the stage clears the bottom HUD`);
    await page.close();
  }
});
