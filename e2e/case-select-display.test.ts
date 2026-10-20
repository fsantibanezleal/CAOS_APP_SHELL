import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startHarness, type Harness } from './harness';

// Consumer trial of shell 0.17.0 (a584b08): at full rail width the room of the native case select is 181 px, and real case names are
// 202 to 311 px (CAOS_Fragmenta 112 states, CAOS_Contraste 413). The select now shows the selected name in a display of up to two wrapped
// lines with the native select on top of it, transparent: the keyboard, the screen reader and the native list are the select's own.
// Round 3 (the trial of 8e6e254 and the re-review): no line cap. The display shows the whole name at any length, wrapping to as many lines as the
// longest name of the visible list needs (measured in the DOM), a token wider than the room breaks inside; it names the case the select holds;
// forced colours keep the native select transparent; one focus ring, on keyboard focus.

const FRAGMENTA = 'Degenerate design: the negative control'; // 241 px
const CONTRASTE = 'Corporate PD across 1 to 5 year horizons (planned)'; // 311 px
const GRANITE = 'Granite mine, northeastern China: the extrapolation control'; // 354 px, three lines in the App rail (the trial of 8e6e254)
const LIFETIME = 'Lifetime PD, IFRS 9 staging and ECL on public small-business loans'; // 398 px
const TOKEN = 'fragmenta_escondida_bench_blast_pattern_07_full_resolution_run'; // no space, wider than the room

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { CaseSelector, CaseWorkbench } from './src/index';
    const LONG = [
      { id: 'c-short', name: 'Base design', category: 'Mine' },
      { id: 'c-frag', name: ${JSON.stringify(FRAGMENTA)}, category: 'Mine' },
      { id: 'c-contr', name: ${JSON.stringify(CONTRASTE)}, category: 'Credit' },
      { id: 'c-granite', name: ${JSON.stringify(GRANITE)}, category: 'Mine' },
      { id: 'c-life', name: ${JSON.stringify(LIFETIME)}, category: 'Credit' },
      { id: 'c-token', name: ${JSON.stringify(TOKEN)}, category: 'Mine' },
    ];
    const SHORT = [
      { id: 'c-short', name: 'Base design', category: 'Mine' },
      { id: 'c-two', name: 'Second case', category: 'Mine' },
      { id: 'c-three', name: 'Third case', category: 'Credit' },
    ];
    function Lane() {
      // the stale scenario: the selected id is outside the visible source lane
      const [id, setId] = useState('r1');
      return (
        <div style={{ width: 300 }}>
          <CaseSelector
            cases={[{ id: 's1', name: 'Synthetic one', kind: 'synthetic' }, { id: 'r1', name: 'Real one', kind: 'real' }]}
            selectedId={id}
            onSelect={setId}
            source="synthetic"
            layout="select"
          />
        </div>
      );
    }
    function Edge() {
      const q = new URLSearchParams(location.search);
      const set = q.get('set');
      const cases = set === 'empty' ? [] : set === 'one' ? [{ id: 'only', name: ${JSON.stringify(TOKEN)} }]
        : [{ id: 'first', name: 'Disabled first case', disabled: true }, { id: 'second', name: 'Second enabled case' }];
      return (
        <div style={{ width: 300 }}>
          <CaseSelector cases={cases} selectedId="none" onSelect={() => undefined} layout="select" accessory={set === 'accessory' ? <button type="button">Go</button> : undefined} />
        </div>
      );
    }
    function App() {
      const q = new URLSearchParams(location.search);
      if (q.get('mode') === 'lane') return <Lane />;
      if (q.get('mode') === 'edge') return <Edge />;
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

/** What the reader sees for the case select: the real text element (never a probe copy), the lines it holds and whether its box cuts it. */
const seen = (page: Page) =>
  page.evaluate(() => {
    const d = document.querySelector('.cs-select-display') as HTMLElement | null;
    const t = d?.querySelector('.cs-select-text') as HTMLElement | null;
    if (!d || !t) return null;
    const line = parseFloat(getComputedStyle(t).lineHeight);
    const r = d.getBoundingClientRect();
    return {
      text: (t.textContent ?? '').trim(),
      lines: Math.round(t.clientHeight / line),
      cutV: t.scrollHeight > t.clientHeight + 1,
      cutH: t.scrollWidth > t.clientWidth + 1,
      height: Math.round(r.height * 100) / 100,
      hidden: d.getAttribute('aria-hidden'),
    };
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
      for (const [id, name] of [['c-frag', FRAGMENTA], ['c-contr', CONTRASTE], ['c-granite', GRANITE], ['c-life', LIFETIME], ['c-token', TOKEN]]) {
        await page.locator('select[data-control="case"]').selectOption(id);
        const s = await seen(page);
        const where = `${theme} ${width}px ${mode} ${id}`;
        assert.ok(s, `${where}: the display is there`);
        assert.equal(s.text, name, `${where}: the whole name`);
        assert.ok(!s.cutV && !s.cutH, `${where}: the name is cut (${s.lines} lines)`);
        assert.equal(s.hidden, 'true', `${where}: the display is hidden from the accessibility tree`);
      }
    }
    await page.close();
  }
}

