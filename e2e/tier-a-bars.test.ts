import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startTierPage, type TierPage } from './tier-harness.ts';

// Shell 0.19.0, Tier A on BarChart: a crosshair band and a readout for the bar under the pointer or the keyboard, zoom and pan by
// category (wheel while focused, brush, Shift and drag, pinch, keys), a reset control, a tab stop with a name, a hidden table and a
// summary; and defect D1, a value axis of counts that ticked at fractions ("0, 1, 1, 2, 2").
let t: TierPage;
before(async () => {
  t = await startTierPage(`
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { BarChart } from './src/index';
    import { useLangStore } from './src/lib/lang';
    const w = window as unknown as Record<string, any>;
    w.__selected = [];
    w.setLang = (l: 'en' | 'es') => useLangStore.getState().setLang(l);
    const q = new URLSearchParams(location.search);
    useLangStore.getState().setLang(q.get('lang') === 'es' ? 'es' : 'en');
    const form = q.get('form') ?? 'h';
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
    const data = names.map((n, i) => ({ id: n.toLowerCase(), label: n, value: [12, 7, 19, 3, 15, 9, 21, 5][i], hint: i === 2 ? 'the best case' : undefined }));
    const axis = { label: 'Peak', unit: 'people', format: { decimals: 0 } };
    const box = (child: React.ReactNode, h?: number) => (<div><div style={{ width: 640, maxWidth: '100%', ...(h ? { height: h } : {}) }}>{child}</div><div style={{ height: 2400 }}>after the chart</div></div>);
    const forms: Record<string, () => React.ReactNode> = {
      h: () => box(<BarChart title="Peaks" axis={axis} data={data} onSelect={(id) => w.__selected.push(id)} />),
      v: () => box(<BarChart title="Peaks" axis={axis} data={data} orientation="vertical" onSelect={(id) => w.__selected.push(id)} />),
      es: () => box(<BarChart title={{ en: 'Peaks', es: 'Picos' }} axis={{ label: { en: 'Peak', es: 'Pico' }, unit: { en: 'people', es: 'personas' }, format: { digits: 3 } }} data={data.map((d) => ({ ...d, value: d.value + 0.5 }))} />),
      fill: () => box(<BarChart title="Peaks" axis={axis} data={data} height="fill" />, 300),
      off: () => box(<BarChart title="Peaks" axis={axis} data={data} zoomOff="Every bar must stay in view to compare them" />),
      two: () => box(<BarChart title="Two" axis={axis} data={data.slice(0, 2)} />),
      counts: () => box(<BarChart title="Cases" axis={{ label: 'Cases', unit: 'tests' }} data={[0, 1, 2, 1, 0, 2].map((v, i) => ({ id: 'c' + i, label: 'Batch ' + i, value: v }))} />),
      countsv: () => box(<BarChart title="Cases" orientation="vertical" axis={{ label: 'Cases', unit: 'tests' }} data={[0, 1, 2, 1, 0, 2].map((v, i) => ({ id: 'c' + i, label: 'Batch ' + i, value: v }))} />),
      countsd0: () => box(<BarChart title="Cases" axis={{ label: 'Cases', format: { decimals: 0 } }} data={[0, 0.4, 1.2, 0.6].map((v, i) => ({ id: 'c' + i, label: 'Batch ' + i, value: v }))} />),
      fractions: () => box(<BarChart title="Share" axis={{ label: 'Share', format: { digits: 2 } }} data={[0.1, 0.25, 0.5, 0.75].map((v, i) => ({ id: 'c' + i, label: 'Batch ' + i, value: v }))} />),
      tenth: () => box(<BarChart title="Share" axis={{ label: 'Share', format: { decimals: 1 } }} data={[0.01, 0.02, 0.03, 0.04].map((v, i) => ({ id: 'c' + i, label: 'Batch ' + i, value: v }))} />),
      percent: () => box(<BarChart title="Share" axis={{ label: 'Share', format: { decimals: 0, percent: true } }} data={[0.12, 0.2, 0.31, 0.4].map((v, i) => ({ id: 'c' + i, label: 'Batch ' + i, value: v }))} />),
      big: () => box(<BarChart title="Large counts" axis={{ label: 'Cases' }} data={[0, 1500, 3000, 4500].map((v, i) => ({ id: 'c' + i, label: 'Batch ' + i, value: v }))} />),
      title: () => box(<BarChart title="Exposure" axis={{ label: { en: 'Accumulated CVA and DVA across every counterparty of the portfolio', es: 'CVA y DVA acumulados de todas las contrapartes de la cartera' }, unit: { en: 'USD millions, one-sided 99%', es: 'millones de USD, unilateral 99%' }, format: { decimals: 0 } }} data={data} />),
      titlev: () => box(<BarChart title="Exposure" orientation="vertical" axis={{ label: { en: 'Accumulated CVA and DVA across every counterparty of the portfolio', es: 'CVA y DVA acumulados de todas las contrapartes de la cartera' }, unit: { en: 'USD millions, one-sided 99%', es: 'millones de USD, unilateral 99%' }, format: { decimals: 0 } }} data={data} />),
    };
    const App = forms[form] ?? forms.h;
    createRoot(document.getElementById('root')!).render(<App />);
  `);
});
after(async () => {
  await t?.close();
});

