import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startHarness, type Harness } from './harness';

// Consumer trial of shell 0.17.0 (a584b08): at full rail width the room of the native case select is 181 px, and real case names are
// 202 to 311 px (CAOS_Fragmenta 112 states, CAOS_Contraste 413). The select now shows the selected name in a display of up to two wrapped
// lines with the native select on top of it, transparent: the keyboard, the screen reader and the native list are the select's own.

const FRAGMENTA = 'Degenerate design: the negative control'; // 241 px
const CONTRASTE = 'Corporate PD across 1 to 5 year horizons (planned)'; // 311 px

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { CaseWorkbench } from './src/index';
    const LONG = [
      { id: 'c-short', name: 'Base design', category: 'Mine' },
      { id: 'c-frag', name: ${JSON.stringify(FRAGMENTA)}, category: 'Mine' },
      { id: 'c-contr', name: ${JSON.stringify(CONTRASTE)}, category: 'Credit' },
    ];
    const SHORT = [
      { id: 'c-short', name: 'Base design', category: 'Mine' },
      { id: 'c-two', name: 'Second case', category: 'Mine' },
      { id: 'c-three', name: 'Third case', category: 'Credit' },
    ];
    function App() {
      const q = new URLSearchParams(location.search);
      const cases = q.get('names') === 'short' ? SHORT : LONG;
      const [caseId, setCaseId] = useState(q.get('case') ?? cases[0].id);
      return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <main id="app-main" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <CaseWorkbench
              caseId={caseId}
              cases={{ cases, selectedId: caseId, onSelect: setCaseId, layout: 'select', deepLink: true }}
              variants={{ variants: [{ id: 'a', label: 'Base' }, { id: 'b', label: 'Stress' }], activeId: 'a', onSelect: () => undefined }}
              focus
              groups={[{ id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <p>MODEL {caseId}</p> }]}
              context={{ content: <p>CONTEXT</p> }}
            />
          </main>
          {q.get('ref') === '1' && <select id="ref" className="select" aria-label="reference"><option>Base design</option></select>}
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

/** What the reader sees for the case select: the display's text, the lines that text needs at the display's width, and its box. */
const seen = (page: Page) =>
  page.evaluate(() => {
    const d = document.querySelector('.cs-select-display') as HTMLElement | null;
    if (!d) return null;
    const s = getComputedStyle(d);
    const probe = d.cloneNode(false) as HTMLElement;
    probe.textContent = d.textContent;
    probe.setAttribute('style', `position:absolute;visibility:hidden;left:0;top:0;width:${d.getBoundingClientRect().width}px;display:block;overflow:visible;max-height:none;min-height:0;height:auto;-webkit-line-clamp:unset`);
    d.parentElement!.append(probe);
    const line = parseFloat(getComputedStyle(probe).lineHeight);
    const pad = parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) + parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth);
    const lines = Math.round((probe.getBoundingClientRect().height - pad) / line);
    probe.remove();
    const r = d.getBoundingClientRect();
    return { text: (d.textContent ?? '').trim(), lines, height: Math.round(r.height * 100) / 100, hidden: d.getAttribute('aria-hidden') };
  });

async function longNamesWhole(theme: string) {
  for (const [width, height] of SIZES) {
    const page = await h.browser.newPage({ viewport: { width, height } });
    await page.goto(h.address);
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForSelector('select[data-control="case"]');
    for (const mode of ['App', 'Focus']) {
      if (mode === 'Focus') {
        await page.locator('[data-focus-enter]').click();
        await page.waitForSelector('[data-focus-shell]');
      }
      for (const [id, name] of [['c-frag', FRAGMENTA], ['c-contr', CONTRASTE]]) {
        await page.locator('select[data-control="case"]').selectOption(id);
        const s = await seen(page);
        const where = `${theme} ${width}px ${mode} ${id}`;
        assert.ok(s, `${where}: the display is there`);
        assert.equal(s.text, name, `${where}: the whole name`);
        assert.ok(s.lines <= 2, `${where}: ${s.lines} lines needed, two fit`);
        assert.equal(s.hidden, 'true', `${where}: the display is hidden from the accessibility tree`);
      }
    }
    await page.close();
  }
}

test('light: the longest Fragmenta and Contraste names are shown whole, in two lines at most, at 390, 768 and 1280 px, in the App and in Focus', async () => {
  await longNamesWhole('light');
});