test('light: the Fragmenta, Contraste and longer trial names are shown whole at any length, at 390, 768 and 1280 px, in the App and in Focus', async () => {
  await longNamesWhole('light');
});

test('dark: the Fragmenta, Contraste and longer trial names are shown whole at any length, at 390, 768 and 1280 px, in the App and in Focus', async () => {
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
  assert.equal(await box.inputValue(), 'c-life', 'the last option of the native list');
  assert.equal((await seen(page))?.text, LIFETIME);
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'SELECT', 'keyboard focus stays on the native select');
  assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('.cs-select-display')!).outlineStyle !== 'none'), 'a focus ring shows on the display');
  await page.close();
});

test('no line cap: the trial names that needed three lines in 182 px (Fragmenta 354 px, Contraste 398 px) read whole in three lines, in the App and in Focus at 1280x800, and the token wider than the room breaks inside', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(h.address);
  await page.waitForSelector('select[data-control="case"]');
  for (const mode of ['App', 'Focus']) {
    if (mode === 'Focus') {
      await page.locator('[data-focus-enter]').click();
      await page.waitForSelector('[data-focus-shell]');
    }
    for (const [id, name] of [['c-granite', GRANITE], ['c-life', LIFETIME], ['c-token', TOKEN]]) {
      await page.locator('select[data-control="case"]').selectOption(id);
      const s = (await seen(page))!;
      assert.equal(s.text, name, `${mode} ${id}: the whole name`);
      assert.ok(s.lines >= 3, `${mode} ${id}: ${s.lines} lines (the name needs three or more in the rail)`);
      assert.ok(!s.cutV && !s.cutH, `${mode} ${id}: not cut`);
      const room = await page.evaluate(() => { const t = document.querySelector('.cs-select-text') as HTMLElement; return t.getBoundingClientRect().right <= document.querySelector('.cs-select-display')!.getBoundingClientRect().right; });
      assert.ok(room, `${mode} ${id}: the text stays inside the display`);
    }
  }
  await page.close();
});

