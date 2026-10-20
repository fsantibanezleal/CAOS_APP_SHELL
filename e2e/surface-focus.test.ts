import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startHarness, type Harness } from './harness';

// Focus mode for a SurfacePage App (shell 0.16.0, BL-068, ADR-0070): the control shows on the head while a focusable view is open,
// opens that view in the full viewport with its rail, holds `?focus=1` beside `?view=`, and returns on the same view and sub-view.

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { SurfacePage, SubTabs, Knob } from './src/index';
    function App() {
      const [scale, setScale] = useState(1);
      const param = window.__PARAM;
      const tabs = [
        { id: 'list', label: 'List', content: <p data-probe="list">LIST</p> },
        {
          id: 'engine', label: 'Engine',
          focus: {
            title: { en: 'Engine run', es: 'Corrida del motor' },
            hud: [{ label: { en: 'Peak', es: 'Pico' }, value: '3' }],
            rail: <Knob id="scale" label={{ en: 'Scale', es: 'Escala' }} value={scale} min={0.5} max={2} step={0.1} onChange={setScale} />,
          },
          content: (
            <SubTabs ariaLabel="Engine views" tabs={[
              { id: 'phase', label: 'Phase', content: <p data-probe="phase">PHASE {scale}</p> },
              { id: 'table', label: 'Table', content: <p data-probe="table">TABLE {scale}</p> },
            ]} />
          ),
        },
        { id: 'tasks', label: 'Tasks', focus: true, content: <div data-probe="tasks"><button id="tasks-run" type="button">Run the task</button></div> },
        { id: 'notes', label: 'Notes', content: <p data-probe="notes">NOTES</p> },
      ];
      return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <header><a id="bg-head" href="#top">header link</a></header>
          <main id="app-main" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <SurfacePage
              title={{ en: 'Console', es: 'Consola' }}
              lede="What the console runs."
              actions={<button type="button" id="export">Export</button>}
              tabs={tabs}
              instrument
              focus={{ param, onChange: (on) => { window.__focusEvents = [...(window.__focusEvents ?? []), on]; } }}
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

test('Focus opens the open view in the full viewport with its rail, and the exit button returns to the same view and sub-view', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(h.address);
  await page.getByRole('tab', { name: 'Engine' }).click();
  await page.getByRole('tab', { name: 'Table' }).click();
  await page.locator('[data-focus-enter]').waitFor();
  const before = await probe(page);
  assert.match(before, /TABLE 1/);
  await page.locator('[data-focus-enter]').click();
  assert.equal(await inFocus(page), 1, 'the focus shell is open');
  assert.equal(q(page).get('focus'), '1');
  assert.equal(q(page).get('view'), 'engine', 'the URL keeps the view');
  assert.equal(await page.locator('[data-surface]').count(), 0, 'the surface frame is replaced');
  assert.equal(await page.locator('[data-surface-focus]').getAttribute('data-focus-view'), 'engine');
  assert.equal(await probe(page), before, 'the same sub-view');
  assert.equal(await page.locator('.caos-focus-label strong').textContent(), 'Engine run', 'the title the view gives');
  assert.equal(await page.locator('.caos-focus-label span').textContent(), 'Console', 'the surface title is the description by default');
  assert.equal(await page.locator('.caos-focus-hud').textContent(), '3Peak');
  assert.equal(await page.locator('[data-focus-shell] input[type="range"]').count(), 1, "the rail holds the view's control");
  const stage = await page.locator('.caos-focus-stage').boundingBox();
  assert.ok(stage && stage.width * stage.height >= 0.5 * 1280 * 800, 'the stage takes at least half of the viewport');
  assert.deepEqual(await noScroll(page), { w: true, h: true }, 'the page does not scroll');
  assert.equal(await page.locator('.caos-focus-rail').evaluate((e) => e.scrollHeight <= e.clientHeight + 1), true, 'the rail does not scroll');
  assert.notEqual(await page.evaluate(() => document.activeElement?.getAttribute('data-focus-exit')), null, 'keyboard focus is on the exit control');
  await page.locator('[data-focus-shell] input[type="range"]').press('ArrowRight');
  assert.match(await probe(page), /TABLE 1\.1/, 'a change in the rail acts on the stage');
  await page.locator('[data-focus-exit]').click();
  assert.equal(await inFocus(page), 0);
  assert.equal(await page.locator('[data-surface]').count(), 1);
  assert.equal(q(page).get('focus'), null);
  assert.equal(q(page).get('view'), 'engine');
  assert.match(await probe(page), /TABLE 1\.1/, 'the same view and sub-view');
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-focus-enter')), true, 'keyboard focus returns to the Focus control');
  assert.deepEqual(await page.evaluate(() => (window as unknown as { __focusEvents: boolean[] }).__focusEvents), [true, false]);
  await page.close();
});

