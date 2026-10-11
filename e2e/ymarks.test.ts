import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser } from '@playwright/test';

// Reference lines with a tone (CAOS_APP_SHELL#94): a `bad` line above the data and a `neutral` one below it, on a line
// chart that gives no y range. Both must be drawn (the range takes them in), each in its token's colour, in both
// themes; a `warn` line (no tone) keeps today's look.
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
            <div style={{ width: 520, height: 360 }}>
              <UPlotChart
                height={320}
                x={{ values: [0, 1, 2, 3, 4], label: 'Month' }}
                y={{ label: 'Rate', format: { decimals: 0 } }}
                series={[{ label: 'Observed', values: [10, 12, 15, 13, 18] }]}
                yMarks={[
                  { y: 30, label: 'red threshold', tone: 'bad' },
                  { y: 2, label: 'no bias', tone: 'neutral' },
                  { y: 22, label: 'amber threshold' },
                ]}
              />
            </div>
          );
        }
        createRoot(document.getElementById('root')).render(<App />);
      `,
      resolveDir: root,
      sourcefile: 'ymarks.tsx',
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
    if (req.url === '/ymarks.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(script.outputFiles[0].text);
    } else if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(uplotCss + css + chartCss);
    } else {
      const theme = req.url?.includes('dark') ? 'dark' : 'light';
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><html data-theme="${theme}"><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/ymarks.js"></script></body></html>`);
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

/** The rows of the plot area whose pixels, over at least a fifth of the width, are the given colour (a dotted line
 * covers a third of its row); the canvas's pixels are read unpremultiplied, so the blur of a line between two rows keeps
 * its colour. The page script is a string: a function handed to the page would carry the runner's helpers with it. */
const ROWS_OF = `(token) => {
  const probe = document.createElement('i');
  probe.style.color = 'var(' + token + ')';
  document.body.appendChild(probe);
  const want = (getComputedStyle(probe).color.match(/\\d+/g) || []).slice(0, 3).map(Number);
  probe.remove();
  const c = document.querySelector('.caos-chart canvas');
  const over = document.querySelector('.u-over').getBoundingClientRect();
  const box = c.getBoundingClientRect();
  const k = c.width / box.width;
  const ctx = c.getContext('2d');
  const x0 = Math.round((over.left - box.left) * k);
  const w = Math.round(over.width * k);
  const y0 = Math.round((over.top - box.top) * k);
  const h = Math.round(over.height * k);
  const data = ctx.getImageData(x0, y0 - 4, w, h + 8).data;
  const rows = []; let best = 0;
  for (let y = 0; y < h + 8; y++) {
    let hits = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 80 && Math.abs(data[i] - want[0]) < 14 && Math.abs(data[i + 1] - want[1]) < 14 && Math.abs(data[i + 2] - want[2]) < 14) hits++;
    }
    best = Math.max(best, hits); if (hits > w / 5) rows.push(Math.round(((y - 4) / k) * 10) / 10);
  }
  return { rows, height: over.height, best, w, want };
}`;

for (const theme of ['light', 'dark'] as const) {
  test(`a bad line above the data and a neutral line below it are drawn in their tone (${theme})`, async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(`${address}/${theme}`);
      await page.waitForSelector('.caos-chart[data-drawn="1"] .u-over', { timeout: 10000 });
      const read = async (token: string) => (await page.evaluate(`(${ROWS_OF})(${JSON.stringify(token)})`)) as { rows: number[]; height: number };
      const bad = await read('--color-bad');
      const neutral = await read('--color-fg-subtle');
      const warn = await read('--color-warn');
      assert.ok(bad.rows.length > 0, 'the red threshold above the data is drawn in --color-bad ' + JSON.stringify(bad));
      assert.ok(neutral.rows.length > 0, 'the neutral level below the data is drawn in --color-fg-subtle');
      assert.ok(warn.rows.length > 0, 'a line without a tone keeps --color-warn');
      // above the data's 18 sits the line at 30, and below its 10 the line at 2: the range took both in
      const top = Math.min(...bad.rows);
      const bottom = Math.max(...neutral.rows);
      assert.ok(top < bad.height * 0.3, `the red line is near the top of the plot (row ${top} of ${bad.height})`);
      assert.ok(bottom > neutral.height * 0.7, `the neutral line is near the bottom of the plot (row ${bottom} of ${neutral.height})`);
      assert.ok(Math.min(...warn.rows) > top, 'the line at 22 sits below the one at 30');
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  });
}
