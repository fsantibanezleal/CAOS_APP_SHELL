import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startTierPage, type TierPage } from './tier-harness.ts';

// Shell 0.19.0, D16-21, S3: the labels of x marks and the labels of y marks share one set of placed boxes. Triage rows V04-2 and V16-3 of the
// Contraste U16-R2 round: an x label over a threshold's y label ("Am2020-2021old 0.05"; "LCR window: 30 days" over "Realised run, Board share:
// 85.00 %" at 390 px). The host says what it placed (`data-mark-boxes`) and how many labels overlap (`data-mark-overlaps`).
let t: TierPage;
before(async () => {
  t = await startTierPage(`
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { UPlotChart } from './src/chart';
    import { useLangStore } from './src/lib/lang';
    const q = new URLSearchParams(location.search);
    useLangStore.getState().setLang(q.get('lang') === 'es' ? 'es' : 'en');
    const form = q.get('form') ?? 'c16';
    const days = Array.from({ length: 91 }, (_, i) => i);
    const run = days.map((d) => 40 + 45 * (1 - Math.exp(-d / 25)));
    const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
    const forms: Record<string, () => React.ReactNode> = {
      // V16-3: the LCR window at day 30 and the board share at 85 % of a run that tops out at 88 %
      c16: () => (
        <UPlotChart height={280} x={{ values: days, label: { en: 'Day', es: 'Día' }, unit: 'd', format: { decimals: 0 } }} y={{ label: 'Run', unit: '%', format: { decimals: 0 }, range: [0, 90] }}
          series={[{ label: 'Realised run', values: run }]}
          marks={[{ x: 30, label: { en: 'LCR window: 30 days', es: 'Ventana LCR: 30 días' } }]}
          yMarks={[{ y: 88, label: { en: 'Realised run, Board share: 85.00 %', es: 'Corrida realizada, cuota del Directorio: 85,00 %' } }]} />
      ),
      // V04-2: two vintages marked on the x axis and a threshold at the top of the range
      c04: () => (
        <UPlotChart height={280} x={{ values: years, label: 'Year', format: { decimals: 0 } }} y={{ label: 'Share', format: { digits: 2 }, range: [0, 0.052] }}
          series={[{ label: 'Observed', values: [0.02, 0.03, 0.04, 0.045, 0.05, 0.048, 0.049] }]}
          marks={[{ x: 2020, label: 'Am2020-2021' }, { x: 2022, label: 'Am2022' }]}
          yMarks={[{ y: 0.05, label: 'old 0.05' }]} />
      ),
      // no y marks: x labels are placed as before
      plain: () => (
        <UPlotChart height={280} x={{ values: days, label: 'Day', format: { decimals: 0 } }} y={{ label: 'Run', format: { decimals: 0 } }}
          series={[{ label: 'Run', values: run }]}
          marks={[{ x: 10, label: 'first mark' }, { x: 12, label: 'second mark' }, { x: 80, label: 'late mark' }]} />
      ),
      // a label wider than the plot: cut with an ellipsis, the whole text kept elsewhere
      cut: () => (
        <UPlotChart height={200} x={{ values: days, label: 'Day', format: { decimals: 0 } }} y={{ label: 'Run', format: { decimals: 0 } }}
          series={[{ label: 'Run', values: run }]}
          marks={[{ x: 45, label: 'Regulatory liquidity window of thirty days' }]} />
      ),
      none: () => <UPlotChart height={200} x={{ values: days, label: 'Day' }} y={{ label: 'Run' }} series={[{ label: 'Run', values: run }]} />,
    };
    createRoot(document.getElementById('root')!).render(<div style={{ width: Number(q.get('w') ?? 640), maxWidth: '100%' }}>{(forms[form] ?? forms.c16)()}</div>);
  `);
});
after(async () => {
  await t?.close();
});

interface Box {
  k: 'x' | 'y';
  t: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cut?: boolean;
}
async function open(query: string, opts?: Parameters<TierPage['open']>[1]) {
  const o = await t.open(query, opts);
  await o.page.waitForSelector('.caos-chart[data-drawn="1"] canvas', { timeout: 10000 });
  await o.page.waitForTimeout(250);
  return o;
}
const boxesOf = async (page: Page): Promise<Box[]> => JSON.parse((await page.locator('.caos-chart').getAttribute('data-mark-boxes')) ?? '[]');
const overlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const anyOverlap = (boxes: Box[]) => boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => overlap(a, b)).map((b) => `${a.t} / ${b.t}`));

