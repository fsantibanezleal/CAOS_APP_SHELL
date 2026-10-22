import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startTierPage, type TierPage } from './tier-harness.ts';

// Shell 0.19.0, Tier A of the interactive-visualization rubric on UPlotChart: zoom and pan by wheel, brush, Shift and drag and
// touch; double-click, the visible control and the keys to reset; a crosshair with a readout from the keyboard; a tab stop with
// a name, a hidden table of the values and a summary. The page reads `?form=` and `?lang=`; `window.__picked` records the points
// chosen with Enter, `window.setLang` and `window.setTheme` change the language and the theme while the chart is drawn.
let t: TierPage;
before(async () => {
  t = await startTierPage(`
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { UPlotChart } from './src/chart';
    import { useLangStore } from './src/lib/lang';
    import { useThemeStore } from './src/lib/theme';
    const w = window as unknown as Record<string, any>;
    w.setLang = (l: 'en' | 'es') => useLangStore.getState().setLang(l);
    w.setTheme = (th: 'light' | 'dark') => useThemeStore.getState().setTheme(th);
    w.__picked = [];
    const q = new URLSearchParams(location.search);
    useLangStore.getState().setLang(q.get('lang') === 'es' ? 'es' : 'en');
    const form = q.get('form') ?? 'line';
    const years = Array.from({ length: 12 }, (_, i) => 2000 + i);
    const massA = [1, 2.5, 3, 4.5, 5, 6.5, 7, 7.5, 8, 8.5, 9, 9.5];
    const massB = [9, 8.5, 8, 7, 6.5, 6, 5, 4, 3.5, 3, 2, 1.5];
    const page = (child: React.ReactNode) => (<div><div style={{ width: 640, maxWidth: '100%', height: 420 }}>{child}</div><div style={{ height: 2400 }}>after the chart</div></div>);
    const xAxis = { label: 'Year', format: { decimals: 0, grouping: false } };
    const yAxis = { label: 'Mass', unit: 'kg', format: { decimals: 1 } };
    function Line() {
      return page(<UPlotChart height={360} title="Growth" x={{ values: years, ...xAxis }} y={yAxis} series={[{ label: 'Alpha', values: massA }, { label: 'Beta', values: massB }]} onPick={(i) => w.__picked.push(i)} />);
    }
    function Es() {
      return page(<UPlotChart height={360} title={{ en: 'Growth', es: 'Crecimiento' }} x={{ values: years, label: { en: 'Year', es: 'Año' }, format: { decimals: 0, grouping: false } }} y={{ label: { en: 'Mass', es: 'Masa' }, unit: 'kg', format: { decimals: 1 } }} series={[{ label: 'Alpha', values: massA }]} />);
    }
    function One() {
      return page(<UPlotChart height={360} x={{ values: [5], label: 'Year' }} y={yAxis} series={[{ label: 'Alpha', values: [3] }]} />);
    }
    function Empty() {
      return page(<UPlotChart height={360} x={{ values: [], label: 'Year' }} y={yAxis} series={[{ label: 'Alpha', values: [] }]} />);
    }
    function Log() {
      return page(<UPlotChart height={360} x={{ values: [1, 10, 100, 1000, 10000], label: 'Size', log: true }} y={yAxis} series={[{ label: 'Alpha', values: [1, 2, 3, 4, 5] }]} />);
    }
    function Off() {
      return page(<UPlotChart height={360} zoomOff="The range is the finding: the whole curve must stay in view" x={{ values: years, ...xAxis }} y={yAxis} series={[{ label: 'Alpha', values: massA }]} />);
    }
    function Both() {
      return page(<UPlotChart height={360} zoomY x={{ values: years, ...xAxis }} y={yAxis} series={[{ label: 'Alpha', values: massA }]} />);
    }
    function Drag() {
      const [v, setV] = useState(5);
      return page(<UPlotChart height={360} x={{ values: years, ...xAxis }} y={{ ...yAxis, range: [0, 10] }} series={[{ label: 'Alpha', values: massA }]} yMarks={[{ y: v, label: 'limit', drag: { min: 0, max: 10, step: 0.5 } }]} onYMarkChange={(_i, y) => setV(y)} />);
    }
    function Rerender() {
      const [tick, setTick] = useState(0);
      const [bump, setBump] = useState(0);
      w.rerender = () => setTick((n) => n + 1);
      w.newData = () => setBump((n) => n + 1);
      // fresh arrays on every render, as a parent that does not memoize hands them in
      return page(<UPlotChart height={360} x={{ values: [...years], ...xAxis }} y={yAxis} series={[{ label: 'Alpha', values: massA.map((v) => v + bump) }]} />);
    }
    function Ticks() {
      return page(<UPlotChart height={360} x={{ values: [0, 1, 2, 3, 4, 5, 6, 7], label: 'Protocol', ticks: [0, 1, 2, 3, 4, 5, 6, 7].map((v) => ({ value: v, label: 'p' + v })) }} y={yAxis} series={[{ label: 'Alpha', values: [1, 2, 3, 4, 5, 6, 7, 8] }]} />);
    }
    function Scatter() {
      return page(<UPlotChart height={360} x={{ values: [3, 1, 2, 5, 4], label: 'Observed' }} y={yAxis} series={[{ label: 'Predicted', values: [3.1, 0.8, 2.2, 5.3, 3.9], mode: 'points' }]} onPick={(i) => w.__picked.push(i)} />);
    }
    function Ranged() {
      return page(<UPlotChart height={360} x={{ values: [0, 1, 2], label: 'Protocol', ticks: [0, 1, 2].map((v) => ({ value: v, label: 'p' + v })), range: [-0.5, 2.5] }} y={{ label: 'Error', range: [10, 40], format: { decimals: 0 } }} series={[{ label: 'Model', values: [12, 24, 39], dots: true }]} />);
    }
    function OverlayLog() {
      return page(<UPlotChart height={360} zoomY x={{ values: [0.01, 0.1, 1, 10], label: 'Size', log: true }} y={{ label: 'Passing', range: [0, 100], format: { decimals: 0 } }} series={[{ label: 'Model', values: [5, 30, 70, 99] }, { label: 'Measured', values: [3, 19, 51, 99], x: [0.015, 0.07, 0.3, 3], mode: 'points' }]} yMarks={[{ y: 50, label: 'P50', drag: { min: 5, max: 95, step: 1 } }]} onYMarkChange={() => undefined} />);
    }
    const forms: Record<string, () => React.ReactNode> = { ranged: Ranged, overlaylog: OverlayLog, line: Line, es: Es, one: One, empty: Empty, log: Log, off: Off, both: Both, drag: Drag, rerender: Rerender, ticks: Ticks, scatter: Scatter };
    const App = forms[form] ?? Line;
    createRoot(document.getElementById('root')!).render(<App />);
  `);
});
after(async () => {
  await t?.close();
});

