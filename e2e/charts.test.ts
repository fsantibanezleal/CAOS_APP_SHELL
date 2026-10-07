import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser } from '@playwright/test';

// A real bundled consumer: uPlot builds its axes only in a browser. Known shell defect 31: a log axis reaching below
// uPlot's tick table (about 1e-22) threw "Invalid array length" and the chart was never drawn.
let browser: Browser, server: Server, address: string;
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const script = await build({
    stdin: { contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {UPlotChart} from './src/chart';
      const q = new URLSearchParams(location.search);
      const lo = Number(q.get('lo'));
      function App(){return q.get('axis') === 'x'
        ? <div style={{width:640,height:360}}><UPlotChart height={320}
            x={{values:[lo,1e-5,0.01,0.5],label:'p-value',log:true}}
            y={{label:'Share of tests'}}
            series={[{label:'Cumulative share',values:[0.1,0.4,0.7,1]}]}/></div>
        : <div style={{width:640,height:360}}><UPlotChart height={320}
            x={{values:[2000,2001,2002,2003],label:'Year',format:{decimals:0,grouping:false}}}
            y={{label:'p-value',log:true}}
            series={[{label:'Reference test',values:[0.5,0.01,lo,1e-5]},{label:'Level',values:[0.05,0.05,0.05,0.05]}]}/></div>}
      createRoot(document.getElementById('root')).render(<App/>);
    `, resolveDir: root, sourcefile: 'consumer.tsx', loader: 'tsx' },
    bundle: true, format: 'esm', platform: 'browser', write: false,
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const chartCss = await readFile(new URL('../chart.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    if (req.url === '/consumer.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script.outputFiles[0].text); }
    else if (req.url === '/styles.css') { res.setHeader('Content-Type', 'text/css'); res.end(css + chartCss); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html data-theme="light"><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/consumer.js"></script></body></html>'); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await new Promise<void>((resolve) => server?.close(() => resolve())); });

for (const lo of ['1e-124', '1e-300']) {
  test(`a log x axis down to ${lo} draws without an error (known shell defect 31)`, async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 480 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${address}/?axis=x&lo=${lo}`);
    await page.waitForSelector('.caos-chart[data-drawn="1"] canvas', { timeout: 10000 });
    await page.waitForTimeout(300);
    assert.deepEqual(errors, [], `page errors at ${lo}: ${errors.join(' | ')}`);
    await page.close();
  });
}

for (const lo of ['1e-5', '1e-22', '1e-23', '1e-124', '1e-300']) {
  test(`a log axis down to ${lo} draws without an error (known shell defect 31)`, async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 480 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${address}/?lo=${lo}`);
    await page.waitForSelector('.caos-chart[data-drawn="1"] canvas', { timeout: 10000 });
    await page.waitForTimeout(300);
    assert.deepEqual(errors, [], `page errors at ${lo}: ${errors.join(' | ')}`);
    // the readout row formats the cursor's year without a group separator
    await page.hover('.u-over', { position: { x: 60, y: 60 } });
    await page.waitForTimeout(200);
    const read = await page.locator('.caos-chart-readout').textContent();
    assert.match(read ?? '', /Year 200\d/, `the readout: ${read}`);
    await page.close();
  });
}
