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
    import { SurfacePage, SubTabs, Knob, CaseWorkbench, useLangStore, useShellLang } from './src/index';
    window.__setLang = (l) => useLangStore.getState().setLang(l);
    function Bench() {
      const lang = useShellLang();
      return (
        <CaseWorkbench
          caseId="c1"
          focus
          groups={[{ id: 'validation', label: { en: 'Validation', es: 'Validación' }, content: (
            <SubTabs ariaLabel={lang === 'es' ? 'Vistas de validación' : 'Validation views'} tabs={[
              { id: 'phase', label: 'Phase', content: <p data-probe="phase">PHASE</p> },
              { id: 'table', label: 'Table', content: <p data-probe="table">TABLE</p> },
            ]} />
          ) }]}
          context={{ content: <p>CONTEXT</p> }}
        />
      );
    }
    const rowTabs = (tag) => [
      { id: 'chart', label: 'Chart', content: <p data-probe="row">CHART {tag}</p> },
      { id: 'table', label: 'Table', content: <p data-probe="row">TABLE {tag}</p> },
    ];
    // two places with sub-view rows that share their ids: they must keep separate selections (the view memory keys on the place)
    function Twin() {
      const tabs = [
        { id: 'alpha', label: 'Alpha', focus: true, content: <SubTabs ariaLabel="Alpha views" tabs={rowTabs('alpha')} /> },
        { id: 'beta', label: 'Beta', focus: true, content: <SubTabs ariaLabel="Beta views" initial="chart" tabs={rowTabs('beta')} /> },
      ];
      return <main><SurfacePage title={{ en: 'Twin', es: 'Gemelo' }} tabs={tabs} focus /></main>;
    }
    function Bench2() {
      return (
        <main>
          <CaseWorkbench
            caseId="c1"
            groups={[
              { id: 'alpha', label: { en: 'Alpha', es: 'Alfa' }, content: <SubTabs ariaLabel="Alpha views" tabs={rowTabs('alpha')} /> },
              { id: 'beta', label: { en: 'Beta', es: 'Beta' }, content: <SubTabs ariaLabel="Beta views" initial="chart" tabs={rowTabs('beta')} /> },
            ]}
            context={{ content: <p>CONTEXT</p> }}
          />
        </main>
      );
    }
    function App() {
      const lang = useShellLang();
      if (new URLSearchParams(location.search).get('twin') === '1') return <Twin />;
      if (new URLSearchParams(location.search).get('bench2') === '1') return <Bench2 />;
      if (new URLSearchParams(location.search).get('workbench') === '1') return <main><Bench /></main>;
      const [scale, setScale] = useState(1);
      const param = window.__PARAM;
      const q = new URLSearchParams(location.search);
      const shape = q.get('shape') ?? 'full';
      const nofocus = q.get('nofocus') === '1';
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
            <SubTabs ariaLabel={lang === 'es' ? 'Vistas del motor' : 'Engine views'} tabs={[
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
              title={shape === 'headless' ? undefined : { en: 'Console', es: 'Consola' }}
              lede={shape === 'full' || shape === 'lede' ? 'What the console runs.' : undefined}
              actions={shape === 'full' || shape === 'actions' ? <button type="button" id="export">Export</button> : undefined}
              tabs={tabs}
              instrument
              focus={nofocus ? undefined : { param, onChange: (on) => { window.__focusEvents = [...(window.__focusEvents ?? []), on]; } }}
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
    assert.equal(await page.locator('[data-focus-enter]').filter({ visible: true }).count(), 0, `${view}: no control on a view with no stage`);
    assert.equal(await page.evaluate(() => (window as unknown as { __focusEvents?: boolean[] }).__focusEvents ?? null), null, `${view}: no change was reported`);
    await page.close();
  }
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?focus=1`);
  assert.equal(await inFocus(page), 0, 'with no view named the first view decides, and it has no stage');
  await page.close();
});

const SHAPES = ['headless', 'title', 'actions', 'lede', 'full'];
const VIEWS = ['List', 'Engine', 'Tasks', 'Notes'];

test('the control sits at the end of the tab row: on every shape of surface the tab row and the head are the same on every view, as in 0.15.0, at 390, 768 and 1280 px', async () => {
  for (const shape of SHAPES) {
    for (const width of [390, 768, 1280]) {
      const where = `${shape} ${width}px`;
      const geometry = async (nofocus: boolean) => {
        const page = await h.browser.newPage({ viewport: { width, height: width < 800 ? 844 : 800 } });
        await page.goto(`${h.address}/?shape=${shape}${nofocus ? '&nofocus=1' : ''}`);
        await page.waitForSelector('[data-surface]');
        const out: Array<{ view: string; top: number; height: number; head: number; control: boolean }> = [];
        for (const view of VIEWS) {
          await page.getByRole('tab', { name: view, exact: true }).click();
          out.push(await page.evaluate((v) => {
            const s = document.querySelector('[data-surface]')!.getBoundingClientRect();
            const row = document.querySelector('.caos-surface-body > .tabs > [role="tablist"]')!.getBoundingClientRect();
            const head = document.querySelector('.caos-surface-head');
            const c = document.querySelector('[data-focus-enter]');
            const shown = c ? getComputedStyle(c).visibility !== 'hidden' && c.getAttribute('aria-hidden') !== 'true' : false;
            return { view: v, top: Math.round((row.top - s.top) * 100) / 100, height: Math.round(row.height * 100) / 100, head: head ? Math.round(head.getBoundingClientRect().height * 100) / 100 : 0, control: shown };
          }, view));
        }
        await page.close();
        return out;
      };
      const withFocus = await geometry(false);
      const without = await geometry(true);
      const first = withFocus[0];
      for (const g of withFocus) {
        assert.equal(g.top, first.top, `${where}: the tab row's top is the same on ${g.view} and ${first.view} (${g.top} against ${first.top})`);
        assert.equal(g.height, first.height, `${where}: the tab row's height is the same on every view`);
        assert.equal(g.head, first.head, `${where}: the head's height is the same on every view`);
      }
      assert.deepEqual(withFocus.map((g) => g.control), [false, true, true, false], `${where}: the control shows on Engine and Tasks only`);
      for (let i = 0; i < withFocus.length; i += 1) {
        assert.equal(withFocus[i].head, without[i].head, `${where}: the head's height equals 0.15.0's (no head is added) on ${withFocus[i].view}`);
        assert.equal(withFocus[i].top, without[i].top, `${where}: the tab row's top equals 0.15.0's on ${withFocus[i].view}`);
        assert.equal(withFocus[i].height, without[i].height, `${where}: the tab row's height equals 0.15.0's on ${withFocus[i].view}`);
      }
    }
  }
});