async function noOverlap(form: string, width: number) {
  const { page, errors } = await open(`form=${form}&w=${width}`, { width, height: 700 });
  try {
    assert.equal(await page.locator('.caos-chart').getAttribute('data-mark-overlaps'), '0');
    const boxes = await boxesOf(page);
    const labels = boxes.map((b) => b.t).join(' | ');
    assert.ok(boxes.some((b) => b.k === 'x') && boxes.some((b) => b.k === 'y'), `both kinds are placed: ${labels}`);
    assert.deepEqual(anyOverlap(boxes), [], `placed: ${JSON.stringify(boxes)}`);
    // every label is inside the plot
    const plot = (await page.locator('.u-over').boundingBox())!;
    const host = (await page.locator('.caos-chart canvas').first().boundingBox())!;
    for (const b of boxes) assert.ok(b.x0 >= -0.5 && b.x1 <= plot.width + (plot.x - host.x) + 8 && b.y0 >= -0.5, `${b.t} is inside the canvas: ${JSON.stringify(b)}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

test('S3 c16 at 390: no x label lies over a y label or another x label (the host says 0 and the boxes agree)', () => noOverlap('c16', 390));
test('S3 c16 at 640: no x label lies over a y label or another x label (the host says 0 and the boxes agree)', () => noOverlap('c16', 640));
test('S3 c04 at 390: no x label lies over a y label or another x label (the host says 0 and the boxes agree)', () => noOverlap('c04', 390));
test('S3 c04 at 640: no x label lies over a y label or another x label (the host says 0 and the boxes agree)', () => noOverlap('c04', 640));

test('S3: a chart with no y marks places its x labels as before: right of the line, a row down past a label that is in the way', async () => {
  const { page } = await open('form=plain', { width: 700, height: 700 });
  try {
    assert.equal(await page.locator('.caos-chart').getAttribute('data-mark-overlaps'), '0');
    const boxes = (await boxesOf(page)).filter((b) => b.k === 'x').sort((p, q) => p.x0 - q.x0);
    assert.equal(boxes.length, 3);
    const rows = boxes.map((b) => Math.round(b.y1));
    assert.equal(rows[0], rows[2], 'the first and the late label share row 0');
    assert.equal(rows[1] - rows[0], 14, 'the second is one row (14 px) down');
    // right of its line, 4 px off it: the first label starts 4 px right of the mark at day 10
    const plot = await page.evaluate(() => {
      const o = document.querySelector('.u-over')!.getBoundingClientRect();
      const c = document.querySelector('.caos-chart canvas')!.getBoundingClientRect();
      return { left: o.left - c.left, width: o.width };
    });
    const expected = plot.left + (10 / 90) * plot.width + 4;
    assert.ok(Math.abs(boxes[0].x0 - expected) < 1.5, `x0 ${boxes[0].x0} near ${expected}`);
  } finally {
    await page.close();
  }
});

test('S3: a chart with no marks says 0 overlaps and no boxes', async () => {
  const { page } = await open('form=none', { width: 600, height: 500 });
  try {
    assert.equal(await page.locator('.caos-chart').getAttribute('data-mark-overlaps'), '0');
    assert.deepEqual(await boxesOf(page), []);
  } finally {
    await page.close();
  }
});

test('S3 cut: a label that fits no row is cut with an ellipsis; its whole text stays in the title, the readout and the table of marks', async () => {
  const { page, errors } = await open('form=cut&w=200', { width: 260, height: 600 });
  try {
    const full = 'Regulatory liquidity window of thirty days';
    const boxes = await boxesOf(page);
    assert.equal(boxes.length, 1);
    assert.ok(boxes[0].cut && boxes[0].t.endsWith('…') && boxes[0].t.length < full.length, `cut: ${boxes[0].t}`);
    assert.equal(await page.locator('.caos-chart').getAttribute('data-mark-overlaps'), '0');
    assert.equal(await page.locator('.caos-chart').getAttribute('data-mark-cut'), full);
    assert.equal(await page.locator('.caos-chart-plot').getAttribute('title'), full, 'the whole text is the plot title');
    assert.ok(((await page.locator('.caos-chart-readout').textContent()) ?? '').includes(full), 'and the readout');
    const rows = await page.locator('table[data-chart-marks] tbody tr').allTextContents();
    assert.ok(rows.some((r) => r.includes(full)), `and the table of marks: ${rows}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('S3 table of marks: every mark is listed, labelled or not, in the page language, linked from the plot by aria-details', async () => {
  const { page } = await open('form=c16&lang=es&w=640', { width: 700, height: 700 });
  try {
    const table = page.locator('table[data-chart-marks]');
    assert.deepEqual(await table.locator('thead th').allTextContents(), ['Marca', 'Posición']);
    const rows = await table.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('th, td')].map((c) => (c.textContent ?? '').replace(/ /g, ' '))));
    assert.deepEqual(rows, [['Ventana LCR: 30 días', 'Día 30 d'], ['Corrida realizada, cuota del Directorio: 85,00 %', '88 %']]);
    const details = ((await page.locator('[data-chart-focus]').getAttribute('aria-details')) ?? '').split(' ');
    assert.equal(details.length, 2);
    assert.equal(await page.locator(`[id="${details[1]}"]`).count(), 1);
    assert.equal(await page.locator('table[data-chart-table]').count(), 1, 'the table of values is still the one table of the chart');
  } finally {
    await page.close();
  }
});
