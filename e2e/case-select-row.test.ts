import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startHarness, type Harness } from './harness';

// BL-074 (shell 0.17.0): since 0.14.1 the case select shared its row with the Focus control and a case name was cut inside the native
// select (CAOS_Fragmenta 0.08.001: "Mina de cob"). The control now sits at the end of the group tab row, in the slot Tabs reserves, so the
// select takes the rail's whole width and the rail head and the tab row are no taller than without the control (ADR-0071).

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { CaseWorkbench, SubTabs } from './src/index';
    const CASES = [
      { id: 'c-low', name: 'Mina de cobre', category: 'Rajo' },
      { id: 'c-long', name: 'Diseño degenerado: el control', category: 'Rajo' },
      { id: 'c-high', name: 'Tronadura', category: 'Subterránea' },
    ];
    function App() {
      const q = new URLSearchParams(location.search);
      const [caseId, setCaseId] = useState(q.get('case') ?? 'c-long');
      const focus = q.get('nofocus') === '1' ? undefined : { onChange: (on) => { window.__focusEvents = [...(window.__focusEvents ?? []), on]; } };
      return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <main id="app-main" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <CaseWorkbench
              caseId={caseId}
              cases={{ cases: CASES, selectedId: caseId, onSelect: setCaseId, layout: 'select', deepLink: true }}
              variants={{ variants: [{ id: 'a', label: 'Base' }, { id: 'b', label: 'Stress' }], activeId: 'a', onSelect: () => undefined }}
              focus={focus}
              groups={[
                { id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <p data-probe="model">MODEL {caseId}</p> },
                { id: 'validation', label: { en: 'Validation', es: 'Validación' }, content: (
                  <SubTabs ariaLabel="Validation views" tabs={[
                    { id: 'phase', label: 'Phase', content: <p data-probe="phase">PHASE {caseId}</p> },
                    { id: 'table', label: 'Table', content: <p data-probe="table">TABLE {caseId}</p> },
                  ]} />
                ) },
              ]}
              context={{ content: <p>CONTEXT</p> }}
            />
          </main>
        </div>
      );
    }
    createRoot(document.getElementById('root')).render(<App />);
  `);
});
after(async () => {
  await h?.close();
});

const SIZES: Array<[number, number]> = [[390, 844], [768, 844], [1280, 800]];
const q = (page: Page) => new URL(page.url()).searchParams;

/**
 * Every visible select whose selected text does not fit the room it leaves: a case select with the shell's display shows its name in up to
 * two wrapped lines (a probe copy of the display gives the lines the text needs); any other select shows one line in its width less its own
 * padding and the native arrow, which is measured (a probe select of the same class holding one character; 0 with `appearance: none`).
 * The same measure as the gate's G5 (gate/inpage.mjs, `selectCuts`).
 */
const cutSelects = (page: Page) =>
  page.evaluate(() => {
    const out: Array<{ text: string; need: number; has: number }> = [];
    const ctx = document.createElement('canvas').getContext('2d')!;
    for (const sel of document.querySelectorAll('select')) {
      const r = sel.getBoundingClientRect();
      if (r.width < 1) continue;
      const s = getComputedStyle(sel);
      const text = (sel.selectedOptions[0]?.textContent ?? '').trim();
      const display = sel.closest('.cs-select-wrap')?.querySelector('.cs-select-display') as HTMLElement | null;
      if (display) {
        const probe = display.cloneNode(false) as HTMLElement;
        probe.textContent = text;
        probe.setAttribute('style', `position:absolute;visibility:hidden;left:0;top:0;width:${display.getBoundingClientRect().width}px;display:block;overflow:visible;max-height:none;min-height:0;height:auto`);
        display.parentElement!.append(probe);
        const pv = getComputedStyle(probe);
        const box = parseFloat(pv.paddingTop) + parseFloat(pv.paddingBottom) + parseFloat(pv.borderTopWidth) + parseFloat(pv.borderBottomWidth);
        const lines = Math.round((probe.getBoundingClientRect().height - box) / parseFloat(pv.lineHeight));
        probe.remove();
        if (lines > 2) out.push({ text, need: lines, has: 2 });
        continue;
      }
      ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const pad = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
      const probe = sel.cloneNode(false) as HTMLSelectElement;
      for (const a of Array.from(probe.attributes)) if (a.name !== 'class') probe.removeAttribute(a.name);
      probe.append(new Option('x'));
      probe.setAttribute('style', 'position:absolute;visibility:hidden;width:auto;min-width:0;max-width:none;flex:none;left:0;top:0');
      sel.parentElement!.append(probe);
      const ps = getComputedStyle(probe);
      const arrow = Math.max(0, probe.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight) - ctx.measureText('x').width);
      probe.remove();
      const need = ctx.measureText(text).width;
      const has = sel.clientWidth - pad - arrow;
      if (need > has + 1) out.push({ text, need: Math.round(need), has: Math.round(has) });
    }
    return out;
  });

test('the case select shows the whole name of the longest case at 390, 768 and 1280 px, with the Focus control present', async () => {
  for (const [width, height] of SIZES) {
    const page = await h.browser.newPage({ viewport: { width, height } });
    await page.goto(h.address);
    await page.waitForSelector('[data-control="case"]');
    assert.equal(await page.locator('[data-focus-enter]').count(), 1);
    assert.deepEqual(await cutSelects(page), [], `${width}px: no select cuts its selected case name`);
    const m = await page.evaluate(() => {
      const sel = document.querySelector('select[data-control="case"]')!.getBoundingClientRect();
      const head = document.querySelector('.caos-wb-rail-head')!.getBoundingClientRect();
      return { selW: sel.width, headW: head.width, inRow: !!document.querySelector('.cs-select-row'), inHead: !!document.querySelector('.caos-wb-rail-head [data-focus-enter]') };
    });
    assert.equal(m.inRow, false, `${width}px: no select row`);
    assert.equal(m.inHead, false, `${width}px: the control is not in the rail head`);
    // the rail head holds the select alone: it takes the head's width less the rail's padding, up to its own 460px cap
    assert.ok(m.selW >= Math.min(m.headW, 460) - 2, `${width}px: the select spans the rail head (${m.selW}px in a ${m.headW}px head)`);
    await page.close();
  }
});

test('the control sits at the end of the group tab row, beside the tab list and never inside it, on one row', async () => {
  for (const [width, height] of SIZES) {
    const page = await h.browser.newPage({ viewport: { width, height } });
    await page.goto(h.address);
    await page.waitForSelector('[data-focus-enter]');
    const m = await page.evaluate(() => {
      const c = document.querySelector('[data-focus-enter]')!.getBoundingClientRect();
      const list = document.querySelector('[data-case-workbench] [role="tablist"]')!;
      const lr = list.getBoundingClientRect();
      const slot = document.querySelector('[data-tabs-slot]')!;
      return { right: c.right, left: c.left, w: innerWidth, listRight: lr.right, inTablist: list.contains(slot), sameRow: Math.abs(c.top - lr.top) < lr.height, slotInCw: !!slot.closest('[data-case-workbench]') };
    });
    assert.ok(m.right <= m.w && m.left >= 0, `${width}px: inside the viewport`);
    assert.ok(m.listRight <= m.left + 1, `${width}px: the tab list ends where the slot starts`);
    assert.equal(m.inTablist, false);
    assert.equal(m.sameRow, true, `${width}px: same row`);
    assert.equal(m.slotInCw, true);
    await page.close();
  }
});

test('the rail head and the group tab row are no taller with the Focus control than without it (0.16.0 geometry), at 390, 768 and 1280 px', async () => {
  const geometry = async (width: number, height: number, nofocus: boolean) => {
    const page = await h.browser.newPage({ viewport: { width, height } });
    await page.goto(`${h.address}/?${nofocus ? 'nofocus=1' : ''}`);
    await page.waitForSelector('[data-case-workbench] [role="tablist"]');
    const g = await page.evaluate(() => {
      const wb = document.querySelector('[data-case-workbench]')!.getBoundingClientRect();
      const row = document.querySelector('[data-case-workbench] [role="tablist"]')!.getBoundingClientRect();
      const tab = document.querySelector('[data-case-workbench] [role="tablist"] [role="tab"]')!.getBoundingClientRect();
      const panel = document.querySelector('[data-case-workbench] [role="tabpanel"]')!.getBoundingClientRect();
      const head = document.querySelector('.caos-wb-rail-head')!.getBoundingClientRect();
      return { head: Math.round(head.height * 100) / 100, rowH: Math.round(row.height * 100) / 100, tabH: Math.round(tab.height * 100) / 100, panelTop: Math.round((panel.top - wb.top) * 100) / 100 };
    });
    await page.close();
    return g;
  };
  for (const [w, hh] of SIZES) {
    const withFocus = await geometry(w, hh, false);
    const without = await geometry(w, hh, true);
    assert.equal(withFocus.head, without.head, `${w}px: the rail head's height (${withFocus.head} against ${without.head})`);
    assert.equal(withFocus.rowH, without.rowH, `${w}px: the tab row's height`);
    assert.equal(withFocus.tabH, without.tabH, `${w}px: the tabs' height`);
    assert.equal(withFocus.panelTop, without.panelTop, `${w}px: the panel starts at the same place, the row added no height (${withFocus.panelTop} against ${without.panelTop})`);
  }
});