test('Escape returns from Focus, and a deep link with ?view=engine&focus=1 opens it on that view', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?view=engine&focus=1`);
  await page.waitForSelector('[data-focus-shell]');
  assert.equal(await page.locator('[data-surface-focus]').getAttribute('data-focus-view'), 'engine');
  assert.match(await probe(page), /PHASE/);
  await page.keyboard.press('Escape');
  assert.equal(await inFocus(page), 0, 'Escape closes Focus');
  assert.equal(q(page).get('focus'), null);
  assert.equal(q(page).get('view'), 'engine');
  assert.equal(await page.locator('[data-surface]').count(), 1);
  await page.close();
});

test('a deep link to a view with no stage, or to an unknown view, opens no Focus and loses the parameter', async () => {
  for (const view of ['list', 'notes', 'nothing']) {
    const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${h.address}/?view=${view}&focus=1`);
    await page.waitForSelector('[data-surface]');
    assert.equal(await inFocus(page), 0, `${view}: no Focus`);
    await page.waitForFunction(() => !new URLSearchParams(location.search).has('focus'));
    assert.equal(q(page).get('focus'), null, `${view}: the parameter is removed`);
    assert.equal(q(page).get('view'), view, `${view}: the view of the link is left as it was`);
    assert.equal(await page.locator('[data-focus-enter]').count(), 0, `${view}: no control on a view with no stage`);
    assert.equal(await page.evaluate(() => (window as unknown as { __focusEvents?: boolean[] }).__focusEvents ?? null), null, `${view}: no change was reported`);
    await page.close();
  }
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?focus=1`);
  assert.equal(await inFocus(page), 0, 'with no view named the first view decides, and it has no stage');
  await page.close();
});

test('the control follows the open view: shown on a view with a stage, hidden on one without, and the head keeps its height', async () => {
  for (const width of [390, 768, 1280]) {
    const page = await h.browser.newPage({ viewport: { width, height: width < 800 ? 844 : 800 } });
    await page.goto(h.address);
    await page.waitForSelector('[data-surface]');
    const head = () => page.locator('.caos-surface-head').evaluate((e) => Math.round(e.getBoundingClientRect().height));
    const rows = () => page.locator('.caos-surface-body > .tabs > .tablist').evaluate((t) => new Set([...t.querySelectorAll('[role="tab"]')].map((b) => Math.round(b.getBoundingClientRect().top))).size);
    assert.equal(await page.locator('[data-focus-enter]').count(), 0, `${width}px: hidden on the list`);
    const plainHead = await head();
    await page.getByRole('tab', { name: 'Engine' }).click();
    assert.equal(await page.locator('[data-focus-enter]').count(), 1, `${width}px: shown on the engine view`);
    // no new row: the control sits on the row of the heading (never below it), and the head grows by less than a line of text
    const onRow = await page.evaluate(() => {
      const c = document.querySelector('[data-focus-enter]')!.getBoundingClientRect();
      const hd = document.querySelector('.caos-surface-heading')!.getBoundingClientRect();
      return c.top < hd.bottom - 8 && c.bottom > hd.top;
    });
    assert.equal(onRow, true, `${width}px: the control is on the heading's row (no new row)`);
    assert.ok((await head()) - plainHead < 8, `${width}px: the head is no taller than a line more with the control (${plainHead} to ${await head()})`);
    assert.equal(await rows(), 1, `${width}px: one tab row`);
    assert.deepEqual(await noScroll(page), { w: true, h: true }, `${width}px: no page scroll with the control`);
    await page.getByRole('tab', { name: 'Notes' }).click();
    assert.equal(await page.locator('[data-focus-enter]').count(), 0, `${width}px: hidden again on the notes`);
    assert.equal(await head(), plainHead, `${width}px: the head returns to its height`);
    await page.close();
  }
});

