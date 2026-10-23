import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startTierPage, type TierPage } from './tier-harness.ts';

// Shell 0.19.0, the two text defects of the Contraste capture review (U16-R2): D2 a square root that collapsed to under 2 px in
// documentation prose (.prose svg { height: auto } beat KaTeX's own rule), and D3 a rotated y-axis title longer than the plot that
// was cut and lost its unit ("Accumulated CVA and DVA (US"). The page reads `?form=`, `?lang=`, `?len=` (how many words the title has).
let t: TierPage;
before(async () => {
  t = await startTierPage(`
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { Equation, InlineMath } from './src/index';
    import { UPlotChart } from './src/chart';
    import { useLangStore } from './src/lib/lang';
    const q = new URLSearchParams(location.search);
    useLangStore.getState().setLang(q.get('lang') === 'es' ? 'es' : 'en');
    const form = q.get('form') ?? 'prose';
    const words = Number(q.get('len') ?? '6');
    const height = Number(q.get('h') ?? '280');
    const base = ['Accumulated', 'CVA', 'and', 'DVA', 'across', 'the', 'whole', 'portfolio', 'of', 'counterparties', 'at', 'ninety', 'nine', 'percent', 'one-sided', 'confidence'];
    const baseEs = ['CVA', 'y', 'DVA', 'acumulados', 'de', 'todas', 'las', 'contrapartes', 'de', 'la', 'cartera', 'con', 'confianza', 'unilateral', 'al', 'noventa'];
    const title = (list: string[]) => list.slice(0, words).join(' ');
    const years = Array.from({ length: 10 }, (_, i) => 2000 + i);
    function Prose() {
      return (
        <div className="prose" style={{ maxWidth: 640 }}>
          <p id="inline">The distance is <span id="inline-root"><InlineMath tex={'\\\\sqrt{x^2+y^2}'} /></span> in the plane.</p>
          <div id="display"><Equation tex={'\\\\sigma = \\\\sqrt{\\\\frac{1}{n}\\\\sum_{i=1}^{n}(x_i-\\\\bar{x})^2}'} caption="The standard deviation." /></div>
        </div>
      );
    }
    function YTitle() {
      return (
        <div style={{ width: 640, maxWidth: '100%', height: height + 120 }}>
          <UPlotChart
            height={height}
            x={{ values: years, label: { en: 'Year', es: 'Año' }, format: { decimals: 0, grouping: false } }}
            y={{ label: { en: title(base), es: title(baseEs) }, unit: { en: 'USD millions', es: 'millones de USD' }, format: { decimals: 1 } }}
            series={[{ label: 'Alpha', values: years.map((v) => v - 1990) }]}
          />
        </div>
      );
    }
    function XTitle() {
      return (
        <div style={{ width: 640, maxWidth: '100%', height: 420 }}>
          <UPlotChart
            height={300}
            x={{ values: years, label: { en: title(base) + ' by year of the calendar in which each trade was booked', es: title(baseEs) + ' por año del calendario en que se registró cada operación' }, unit: { en: 'calendar years', es: 'años calendario' }, format: { decimals: 0, grouping: false } }}
            y={{ label: 'Mass', unit: 'kg', format: { decimals: 1 } }}
            series={[{ label: 'Alpha', values: years.map((v) => v - 1990) }]}
          />
        </div>
      );
    }
    const forms: Record<string, () => React.ReactNode> = { prose: Prose, ytitle: YTitle, xtitle: XTitle };
    const App = forms[form] ?? Prose;
    createRoot(document.getElementById('root')!).render(<App />);
  `);
});
after(async () => {
  await t?.close();
});

test('D2: a square root inside prose keeps its intrinsic height, inline and in a display equation', async () => {
  const { page, errors } = await t.open('form=prose');
  try {
    await page.waitForSelector('.prose .katex svg', { timeout: 10000 });
    await page.evaluate(`document.fonts.ready`);
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll('.prose .katex svg')].map((svg) => {
        const r = svg.getBoundingClientRect();
        return { w: r.width, h: r.height, inRoot: Boolean(svg.closest('.sqrt')) };
      }),
    );
    assert.ok(sizes.length >= 2, `a root in the sentence and one in the equation: ${JSON.stringify(sizes)}`);
    for (const s of sizes) assert.ok(s.h >= 8 && s.w >= 6, `a root is drawn, not collapsed to a line: ${JSON.stringify(s)}`);
    // the stroke of the radical is a path with a size of its own
    const path = await page.evaluate(() => {
      const p = document.querySelector('#inline .katex svg path') as SVGGraphicsElement | null;
      const r = p?.getBoundingClientRect();
      return r ? { w: r.width, h: r.height } : null;
    });
    assert.ok(path && path.h >= 8, `the radical path: ${JSON.stringify(path)}`);
    assert.deepEqual(errors.filter((e) => !/Failed to load resource/.test(e)), []);
  } finally {
    await page.close();
  }
});