test('the display always names the case the native select holds: a selected id outside the visible source lane shows the first visible case, as React selects it', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?mode=lane`);
  await page.waitForSelector('.cs-select-display');
  const held = await page.evaluate(() => { const sel = document.querySelector('select[data-control="case"]') as HTMLSelectElement; return sel.options[sel.selectedIndex].textContent; });
  assert.equal(held, 'Synthetic one', 'React gives the select its first visible option');
  assert.equal((await seen(page))?.text, 'Synthetic one', 'and the display shows the same case');
  await page.close();
});

test('edge lists: a disabled first option falls to the first enabled case, an empty list shows an empty display without error, a list of one long token reads whole beside an accessory', async () => {
  const errors: string[] = [];
  for (const set of ['disabled', 'empty', 'one', 'accessory']) {
    const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => errors.push(`${set}: ${e.message}`));
    await page.goto(`${h.address}/?mode=edge&set=${set}`);
    await page.waitForSelector('.cs-select-display');
    const s = (await seen(page))!;
    const held = await page.evaluate(() => { const sel = document.querySelector('select[data-control="case"]') as HTMLSelectElement; return (sel.options[sel.selectedIndex]?.textContent ?? '').trim(); });
    assert.equal(s.text, held, `${set}: the display names what the select holds ("${held}")`);
    if (set === 'disabled') assert.equal(s.text, 'Second enabled case');
    if (set === 'empty') assert.equal(s.text, '');
    if (set === 'one' || set === 'accessory') assert.ok(!s.cutV && !s.cutH, `${set}: the token reads whole`);
    await page.close();
  }
  assert.deepEqual(errors, []);
});

test('forced colours (Windows High Contrast): the native select stays transparent and the display holds the name, in light and dark, so the name is not painted over itself', async () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    const ctx = await h.browser.newContext({ viewport: { width: 1280, height: 800 }, forcedColors: 'active', colorScheme });
    const page = await ctx.newPage();
    await page.goto(h.address);
    await page.waitForSelector('select[data-control="case"]');
    await page.locator('select[data-control="case"]').selectOption('c-contr');
    const color = await page.evaluate(() => getComputedStyle(document.querySelector('select[data-control="case"]')!).color);
    assert.match(color, /rgba\(0, 0, 0, 0\)|transparent/, `${colorScheme}: the native select's colour stays transparent under forced colours (was ${color})`);
    assert.equal((await seen(page))?.text, CONTRASTE, `${colorScheme}: the display holds the name`);
    const opt = await page.evaluate(() => getComputedStyle(document.querySelector('select[data-control="case"] option')!).color);
    assert.doesNotMatch(opt, /rgba\(0, 0, 0, 0\)|transparent/, `${colorScheme}: the options keep a readable colour`);
    await ctx.close();
  }
});

test('one focus ring: the display rings on :focus-visible, the native select never draws one', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(h.address);
  await page.waitForSelector('select[data-control="case"]');
  const rings = () => page.evaluate(() => {
    const sel = document.querySelector('select[data-control="case"]')!;
    return {
      display: getComputedStyle(document.querySelector('.cs-select-display')!).outlineStyle,
      native: getComputedStyle(sel).outlineStyle,
      focusVisible: sel.matches(':focus-visible'),
    };
  });
  // the ring follows :focus-visible, as for any control. Chromium matches :focus-visible on a select after a mouse click too (it takes keyboard
  // input), so what is checked is the pairing: the native select never draws a ring and the display draws exactly one when the browser says so.
  const box = await page.locator('.cs-select-wrap').boundingBox();
  await page.mouse.click(box!.x + 20, box!.y + 10);
  const mouse = await rings();
  assert.equal(mouse.native, 'none', 'a mouse click: no native ring');
  assert.equal(mouse.display === 'solid', mouse.focusVisible, 'a mouse click: the display rings only when the select matches :focus-visible');
  await page.locator('body').click({ position: { x: 3, y: 3 } });
  const blurred = await rings();
  assert.deepEqual([blurred.display, blurred.native], ['none', 'none'], 'no focus: no ring');
  await page.locator('select[data-control="case"]').focus();
  await page.keyboard.press('ArrowDown');
  const key = await rings();
  assert.deepEqual([key.display, key.native, key.focusVisible], ['solid', 'none', true], 'keyboard focus: the display ring only');
  await page.close();
});

test('the height holds when the reader switches cases by arrows and by typing, and the accessibility tree keeps the combobox with the held option and none of the display text', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(h.address);
  await page.waitForSelector('select[data-control="case"]');
  const box = page.getByRole('combobox', { name: 'Case selector' });
  await box.focus();
  const heights = new Set<string>();
  const grab = async () => heights.add(await page.evaluate(() => `${Math.round(document.querySelector('.cs-select-wrap')!.getBoundingClientRect().height * 100) / 100}/${Math.round(document.querySelector('.caos-wb-rail-head')!.getBoundingClientRect().height * 100) / 100}`));
  await grab();
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Home', 'End']) {
    await page.keyboard.press(key);
    await grab();
  }
  await page.keyboard.type('Corp');
  await grab();
  await page.keyboard.type('Gra');
  await grab();
  assert.equal(heights.size, 1, `the select and the rail head keep their height (${[...heights]})`);
  const tree = await page.locator('.cs-select-wrap').ariaSnapshot();
  assert.match(tree, /combobox "Case selector"/);
  assert.doesNotMatch(tree, /generic|StaticText/, 'no text node of the display in the tree');
  await page.close();
});
