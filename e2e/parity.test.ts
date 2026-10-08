import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser } from '@playwright/test';

// A parity plot as CAOS_Fragmenta draws one (CAOS_APP_SHELL#84): points in two series (the blasts, and the selected
// one, larger), a horizontal reference line (the null model), picking on click. Two points sit 0.02 apart in x and far
// apart in y: the pointer beside the upper one is nearer the lower one in x, and the chart must name the upper one.
let browser: Browser, server: Server, address: string;
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const script = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { UPlotChart } from './src/chart';
        function App() {
          return (
            <div style={{ width: 420, height: 460 }}>
              <UPlotChart
                parity
                height={400}
                x={{ values: [1, 1.02, 3], label: 'Measured', unit: 'cm', format: { decimals: 1 } }}
                y={{ label: 'Predicted', unit: 'cm', format: { decimals: 1 } }}
                series={[
                  { label: 'Blasts', values: [1, 2.8, null], mode: 'points' },
                  { label: 'Selected blast', values: [null, null, 3], mode: 'points', size: 15, color: '--color-warn' },
                ]}
                yMarks={[{ y: 2, label: 'null model' }]}
                onPick={(i) => { (window as unknown as { picked: number[] }).picked.push(i); }}
              />
            </div>
          );
        }
        (window as unknown as { picked: number[] }).picked = [];
        createRoot(document.getElementById('root')).render(<App />);
      `,
      resolveDir: root,
      sourcefile: 'parity.tsx',
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
  // uPlot's own stylesheet places the canvas under its event layer; a product's bundle carries it
  const uplotCss = await readFile(new URL('../node_modules/uplot/dist/uPlot.min.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    if (req.url === '/parity.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(script.outputFiles[0].text);
    } else if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(uplotCss + css + chartCss);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html data-theme="light"><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/parity.js"></script></body></html>');
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

test('a parity plot names and picks the point nearest the pointer in the plane, and draws its reference line', async () => {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(address);
    await page.waitForSelector('.caos-chart[data-drawn="1"] .u-over', { timeout: 10000 });
    const host = page.locator('.caos-chart');
    assert.equal(await host.getAttribute('data-y-marks'), '1');
    const over = (await page.locator('.u-over').boundingBox())!;
    // the parity range of 1 to 3, padded by 5% of the span: 0.9 to 3.1 on both axes
    const at = (v: number) => (v - 0.9) / 2.2;
    const upper = { x: over.x + at(1.02) * over.width, y: over.y + (1 - at(2.8)) * over.height };
    const lower = { x: over.x + at(1) * over.width };
    // two pixels left of the upper point: nearer the lower point in x, nearer the upper one in the plane
    const pointer = { x: upper.x - 2, y: upper.y };
    assert.ok(Math.abs(pointer.x - lower.x) < Math.abs(pointer.x - upper.x), 'the setup puts the pointer nearer the lower point in x');
    await page.mouse.move(pointer.x, pointer.y);
    const readout = page.locator('.caos-chart-readout');
    await page.waitForFunction(() => document.querySelector('.caos-chart-readout')?.textContent?.includes('2.8'), null, { timeout: 5000 });
    const text = await readout.innerText();
    assert.match(text, /Measured 1\.0 cm · Blasts 2\.8 cm$/, `the readout names the upper point, and only the series that has it: ${text}`);
    await page.mouse.click(pointer.x, pointer.y);
    assert.deepEqual(await page.evaluate(() => (window as unknown as { picked: number[] }).picked), [1]);
    // the reference line is drawn: the canvas carries the warn colour along y = 2, inside the plot
    const canvas = (await page.locator('.caos-chart canvas').boundingBox())!;
    const lineY = over.y + (1 - at(2)) * over.height;
    const shot = await page.screenshot({ clip: { x: over.x + over.width * 0.3, y: lineY - 1, width: over.width * 0.2, height: 3 } });
    assert.ok(shot.length > 0 && canvas.width > 0);
    const warnOnLine = await page.evaluate(
      ({ x0, x1, y }) => {
        const c = document.querySelector('.caos-chart canvas') as HTMLCanvasElement;
        const r = c.getBoundingClientRect();
        const k = c.width / r.width;
        const ctx = c.getContext('2d')!;
        let hits = 0;
        for (let x = x0; x < x1; x += 2) {
          for (let dy = -1; dy <= 1; dy++) {
            const [red, green, blue, alpha] = ctx.getImageData(Math.round((x - r.left) * k), Math.round((y + dy - r.top) * k), 1, 1).data;
            // the warn tone (#946300 in the light theme): red well above blue
            if (alpha > 0 && red > blue + 60 && red > 100) hits++;
          }
        }
        return hits;
      },
      { x0: over.x + over.width * 0.1, x1: over.x + over.width * 0.6, y: lineY },
    );
    assert.ok(warnOnLine > 10, `the null-model line is drawn along y = 2 (${warnOnLine} warn pixels)`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