test('Focus never scrolls the page and keeps one tab row, at phone, tablet and desktop, in both languages and themes', async () => {
  for (const width of [390, 768, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const lang of ['en', 'es']) {
        const page = await h.browser.newPage({ viewport: { width, height: width < 800 ? 844 : 800 } });
        await page.addInitScript(`try { localStorage.setItem('caos.lang', '${lang}'); } catch (e) {}`);
        await page.goto(`${h.address}/?view=engine`);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        assert.equal(await page.locator('[data-focus-enter]').getAttribute('aria-label'), lang === 'es' ? 'Abrir esta vista en modo enfoque' : 'Open this view in focus mode');
        await page.locator('[data-focus-enter]').click();
        const m = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('[data-focus-shell] [role="tablist"]')].map((t) => new Set([...t.querySelectorAll('[role="tab"]')].map((b) => Math.round(b.getBoundingClientRect().top))).size);
          const exit = document.querySelector('[data-focus-exit]') as HTMLElement;
          const r = exit.getBoundingClientRect();
          return { w: document.documentElement.scrollWidth <= innerWidth, h: document.documentElement.scrollHeight <= innerHeight + 1, rows, exit: exit.textContent, exitIn: r.right <= innerWidth && r.bottom <= innerHeight && r.width > 0 };
        });
        const where = `${width}px ${theme} ${lang}`;
        assert.ok(m.w && m.h, `${where}: the page does not scroll`);
        assert.ok(m.rows.every((r) => r === 1), `${where}: one tab row (${m.rows})`);
        assert.equal(m.exit, lang === 'es' ? 'Volver a la App' : 'Back to the App', where);
        assert.ok(m.exitIn, `${where}: the exit control is inside the viewport`);
        await page.close();
      }
    }
  }
});

test('Focus makes the page behind it inert, keeps the keyboard in its frame, holds one main and no Focus control', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?view=engine`);
  await page.locator('[data-focus-enter]').click();
  assert.equal(await page.locator('main').count(), 1, 'one main landmark');
  assert.equal(await page.evaluate(() => document.querySelector('main main') === null), true);
  assert.equal(await page.locator('[data-focus-shell] [data-focus-enter]').count(), 0, 'no Focus control in the frame');
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
  await page.close();
});

test('a view without a rail keeps the stage as the whole frame and its own controls in its body', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?view=tasks`);
  await page.locator('[data-focus-enter]').click();
  assert.equal(await inFocus(page), 1);
  assert.equal(await page.locator('.caos-focus-rail').count(), 0, 'no rail column');
  const stage = await page.locator('.caos-focus-stage').boundingBox();
  assert.ok(stage && Math.abs(stage.width - 1280) <= 1, `the stage is the whole frame (${stage?.width}px)`);
  assert.equal(await page.locator('[data-focus-shell] #tasks-run').count(), 1, 'the view keeps its own control');
  assert.equal(await page.locator('.caos-focus-label strong').textContent(), 'Tasks', "the title is the view's label by default");
  assert.deepEqual(await noScroll(page), { w: true, h: true });
  await page.locator('[data-focus-exit]').click();
  assert.equal(q(page).get('view'), 'tasks');
  await page.close();
});

test('the parameter can be renamed (SurfaceFocusConfig.param)', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript('window.__PARAM = "f";');
  await page.goto(`${h.address}/?view=engine&f=1`);
  await page.waitForSelector('[data-focus-shell]');
  await page.keyboard.press('Escape');
  assert.equal(q(page).get('f'), null);
  await page.locator('[data-focus-enter]').click();
  assert.equal(q(page).get('f'), '1');
  assert.equal(q(page).get('focus'), null);
  await page.close();
});
