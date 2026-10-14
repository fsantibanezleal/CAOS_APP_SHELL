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
            focus={{ onChange: (on) => { window.__focusEvents = [...(window.__focusEvents ?? []), on]; } }}
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
