import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser, type Page } from '@playwright/test';

// Shell 0.18.0 (CAOS_Fragmenta 0.09.000, BL-042): what CAOS_Fragmenta's own uPlot wrapper did and the shell's chart did not.
// Named x ticks with an x range, a key that solos a series, dots on a short line, an unlabelled reference line, and a chart
// that uses none of them. The page reads `?form=` to draw one of them and `?lang=` for the interface language, and exposes
// `setLang` and `setTheme` so a test can change either while the chart is drawn.
let browser: Browser, server: Server, address: string;
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const script = await build({
    stdin: {
      contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { UPlotChart } from './src/chart';
        import { useLangStore } from './src/lib/lang';
        import { useThemeStore } from './src/lib/theme';
        const w = window as unknown as Record<string, unknown>;
        w.setLang = (l: 'en' | 'es') => useLangStore.getState().setLang(l);
        w.setTheme = (t: 'light' | 'dark') => useThemeStore.getState().setTheme(t);
        const q = new URLSearchParams(location.search);
        useLangStore.getState().setLang(q.get('lang') === 'es' ? 'es' : 'en');
        const form = q.get('form') ?? 'ticks';
        const protocol = [
          { value: 0, label: { en: 'random', es: 'aleatorio' } },
          { value: 1, label: { en: 'deduplicated', es: 'deduplicado' } },
          { value: 2, label: { en: 'site held out', es: 'sitio retenido' } },
        ];
        const box = (child: React.ReactNode) => <div style={{ width: 640, height: 420 }}>{child}</div>;
        function Ticks() {
          return box(
            <UPlotChart
              height={360}
              x={{ values: [0, 1, 2], label: { en: 'Protocol', es: 'Protocolo' }, ticks: protocol, range: [-0.5, 2.5] }}
              y={{ label: 'Error', range: [10, 40], format: { decimals: 0 } }}
              series={[{ label: 'Model', values: [12, 24, 39], dots: true }, { label: 'Baseline', values: [20, 25, 30] }]}
            />,
          );
        }
        function LogTicks() {
          return box(
            <UPlotChart
              height={360}
              x={{ values: [1, 10, 100, 1000], label: 'Size', log: true, ticks: [0.001, 10, 100, 1, 1e6].map((v) => ({ value: v, label: 'n' + v })) }}
              y={{ label: 'Error' }}
              series={[{ label: 'Model', values: [1, 2, 3, 4] }]}
            />,
          );
        }
        function PlainTicks() {
          return box(
            <UPlotChart height={360} x={{ values: [0, 1, 2], label: 'Protocol', ticks: [] }} y={{ label: 'Error' }} series={[{ label: 'Model', values: [1, 2, 3] }]} />,
          );
        }
        function OneTick() {
          return box(
            <UPlotChart height={360} x={{ values: [0, 1, 2], label: 'Protocol', ticks: [protocol[1]] }} y={{ label: 'Error' }} series={[{ label: 'Model', values: [1, 2, 3] }]} />,
          );
        }
        const lines = [
          { label: 'Alpha', values: [1, 2, 3, 4, 5] },
          { label: 'Beta', values: [5, 4, 3, 2, 1] },
          { label: 'Gamma', values: [3, 3, 3, 3, 3] },
        ];
        function Solo() {
          return box(<UPlotChart height={360} solo x={{ values: [1, 2, 3, 4, 5], label: 'Day' }} y={{ label: 'People', range: [0, 6] }} series={lines} />);
        }
        function SoloDrag() {
          const [v, setV] = useState(4);
          return box(
            <UPlotChart
              height={360}
              solo
              x={{ values: [1, 2, 3, 4, 5], label: 'Day' }}
              y={{ label: 'People', range: [0, 6] }}
              series={lines}
              yMarks={[{ y: v, label: 'limit', drag: { min: 1, max: 6, step: 0.5 } }]}
              onYMarkChange={(_i, y) => setV(y)}
            />,
          );
        }
        function SoloOverlay() {
          return box(
            <UPlotChart
              height={360}
              solo
              x={{ values: [1, 2, 3, 4, 5], label: 'Day' }}
              y={{ label: 'People', range: [0, 6] }}
              series={[lines[0], { label: 'Cases', values: [2, 3], x: [1.5, 3.5], mode: 'points', color: '--color-bad' }]}
            />,
          );
        }
        function SoloOne() {
          return box(<UPlotChart height={360} solo x={{ values: [1, 2, 3], label: 'Day' }} y={{ label: 'People' }} series={[lines[0]]} />);
        }
        function Plain() {
          return box(<UPlotChart height={360} x={{ values: [1, 2, 3, 4, 5], label: 'Day' }} y={{ label: 'People', range: [0, 6] }} series={lines} />);
        }
        function Dots() {
          const on = q.get('dots') !== '0';
          return box(<UPlotChart height={360} x={{ values: [1, 2, 3, 4, 5], label: 'Day', range: [0, 6] }} y={{ label: 'People', range: [0, 10] }} series={[{ label: 'Sparse', values: [4, null, 7, null, 9], dots: on, width: 2 }]} />);
        }
        function DotsLong() {
          const on = q.get('dots') !== '0';
          const xs = Array.from({ length: 60 }, (_, i) => i);
          return box(<UPlotChart height={360} x={{ values: xs, label: 'Day' }} y={{ label: 'People', range: [0, 100] }} series={[{ label: 'Long', values: xs.map((i) => 50 + (i % 7)), dots: on }]} />);
        }
        function Unlabelled() {
          const named = q.get('label') === '1';
          return box(
            <UPlotChart
              height={360}
              x={{ values: [1, 2, 3, 4, 5], label: 'Day' }}
              y={{ label: 'People', range: [-2, 6] }}
              series={[{ label: 'Alpha', values: [1, 2, 3, 4, 5] }]}
              yMarks={named ? [{ y: 0.7, label: 'zero line' }, { y: 3, label: 'level', tone: 'good' }] : [{ y: 0.7 }, { y: 3, label: 'level', tone: 'good' }]}
            />,
          );
        }
        const forms: Record<string, () => React.ReactNode> = { ticks: Ticks, logticks: LogTicks, plainticks: PlainTicks, oneTick: OneTick, solo: Solo, sdrag: SoloDrag, soverlay: SoloOverlay, sone: SoloOne, plain: Plain, dots: Dots, dotslong: DotsLong, unlabelled: Unlabelled };
        const App = forms[form] ?? Ticks;
        createRoot(document.getElementById('root')).render(<App />);
      `,
      resolveDir: root,
      sourcefile: 'categorical.tsx',
      loader: 'tsx',
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const chartCss = await readFile(new URL('../chart.css', import.meta.url), 'utf8');
  const uplotCss = await readFile(new URL('../node_modules/uplot/dist/uPlot.min.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    if (req.url === '/categorical.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(script.outputFiles[0].text);
    } else if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(uplotCss + css + chartCss);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><html lang="en" data-theme="light"><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/categorical.js"></script></body></html>`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

/** Every text the page draws on a canvas, in order, so a test reads what the chart wrote on its axes and over its plot. */
const SPY = `
  window.__texts = [];
  const fill = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y) { window.__texts.push(String(t)); return fill.apply(this, arguments); };
`;

async function open(form: string, extra = ''): Promise<{ page: Page; errors: string[] }> {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(SPY);
  await page.goto(`${address}/?form=${form}${extra}`);
  await page.waitForSelector('.caos-chart[data-drawn="1"] .u-over', { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('.caos-chart canvas') !== null);
  return { page, errors };
}

/** A hash of the chart's pixels (a sum weighted by position), to tell two drawings apart. */
const HASH = `() => {
  const c = document.querySelector('.caos-chart canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 13) % 1000000007;
  return h;
}`;
const hash = (page: Page) => page.evaluate(`(${HASH})()`) as Promise<number>;

/** The columns of the plot that hold pixels of a token's colour (alpha above 80), grouped into runs: one run per dot or
 * stroke. The page script is a string: a function handed to the page would carry the runner's helpers with it. */
const RUNS = `(token) => {
  const probe = document.createElement('i');
  probe.style.color = 'var(' + token + ')';
  document.body.appendChild(probe);
  const want = (getComputedStyle(probe).color.match(/\\d+/g) || []).slice(0, 3).map(Number);
  probe.remove();
  const c = document.querySelector('.caos-chart canvas');
  const over = document.querySelector('.u-over').getBoundingClientRect();
  const box = c.getBoundingClientRect();
  const k = c.width / box.width;
  const x0 = Math.round((over.left - box.left) * k);
  const w = Math.round(over.width * k);
  const y0 = Math.round((over.top - box.top) * k);
  const h = Math.round(over.height * k);
  const data = c.getContext('2d').getImageData(x0, y0, w, h).data;
  const cols = [];
  for (let x = 0; x < w; x++) {
    let hit = false;
    for (let y = 0; y < h && !hit; y++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 80 && Math.abs(data[i] - want[0]) < 20 && Math.abs(data[i + 1] - want[1]) < 20 && Math.abs(data[i + 2] - want[2]) < 20) hit = true;
    }
    cols.push(hit);
  }
  const runs = []; let start = -1;
  for (let x = 0; x <= w; x++) {
    if (x < w && cols[x]) { if (start < 0) start = x; } else if (start >= 0) { runs.push([start / k, (x - 1) / k]); start = -1; }
  }
  return runs;
}`;
const runs = (page: Page, token: string) => page.evaluate(`(${RUNS})(${JSON.stringify(token)})`) as Promise<[number, number][]>;

// ---- named ticks -----------------------------------------------------------------------------------------------------

test('named ticks: the x axis shows exactly the three names, none of 0, 1, 2 and no other tick', async () => {
  const { page, errors } = await open('ticks');
  try {
    const host = page.locator('.caos-chart');
    assert.equal(await host.getAttribute('data-x-tick-labels'), 'random|deduplicated|site held out');
    assert.equal(await host.getAttribute('data-ticks-x'), '3');
    assert.equal(await host.getAttribute('data-ticks-repeat'), '0', 'the labels never repeat');
    const texts = (await page.evaluate('window.__texts')) as string[];
    for (const name of ['random', 'deduplicated', 'site held out']) assert.ok(texts.includes(name), `${name} is drawn: ${[...new Set(texts)]}`);
    // the x axis draws no number: the y axis ticks at 10, 20, 30 and 40, so a bare 0, 1 or 2 would be an x tick
    for (const bare of ['0', '1', '2', '0.5', '1.5', '-0.5', '2.5']) assert.ok(!texts.includes(bare), `no x tick reads ${bare}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('named ticks: the labels follow the page language, the readout names the x by its tick and not by a number', async () => {
  const { page, errors } = await open('ticks', '&lang=es');
  try {
    const host = page.locator('.caos-chart');
    assert.equal(await host.getAttribute('data-x-tick-labels'), 'aleatorio|deduplicado|sitio retenido');
    const over = (await page.locator('.u-over').boundingBox())!;
    // x runs -0.5 to 2.5 (the given range): the tick at 1 is at half the width
    await page.mouse.move(over.x + over.width / 2, over.y + over.height / 2);
    await page.waitForFunction(() => /deduplicado/.test(document.querySelector('.caos-chart-readout')!.textContent ?? ''));
    const read = (await page.locator('.caos-chart-readout').textContent())!;
    assert.match(read, /^Protocolo deduplicado/, read);
    assert.ok(!/Protocolo 1\b/.test(read), `no number where a tick names the x: ${read}`);
    await page.evaluate(`window.setLang('en')`);
    await page.waitForFunction(() => document.querySelector('.caos-chart')!.getAttribute('data-x-tick-labels') === 'random|deduplicated|site held out');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('x range: the end ticks sit inside the plot, a half step from its edges, so their names are not cut', async () => {
  const { page, errors } = await open('ticks');
  try {
    const over = (await page.locator('.u-over').boundingBox())!;
    // the range -0.5 to 2.5 puts tick 0 at a sixth of the width and tick 2 at five sixths
    const model = await runs(page, '--color-accent');
    assert.ok(model.length > 0);
    const first = model[0][0];
    const last = model[model.length - 1][1];
    assert.ok(first > over.width * 0.1, `the first point sits well inside the left edge: ${first} of ${over.width}`);
    assert.ok(last < over.width * 0.9, `the last point sits well inside the right edge: ${last} of ${over.width}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('named ticks on a log x axis: only the ticks above 0 inside the range are drawn, in order', async () => {
  const { page, errors } = await open('logticks');
  try {
    // the data run from 1 to 1000; the ticks 0.001 and 1e6 are outside the range
    const labels = (await page.locator('.caos-chart').getAttribute('data-x-tick-labels'))!.split('|');
    assert.deepEqual(labels, ['n1', 'n10', 'n100'], `${labels}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('an empty tick list leaves uPlot its own ticks, a list of one draws that one', async () => {
  const plain = await open('plainticks');
  try {
    assert.equal(await plain.page.locator('.caos-chart').getAttribute('data-x-tick-labels'), null);
    assert.ok(Number(await plain.page.locator('.caos-chart').getAttribute('data-ticks-x')) >= 2);
    assert.deepEqual(plain.errors, []);
  } finally {
    await plain.page.close();
  }
  const one = await open('oneTick');
  try {
    assert.equal(await one.page.locator('.caos-chart').getAttribute('data-x-tick-labels'), 'deduplicated');
    assert.equal(await one.page.locator('.caos-chart').getAttribute('data-ticks-x'), '1');
    assert.deepEqual(one.errors, []);
  } finally {
    await one.page.close();
  }
});

// ---- the solo key ----------------------------------------------------------------------------------------------------

test('solo: Tab reaches the first key button, Enter solos it, Space releases it, the drawn pixels change and come back', async () => {
  const { page, errors } = await open('solo');
  try {
    const buttons = page.locator('.caos-chart-key button');
    assert.equal(await buttons.count(), 3);
    for (let i = 0; i < 3; i++) assert.equal(await buttons.nth(i).getAttribute('aria-pressed'), 'false');
    const rest = await hash(page);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(`document.activeElement.textContent`), 'Alpha', 'Tab lands on the first entry of the key');
    await page.keyboard.press('Enter');
    assert.equal(await buttons.nth(0).getAttribute('aria-pressed'), 'true');
    assert.equal(await buttons.nth(1).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('.caos-chart').getAttribute('data-solo'), '0');
    const soloed = await hash(page);
    assert.notEqual(soloed, rest, 'the others are dimmed, so the pixels change');
    await page.keyboard.press('Space');
    assert.equal(await buttons.nth(0).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('.caos-chart').getAttribute('data-solo'), null);
    assert.equal(await hash(page), rest, 'released: the chart is drawn as at rest');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('solo: a click solos, a second click releases, a click on another entry moves the solo; the soloed line stays as drawn', async () => {
  const { page, errors } = await open('solo');
  try {
    const buttons = page.locator('.caos-chart-key button');
    const accent = await runs(page, '--color-accent');
    const magenta = await runs(page, '--color-magenta');
    assert.ok(accent.length > 0 && magenta.length > 0);
    await buttons.nth(1).click();
    assert.equal(await buttons.nth(1).getAttribute('aria-pressed'), 'true');
    assert.equal((await runs(page, '--color-accent')).length, 0, 'Alpha is dimmed to 0.12, no pixel of its full colour is left');
    assert.ok((await runs(page, '--color-magenta')).length > 0, 'Beta stays as drawn');
    await buttons.nth(2).click();
    assert.equal(await buttons.nth(1).getAttribute('aria-pressed'), 'false');
    assert.equal(await buttons.nth(2).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.caos-chart').getAttribute('data-solo'), '2');
    assert.equal((await runs(page, '--color-magenta')).length, 0, 'Beta is dimmed in its turn');
    await buttons.nth(2).click();
    assert.equal(await buttons.nth(2).getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await runs(page, '--color-accent'), accent, 'released: Alpha is as at rest');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('solo: a press redraws the chart, never rebuilds it: the canvas, the cursor readout and a dragged line survive', async () => {
  const { page, errors } = await open('sdrag');
  try {
    await page.evaluate(`window.__canvas = document.querySelector('.caos-chart canvas'); window.__handle = document.querySelector('[data-y-handle]');`);
    // the reader holds a line at 3 with the keyboard, and the pointer rests on the chart
    const handle = page.locator('[data-y-handle="0"]');
    await handle.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    const held = await handle.getAttribute('aria-valuenow');
    assert.equal(held, '3');
    const over = (await page.locator('.u-over').boundingBox())!;
    await page.mouse.move(over.x + over.width / 2, over.y + over.height / 4);
    await page.waitForFunction(() => /Alpha/.test(document.querySelector('.caos-chart-readout')!.textContent ?? ''));
    const readout = await page.locator('.caos-chart-readout').textContent();
    const before = await hash(page);
    await page.locator('.caos-chart-key button').nth(1).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.caos-chart-key button').nth(1).getAttribute('aria-pressed'), 'true');
    assert.notEqual(await hash(page), before);
    assert.equal(await page.evaluate(`window.__canvas === document.querySelector('.caos-chart canvas')`), true, 'the same canvas: not rebuilt');
    assert.equal(await page.evaluate(`window.__handle === document.querySelector('[data-y-handle]')`), true, 'the same handle: the drag state survives');
    assert.equal(await handle.getAttribute('aria-valuenow'), held);
    assert.equal(await page.locator('.caos-chart-readout').textContent(), readout, 'the cursor readout survives');
    // the line still moves, with the key soloed
    await handle.focus();
    await page.keyboard.press('ArrowUp');
    assert.equal(await handle.getAttribute('aria-valuenow'), '3.5');
    assert.equal(await page.locator('.caos-chart-key button').nth(1).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('solo: with an overlay the points are dimmed by another line and the line by the overlay; one series still toggles', async () => {
  const { page, errors } = await open('soverlay');
  try {
    const buttons = page.locator('.caos-chart-key button');
    assert.equal(await buttons.count(), 2);
    assert.ok((await runs(page, '--color-bad')).length > 0, 'the cases are drawn');
    await buttons.nth(0).click();
    assert.equal((await runs(page, '--color-bad')).length, 0, 'the cases are dimmed when the line is soloed');
    await buttons.nth(1).click();
    assert.equal((await runs(page, '--color-accent')).length, 0, 'the line is dimmed when the cases are soloed');
    assert.ok((await runs(page, '--color-bad')).length > 0, 'the cases stay as drawn');
    assert.equal(await page.locator('.caos-chart').getAttribute('data-overlay-drawn'), '2');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
  const one = await open('sone');
  try {
    const b = one.page.locator('.caos-chart-key button');
    assert.equal(await b.count(), 1);
    const rest = await hash(one.page);
    await b.click();
    assert.equal(await b.getAttribute('aria-pressed'), 'true');
    assert.equal(await hash(one.page), rest, 'one series: nothing to dim');
    await b.click();
    assert.equal(await b.getAttribute('aria-pressed'), 'false');
    assert.deepEqual(one.errors, []);
  } finally {
    await one.page.close();
  }
});

test('solo: the solo survives a theme and a language change, and the key reads in the page language', async () => {
  const { page, errors } = await open('ticks', '');
  await page.close();
  const solo = await open('solo');
  try {
    const buttons = solo.page.locator('.caos-chart-key button');
    await buttons.nth(2).click();
    await solo.page.evaluate(`window.setTheme('dark')`);
    await solo.page.waitForSelector('html[data-theme="dark"]');
    await solo.page.evaluate(`window.setLang('es')`);
    await solo.page.waitForFunction(() => document.querySelector('.caos-chart-legend')!.getAttribute('aria-label') === 'Series del gráfico');
    assert.equal(await buttons.nth(2).getAttribute('aria-pressed'), 'true', 'still soloed after both changes');
    assert.equal(await solo.page.locator('.caos-chart').getAttribute('data-solo'), '2');
    assert.ok(errors.length === 0 && solo.errors.length === 0, `${errors} ${solo.errors}`);
  } finally {
    await solo.page.close();
  }
});

test('a chart without the solo option has a key that is not interactive, as in 0.17.0', async () => {
  const { page, errors } = await open('plain');
  try {
    assert.equal(await page.locator('.caos-chart-key').count(), 3);
    assert.equal(await page.locator('.caos-chart-key button').count(), 0);
    assert.equal(await page.locator('.caos-chart').getAttribute('data-solo'), null);
    assert.equal(await page.locator('.caos-chart').getAttribute('data-x-tick-labels'), null);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

// ---- dots ----------------------------------------------------------------------------------------------------------

test('dots: a short line with dots draws one at each value and none at a null; without the option none is drawn', async () => {
  const on = await open('dots');
  try {
    // the values 4, null, 7, null, 9: three dots, and a null between each, so no line joins them
    const dots = await runs(on.page, '--color-accent');
    assert.equal(dots.length, 3, `three dots, one per value: ${JSON.stringify(dots)}`);
    for (const [a, b] of dots) assert.ok(b - a >= 2 && b - a <= 10, `a dot is about 5 px wide: ${b - a}`);
    assert.deepEqual(on.errors, []);
  } finally {
    await on.page.close();
  }
  const off = await open('dots', '&dots=0');
  try {
    assert.equal((await runs(off.page, '--color-accent')).length, 0, 'off by default: an isolated value draws nothing');
  } finally {
    await off.page.close();
  }
});

test('dots: a line of 40 values or more is drawn with dots when the option is given, and without them when it is not', async () => {
  const on = await open('dotslong');
  const off = await open('dotslong', '&dots=0');
  try {
    assert.notEqual(await hash(on.page), await hash(off.page), 'the dots change the drawing');
    assert.deepEqual(on.errors, []);
  } finally {
    await on.page.close();
    await off.page.close();
  }
});

// ---- an unlabelled reference line ------------------------------------------------------------------------------------

test('an unlabelled reference line is drawn in the warn colour and writes no text; the labelled lines keep their labels', async () => {
  const bare = await open('unlabelled');
  const named = await open('unlabelled', '&label=1');
  try {
    const bareTexts = (await bare.page.evaluate('window.__texts')) as string[];
    const namedTexts = (await named.page.evaluate('window.__texts')) as string[];
    assert.ok(bareTexts.includes('level'), 'the labelled line keeps its label');
    assert.ok(!bareTexts.includes('zero line'));
    assert.ok(namedTexts.includes('zero line'));
    // the named chart wrote the label and nothing else more: the unlabelled line writes no text at all
    const extra = [...new Set(namedTexts)].filter((t) => !new Set(bareTexts).has(t));
    assert.deepEqual(extra, ['zero line']);
    assert.equal(await bare.page.locator('.caos-chart').getAttribute('data-y-marks'), '2');
    // the line is still there (off the grid, whose lines would blend with it): warn pixels across the plot
    const rows = (await bare.page.evaluate(`(${RUNS})('--color-warn')`)) as [number, number][];
    assert.ok(rows.length > 0, 'the unlabelled line is drawn');
    assert.deepEqual(bare.errors, []);
    assert.deepEqual(named.errors, []);
  } finally {
    await bare.page.close();
    await named.page.close();
  }
});