async function open(query: string, opts?: Parameters<TierPage['open']>[1]) {
  const o = await t.open(query, opts);
  await o.page.waitForSelector('.caos-bars[data-drawn="1"] svg', { timeout: 10000 });
  return o;
}
const windowOf = async (page: Page): Promise<[number, number]> => {
  const [a, b] = ((await page.locator('.caos-bars-host').getAttribute('data-window')) ?? '0,0').split(',').map(Number);
  return [a, b];
};
const zoomed = async (page: Page) => (await page.locator('.caos-bars-host').getAttribute('data-zoomed')) === '1';
const readout = async (page: Page) => ((await page.locator('.caos-bars-readout').textContent()) ?? '').replace(/ /g, ' ');
const bars = (page: Page) => page.locator('svg [data-bar]');
const svgBox = async (page: Page) => (await page.locator('.caos-bars svg').boundingBox())!;

test('Tier A bars: the chart is one tab stop named by its title, with a hidden table of every bar and a summary', async () => {
  for (const form of ['h', 'v']) {
    const { page, errors } = await open(`form=${form}`);
    try {
      const stop = page.locator('[data-chart-focus]');
      assert.equal(await stop.count(), 1, form);
      assert.equal(await stop.getAttribute('tabindex'), '0');
      assert.equal(await stop.getAttribute('aria-label'), 'Peaks');
      assert.equal(await stop.getAttribute('role'), 'group');
      const described = (await stop.getAttribute('aria-describedby'))!.split(' ');
      for (const id of described) assert.equal(await page.locator(`[id="${id}"]`).count(), 1);
      const table = page.locator('table[data-chart-table]');
      assert.equal(await table.locator('tbody tr').count(), 8);
      assert.deepEqual(await table.locator('thead th').allTextContents(), ['Category', 'Peak (people)', 'Note']);
      assert.deepEqual(await table.locator('tbody tr').nth(2).locator('th, td').allTextContents(), ['Gamma', '19', 'the best case']);
      assert.match((await page.locator('.caos-chart-summary').textContent()) ?? '', /^Bar chart, Peaks: 8 bars\. Peak \(people\): lowest 3.people at Delta, highest 21.people at Eta\.$/);
      const box = (await page.locator('[data-chart-table-box]').boundingBox())!;
      assert.ok(box.width <= 2 && box.height <= 2);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
});

test('Tier A bars: the table, the summary and the readout follow the page language', async () => {
  const { page } = await open('form=es&lang=es');
  try {
    assert.equal(await page.locator('[data-chart-focus]').getAttribute('aria-label'), 'Picos');
    assert.deepEqual(await page.locator('table[data-chart-table] thead th').allTextContents(), ['Categoría', 'Pico (personas)', 'Nota']);
    assert.match((await page.locator('.caos-chart-summary').textContent()) ?? '', /^Gráfico de barras, Picos: 8 barras\. Pico \(personas\): mínimo 3,5.personas en Delta, máximo 21,5.personas en Eta\.$/);
    assert.match(await readout(page), /^Apunte a una barra/);
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('ArrowDown');
    assert.match(await readout(page), /^Alpha: 12,5.personas$/);
  } finally {
    await page.close();
  }
});

test('crosshair: hovering a bar highlights its band and reads its label, value and hint; leaving clears it (horizontal and vertical)', async () => {
  for (const form of ['h', 'v']) {
    const { page } = await open(`form=${form}`);
    try {
      assert.match(await readout(page), /^Point at a bar/);
      const target = bars(page).nth(2);
      const rect = (await target.locator('rect').first().boundingBox())!;
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.waitForTimeout(100);
      assert.equal(await readout(page), 'Gamma: 19 people · the best case', form);
      assert.equal(await page.locator('[data-bar-cursor]').count(), 1, 'one crosshair band');
      assert.equal(await page.locator('svg [data-cursor="1"]').getAttribute('data-bar'), 'gamma');
      await page.mouse.move(2, 2);
      await page.waitForTimeout(100);
      assert.match(await readout(page), /^Point at a bar/);
      assert.equal(await page.locator('[data-bar-cursor]').count(), 0);
    } finally {
      await page.close();
    }
  }
});

test('keyboard: the arrows move the crosshair bar by bar and the readout follows; Home and End; Enter chooses the bar; leaving clears it', async () => {
  const { page, errors } = await open('form=h');
  try {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(`document.activeElement.hasAttribute('data-chart-focus')`), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await readout(page), 'Alpha: 12 people');
    await page.keyboard.press('ArrowRight');
    assert.equal(await readout(page), 'Beta: 7 people');
    await page.keyboard.press('ArrowUp');
    assert.equal(await readout(page), 'Alpha: 12 people');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await readout(page), 'Alpha: 12 people', 'the start holds');
    await page.keyboard.press('End');
    assert.equal(await readout(page), 'Theta: 5 people');
    await page.keyboard.press('ArrowRight');
    assert.equal(await readout(page), 'Theta: 5 people', 'the end holds');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    assert.equal(await readout(page), 'Gamma: 19 people · the best case');
    assert.equal(await page.locator('.caos-bars-readout').getAttribute('aria-live'), 'polite');
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(`window.__selected`), ['gamma']);
    await page.keyboard.press('Tab'); // the first bar: a button because onSelect is given
    assert.equal(await page.evaluate(`document.activeElement.getAttribute('role')`), 'button');
    await page.focus('[data-chart-focus]');
    await page.evaluate(`document.activeElement.blur()`);
    assert.match(await readout(page), /^Point at a bar/, 'blur clears the crosshair');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('keyboard zoom: + shows fewer bars around the crosshair, Shift with the arrows pans, - widens, 0 and Escape reset; the page does not move', async () => {
  const { page } = await open('form=h');
  try {
    const before = await svgBox(page);
    await page.focus('[data-chart-focus]');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown'); // Delta, index 3
    await page.keyboard.press('+');
    assert.equal(await zoomed(page), true);
    let [s, e] = await windowOf(page);
    assert.ok(e - s < 8 && s <= 3 && e > 3, `window ${s}..${e} holds the crosshair bar`);
    assert.equal(await bars(page).count(), e - s);
    assert.equal(await page.locator('.caos-chart-reset').count(), 1);
    assert.equal(await readout(page), 'Delta: 3 people', 'the crosshair keeps its bar');
    for (let i = 0; i < 6; i++) await page.keyboard.press('+');
    [s, e] = await windowOf(page);
    assert.equal(e - s, 2, 'two bars is the least');
    await page.keyboard.press('Shift+ArrowRight');
    const [s2] = await windowOf(page);
    assert.equal(s2, s + 1);
    await page.keyboard.press('-');
    const [s3, e3] = await windowOf(page);
    assert.ok(e3 - s3 > 2);
    const after = await svgBox(page);
    assert.equal(Math.round(after.height), Math.round(before.height), 'the chart keeps its height when zoomed: the page does not move');
    await page.keyboard.press('0');
    assert.equal(await zoomed(page), false);
    assert.deepEqual(await windowOf(page), [0, 8]);
    await page.keyboard.press('+');
    await page.keyboard.press('Escape');
    assert.equal(await zoomed(page), false);
  } finally {
    await page.close();
  }
});

test('keyboard zoom: the crosshair stepping past the edge of the window slides the window; Home and End jump', async () => {
  const { page } = await open('form=v');
  try {
    await page.focus('[data-chart-focus]');
    for (let i = 0; i < 4; i++) await page.keyboard.press('+');
    const [s, e] = await windowOf(page);
    assert.ok(e - s <= 3);
    await page.keyboard.press('Home');
    assert.deepEqual((await windowOf(page))[0], 0);
    assert.equal(await readout(page), 'Alpha: 12 people');
    await page.keyboard.press('End');
    const [s2, e2] = await windowOf(page);
    assert.equal(e2, 8);
    assert.ok(s2 >= 5);
    assert.equal(await readout(page), 'Theta: 5 people');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    const [s3, e3] = await windowOf(page);
    assert.ok(s3 <= 4 && e3 > 4, `the window follows the crosshair to bar 4: ${s3}..${e3}`);
    assert.equal(await readout(page), 'Epsilon: 15 people');
  } finally {
    await page.close();
  }
});

test('wheel on bars: an unfocused chart leaves the wheel to the page; a focused one, or Ctrl, zooms and the page does not scroll', async () => {
  const { page } = await open('form=h');
  try {
    const b = await svgBox(page);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(250);
    assert.ok((await page.evaluate(`window.scrollY`)) > 0, 'the page scrolled');
    assert.equal(await zoomed(page), false);
    await page.evaluate(`window.scrollTo(0, 0)`);
    await page.mouse.click(b.x + b.width / 2, b.y + 5); // the focus, not a bar
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(`window.scrollY`), 0, 'a focused chart does not scroll the page');
    assert.equal(await zoomed(page), true);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(200);
    assert.equal(await zoomed(page), false, 'wheeling out returns to every bar');
    await page.evaluate(`document.activeElement.blur()`);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -400);
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);
    assert.equal(await zoomed(page), true, 'Ctrl and wheel zooms an unfocused chart');
  } finally {
    await page.close();
  }
});

