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
    // every text the canvas writes, with the box of its ink: an overlap measured on the drawing itself, whatever the chart declares
    const w = window as unknown as Record<string, any>;
    w.__inked = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text: string, x: number, y: number, ...rest: number[]) {
      const m = this.measureText(String(text));
      const x0 = this.textAlign === 'left' || this.textAlign === 'start' ? x : this.textAlign === 'right' || this.textAlign === 'end' ? x - m.width : x - m.width / 2;
      w.__inked.push({ t: String(text), x0, x1: x0 + m.width, y0: y - m.actualBoundingBoxAscent, y1: y + m.actualBoundingBoxDescent });
      return fillText.call(this, text, x, y, ...rest);
    };
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
      // V04-2 as Contraste drew it (CAOS_Contraste C04 Findings, the S&P variant, before its labels were shortened): the 27 cited p-values on
      // a log axis that ends at the floor 1e-16, the years the finding names marked at their numbers (2002 alone, 2020 and 2021 as one run), and
      // the policy's two thresholds as reference lines. The capture read "Am2020-2021old 0.05": the run's label over "Amber threshold 0.05".
      c04real: () => {
        const ps = [0, 2.33599866e-43, 4.99976558e-62, 1.91374984e-124, 2.10364953e-30, 1.29364218e-21, 3.28090409e-31, 3.87415579e-38, 3.11010718e-40, 1.00550338e-24, 1.87731467e-59, 6.59198601e-18, 4.28405156e-12, 3.74968378e-6, 3.06889307e-11, 3.17928462e-17, 5.30716341e-7, 2.01734438e-19, 3.4457258e-34, 1.08791475e-33, 8.77722805e-56, 8.45040173e-95, 0, 2.15256685e-35, 5.01910564e-29, 1.37584523e-18, 1.62710272e-14];
        const floor = 1e-16;
        const xs = [0.5, ...ps.map((_, i) => i + 1), ps.length + 0.5];
        const where = (f: (p: number) => boolean, at?: number) => [null, ...ps.map((p) => (f(p) ? (at ?? p) : null)), null];
        return (
          <UPlotChart height={Number(q.get('h') ?? 300)} x={{ values: xs, label: 'Cited test (the number in the table)', format: { decimals: 0 } }} y={{ label: 'p-value (log scale)', log: true, format: { digits: 2 } }}
            series={[
              { label: 'Red: p below 0.01', values: where((p) => p >= floor && p < 0.01), color: '--color-bad', mode: 'points' },
              { label: 'Red, p below 1e-16: drawn at 1e-16', values: where((p) => p < floor, floor), color: '--color-magenta', mode: 'points' },
            ]}
            marks={[{ x: 4, label: '2002' }, { x: 22, label: '2020-2021' }, { x: 23, label: '' }]}
            yMarks={[{ y: 0.05, label: 'Amber threshold 0.05', tone: 'warn' }, { y: 0.01, label: 'Red threshold 0.01', tone: 'bad' }]} />
        );
      },
      // reference lines close together (zones, thresholds): three y marks one unit apart with long labels
      ytwin: () => (
        <UPlotChart height={280} x={{ values: days, label: 'Day', format: { decimals: 0 } }} y={{ label: 'Run', format: { decimals: 0 }, range: [0, 90] }}
          series={[{ label: 'Run', values: run }]}
          yMarks={[{ y: 50, label: 'Lower zone limit of the board' }, { y: 51, label: 'Supervisory early-warning level' }, { y: 52, label: 'Upper zone limit of the board' }]} />
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


/** The ink of the last drawing of each mark label (a cut label counts as its label), read from the canvas calls, and the pairs that overlap. */
async function inkedOverlaps(page: Page, labels: string[]) {
  const inked: Box[] = await page.evaluate(() => (window as unknown as { __inked: Box[] }).__inked);
  const last = new Map<string, Box>();
  for (const b of inked) {
    const stem = b.t.replace(/…$/, '');
    const label = labels.find((l) => stem.length > 0 && l.startsWith(stem));
    if (label) last.set(label, b);
  }
  const boxes = [...last.entries()].map(([t, b]) => ({ ...b, t }));
  return { boxes, pairs: anyOverlap(boxes) };
}

// m2 (re-review of 0.19.0): the shell's own c04 form drew the same pixels before and after S3, so it could not show V04-2 fixed. This is
// Contraste's drawing at its widths (a card at 390 and at 1280) and its heights; the overlap is measured on the ink the canvas writes.
test('m2 c04real: the run "2020-2021" and the threshold labels do not overlap on the canvas at 358x300, 390x280, 640x300 and 640x420 (V04-2 as Contraste drew it)', async () => {
  for (const [w, h] of [[358, 300], [390, 280], [640, 300], [640, 420]]) {
    const { page, errors } = await open(`form=c04real&w=${w}&h=${h}`, { width: w + 40, height: 900 });
    try {
      const { boxes, pairs } = await inkedOverlaps(page, ['2002', '2020-2021', 'Amber threshold 0.05', 'Red threshold 0.01']);
      assert.equal(boxes.length, 4, `${w}x${h}: every label is written: ${JSON.stringify(boxes)}`);
      assert.deepEqual(pairs, [], `${w}x${h}: inked: ${JSON.stringify(boxes)}`);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
});

// m1 (re-review of 0.19.0): y-mark labels are placed against the shared boxes as x labels are, on rows near their line, cut with an ellipsis
// when no row has room: three reference lines one unit apart with long labels overlapped each other at 390 px.
test('m1 ytwin: close reference lines keep their labels apart at 390 and 640, on the canvas and in what the chart declares', async () => {
  for (const wd of [390, 640]) {
    const { page, errors } = await open(`form=ytwin&w=${wd}`, { width: wd + 40, height: 800 });
    try {
      const labels = ['Lower zone limit of the board', 'Supervisory early-warning level', 'Upper zone limit of the board'];
      assert.equal(await page.locator('.caos-chart').getAttribute('data-mark-overlaps'), '0');
      const boxes = await boxesOf(page);
      assert.equal(boxes.filter((b) => b.k === 'y').length, 3, `every label is written: ${JSON.stringify(boxes)}`);
      assert.deepEqual(anyOverlap(boxes), [], `placed: ${JSON.stringify(boxes)}`);
      for (const b of boxes) assert.ok(labels.includes(b.t) || (b.t.endsWith('…') && labels.some((l) => l.startsWith(b.t.slice(0, -1).trimEnd()))), `"${b.t}" is a label or its cut`);
      const inked = await inkedOverlaps(page, labels);
      assert.deepEqual(inked.pairs, [], `inked: ${JSON.stringify(inked.boxes)}`);
      // a cut label keeps its whole text in the table of marks
      const rows = await page.locator('table[data-chart-marks] tbody tr').allTextContents();
      for (const l of labels) assert.ok(rows.some((r) => r.includes(l)), `the table of marks names "${l}"`);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
});