const view = async (page: Page): Promise<[number, number]> => {
  const raw = await page.locator('.caos-chart').getAttribute('data-view-x');
  const [a, b] = (raw ?? '0,0').split(',').map(Number);
  return [a, b];
};
const zoomed = async (page: Page) => (await page.locator('.caos-chart').getAttribute('data-zoomed')) === '1';
const readout = async (page: Page) => ((await page.locator('.caos-chart-readout').textContent()) ?? '').replace(/ /g, ' ');
async function open(query: string, opts?: Parameters<TierPage['open']>[1]) {
  const o = await t.open(query, opts);
  await o.page.waitForSelector('.caos-chart[data-drawn="1"] canvas', { timeout: 10000 });
  await o.page.waitForFunction(() => document.querySelector('.caos-chart')?.getAttribute('data-view-x'), null, { timeout: 5000 });
  return o;
}
const plotBox = async (page: Page) => (await page.locator('.u-over').boundingBox())!;

test('Tier A: the plot is one tab stop with the chart title as its name, a hidden table of the values and a summary', async () => {
  const { page, errors } = await open('form=line');
  try {
    const plot = page.locator('[data-chart-focus]');
    assert.equal(await page.locator('[data-chart-focus]').count(), 1, 'exactly one tab stop per chart');
    assert.equal(await plot.getAttribute('tabindex'), '0');
    assert.equal(await plot.getAttribute('aria-label'), 'Growth');
    assert.equal(await plot.getAttribute('role'), 'group');
    assert.equal(await plot.getAttribute('aria-roledescription'), 'interactive chart');
    const described = (await plot.getAttribute('aria-describedby'))!.split(' ');
    assert.equal(described.length, 2);
    for (const id of described) assert.equal(await page.locator(`[id="${id}"]`).count(), 1, `the description ${id} exists`);
    const table = page.locator('table[data-chart-table]');
    assert.equal(await table.locator('tbody tr').count(), 12);
    assert.deepEqual(await table.locator('thead th').allTextContents(), ['Year', 'Alpha (kg)', 'Beta (kg)']);
    assert.deepEqual(await table.locator('tbody tr').first().locator('th, td').allTextContents(), ['2000', '1.0', '9.0']);
    assert.equal(await table.locator('caption').textContent(), 'Growth');
    const summary = await page.locator('.caos-chart-summary').textContent();
    assert.match(summary ?? '', /^Line chart, Growth: 12 points\. series Alpha, Beta\. Year from 2000 to 2011\. Mass \(kg\): lowest 1\.0.kg at Alpha, Year 2000, highest 9\.5.kg at Alpha, Year 2011\.$/);
    // the table and the summary are for a screen reader only: one pixel, off the visual flow
    const box = (await page.locator('[data-chart-table-box]').boundingBox())!;
    assert.ok(box.width <= 2 && box.height <= 2, `hidden: ${box.width}x${box.height}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('Tier A: the table, the summary and the name follow the page language', async () => {
  const { page } = await open('form=es&lang=es');
  try {
    assert.equal(await page.locator('[data-chart-focus]').getAttribute('aria-label'), 'Crecimiento');
    assert.equal(await page.locator('[data-chart-focus]').getAttribute('aria-roledescription'), 'gráfico interactivo');
    assert.deepEqual(await page.locator('table[data-chart-table] thead th').allTextContents(), ['Año (kg)'.replace(' (kg)', ''), 'Alpha (kg)']);
    const summary = (await page.locator('.caos-chart-summary').textContent()) ?? '';
    assert.match(summary, /^Gráfico de líneas, Crecimiento: 12 puntos\. serie Alpha\. Año de 2000 a 2011\. Masa \(kg\): mínimo 1,0.kg en Año 2000, máximo 9,5.kg en Año 2011\.$/);
    assert.equal((await page.locator('table[data-chart-table] tbody tr').first().locator('td').allTextContents())[0], '1,0', 'a decimal comma in Spanish');
    await page.evaluate(`window.setLang('en')`);
    await page.waitForFunction(() => document.querySelector('[data-chart-focus]')?.getAttribute('aria-label') === 'Growth');
    assert.match((await page.locator('.caos-chart-summary').textContent()) ?? '', /^Line chart/);
  } finally {
    await page.close();
  }
});

test('wheel: a chart that has not been focused leaves the wheel to the page; the page scrolls and nothing zooms', async () => {
  const { page } = await open('form=line');
  try {
    const b = await plotBox(page);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const [v0] = [await view(page)];
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(250);
    assert.ok((await page.evaluate(`window.scrollY`)) > 0, 'the page scrolled');
    assert.equal(await zoomed(page), false);
    assert.deepEqual(await view(page), v0);
    // an upward wheel is not taken either
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(150);
    assert.equal(await zoomed(page), false);
  } finally {
    await page.close();
  }
});

test('wheel: a chart that holds the focus zooms with the wheel around the pointer and never scrolls the page', async () => {
  const { page } = await open('form=line');
  try {
    const b = await plotBox(page);
    const full = await view(page);
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    assert.equal(await page.evaluate(`document.activeElement.hasAttribute('data-chart-focus')`), true, 'a click gives the chart the focus');
    await page.mouse.move(b.x + b.width * 0.25, b.y + b.height / 2);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(`window.scrollY`), 0, 'the page did not scroll');
    assert.equal(await zoomed(page), true);
    const [lo, hi] = await view(page);
    assert.ok(hi - lo < (full[1] - full[0]) * 0.8, `zoomed in: ${lo} to ${hi}`);
    // the point under the pointer keeps its place: a quarter of the way along
    const anchor = full[0] + (full[1] - full[0]) * 0.25;
    assert.ok(Math.abs((anchor - lo) / (hi - lo) - 0.25) < 0.06, `the anchor stays at a quarter: ${(anchor - lo) / (hi - lo)}`);
    assert.equal(await page.locator('.caos-chart-reset').count(), 1, 'the reset control appears');
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(200);
    assert.equal(await zoomed(page), false, 'wheeling back out returns to the full range');
    assert.equal(await page.evaluate(`window.scrollY`), 0);
  } finally {
    await page.close();
  }
});

test('wheel: with Ctrl held (a trackpad pinch) an unfocused chart zooms, and the browser is not zoomed', async () => {
  const { page } = await open('form=line');
  try {
    const b = await plotBox(page);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -400);
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);
    assert.equal(await zoomed(page), true);
    assert.equal(await page.evaluate(`window.scrollY`), 0);
  } finally {
    await page.close();
  }
});

test('wheel: a chart that cannot be zoomed (one point, zoom off) never takes the wheel, even focused', async () => {
  for (const form of ['one', 'off']) {
    const { page } = await open(`form=${form}`);
    try {
      const b = await plotBox(page);
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(250);
      assert.equal(await zoomed(page), false, form);
      assert.ok((await page.evaluate(`window.scrollY`)) > 0, `${form}: the page scrolled`);
    } finally {
      await page.close();
    }
  }
});

test('brush: a drag along x zooms to the dragged range, the reset control returns to the full range and gives the focus back', async () => {
  const { page } = await open('form=line');
  try {
    const b = await plotBox(page);
    const full = await view(page);
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5, { steps: 6 });
    await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    assert.equal(await zoomed(page), true);
    const [lo, hi] = await view(page);
    assert.ok(Math.abs(lo - (full[0] + (full[1] - full[0]) * 0.3)) < 0.5 && Math.abs(hi - (full[0] + (full[1] - full[0]) * 0.6)) < 0.5, `the dragged range: ${lo} to ${hi}`);
    const button = page.locator('.caos-chart-reset');
    assert.equal(await button.textContent(), 'Reset zoom');
    await button.click();
    await page.waitForTimeout(100);
    assert.equal(await zoomed(page), false);
    const [a, z] = await view(page);
    assert.ok(Math.abs(a - full[0]) < 1e-6 && Math.abs(z - full[1]) < 1e-6);
    assert.equal(await page.locator('.caos-chart-reset').count(), 0, 'the control is shown only while zoomed');
    assert.equal(await page.evaluate(`document.activeElement.hasAttribute('data-chart-focus')`), true, 'the focus returns to the plot');
  } finally {
    await page.close();
  }
});

test('brush: a click with a small jitter is a click, not a zoom (3 px)', async () => {
  const { page } = await open('form=line');
  try {
    const b = await plotBox(page);
    await page.mouse.move(b.x + 200, b.y + 100);
    await page.mouse.down();
    await page.mouse.move(b.x + 203, b.y + 101);
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert.equal(await zoomed(page), false);
  } finally {
    await page.close();
  }
});

test('reset: a double-click returns to the full range', async () => {
  const { page } = await open('form=line');
  try {
    const b = await plotBox(page);
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(150);
    assert.equal(await zoomed(page), true);
    await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(150);
    assert.equal(await zoomed(page), false);
  } finally {
    await page.close();
  }
});

test('pan: Shift and a mouse drag moves a zoomed chart by the dragged distance and keeps its span', async () => {
  const { page } = await open('form=line');
  try {
    const b = await plotBox(page);
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, -700);
    await page.waitForTimeout(150);
    const [lo, hi] = await view(page);
    await page.keyboard.down('Shift');
    await page.mouse.move(b.x + b.width * 0.6, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.6 - 80, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(150);
    const [lo2, hi2] = await view(page);
    assert.ok(Math.abs(hi2 - lo2 - (hi - lo)) < 1e-6, 'the span is kept');
    const expected = (80 / b.width) * (hi - lo);
    assert.ok(Math.abs(lo2 - lo - expected) < 0.05 * (hi - lo), `moved ${lo2 - lo}, expected ${expected}`);
    assert.equal(await zoomed(page), true, 'still zoomed, the brush did not take the drag');
  } finally {
    await page.close();
  }
});

test('keyboard: Tab reaches the plot, the arrows move the crosshair point to point and the readout follows; Home and End go to the ends', async () => {
  const { page, errors } = await open('form=line');
  try {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(`document.activeElement.hasAttribute('data-chart-focus')`), true);
    assert.match(await readout(page), /Hover the chart/);
    await page.keyboard.press('ArrowRight');
    assert.match(await readout(page), /^Year 2000 · Alpha 1\.0.kg · Beta 9\.0.kg$/);
    await page.keyboard.press('ArrowRight');
    assert.match(await readout(page), /^Year 2001 · Alpha 2\.5.kg/);
    await page.keyboard.press('End');
    assert.match(await readout(page), /^Year 2011/);
    await page.keyboard.press('ArrowRight');
    assert.match(await readout(page), /^Year 2011/, 'the end holds');
    await page.keyboard.press('Home');
    assert.match(await readout(page), /^Year 2000/);
    await page.keyboard.press('ArrowLeft');
    assert.match(await readout(page), /^Year 2000/, 'the start holds');
    assert.equal(await page.locator('.caos-chart-readout').getAttribute('aria-live'), 'polite', 'the readout is a polite live region');
    // the crosshair is drawn at the point: the uPlot cursor line sits over the plot
    const cursor = await page.locator('.u-cursor-x').boundingBox();
    assert.ok(cursor && cursor.x >= 0, 'the crosshair is placed');
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(`document.activeElement.hasAttribute('data-chart-focus')`), true, 'Tab moves on');
    assert.match(await readout(page), /Hover the chart/, 'leaving the chart clears the crosshair and its readout');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('keyboard: the readout follows in Spanish with decimal commas', async () => {
  const { page } = await open('form=es&lang=es');
  try {
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('ArrowRight');
    assert.match(await readout(page), /^Año 2000 · Alpha 1,0.kg$/);
  } finally {
    await page.close();
  }
});

test('keyboard: + and - zoom around the crosshair, Shift with the arrows pans, 0 and Escape reset', async () => {
  const { page } = await open('form=line');
  try {
    await page.focus('[data-chart-focus]');
    const full = await view(page);
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight'); // 2004
    await page.keyboard.press('+');
    assert.equal(await zoomed(page), true);
    let [lo, hi] = await view(page);
    assert.ok(hi - lo < full[1] - full[0]);
    assert.ok(lo <= 2004 && hi >= 2004, 'the crosshair stays in view');
    assert.match(await readout(page), /^Year 2004/, 'and keeps its point');
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    [lo, hi] = await view(page);
    const span = hi - lo;
    await page.keyboard.press('Shift+ArrowRight');
    const [lo2, hi2] = await view(page);
    assert.ok(lo2 > lo && Math.abs(hi2 - lo2 - span) < 1e-6, 'the view moved right and kept its span');
    await page.keyboard.press('-');
    const [lo3, hi3] = await view(page);
    assert.ok(hi3 - lo3 > span);
    await page.keyboard.press('0');
    assert.equal(await zoomed(page), false);
    assert.deepEqual(await view(page), full);
    await page.keyboard.press('+');
    assert.equal(await zoomed(page), true);
    await page.keyboard.press('Escape');
    assert.equal(await zoomed(page), false, 'Escape resets a zoomed chart');
  } finally {
    await page.close();
  }
});

test('keyboard: Escape on a chart that is not zoomed is not taken (a Focus mode or a dialog behind it still gets it)', async () => {
  const { page } = await open('form=line');
  try {
    await page.focus('[data-chart-focus]');
    const prevented = await page.evaluate(`(() => { const el = document.querySelector('[data-chart-focus]'); const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; })()`);
    assert.equal(prevented, false);
    const taken = await page.evaluate(`(() => { const el = document.querySelector('[data-chart-focus]'); const e = new KeyboardEvent('keydown', { key: '0', bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; })()`);
    assert.equal(taken, true, "0 is always the chart's");
  } finally {
    await page.close();
  }
});

test('keyboard: a zoomed chart starts the crosshair inside the view, and steps past its edge slide the view', async () => {
  const { page } = await open('form=line');
  try {
    await page.focus('[data-chart-focus]');
    for (let i = 0; i < 6; i++) await page.keyboard.press('+');
    await page.keyboard.press('Home'); // zoom keys with no crosshair zoom around the middle; Home then jumps to 2000, revealing it
    const [lo, hi] = await view(page);
    assert.ok(lo <= 2000.5 && hi > lo, `the view slid to the first point: ${lo}..${hi}`);
    assert.match(await readout(page), /^Year 2000/);
    await page.keyboard.press('End');
    const [lo2, hi2] = await view(page);
    assert.ok(hi2 >= 2011 - 0.01 && lo2 > lo, `the view slid to the last point: ${lo2}..${hi2}`);
    assert.match(await readout(page), /^Year 2011/);
  } finally {
    await page.close();
  }
});

test('keyboard: Enter chooses the point under the crosshair (onPick), as a click does', async () => {
  const { page } = await open('form=line');
  try {
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(`window.__picked`), [], 'nothing under the crosshair yet');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(`window.__picked`), [2]);
  } finally {
    await page.close();
  }
});

test('keyboard: a scatter sorted from unsorted x maps the chosen point back to the caller\'s index', async () => {
  const { page } = await open('form=scatter');
  try {
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('ArrowRight'); // the smallest x, 1, is the caller's index 1
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(`window.__picked`), [1]);
    assert.match(await readout(page), /^Observed 1 · Predicted 0\.8/);
  } finally {
    await page.close();
  }
});

test('keyboard: the handle of a draggable line keeps its own keys (SHC-041); the plot is the first stop, the handle the next', async () => {
  const { page } = await open('form=drag');
  try {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(`document.activeElement.hasAttribute('data-chart-focus')`), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(`document.activeElement.getAttribute('role')`), 'slider');
    const before = await page.locator('[data-y-handle]').getAttribute('aria-valuenow');
    await page.keyboard.press('ArrowUp');
    const after = await page.locator('[data-y-handle]').getAttribute('aria-valuenow');
    assert.notEqual(after, before, 'the arrow moved the line');
    assert.match(await readout(page), /Hover the chart/, 'and did not move the crosshair of the plot');
  } finally {
    await page.close();
  }
});

test('hover: the pointer reads values as before, and moving the mouse onto a focused chart takes the crosshair', async () => {
  const { page } = await open('form=line');
  try {
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('ArrowRight');
    const b = await plotBox(page);
    await page.mouse.move(b.x + b.width - 5, b.y + b.height / 2);
    await page.waitForTimeout(150);
    assert.match(await readout(page), /^Year 2011/);
  } finally {
    await page.close();
  }
});

test('touch: two fingers pinch the chart in and out around their middle, and a finger drags a zoomed chart', async () => {
  const { page, context } = await open('form=line', { touch: true });
  try {
    const cdp = await context.newCDPSession(page);
    const b = await plotBox(page);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const touch = (type: string, pts: { x: number; y: number; id: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await touch('touchStart', [{ x: cx - 40, y: cy, id: 0 }, { x: cx + 40, y: cy, id: 1 }]);
    for (let s = 1; s <= 8; s++) await touch('touchMove', [{ x: cx - 40 - s * 12, y: cy, id: 0 }, { x: cx + 40 + s * 12, y: cy, id: 1 }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(200);
    assert.equal(await zoomed(page), true, 'spreading two fingers zoomed in');
    const [lo, hi] = await view(page);
    const full = [2000, 2011];
    assert.ok(hi - lo < (full[1] - full[0]) * 0.7, `${lo}..${hi}`);
    // one finger drags the zoomed chart to the right: the view moves left
    await touch('touchStart', [{ x: cx, y: cy, id: 0 }]);
    for (let s = 1; s <= 8; s++) await touch('touchMove', [{ x: cx + s * 10, y: cy, id: 0 }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(200);
    const [lo2, hi2] = await view(page);
    assert.ok(lo2 < lo && Math.abs(hi2 - lo2 - (hi - lo)) < 1e-6 * 1e3, `panned: ${lo}..${hi} to ${lo2}..${hi2}`);
    // pinching in zooms back out
    await touch('touchStart', [{ x: cx - 120, y: cy, id: 0 }, { x: cx + 120, y: cy, id: 1 }]);
    for (let s = 1; s <= 8; s++) await touch('touchMove', [{ x: cx - 120 + s * 14, y: cy, id: 0 }, { x: cx + 120 - s * 14, y: cy, id: 1 }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(200);
    const [lo3, hi3] = await view(page);
    assert.ok(hi3 - lo3 > hi2 - lo2, 'pinching in zooms out');
  } finally {
    await page.close();
  }
});

test('touch: an unzoomed chart leaves the vertical scroll to the page (touch-action pan-y); a zoomed one takes the finger (none)', async () => {
  const { page } = await open('form=line');
  try {
    assert.equal(await page.locator('.u-over').evaluate((el) => (el as HTMLElement).style.touchAction), 'pan-y');
    const b = await plotBox(page);
    await page.mouse.click(b.x + 100, b.y + 100);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.u-over').evaluate((el) => (el as HTMLElement).style.touchAction), 'none');
  } finally {
    await page.close();
  }
});

test('zoom off: no wheel, no brush, no reset control, the keys + - 0 are not taken; the crosshair, the table and the summary remain; the host says why', async () => {
  const { page } = await open('form=off');
  try {
    const host = page.locator('.caos-chart');
    assert.equal(await host.getAttribute('data-zoom-off'), 'The range is the finding: the whole curve must stay in view');
    assert.equal(await host.getAttribute('data-zoomable'), '0');
    const b = await plotBox(page);
    await page.mouse.move(b.x + 100, b.y + 100);
    await page.mouse.down();
    await page.mouse.move(b.x + 300, b.y + 100, { steps: 6 });
    await page.mouse.up();
    assert.equal(await zoomed(page), false, 'the brush is off');
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('+');
    assert.equal(await zoomed(page), false);
    await page.keyboard.press('ArrowRight');
    assert.match(await readout(page), /^Year 2000/);
    assert.equal(await page.locator('table[data-chart-table]').count(), 1);
    assert.equal(await page.locator('[data-chart-focus]').count(), 1);
  } finally {
    await page.close();
  }
});

test('log axis: zooming stays positive and keeps decades; one point and an empty chart are tab stops that do not zoom and raise no error', async () => {
  const { page, errors } = await open('form=log');
  try {
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    const [lo, hi] = await view(page);
    assert.ok(lo > 0 && hi > lo && hi / lo < 10000, `a log view ${lo}..${hi}`);
    assert.ok(lo <= 10 && hi >= 10, 'the crosshair stays in view');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
  for (const form of ['one', 'empty']) {
    const o = await t.open(`form=${form}`);
    try {
      await o.page.waitForSelector('.caos-chart[data-drawn="1"]', { timeout: 10000 });
      await o.page.waitForTimeout(300);
      assert.equal(await o.page.locator('.caos-chart').getAttribute('data-zoomable'), '0', form);
      await o.page.focus('[data-chart-focus]');
      await o.page.keyboard.press('ArrowRight');
      await o.page.keyboard.press('+');
      await o.page.keyboard.press('0');
      assert.equal(await o.page.locator('.caos-chart').getAttribute('data-zoomed'), null, form);
      assert.deepEqual(o.errors, [], form);
    } finally {
      await o.page.close();
    }
  }
});

test('zoomY: the wheel and the keys zoom both axes, and the reset returns both', async () => {
  const { page } = await open('form=both');
  try {
    const b = await plotBox(page);
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(200);
    assert.equal(await zoomed(page), true);
    await page.keyboard.press('0');
    await page.waitForTimeout(100);
    assert.equal(await zoomed(page), false);
    assert.equal(await page.locator('.caos-chart-reset').count(), 0);
  } finally {
    await page.close();
  }
});

test('zoom is kept across a theme and a language change, and across a parent that renders with fresh arrays of the same data; new data starts from the full range', async () => {
  const { page } = await open('form=rerender');
  try {
    const b = await plotBox(page);
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(200);
    const zoomedView = await view(page);
    assert.equal(await zoomed(page), true);
    await page.evaluate(`window.rerender()`);
    await page.waitForTimeout(250);
    assert.deepEqual(await view(page), zoomedView, 'the same data in new arrays leaves the zoom');
    await page.evaluate(`window.setTheme('dark')`);
    await page.waitForTimeout(400);
    assert.equal(await zoomed(page), true, 'a theme change keeps the zoom');
    const v2 = await view(page);
    assert.ok(Math.abs(v2[0] - zoomedView[0]) < 1e-6 && Math.abs(v2[1] - zoomedView[1]) < 1e-6);
    await page.evaluate(`window.setLang('es')`);
    await page.waitForTimeout(400);
    assert.equal(await zoomed(page), true, 'a language change keeps the zoom');
    await page.evaluate(`window.newData()`);
    await page.waitForTimeout(400);
    assert.equal(await zoomed(page), false, 'new data resets the zoom');
    assert.equal(await page.locator('.caos-chart-reset').count(), 0);
  } finally {
    await page.close();
  }
});

test('fixed ranges: a chart with x.range, y.range, overlays on a log axis or a draggable line zooms and resets like any other (the gate fixture charts)', async () => {
  for (const form of ['ranged', 'overlaylog']) {
    const { page, errors } = await open(`form=${form}`);
    try {
      const full = await view(page);
      await page.focus('[data-chart-focus]');
      await page.keyboard.press('+');
      await page.waitForTimeout(100);
      assert.equal(await zoomed(page), true, `${form}: + zooms`);
      const [lo, hi] = await view(page);
      assert.ok(hi - lo < full[1] - full[0] || (form === 'overlaylog' && hi / lo < full[1] / full[0]), `${form}: narrower ${lo}..${hi} than ${full}`);
      assert.equal(await page.locator('.caos-chart-reset').count(), 1);
      await page.keyboard.press('0');
      await page.waitForTimeout(100);
      assert.equal(await zoomed(page), false, `${form}: 0 resets`);
      assert.deepEqual(await view(page), full);
      assert.deepEqual(errors, [], form);
    } finally {
      await page.close();
    }
  }
});

test('named ticks keep working under zoom: only the named ticks inside the view are labelled', async () => {
  const { page } = await open('form=ticks');
  try {
    const all = ((await page.locator('.caos-chart').getAttribute('data-x-tick-labels')) ?? '').split('|');
    assert.equal(all.length, 8);
    await page.focus('[data-chart-focus]');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 3; i++) await page.keyboard.press('+');
    await page.waitForTimeout(150);
    const some = ((await page.locator('.caos-chart').getAttribute('data-x-tick-labels')) ?? '').split('|').filter(Boolean);
    assert.ok(some.length > 0 && some.length < 8, `fewer ticks in view: ${some.join(',')}`);
    assert.equal(await page.locator('.caos-chart').getAttribute('data-ticks-repeated'), null);
  } finally {
    await page.close();
  }
});