test('brush on bars: a drag across rows zooms to the bars it touches, the reset control returns, a double-click resets, a small drag is a click', async () => {
  for (const form of ['h', 'v']) {
    const { page } = await open(`form=${form}`);
    try {
      const b = await svgBox(page);
      const horizontal = form === 'h';
      const at = (frac: number) => (horizontal ? { x: b.x + b.width * 0.5, y: b.y + 4 + (b.height - 70) * frac } : { x: b.x + 60 + (b.width - 70) * frac, y: b.y + b.height * 0.4 });
      const a = at(0.3);
      const z = at(0.6);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move((a.x + z.x) / 2, (a.y + z.y) / 2, { steps: 5 });
      assert.equal(await page.locator('[data-bar-brush]').count(), 1, `${form}: the brush is drawn while dragging`);
      await page.mouse.move(z.x, z.y, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(100);
      assert.equal(await zoomed(page), true, form);
      const [s, e] = await windowOf(page);
      assert.ok(s >= 1 && e <= 6 && e - s >= 2 && e - s <= 4, `${form}: the bars under the drag: ${s}..${e}`);
      assert.equal(await page.locator('[data-bar-brush]').count(), 0);
      await page.locator('.caos-chart-reset').click();
      assert.equal(await zoomed(page), false);
      assert.equal(await page.evaluate(`document.activeElement.hasAttribute('data-chart-focus')`), true, 'the focus returns to the chart');
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(a.x + 2, a.y + 2);
      await page.mouse.up();
      assert.equal(await zoomed(page), false, 'a drag under the threshold zooms nothing');
      await page.keyboard.press('+');
      assert.equal(await zoomed(page), true);
      await page.mouse.dblclick(a.x, a.y);
      assert.equal(await zoomed(page), false, 'a double-click resets');
    } finally {
      await page.close();
    }
  }
});

test('pan on bars: Shift and a drag along the bars moves the window and keeps its width', async () => {
  const { page } = await open('form=h');
  try {
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    const [s, e] = await windowOf(page);
    const b = await svgBox(page);
    await page.keyboard.down('Shift');
    await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.2, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    const [s2, e2] = await windowOf(page);
    assert.equal(e2 - s2, e - s);
    assert.notEqual(s2, s, 'the window moved');
    assert.equal(await zoomed(page), true);
  } finally {
    await page.close();
  }
});

test('touch on bars: two fingers pinch the bars in and out, and one finger drags a zoomed chart', async () => {
  const { page, context } = await open('form=v', { touch: true });
  try {
    const cdp = await context.newCDPSession(page);
    const b = await svgBox(page);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const touch = (type: string, pts: { x: number; y: number; id: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await touch('touchStart', [{ x: cx - 30, y: cy, id: 0 }, { x: cx + 30, y: cy, id: 1 }]);
    for (let s = 1; s <= 8; s++) await touch('touchMove', [{ x: cx - 30 - s * 14, y: cy, id: 0 }, { x: cx + 30 + s * 14, y: cy, id: 1 }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(200);
    assert.equal(await zoomed(page), true, 'spreading two fingers zoomed in');
    const [s, e] = await windowOf(page);
    assert.ok(e - s < 8);
    await touch('touchStart', [{ x: cx, y: cy, id: 0 }]);
    for (let k = 1; k <= 8; k++) await touch('touchMove', [{ x: cx - k * 30, y: cy, id: 0 }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(200);
    const [s2, e2] = await windowOf(page);
    assert.equal(e2 - s2, e - s);
    assert.ok(s2 > s, `dragging left moved the window right: ${s}..${e} to ${s2}..${e2}`);
  } finally {
    await page.close();
  }
});

test('zoom off on bars: no wheel, no brush, no keys + - 0 and no reset; the crosshair, table and summary remain and the host says why', async () => {
  const { page } = await open('form=off');
  try {
    const host = page.locator('.caos-bars-host');
    assert.equal(await host.getAttribute('data-zoom-off'), 'Every bar must stay in view to compare them');
    assert.equal(await host.getAttribute('data-zoomable'), '0');
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('+');
    assert.equal(await zoomed(page), false);
    await page.keyboard.press('ArrowDown');
    assert.equal(await readout(page), 'Alpha: 12 people');
    const b = await svgBox(page);
    await page.mouse.wheel(0, -300);
    await page.mouse.move(b.x + b.width / 2, b.y + 10);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + 100, { steps: 5 });
    await page.mouse.up();
    assert.equal(await zoomed(page), false);
    assert.equal(await page.locator('table[data-chart-table]').count(), 1);
  } finally {
    await page.close();
  }
});

test('zoom on bars: a chart of two bars cannot be zoomed, and a filling chart keeps its height when zoomed', async () => {
  const two = await open('form=two');
  try {
    assert.equal(await two.page.locator('.caos-bars-host').getAttribute('data-zoomable'), '0');
    await two.page.focus('[data-chart-focus]');
    await two.page.keyboard.press('+');
    assert.equal(await zoomed(two.page), false);
  } finally {
    await two.page.close();
  }
  const { page } = await open('form=fill');
  try {
    const h0 = await page.locator('.caos-bars-host').evaluate((el) => el.getBoundingClientRect().height);
    assert.ok(Math.abs(h0 - 300) < 2, `fills its container: ${h0}`);
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    const h1 = await page.locator('.caos-bars-host').evaluate((el) => el.getBoundingClientRect().height);
    assert.equal(Math.round(h1), Math.round(h0));
    const overflow = await page.locator('.caos-bars').evaluate((el) => el.scrollHeight - el.clientHeight);
    assert.ok(overflow <= 1, `the drawing fits the box: ${overflow}`);
  } finally {
    await page.close();
  }
});

// ---- D1: a value axis of counts ticks at whole numbers ----------------------------------------------------------------------

const tickTexts = async (page: Page, horizontal: boolean) =>
  page.evaluate((hz) => {
    const svg = document.querySelector('.caos-bars svg')!;
    // the tick labels are the texts of the grid groups, the first <text> of each <g> that has a <line>
    return [...svg.querySelectorAll(':scope > g')]
      .filter((g) => g.querySelector(':scope > line') && g.querySelector(':scope > text'))
      .map((g) => (g.querySelector(':scope > text') as SVGTextElement).textContent ?? '')
      .map((s) => (hz ? s : s));
  }, horizontal);

test('D1: a value axis of counts ticks at whole numbers and no label repeats (horizontal and vertical, default format and decimals 0)', async () => {
  for (const [form, horizontal] of [['counts', true], ['countsv', false], ['countsd0', true]] as const) {
    const { page } = await open(`form=${form}`);
    try {
      const ticks = await tickTexts(page, horizontal);
      assert.ok(ticks.length >= 2, `${form}: ${ticks}`);
      assert.equal(new Set(ticks).size, ticks.length, `${form}: no repeated label in ${ticks.join(', ')}`);
      assert.ok(ticks.every((s) => /^\d+$/.test(s)), `${form}: whole numbers only: ${ticks.join(', ')}`);
      assert.equal(await page.locator('.caos-bars').getAttribute('data-ticks-repeat'), '0');
    } finally {
      await page.close();
    }
  }
});

test('D1: an axis of fractions keeps its fractional ticks, and large counts tick at round whole numbers', async () => {
  const f = await open('form=fractions');
  try {
    const ticks = await tickTexts(f.page, true);
    assert.ok(ticks.some((s) => /[.,]/.test(s)), `fractions are not rounded to whole numbers: ${ticks}`);
    assert.equal(new Set(ticks).size, ticks.length);
  } finally {
    await f.page.close();
  }
  for (const form of ['tenth', 'percent']) {
    const o = await open(`form=${form}`);
    try {
      const ticks = await tickTexts(o.page, true);
      assert.ok(ticks.length >= 2 && new Set(ticks).size === ticks.length, `${form}: no repeated label in ${ticks.join(', ')}`);
      assert.equal(await o.page.locator('.caos-bars').getAttribute('data-ticks-repeat'), '0');
    } finally {
      await o.page.close();
    }
  }
  const b = await open('form=big');
  try {
    const ticks = await tickTexts(b.page, true);
    assert.ok(ticks.every((s) => /^[\d,]+$/.test(s)), `${ticks}`);
    assert.equal(new Set(ticks).size, ticks.length);
  } finally {
    await b.page.close();
  }
});

// ---- D3 on bars: the axis title wraps, never cut -----------------------------------------------------------------------------

test('D3 on bars: a long axis title wraps over the drawing instead of being cut, in both orientations and both languages, at 390 px', async () => {
  for (const form of ['title', 'titlev']) {
    for (const lang of ['en', 'es']) {
      const { page } = await open(`form=${form}&lang=${lang}`, { width: 390, height: 800, touch: true });
      try {
        const out = await page.evaluate(() => {
          const svg = document.querySelector('.caos-bars svg')!;
          const sb = svg.getBoundingClientRect();
          const lines = [...svg.querySelectorAll('text > tspan')].map((tx) => ({ text: tx.textContent ?? '', r: tx.getBoundingClientRect() }));
          return { left: sb.left, right: sb.right, texts: lines.filter((x) => /CVA|USD|DVA|portfolio|cartera|millones|unilateral|one-sided|contrapartes|counterparty|acumulados|Accumulated/.test(x.text)).map((x) => ({ text: x.text, l: x.r.left, r: x.r.right })) };
        });
        assert.ok(out.texts.length >= 2, `${form} ${lang}: the title is broken over lines: ${JSON.stringify(out.texts)}`);
        for (const x of out.texts) assert.ok(x.l >= out.left - 1 && x.r <= out.right + 1, `${form} ${lang}: "${x.text}" inside the drawing (${x.l}..${x.r} of ${out.left}..${out.right})`);
        const joined = out.texts.map((x) => x.text).join(' ');
        assert.match(joined, lang === 'en' ? /Accumulated CVA and DVA.*portfolio.*USD millions, one-sided 99%/ : /CVA y DVA acumulados.*cartera.*millones de USD, unilateral 99%/, 'the whole title, with its unit');
      } finally {
        await page.close();
      }
    }
  }
});