test('the control stays visible and reachable beside the tabs at 390 px, in one row, never inside the tab list', async () => {
  const page = await h.browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${h.address}/?shape=headless`);
  await page.getByRole('tab', { name: 'Engine', exact: true }).click();
  const m = await page.evaluate(() => {
    const c = document.querySelector('[data-focus-enter]')!.getBoundingClientRect();
    const list = document.querySelector('.caos-surface-body > .tabs > [role="tablist"]')!.getBoundingClientRect();
    const rows = new Set([...document.querySelectorAll('.caos-surface-body > .tabs > [role="tablist"] [role="tab"]')].map((b) => Math.round(b.getBoundingClientRect().top))).size;
    const slot = document.querySelector('[data-tabs-slot]')!;
    return { right: c.right, left: c.left, w: innerWidth, listRight: list.right, rows, inTablist: document.querySelector('[role="tablist"]')!.contains(slot), sideBySide: Math.abs(c.top - list.top) < list.height };
  });
  assert.ok(m.right <= m.w && m.left >= 0, 'the control is inside the viewport');
  assert.ok(m.listRight <= m.left + 1, 'the tab list ends where the slot starts: the tabs scroll beside it');
  assert.equal(m.rows, 1);
  assert.equal(m.inTablist, false, 'the slot is beside the tablist, never inside it');
  assert.equal(m.sideBySide, true, 'on the same row');
  await page.locator('[data-focus-enter]').click();
  assert.equal(await inFocus(page), 1, 'reachable by a click');
  await page.close();
});

test('on a view with no stage the hidden control takes no tab stop and is out of the accessibility tree', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?view=list`);
  await page.waitForSelector('[data-surface]');
  const c = page.locator('[data-focus-enter]');
  assert.equal(await c.getAttribute('aria-hidden'), 'true');
  assert.equal(await c.getAttribute('tabindex'), '-1');
  const seen = new Set<string>();
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    seen.add(await page.evaluate(() => ((document.activeElement as HTMLElement).hasAttribute('data-focus-enter') ? 'control' : 'other')));
  }
  assert.equal(seen.has('control'), false, 'Tab never lands on the hidden control');
  await page.close();
});