test('D2: the rule still bounds an ordinary image and svg inside prose to the column', async () => {
  const { page } = await t.open('form=prose');
  try {
    await page.waitForSelector('.prose .katex svg');
    const kept = await page.evaluate(() => {
      const holder = document.querySelector('.prose')!;
      holder.insertAdjacentHTML('beforeend', '<svg id="wide" width="2000" height="400" viewBox="0 0 2000 400"><rect width="2000" height="400" fill="#888"/></svg>');
      const r = document.querySelector('#wide')!.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    assert.ok(kept.w <= 641, `bounded to the column: ${kept.w}`);
    assert.ok(Math.abs(kept.h - kept.w / 5) < 2, `and in proportion: ${kept.h}`);
  } finally {
    await page.close();
  }
});

const moved = async (page: Page) => (await page.locator('.caos-chart').getAttribute('data-axis-title-moved')) ?? '';

/** Whether the first 24 css pixels of the plot canvas (where a rotated y title is drawn) have ink in the top or bottom rows: the title is cut. */
const yTitleTouchesEdge = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector('.caos-chart canvas') as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    const pr = c.width / c.getBoundingClientRect().width;
    const w = Math.round(24 * pr);
    const rows = [0, 1, 2, c.height - 3, c.height - 2, c.height - 1];
    return rows.some((y) => {
      const d = ctx.getImageData(0, y, w, 1).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 40) return true;
      return false;
    });
  });

test('D3: a y title longer than the plot moves above it as a horizontal line, whole and with its unit; a short one stays on the axis', async () => {
  const short = await t.open('form=ytitle&len=2&h=280');
  try {
    await short.page.waitForSelector('.caos-chart[data-drawn="1"] canvas');
    await short.page.waitForTimeout(300);
    assert.equal(await moved(short.page), '', 'a short title stays on the axis');
    assert.equal(await short.page.locator('.caos-chart-axis-title').count(), 0);
  } finally {
    await short.page.close();
  }
  const long = await t.open('form=ytitle&len=16&h=280');
  try {
    await long.page.waitForSelector('.caos-chart[data-drawn="1"] canvas');
    await long.page.waitForTimeout(300);
    assert.match(await moved(long.page), /y/);
    const title = long.page.locator('.caos-chart-axis-title[data-axis-title="y"]');
    assert.equal(await title.textContent(), 'Accumulated CVA and DVA across the whole portfolio of counterparties at ninety nine percent one-sided confidence (USD millions)');
    const fits = await title.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, host: el.closest('.caos-chart')!.getBoundingClientRect().right, right: el.getBoundingClientRect().right }));
    assert.ok(fits.sw <= fits.cw + 1 && fits.right <= fits.host + 1, `shown whole inside the chart: ${JSON.stringify(fits)}`);
    const plotBox = (await long.page.locator('.caos-chart-plot').boundingBox())!;
    const titleBox = (await title.boundingBox())!;
    assert.ok(titleBox.y + titleBox.height <= plotBox.y + 1, 'above the plot');
  } finally {
    await long.page.close();
  }
});

test('D3: no y title is ever cut, at any length, in both languages: it fits the axis or moves above the plot', async () => {
  for (const lang of ['en', 'es']) {
    for (let words = 1; words <= 16; words += 1) {
      const { page } = await t.open(`form=ytitle&lang=${lang}&len=${words}&h=240`, { width: 700, height: 700 });
      try {
        await page.waitForSelector('.caos-chart[data-drawn="1"] canvas');
        await page.waitForTimeout(200);
        const m = await moved(page);
        if (m.includes('y')) {
          const el = page.locator('.caos-chart-axis-title[data-axis-title="y"]');
          assert.ok((await el.count()) === 1, `${lang} ${words}: the moved title is shown`);
          assert.ok(((await el.textContent()) ?? '').length > 5);
        } else {
          assert.equal(await yTitleTouchesEdge(page), false, `${lang} ${words} words: the title on the axis touches the top or bottom of the chart (it is cut)`);
        }
      } finally {
        await page.close();
      }
    }
  }
});

test('D3: at 390 px in Spanish the long titles of both axes are whole (the Contraste case)', async () => {
  const { page, errors } = await t.open('form=xtitle&lang=es&len=8', { width: 390, height: 800, touch: true });
  try {
    await page.waitForSelector('.caos-chart[data-drawn="1"] canvas');
    await page.waitForTimeout(300);
    assert.match(await moved(page), /x/, 'the x title is wider than the chart');
    const x = page.locator('.caos-chart-axis-title[data-axis-title="x"]');
    assert.match((await x.textContent()) ?? '', /CVA y DVA .* por año del calendario en que se registró cada operación \(años calendario\)$/);
    const box = (await x.boundingBox())!;
    const host = (await page.locator('.caos-chart').boundingBox())!;
    assert.ok(box.x >= host.x - 1 && box.x + box.width <= host.x + host.width + 1, 'inside the chart');
    assert.ok(box.height > 20, `it wraps over lines: ${box.height}`);
    const scroll = await page.evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    assert.equal(scroll, 0, 'the page does not scroll sideways');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
  const y = await t.open('form=ytitle&lang=es&len=12&h=260', { width: 390, height: 800, touch: true });
  try {
    await y.page.waitForSelector('.caos-chart[data-drawn="1"] canvas');
    await y.page.waitForTimeout(300);
    assert.match(await moved(y.page), /y/);
    assert.match((await y.page.locator('.caos-chart-axis-title[data-axis-title="y"]').textContent()) ?? '', /\(millones de USD\)$/, 'the unit is not lost');
    assert.equal(await y.page.evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`), 0);
  } finally {
    await y.page.close();
  }
});
