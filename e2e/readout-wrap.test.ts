import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startTierPage, type TierPage } from './tier-harness';

// SHC-106 (issue 224, known defect 45): the readout of UPlotChart and BarChart printed one line and cut the rest with an ellipsis, so in a chart
// narrower than its text the reader lost the end of it; the Spanish hint at rest ("Pase el cursor sobre el gráfico para leer los valores") is
// 345 px wide and a PlotCard's plot body is 329 px at 390 px. The gate's document walk counts a chart only when every glyph of its text was seen,
// so CEFOP_DinHot's robustness charts counted 0 at 390 in Spanish. The readout now wraps, and it keeps the tallest height it reached at the
// chart's width and language, so a filling chart's plot (which takes the height the readout leaves) does not resize as the pointer moves.

let t: TierPage;
before(async () => {
  t = await startTierPage(`
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { BarChart } from './src/index';
    import { UPlotChart } from './src/chart';
    import { useLangStore } from './src/lib/lang';
    const w = window as unknown as Record<string, any>;
    w.setLang = (l: 'en' | 'es') => useLangStore.getState().setLang(l);
    const q = new URLSearchParams(location.search);
    useLangStore.getState().setLang(q.get('lang') === 'es' ? 'es' : 'en');
    const form = q.get('form') ?? 'line';
    const width = Number(q.get('w') ?? 260);
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const ys = [3, 5, 4, 8, 6, 9, 7, 12];
    // a caller's readout three lines long at 260 px: the pointer moves between it and the two-line hint
    const long = (i: number) => 'Step ' + xs[i] + ': level ' + ys[i] + ' units, measured by the reference instrument at the downstream station of the line';
    const bars = xs.map((x, i) => ({ id: 'b' + x, label: 'Batch ' + x, value: ys[i], hint: 'measured by the reference instrument at the downstream station of the line' }));
    function Box({ children, fill }: { children: React.ReactNode; fill?: boolean }) {
      const [wd, setWd] = React.useState(width);
      w.setWidth = setWd;
      return <div style={{ padding: 8 }}><div data-box style={{ width: wd, ...(fill ? { height: 300, display: 'flex', flexDirection: 'column' } : {}) }}>{children}</div><div style={{ height: 600 }}>after</div></div>;
    }
    const forms: Record<string, () => React.ReactNode> = {
      line: () => <Box><UPlotChart height={200} x={{ values: xs, label: { en: 'Step', es: 'Paso' } }} y={{ label: { en: 'Level', es: 'Nivel' } }} series={[{ label: { en: 'Alpha', es: 'Alfa' }, values: ys }]} /></Box>,
      fill: () => <Box fill><UPlotChart height="fill" x={{ values: xs, label: { en: 'Step', es: 'Paso' } }} y={{ label: { en: 'Level', es: 'Nivel' } }} series={[{ label: { en: 'Alpha', es: 'Alfa' }, values: ys }]} readout={long} /></Box>,
      bars: () => <Box><BarChart title={{ en: 'Batches', es: 'Lotes' }} axis={{ label: { en: 'Level', es: 'Nivel' }, format: { decimals: 0 } }} data={bars} /></Box>,
      barsfill: () => <Box fill><BarChart title={{ en: 'Batches', es: 'Lotes' }} axis={{ label: { en: 'Level', es: 'Nivel' }, format: { decimals: 0 } }} data={bars} height="fill" /></Box>,
    };
    const App = forms[form] ?? forms.line;
    createRoot(document.getElementById('root')!).render(<App />);
  `);
});
after(async () => {
  await t?.close();
});

const READOUT = '.caos-chart-readout, .caos-bars-readout';
const PLOT = '.caos-chart-plot, .caos-bars';

async function open(form: string, lang: 'en' | 'es', w = 260) {
  const o = await t.open(`form=${form}&lang=${lang}&w=${w}`, { width: 390, height: 844 });
  await o.page.waitForSelector('.caos-chart[data-drawn="1"] canvas, .caos-bars[data-drawn="1"] svg', { timeout: 10000 });
  await o.page.waitForTimeout(300);
  return o;
}

