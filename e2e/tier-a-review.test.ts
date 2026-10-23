import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startTierPage, type TierPage } from './tier-harness.ts';

// Shell 0.19.0, the fixes of the Opus review (B1, M1 to M6, m1 to m7): the brush on every chart form, bar widths at any width, no repeated
// tick when zoomed to the limit, dates in the table and the readout of a time axis, a wheel that cannot change the range reaching the page,
// the zoom opt-out reported, new data drawn, the size of the reset control, one drag threshold, the markup of the bar chart's names.
let t: TierPage;
before(async () => {
  t = await startTierPage(`
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { UPlotChart } from './src/chart';
    import { BarChart } from './src/index';
    import { useLangStore } from './src/lib/lang';
    const w = window as unknown as Record<string, any>;
    w.setLang = (l: 'en' | 'es') => useLangStore.getState().setLang(l);
    w.__selected = [];
    const q = new URLSearchParams(location.search);
    useLangStore.getState().setLang(q.get('lang') === 'es' ? 'es' : 'en');
    const form = q.get('form') ?? 'line';
    const width = Number(q.get('w') ?? 640);
    const years = Array.from({ length: 12 }, (_, i) => 2000 + i);
    const mass = [1, 2.5, 3, 4.5, 5, 6.5, 7, 7.5, 8, 8.5, 9, 9.5];
    const page = (child: React.ReactNode) => (<div><div style={{ width, maxWidth: '100%', height: 420 }}>{child}</div><div style={{ height: 2400 }}>after the chart</div></div>);
    const xAxis = { label: 'Year', format: { decimals: 0, grouping: false } };
    const yAxis = { label: 'Mass', unit: 'kg', format: { decimals: 1 } };
    const depth = Array.from({ length: 50 }, (_, i) => 1000 + i * 10);
    const days = Array.from({ length: 30 }, (_, i) => 1704067200 + i * 86400);
    const wave = Array.from({ length: 120 }, (_, i) => Math.round(Math.sin(i / 9) * 10 + 20));
    const lines: Record<string, () => React.ReactNode> = {
      line: () => page(<UPlotChart height={360} title="Growth" x={{ values: years, ...xAxis }} y={yAxis} series={[{ label: 'Alpha', values: mass }]} />),
      parity: () => page(<UPlotChart parity height={360} title="Parity" x={{ values: [1, 2, 3, 4, 5], label: 'Observed' }} y={{ label: 'Predicted' }} series={[{ label: 'Pred', values: [1.1, 2.2, 2.9, 4.2, 4.8], mode: 'points' }]} />),
      overlay: () => page(<UPlotChart height={360} title="Fit" x={{ values: years, ...xAxis }} y={yAxis} series={[{ label: 'Model', values: mass }, { label: 'Measured', values: [2, 4, 6], x: [2001.5, 2005.5, 2009.5], mode: 'points' }]} />),
      ranged: () => page(<UPlotChart height={360} title="Ranged" x={{ values: [0, 1, 2, 3, 4], label: 'Protocol', ticks: [0, 1, 2, 3, 4].map((v) => ({ value: v, label: 'p' + v })), range: [-0.5, 4.5] }} y={{ label: 'Error', range: [10, 40], format: { decimals: 0 } }} series={[{ label: 'Model', values: [12, 24, 39, 20, 15], dots: true }]} />),
      depth: () => page(<UPlotChart height={360} title="Depth" x={{ values: depth, label: 'Depth', unit: 'm' }} y={yAxis} series={[{ label: 'Alpha', values: depth.map((d, i) => 1 + (i % 7)) }]} />),
      log: () => page(<UPlotChart height={360} title="Log" x={{ values: [1, 10, 100, 1000, 10000], label: 'Size', log: true }} y={yAxis} series={[{ label: 'Alpha', values: [1, 2, 3, 4, 5] }]} />),
      time: () => page(<UPlotChart height={360} title="Load" x={{ values: days, label: 'Date', time: true }} y={{ label: 'Load', unit: 't', format: { decimals: 0 } }} series={[{ label: 'Load', values: days.map((_, i) => 10 + (i % 5)) }]} />),
      off: () => page(<UPlotChart height={360} title="Off" zoomOff={{ en: 'The whole curve is the finding', es: '' }} x={{ values: years, ...xAxis }} y={yAxis} series={[{ label: 'Alpha', values: mass }]} />),
      offempty: () => page(<UPlotChart height={360} title="Off" zoomOff={{ en: '', es: '' }} x={{ values: years, ...xAxis }} y={yAxis} series={[{ label: 'Alpha', values: mass }]} />),
      tall: () => (<div style={{ height: '150vh' }}><UPlotChart height="fill" title="Tall" x={{ values: years, ...xAxis }} y={yAxis} series={[{ label: 'Alpha', values: mass }]} /></div>),
      data: () => {
        const [ys, setYs] = useState(wave);
        w.swap = () => setYs((a) => { const b = [...a]; [b[0], b[97]] = [b[97], b[0]]; return b; });
        return page(<UPlotChart height={360} title="Wave" x={{ values: wave.map((_, i) => i), label: 'Step' }} y={{ label: 'Level', format: { decimals: 1 } }} series={[{ label: 'Wave', values: ys }]} />);
      },
    };
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];
    const data = names.map((n, i) => ({ id: n.toLowerCase(), label: n, value: [12, 7, 19, 3, 15, 9][i] }));
    const axis = { label: 'Peak', unit: 'people', format: { decimals: 0 } };
    const bars: Record<string, () => React.ReactNode> = {
      bv: () => page(<BarChart title="Peaks" axis={axis} data={data} orientation="vertical" />),
      bh: () => page(<BarChart title="Peaks" axis={axis} data={data} onSelect={(id) => w.__selected.push(id)} />),
      bsel: () => page(<BarChart title="Peaks" axis={axis} data={data} orientation="vertical" onSelect={(id) => w.__selected.push(id)} />),
      boff: () => page(<BarChart title="Peaks" axis={axis} data={data} zoomOff={{ en: 'Every bar must stay in view', es: '' }} />),
      boffempty: () => page(<BarChart title="Peaks" axis={axis} data={data} zoomOff={{ en: '', es: '' }} />),
      btall: () => (<div style={{ height: '150vh' }}><BarChart title="Peaks" axis={axis} data={data} height="fill" /></div>),
    };
    const forms = { ...lines, ...bars } as Record<string, () => React.ReactNode>;
    const App = forms[form] ?? lines.line;
    createRoot(document.getElementById('root')!).render(<App />);
  `);
});
after(async () => {
  await t?.close();
});

