import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser, type Page } from '@playwright/test';

// Shell 0.17.0 S1 (CAOS_APP_SHELL#65, BL-029): the three charts CAOS_Fragmenta draws with its own wrapper. A size
// distribution on a log x axis with a draggable percentile line and measured points on their own sizes; a parity plot;
// and a log-x line. The page reads `?form=` to draw one of them and `?lang=` for the interface language.
let browser: Browser, server: Server, address: string;
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const script = await build({
    stdin: {
      contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { UPlotChart } from './src/chart';
        const w = window as unknown as { changes: [number, number][] };
        w.changes = [];
        const form = new URLSearchParams(location.search).get('form') ?? 'distribution';
        const sizes = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
        const passing = [2, 6, 14, 27, 44, 68, 85, 94, 99, 100];
        function Distribution() {
          const [target, setTarget] = useState(60);
          return (
            <div style={{ width: 640, height: 420 }}>
              <UPlotChart
                height={360}
                x={{ values: sizes, label: 'Fragment size', unit: 'm', log: true }}
                y={{ label: 'Passing', unit: '%', range: [0, 100], format: { decimals: 0 } }}
                series={[
                  { label: 'Model', values: passing },
                  { label: 'Measured', values: [10, 30, 52, 90], x: [0.015, 0.07, 0.3, 3], mode: 'points', color: '--color-bad' },
                ]}
                marks={[{ x: 0.6, label: 'target 60 cm' }, { x: 1, label: 'limit 100 cm' }]}
                yMarks={[
                  { y: target, label: 'P' + Math.round(target), tone: 'neutral', drag: { min: 5, max: 95, step: 1 } },
                  { y: 80, label: 'fixed 80', tone: 'good' },
                ]}
                onYMarkChange={(i, y) => { w.changes.push([i, y]); setTarget(y); }}
              />
            </div>
          );
        }
        function Parity() {
          return (
            <div style={{ width: 520, height: 520 }}>
              <UPlotChart
                parity
                height={460}
                x={{ values: [3, 1, 2, 4], label: 'Observed', unit: 'cm', format: { decimals: 1 } }}
                y={{ label: 'Predicted', unit: 'cm', format: { decimals: 1 } }}
                series={[{ label: 'Blasts', values: [3.2, 0.8, 2.1, 4.4], mode: 'points' }]}
              />
            </div>
          );
        }
        function LogLine() {
          return (
            <div style={{ width: 600, height: 380 }}>
              <UPlotChart
                height={320}
                x={{ values: [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 800], label: 'Day', log: true }}
                y={{ label: 'People', format: { decimals: 0 } }}
                series={[{ label: 'Recovered', values: [1, 2, 4, 9, 20, 41, 80, 120, 150, 170] }]}
              />
            </div>
          );
        }
        const App = form === 'parity' ? Parity : form === 'logline' ? LogLine : Distribution;
        createRoot(document.getElementById('root')).render(<App />);
      `,
      resolveDir: root,
      sourcefile: 'logparity.tsx',
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
    if (req.url === '/logparity.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(script.outputFiles[0].text);
    } else if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(uplotCss + css + chartCss);
    } else {
      const lang = req.url?.includes('lang=es') ? 'es' : 'en';
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><html lang="${lang}" data-theme="light"><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/logparity.js"></script></body></html>`);
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

async function open(form: string, extra = ''): Promise<{ page: Page; errors: string[] }> {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${address}/?form=${form}${extra}`);
  await page.waitForSelector('.caos-chart[data-drawn="1"] .u-over', { timeout: 10000 });
  return { page, errors };
}

test('a log x axis labels its decades and nothing else, no decade in range missing', async () => {
  const { page, errors } = await open('logline');
  try {
    const host = page.locator('.caos-chart');
    // x runs 0.5 to 800: the decades inside are 1, 10 and 100
    const labels = (await host.getAttribute('data-log-labels'))!.split('|');
    assert.deepEqual(labels, ['1', '10', '100'], `the decades of 0.5 to 800: ${labels}`);
    assert.equal(await host.getAttribute('data-ticks-x'), '3');
    assert.equal(await host.getAttribute('data-ticks-repeat'), '0');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('a parity plot is a square box with the same ticks on both axes', async () => {
  const { page, errors } = await open('parity');
  try {
    const box = (await page.locator('.caos-chart-plot .uplot').boundingBox())!;
    assert.ok(Math.abs(box.width - box.height) < 1, `square: ${box.width} by ${box.height}`);
    const host = page.locator('.caos-chart');
    assert.equal(await host.getAttribute('data-ticks-x'), await host.getAttribute('data-ticks-y'));
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('measured points on their own x are drawn inside the plot, the axis taking in the ones past the curve', async () => {
  const { page, errors } = await open('distribution');
  try {
    const host = page.locator('.caos-chart');
    assert.equal(await host.getAttribute('data-overlay'), '1');
    // four measured points, on sizes the curve does not have (0.015 sits left of its first size, 0.01)
    assert.equal(await host.getAttribute('data-overlay-drawn'), '4');
    assert.equal(await host.getAttribute('data-series'), '2');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('a draggable horizontal marker follows the pointer within its range and reports each value', async () => {
  const { page, errors } = await open('distribution');
  try {
    const handle = page.locator('[role="slider"]');
    assert.equal(await handle.count(), 1, 'one draggable marker, one handle');
    assert.equal(await handle.getAttribute('aria-valuemin'), '5');
    assert.equal(await handle.getAttribute('aria-valuemax'), '95');
    assert.equal(await handle.getAttribute('aria-valuenow'), '60');
    assert.equal(await handle.getAttribute('aria-orientation'), 'vertical');
    assert.ok((await handle.getAttribute('aria-label'))!.includes('P60'));
    const over = (await page.locator('.u-over').boundingBox())!;
    const hb = (await handle.boundingBox())!;
    const cx = hb.x + hb.width / 2;
    const cy = hb.y + hb.height / 2;
    // the y scale is 0 to 100 over the plot height: 10 points are a tenth of it
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - over.height * 0.1, { steps: 6 });
    await page.mouse.up();
    const changes = await page.evaluate(() => (window as unknown as { changes: [number, number][] }).changes);
    assert.ok(changes.length >= 2, `a value per move (${changes.length})`);
    assert.ok(changes.every(([i]) => i === 0), 'the index is the marker in yMarks');
    const last = changes[changes.length - 1][1];
    assert.ok(Math.abs(last - 70) <= 1.5, `dragged up a tenth: ${last}`);
    assert.equal(Number(await handle.getAttribute('aria-valuenow')), last);
    // dragged far past the top it stops at the range's end
    const hb2 = (await handle.boundingBox())!;
    await page.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb2.x + hb2.width / 2, over.y - 120, { steps: 6 });
    await page.mouse.up();
    assert.equal(Number(await handle.getAttribute('aria-valuenow')), 95, 'constrained to the range');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('a draggable horizontal marker moves with the keyboard: arrows, Page keys, Home and End', async () => {
  const { page, errors } = await open('distribution');
  try {
    const handle = page.locator('[role="slider"]');
    await handle.focus();
    assert.equal(await handle.evaluate((el) => document.activeElement === el), true, 'the handle takes focus');
    const now = async () => Number(await handle.getAttribute('aria-valuenow'));
    await page.keyboard.press('ArrowUp');
    assert.equal(await now(), 61);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    assert.equal(await now(), 59);
    await page.keyboard.press('PageUp');
    assert.equal(await now(), 69);
    await page.keyboard.press('End');
    assert.equal(await now(), 95);
    await page.keyboard.press('ArrowUp');
    assert.equal(await now(), 95, 'stops at the end');
    await page.keyboard.press('Home');
    assert.equal(await now(), 5);
    const changes = await page.evaluate(() => (window as unknown as { changes: [number, number][] }).changes);
    assert.deepEqual(changes[0], [0, 61]);
    assert.deepEqual(changes[changes.length - 1], [0, 5]);
    // the handle stays where the line is: the line moved to 5 and the handle with it
    const over = (await page.locator('.u-over').boundingBox())!;
    const hb = (await handle.boundingBox())!;
    assert.ok(Math.abs(hb.y + hb.height / 2 - (over.y + over.height * 0.95)) < 4, 'the handle sits on the line');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('only a draggable line has a handle, and the host declares how many', async () => {
  const { page } = await open('distribution');
  try {
    assert.equal(await page.locator('[role="slider"]').count(), 1);
    assert.equal(await page.locator('.caos-chart').getAttribute('data-y-drag'), '1');
    assert.equal(await page.locator('.caos-chart').getAttribute('data-y-marks'), '2');
  } finally {
    await page.close();
  }
});