/** The readout's text and box, the boxes of its line fragments, its line count and what clips it. */
async function readoutOf(page: Page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0);
    const lines = new Set(rects.map((r) => Math.round(r.top))).size;
    const s = getComputedStyle(el);
    return {
      text: el.textContent ?? '',
      box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, height: box.height },
      outside: rects.filter((r) => r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.bottom > box.bottom + 0.5).length,
      lines,
      ellipsis: s.textOverflow === 'ellipsis' && s.overflowX !== 'visible',
      // the height the text takes: the space the readout holds beyond it is what it reserved
      reserved: rects.length ? box.height - (Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top))) : box.height,
      scroll: el.scrollWidth - el.clientWidth,
    };
  }, READOUT);
}
const plotHeight = (page: Page) => page.evaluate((sel) => Math.round((document.querySelector(sel) as HTMLElement).getBoundingClientRect().height), PLOT);
const plotBox = (page: Page) =>
  page.evaluate((sel) => {
    const r = (document.querySelector(sel) as HTMLElement).getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, PLOT);

/** A chart 260 px wide in Spanish: its hint at rest is longer than the chart and must be held whole, on two lines or more. */
async function holdsHint(form: 'line' | 'bars', rest: string | null) {
  const { page, context, errors } = await open(form, 'es');
  try {
    const r = await readoutOf(page);
    if (rest) assert.equal(r.text, rest);
    assert.ok(r.text.length > 40, `the Spanish hint at rest: "${r.text}"`);
    assert.equal(r.ellipsis, false, 'the readout cuts its text with an ellipsis');
    assert.ok(r.scroll <= 0, `the readout's text overflows its box by ${r.scroll} px`);
    assert.equal(r.outside, 0, `${r.outside} fragment(s) of "${r.text}" lie outside the readout's box ${JSON.stringify(r.box)}`);
    assert.ok(r.lines >= 2, `the hint should wrap at 260 px; it holds ${r.lines} line(s)`);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

/** A filling chart 260 px wide in Spanish under the pointer: its plot keeps one height, the readout grows and stays, a new width or language measures it afresh. */
async function settles(form: 'fill' | 'barsfill') {
  const { page, context, errors } = await open(form, 'es');
  try {
    const atRest = await readoutOf(page);
    assert.ok(atRest.lines >= 2, `the hint wraps at 260 px: ${atRest.lines} line(s)`);
    const p0 = await plotBox(page);
    // the pointer on the middle of the plot: the readout reads the point, longer than the hint
    // two moves: the chart reads only a real move (SHC-103), as the browser's own pointer gives it
    await page.mouse.move(p0.x + p0.w / 2 - 3, p0.y + p0.h / 2 - 3);
    await page.mouse.move(p0.x + p0.w / 2, p0.y + p0.h / 2, { steps: 3 });
    await page.waitForTimeout(250);
    const reading = await readoutOf(page);
    assert.notEqual(reading.text, atRest.text, 'the pointer reads a value');
    assert.equal(reading.outside, 0, `the reading is cut: ${JSON.stringify(reading)}`);
    const h1 = await plotHeight(page);
    const r1 = reading.box.height;
    assert.ok(r1 >= atRest.box.height, `the readout shrank from ${atRest.box.height} to ${r1}`);
    // the pointer leaves: the hint is back, in the height the reading reached; the plot keeps its height
    await page.mouse.move(p0.x + p0.w / 2, p0.y + p0.h + 400, { steps: 4 });
    await page.waitForTimeout(250);
    const back = await readoutOf(page);
    assert.equal(back.text, atRest.text, 'the hint is back once the pointer leaves');
    assert.equal(Math.round(back.box.height), Math.round(r1), 'the readout keeps the tallest height it reached');
    assert.equal(await plotHeight(page), h1, 'the plot grew back when the pointer left');
    // the pointer on the plot's lower edge, moving: every frame keeps one plot height (no oscillation between in and out)
    const p1 = await plotBox(page);
    const heights: number[] = [];
    for (let k = 0; k < 12; k += 1) {
      await page.mouse.move(p1.x + 20 + k * 12, p1.y + p1.h - 2);
      await page.waitForTimeout(60);
      heights.push(await plotHeight(page));
    }
    assert.deepEqual([...new Set(heights)], [h1], `the plot's height changed under the pointer: ${heights.join(', ')}`);
    // a new width measures the readout afresh: at 640 px the hint and the readings are shorter
    await page.mouse.move(5, 5);
    await page.evaluate(() => (window as unknown as { setWidth: (w: number) => void }).setWidth(640));
    await page.waitForTimeout(400);
    const wide = await readoutOf(page);
    assert.ok(wide.box.height < r1, `at 640 px the readout kept ${wide.box.height} px of the ${r1} px it reached at 260 px`);
    assert.ok(wide.reserved < 2, `at 640 px the readout reserves ${wide.reserved} px beyond its text`);
    // a new language too: back at 260 px the reading's height was reached in Spanish, the English hint is measured afresh
    await page.evaluate(() => (window as unknown as { setWidth: (w: number) => void }).setWidth(260));
    await page.evaluate(() => (window as unknown as { setLang: (l: string) => void }).setLang('en'));
    await page.waitForTimeout(400);
    const en = await readoutOf(page);
    assert.ok(/[A-Za-z]/.test(en.text) && en.text !== atRest.text, `the English hint: "${en.text}"`);
    assert.ok(en.reserved < 2, `in English the readout reserves ${en.reserved} px beyond its text: ${JSON.stringify(en)}`);
    assert.equal(en.outside, 0);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

test('SHC-106 a UPlotChart narrower than its Spanish hint holds the hint whole on two lines, never cut', { timeout: 60_000 }, () => holdsHint('line', 'Pase el cursor sobre el gráfico para leer los valores'));
test('SHC-106 a BarChart narrower than its Spanish hint holds the hint whole on two lines, never cut', { timeout: 60_000 }, () => holdsHint('bars', null));
test("SHC-106 a filling UPlotChart's plot settles under the pointer: its readout grows to the tallest it reached and stays until the width or the language changes", { timeout: 90_000 }, () => settles('fill'));
test("SHC-106 a filling BarChart's plot settles under the pointer: its readout grows to the tallest it reached and stays until the width or the language changes", { timeout: 90_000 }, () => settles('barsfill'));
