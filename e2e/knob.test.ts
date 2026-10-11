import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, type Browser } from '@playwright/test';

// A knob in a clipping card (CAOS_APP_SHELL#91): Chromium gives a range input a 2 px user-agent side margin, so at width
// 100% the input reached 2 px past the right edge of a PlotCard body (`overflow: hidden`) at phone widths and the gate's
// G5 failed "input.range cannot be brought into the viewport".

let browser: Browser, server: Server, address: string;
before(async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><html data-theme="light"><head><link rel="stylesheet" href="/styles.css"></head><body style="margin:0">' +
        '<div id="card" style="width:337px;overflow:hidden;margin-left:29px">' +
        '<div class="caos-knob" data-control="cohort"><label for="k" class="caos-knob-head"><span>Cohort</span><span class="caos-knob-value">40</span></label>' +
        '<input id="k" class="range" type="range" min="0" max="100" step="1" value="40"></div></div>' +
        '</body></html>',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

test('a knob inside a clipping card keeps its range input inside the card at 390 x 844', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(address);
  const box = await page.evaluate(`(() => {
    const c = document.querySelector('#card').getBoundingClientRect();
    const i = document.querySelector('#k').getBoundingClientRect();
    return { cl: c.left, cr: c.right, il: i.left, ir: i.right, margin: getComputedStyle(document.querySelector('#k')).marginInlineEnd };
  })()`) as { cl: number; cr: number; il: number; ir: number; margin: string };
  assert.ok(box.il >= box.cl - 0.01, `the input starts at ${box.il}, the card at ${box.cl}`);
  assert.ok(box.ir <= box.cr + 0.01, `the input ends at ${box.ir}, past the card's ${box.cr} (margin ${box.margin})`);
  await page.close();
});