test('dark: the longest Fragmenta and Contraste names are shown whole, in two lines at most, at 390, 768 and 1280 px, in the App and in Focus', async () => {
  await longNamesWhole('dark');
});

test('when every name fits, the select is one line and as tall as a plain select; when one needs two lines, the height is the same for every case', async () => {
  for (const [width, height] of SIZES) {
    const page = await h.browser.newPage({ viewport: { width, height } });
    await page.goto(`${h.address}/?names=short&ref=1`);
    await page.waitForSelector('.cs-select-display');
    const one = await page.evaluate(() => ({
      wrap: document.querySelector('.cs-select-wrap')!.getBoundingClientRect().height,
      ref: document.querySelector('#ref')!.getBoundingClientRect().height,
      head: document.querySelector('.caos-wb-rail-head')!.getBoundingClientRect().height,
    }));
    assert.ok(Math.abs(one.wrap - one.ref) <= 1, `${width}px: one line, ${one.wrap} against a plain select's ${one.ref}`);
    const heads = new Set<number>();
    for (const id of ['c-two', 'c-three', 'c-short']) {
      await page.locator('select[data-control="case"]').selectOption(id);
      heads.add(await page.evaluate(() => Math.round(document.querySelector('.caos-wb-rail-head')!.getBoundingClientRect().height * 100) / 100));
    }
    assert.equal(heads.size, 1, `${width}px short list: the rail head never moves (${[...heads]})`);
    assert.equal([...heads][0], Math.round(one.head * 100) / 100, `${width}px: the head is what it was at one line`);
    await page.close();

    const long = await h.browser.newPage({ viewport: { width, height } });
    await long.goto(h.address);
    await long.waitForSelector('.cs-select-display');
    const hs = new Set<string>();
    for (const id of ['c-short', 'c-frag', 'c-contr', 'c-short']) {
      await long.locator('select[data-control="case"]').selectOption(id);
      hs.add(await long.evaluate(() => `${Math.round(document.querySelector('.cs-select-wrap')!.getBoundingClientRect().height * 100) / 100}/${Math.round(document.querySelector('.caos-wb-rail-head')!.getBoundingClientRect().height * 100) / 100}`));
    }
    assert.equal(hs.size, 1, `${width}px long list: the select and the rail head keep their height across case switches (${[...hs]})`);
    await long.close();
  }
});

test('the native select stays in place on top of the display: named for a screen reader, operable by keyboard, with the native list', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(h.address);
  const box = page.getByRole('combobox', { name: 'Case selector' });
  assert.equal(await box.count(), 1, 'one combobox with its accessible name');
  const geo = await page.evaluate(() => {
    const w = document.querySelector('.cs-select-wrap')!.getBoundingClientRect();
    const s = document.querySelector('select[data-control="case"]')!.getBoundingClientRect();
    const cs = getComputedStyle(document.querySelector('select[data-control="case"]')!);
    return { dx: Math.abs(w.left - s.left), dy: Math.abs(w.top - s.top), dw: Math.abs(w.width - s.width), dh: Math.abs(w.height - s.height), color: cs.color, opacity: cs.opacity };
  });
  assert.ok(geo.dx < 1 && geo.dy < 1 && geo.dw < 1 && geo.dh < 1, 'the select covers the display exactly');
  assert.notEqual(geo.opacity, '0', 'transparent by colour, not by opacity (it stays visible to the gate and to assistive tools)');
  assert.match(geo.color, /rgba\(0, 0, 0, 0\)|transparent/);
  // the pointer hits the select, so a click opens its native list
  assert.equal(await page.evaluate(() => { const r = document.querySelector('.cs-select-display')!.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.tagName; }), 'SELECT');
  await box.focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await box.inputValue(), 'c-frag', 'the keyboard moves the selection');
  assert.equal((await seen(page))?.text, FRAGMENTA, 'and the display follows');
  await page.keyboard.press('End');
  assert.equal(await box.inputValue(), 'c-contr');
  assert.equal((await seen(page))?.text, CONTRASTE);
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'SELECT', 'keyboard focus stays on the native select');
  assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('.cs-select-display')!).outlineStyle !== 'none'), 'a focus ring shows on the display');
  await page.close();
});