test('Focus keeps its behaviour from the tab row: the URL, the exit button, Escape and the return to the same case, group and sub-view', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?case=c-long&view=validation`);
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await page.locator('[data-focus-enter]').click();
  await page.waitForSelector('[data-focus-shell]');
  assert.equal(q(page).get('focus'), '1');
  assert.equal(q(page).get('case'), 'c-long');
  assert.equal(q(page).get('view'), 'validation');
  assert.equal(await page.locator('[data-focus-shell] [data-focus-enter]').count(), 0, 'no Focus control inside Focus');
  assert.deepEqual(await cutSelects(page), [], 'the select in the Focus rail shows the whole name too');
  assert.match((await page.locator('[data-probe]').first().textContent()) ?? '', /TABLE c-long/);
  await page.locator('[data-focus-exit]').click();
  assert.equal(await page.locator('[data-focus-shell]').count(), 0);
  assert.equal(q(page).get('focus'), null);
  assert.match((await page.locator('[data-probe]').first().textContent()) ?? '', /TABLE c-long/, 'same case, group and sub-view');
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-focus-enter')), true, 'keyboard focus returns to the control');
  await page.locator('[data-focus-enter]').click();
  await page.waitForSelector('[data-focus-shell]');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-focus-shell]').count(), 0, 'Escape returns');
  assert.equal(q(page).get('case'), 'c-long');
  assert.deepEqual(await page.evaluate(() => (window as unknown as { __focusEvents: boolean[] }).__focusEvents), [true, false, true, false]);
  await page.close();
});

test('a select of the product, without the shell display, whose text fits its content box but ends under the native arrow is cut (the arrow is measured, review of 0.17.0 M1)', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?case=c-long`);
  await page.waitForSelector('[data-control="case"]');
  assert.deepEqual(await cutSelects(page), [], 'the case select shows its name whole');
  await page.evaluate(() => {
    const sel = document.createElement('select');
    sel.className = 'select';
    sel.id = 'planted';
    sel.append(new Option('Low contact'));
    document.querySelector('.caos-wb-rail-head')!.append(sel);
    const s = getComputedStyle(sel);
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const box = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight) + parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
    sel.style.width = `${ctx.measureText('Low contact').width + box + 2}px`;
  });
  const cut = await cutSelects(page);
  assert.equal(cut.length, 1, 'the text ends under the arrow: cut');
  assert.equal(cut[0].text, 'Low contact');
  assert.ok(cut[0].has < cut[0].need, 'the arrow is taken out of the room');
  await page.close();
});