async function open(query: string, opts?: Parameters<TierPage['open']>[1]) {
  const o = await t.open(query, opts);
  await o.page.waitForSelector('.caos-chart[data-drawn="1"] canvas', { timeout: 10000 });
  await o.page.waitForFunction(() => document.querySelector('.caos-chart')?.getAttribute('data-view-x'), null, { timeout: 5000 });
  return o;
}
async function openBars(query: string, opts?: Parameters<TierPage['open']>[1]) {
  const o = await t.open(query, opts);
  await o.page.waitForSelector('.caos-bars[data-drawn="1"] svg', { timeout: 10000 });
  return o;
}
const zoomed = async (page: Page) => (await page.locator('.caos-chart').getAttribute('data-zoomed')) === '1';
const plotBox = async (page: Page) => (await page.locator('.u-over').boundingBox())!;
const view = async (page: Page): Promise<[number, number]> => {
  const [a, b] = ((await page.locator('.caos-chart').getAttribute('data-view-x')) ?? '0,0').split(',').map(Number);
  return [a, b];
};
async function drag(page: Page, x0: number, x1: number, y: number) {
  await page.mouse.move(x0, y);
  await page.mouse.down();
  await page.mouse.move((x0 + x1) / 2, y, { steps: 6 });
  await page.mouse.move(x1, y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test('B1: the brush zooms a plain line chart, a parity plot, a chart with an overlay series and one with x.range', async () => {
  for (const form of ['line', 'parity', 'overlay', 'ranged']) {
    const { page, errors } = await open(`form=${form}`);
    try {
      const b = await plotBox(page);
      const full = await view(page);
      await drag(page, b.x + b.width * 0.3, b.x + b.width * 0.6, b.y + b.height * 0.5);
      assert.equal(await zoomed(page), true, `${form}: the brush zoomed`);
      const [lo, hi] = await view(page);
      const span = full[1] - full[0];
      assert.ok(Math.abs(lo - (full[0] + span * 0.3)) < span * 0.03 && Math.abs(hi - (full[0] + span * 0.6)) < span * 0.03, `${form}: the dragged range, ${lo} to ${hi} of ${full}`);
      assert.equal(await page.locator('.u-select').evaluate((el) => (el as HTMLElement).offsetWidth), 0, `${form}: the selection box is gone`);
      assert.equal(await page.locator('.caos-chart-reset').count(), 1, `${form}: the reset control appears`);
      await page.locator('.caos-chart-reset').click();
      await page.waitForTimeout(100);
      assert.equal(await zoomed(page), false, `${form}: reset returns to the full range`);
      assert.deepEqual(await view(page), full, `${form}: the full range comes back exactly`);
      assert.deepEqual(errors, [], form);
    } finally {
      await page.close();
    }
  }
});

test('M1: a vertical BarChart draws no negative width and logs no error at any width; at 0 px it draws nothing', async () => {
  for (const w of [1280, 400, 120, 70, 50, 20]) {
    const { page, errors } = await openBars(`form=bv&w=${w}`, { width: 1400 });
    try {
      await page.waitForTimeout(150);
      const widths = await page.evaluate(() => [...document.querySelectorAll('.caos-bars svg rect')].map((r) => Number(r.getAttribute('width'))));
      assert.ok(widths.every((x) => x >= 0), `${w}px: widths ${widths.filter((x) => x < 0)}`);
      assert.deepEqual(errors, [], `${w}px`);
    } finally {
      await page.close();
    }
  }
  const { page, errors } = await t.open('form=bv&w=0', { width: 1400 });
  try {
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.caos-bars svg rect').count(), 0, 'nothing drawn at 0 px');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('M2: zoomed to its least span, no axis repeats a tick label (significant digits at depth 1000 to 1490, log, time, named ticks)', async () => {
  for (const form of ['depth', 'log', 'time', 'ranged']) {
    const { page } = await open(`form=${form}`);
    try {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Home');
      const full = await view(page);
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('+');
        await page.waitForTimeout(25);
        const repeat = await page.locator('.caos-chart').getAttribute('data-ticks-repeat');
        assert.equal(repeat, '0', `${form}: press ${i + 1} repeats ${repeat} tick label(s) at view ${await page.locator('.caos-chart').getAttribute('data-view-x')}`);
      }
      const [lo, hi] = await view(page);
      assert.ok(hi - lo < (full[1] - full[0]) * 0.5 || form === 'log', `${form}: it did zoom (${lo} to ${hi})`);
    } finally {
      await page.close();
    }
  }
});

test('M3: on a time axis the table, the summary and the readout print dates in the page language', async () => {
  for (const lang of ['en', 'es']) {
    const { page } = await open(`form=time&lang=${lang}`);
    try {
      const expect = await page.evaluate(
        ([l]) => new Intl.DateTimeFormat(l === 'es' ? 'es-CL' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(1704067200 * 1000)),
        [lang],
      );
      const first = await page.locator('table[data-chart-table] tbody tr').first().locator('th, td').allTextContents();
      assert.equal(first[0], expect, `${lang}: first table row`);
      const summary = (await page.locator('.caos-chart-summary').textContent()) ?? '';
      assert.ok(summary.includes(expect), `${lang}: the summary names ${expect}: ${summary}`);
      assert.ok(!/1[.,]704[.,]067/.test(summary), `${lang}: no epoch seconds in the summary`);
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowRight');
      const read = (await page.locator('.caos-chart-readout').textContent()) ?? '';
      assert.ok(read.includes(expect) && !/1[.,]704[.,]067/.test(read), `${lang}: the readout names the date: ${read}`);
    } finally {
      await page.close();
    }
  }
});

test('M4: a wheel that cannot change the range reaches the page (zoom out at the full range, zoom in at the least span)', async () => {
  const { page } = await open('form=line');
  try {
    const b = await plotBox(page);
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    assert.equal(await page.evaluate(`document.activeElement.hasAttribute('data-chart-focus')`), true);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(250);
    assert.ok((await page.evaluate(`window.scrollY`)) > 0, 'the page scrolled: zoom out at the full range changes nothing');
    assert.equal(await zoomed(page), false);
    // at the least span a wheel up (zoom in) cannot zoom further: it scrolls the page back up
    await page.evaluate(`window.scrollTo(0, 0)`);
    for (let i = 0; i < 40; i++) await page.keyboard.press('+');
    await page.evaluate(`window.scrollTo(0, 150)`);
    await page.waitForTimeout(100);
    const before = await page.evaluate(`window.scrollY`);
    const at = await page.locator('.u-over').boundingBox();
    await page.mouse.move(at!.x + at!.width / 2, Math.min(at!.y + at!.height - 5, 600));
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -120);
    await page.waitForTimeout(250);
    assert.ok((await page.evaluate(`window.scrollY`)) < before, 'the page scrolled up: zoom in at the least span changes nothing');
  } finally {
    await page.close();
  }
});

test('M4: a 150vh filling chart, focused by a click, can be scrolled past with the wheel; the bar chart too', async () => {
  for (const form of ['tall', 'btall']) {
    const { page } = form === 'tall' ? await open(`form=${form}`) : await openBars(`form=${form}`);
    try {
      const box = form === 'tall' ? await plotBox(page) : (await page.locator('.caos-bars svg').boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
      for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 200);
      await page.waitForTimeout(250);
      assert.ok((await page.evaluate(`window.scrollY`)) > 100, `${form}: scrolled ${await page.evaluate(`window.scrollY`)}`);
    } finally {
      await page.close();
    }
  }
});

test('M4: a focused chart that takes the wheel shows a cue (an outline), in both themes', async () => {
  for (const theme of ['light', 'dark']) {
    const { page } = await open('form=line');
    try {
      await page.evaluate(`document.documentElement.dataset.theme = '${theme}'`);
      const b = await plotBox(page);
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      const outline = await page.locator('[data-chart-focus]').evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      assert.ok(outline.style !== 'none' && outline.width >= 2, `${theme}: ${JSON.stringify(outline)}`);
    } finally {
      await page.close();
    }
  }
  const { page } = await openBars('form=bv');
  try {
    const b = (await page.locator('.caos-bars svg').boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 3);
    const outline = await page.locator('[data-chart-focus]').evaluate((el) => getComputedStyle(el).outlineStyle);
    assert.notEqual(outline, 'none', 'bars: the focused chart shows its cue');
  } finally {
    await page.close();
  }
});

test('m6: Ctrl and the wheel zoom a chart only while it is focused; over an unfocused chart the event is left to the browser', async () => {
  const { page } = await open('form=line');
  try {
    const prevented = (): Promise<boolean> =>
      page.evaluate(() => {
        const over = document.querySelector('.u-over')!;
        const r = over.getBoundingClientRect();
        const e = new WheelEvent('wheel', { deltaY: -300, ctrlKey: true, bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
        over.dispatchEvent(e);
        return e.defaultPrevented;
      });
    assert.equal(await prevented(), false, 'unfocused: not prevented');
    assert.equal(await zoomed(page), false, 'unfocused: not zoomed');
    await page.keyboard.press('Tab');
    assert.equal(await prevented(), true, 'focused: prevented');
    await page.waitForTimeout(150);
    assert.equal(await zoomed(page), true, 'focused: zoomed');
  } finally {
    await page.close();
  }
  const bars = await openBars('form=bv');
  try {
    const prevented = (): Promise<boolean> =>
      bars.page.evaluate(() => {
        const el = document.querySelector('.caos-bars')!;
        const r = el.getBoundingClientRect();
        const e = new WheelEvent('wheel', { deltaY: -300, ctrlKey: true, bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
        el.dispatchEvent(e);
        return e.defaultPrevented;
      });
    assert.equal(await prevented(), false, 'bars unfocused: not prevented');
    await bars.page.keyboard.press('Tab');
    assert.equal(await prevented(), true, 'bars focused: prevented');
  } finally {
    await bars.page.close();
  }
});

test('M5: zoomOff always sets data-zoom-off, an empty reason in one language or both included', async () => {
  for (const [form, lang] of [['off', 'es'], ['offempty', 'en'], ['offempty', 'es']]) {
    const { page } = await open(`form=${form}&lang=${lang}`);
    try {
      const host = page.locator('.caos-chart');
      assert.equal(await host.getAttribute('data-zoomable'), '0', `${form}/${lang}`);
      assert.equal(await host.evaluate((el) => el.hasAttribute('data-zoom-off')), true, `${form}/${lang}: data-zoom-off is set`);
    } finally {
      await page.close();
    }
  }
  for (const [form, lang] of [['boff', 'es'], ['boffempty', 'en'], ['boffempty', 'es']]) {
    const { page } = await openBars(`form=${form}&lang=${lang}`);
    try {
      assert.equal(await page.locator('.caos-bars-host').evaluate((el) => el.hasAttribute('data-zoom-off')), true, `${form}/${lang}: data-zoom-off is set`);
    } finally {
      await page.close();
    }
  }
});

test('M6: new data that differs only by a swap of two values is drawn', async () => {
  const { page } = await open('form=data');
  try {
    const canvas = () => page.locator('.u-wrap canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    await page.waitForTimeout(400);
    const before = await canvas();
    await page.evaluate(`window.swap()`);
    await page.waitForTimeout(250);
    assert.notEqual(await canvas(), before, 'the canvas shows the swapped values');
  } finally {
    await page.close();
  }
});

test('m1: the reset control is at least 24 by 24 px', async () => {
  const { page } = await open('form=line');
  try {
    await page.keyboard.press('Tab');
    await page.keyboard.press('+');
    const box = (await page.locator('.caos-chart-reset').boundingBox())!;
    assert.ok(box.width >= 24 && box.height >= 24, `${box.width} x ${box.height}`);
  } finally {
    await page.close();
  }
  const bars = await openBars('form=bh');
  try {
    await bars.page.keyboard.press('Tab');
    await bars.page.keyboard.press('+');
    const box = (await bars.page.locator('.caos-chart-reset').boundingBox())!;
    assert.ok(box.width >= 24 && box.height >= 24, `bars ${box.width} x ${box.height}`);
  } finally {
    await bars.page.close();
  }
});

test('m2: one drag threshold, 5 px, for the bars and the lines: 4 px is a click, 5 px is a brush', async () => {
  const line = await open('form=line');
  try {
    const b = await plotBox(line.page);
    await drag(line.page, b.x + 200, b.x + 204, b.y + 100);
    assert.equal(await zoomed(line.page), false, 'line: 4 px');
    await drag(line.page, b.x + 200, b.x + 220, b.y + 100);
    assert.equal(await zoomed(line.page), true, 'line: 20 px');
  } finally {
    await line.page.close();
  }
  const { page } = await openBars('form=bh');
  try {
    const b = (await page.locator('.caos-bars svg').boundingBox())!;
    const y = b.y + 60;
    const x = b.x + b.width * 0.5;
    const barDrag = async (dy: number) => {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + dy / 2, { steps: 2 });
      await page.mouse.move(x, y + dy, { steps: 2 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    };
    await barDrag(4);
    assert.equal(await page.locator('.caos-bars-host').getAttribute('data-zoomed'), null, 'bars: 4 px');
    await barDrag(5);
    assert.equal(await page.locator('.caos-bars-host').getAttribute('data-zoomed'), '1', 'bars: 5 px');
  } finally {
    await page.close();
  }
});

test('m5: the bar chart says its name once: the drawing is presentational beside the named group, and the bars stay reachable', async () => {
  const { page } = await openBars('form=bsel');
  try {
    const svg = page.locator('.caos-bars svg');
    const role = await svg.getAttribute('role');
    const hidden = await svg.getAttribute('aria-hidden');
    assert.ok(role === 'presentation' || hidden === 'true', `svg role=${role} aria-hidden=${hidden}`);
    assert.equal(await svg.getAttribute('aria-label'), null, 'the drawing carries no second name');
    assert.equal(await page.locator('[data-bar][role="button"]').count(), 6);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(`document.activeElement.getAttribute('data-bar') !== null`), true, 'a bar is reachable by Tab');
  } finally {
    await page.close();
  }
});

test('m7: the plot is described by its summary alone; the data table is linked by aria-details', async () => {
  const { page } = await open('form=line');
  try {
    const stop = page.locator('[data-chart-focus]');
    const described = ((await stop.getAttribute('aria-describedby')) ?? '').split(' ').filter(Boolean);
    assert.equal(described.length, 1);
    assert.equal(await page.locator(`[id="${described[0]}"]`).evaluate((el) => el.tagName), 'P');
    const details = (await stop.getAttribute('aria-details'))!;
    assert.equal(await page.locator(`[id="${details}"]`).evaluate((el) => el.tagName), 'TABLE');
  } finally {
    await page.close();
  }
  const bars = await openBars('form=bh');
  try {
    const stop = bars.page.locator('[data-chart-focus]');
    assert.equal((((await stop.getAttribute('aria-describedby')) ?? '').split(' ').filter(Boolean)).length, 1);
    const details = (await stop.getAttribute('aria-details'))!;
    assert.equal(await bars.page.locator(`[id="${details}"]`).evaluate((el) => el.tagName), 'TABLE');
  } finally {
    await bars.page.close();
  }
});