test('the surface and its Focus frame name their view parameter for the gate (data-view-param), view by default', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?view=engine`);
  assert.equal(await page.locator('[data-surface]').getAttribute('data-view-param'), 'view');
  await page.locator('[data-focus-enter]').click();
  assert.equal(await page.locator('[data-surface-focus]').getAttribute('data-view-param'), 'view');
  await page.close();
});

test('a language switch inside Focus keeps the sub-view on a surface and on a workbench (the view memory is keyed on ids)', async () => {
  const surface = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await surface.goto(`${h.address}/?view=engine`);
  await surface.getByRole('tab', { name: 'Table' }).click();
  await surface.locator('[data-focus-enter]').click();
  await surface.evaluate(() => (window as unknown as { __setLang: (l: string) => void }).__setLang('es'));
  assert.match(await probe(surface), /TABLE/, 'still on the table sub-view in Focus after the switch');
  await surface.keyboard.press('Escape');
  assert.match(await probe(surface), /TABLE/, 'back in the App on the table sub-view after a language switch inside Focus');
  await surface.close();
  const bench = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await bench.goto(`${h.address}/?workbench=1&view=validation`);
  await bench.getByRole('tab', { name: 'Table' }).click();
  await bench.locator('[data-focus-enter]').click();
  await bench.evaluate(() => (window as unknown as { __setLang: (l: string) => void }).__setLang('es'));
  await bench.keyboard.press('Escape');
  assert.match(await probe(bench), /TABLE/, 'back in the workbench on the table sub-view after a language switch inside Focus');
  await bench.close();
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

test('two sub-view rows with the same ids in different groups or views keep separate selections, and a row honours its own initial (the view memory keys on the place)', async () => {
  const bench = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await bench.goto(`${h.address}/?bench2=1`);
  await bench.getByRole('tab', { name: 'Table' }).click();
  assert.match(await probe(bench), /TABLE alpha/);
  await bench.getByRole('tab', { name: 'Beta' }).click();
  assert.match(await probe(bench), /CHART beta/, 'Beta opens on its own initial, not on the Table chosen in Alpha');
  await bench.getByRole('tab', { name: 'Alpha' }).click();
  assert.match(await probe(bench), /TABLE alpha/, 'and Alpha still has its own choice');
  await bench.close();
  const surface = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await surface.goto(`${h.address}/?twin=1`);
  await surface.getByRole('tab', { name: 'Table' }).click();
  assert.match(await probe(surface), /TABLE alpha/);
  await surface.getByRole('tab', { name: 'Beta' }).click();
  assert.match(await probe(surface), /CHART beta/, 'the second view opens on its own initial');
  await surface.locator('[data-focus-enter]').click();
  assert.match(await probe(surface), /CHART beta/, 'Focus opens the second view on its own sub-view');
  await surface.keyboard.press('Escape');
  await surface.getByRole('tab', { name: 'Alpha' }).click();
  assert.match(await probe(surface), /TABLE alpha/, 'the first view kept its choice across Focus');
  await surface.close();
});

test('the Focus frame names its focus parameter for the gate (data-focus-param), focus by default and the renamed one when the product renames it', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?view=engine`);
  await page.locator('[data-focus-enter]').click();
  assert.equal(await page.locator('[data-surface-focus]').getAttribute('data-focus-param'), 'focus');
  await page.close();
  const renamed = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await renamed.addInitScript('window.__PARAM = "f";');
  await renamed.goto(`${h.address}/?view=engine`);
  await renamed.locator('[data-focus-enter]').click();
  assert.equal(await renamed.locator('[data-surface-focus]').getAttribute('data-focus-param'), 'f');
  await renamed.close();
  const bench = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await bench.goto(`${h.address}/?workbench=1`);
  await bench.locator('[data-focus-enter]').click();
  assert.equal(await bench.locator('.caos-cw-focus').getAttribute('data-focus-param'), 'focus');
  await bench.close();
});
