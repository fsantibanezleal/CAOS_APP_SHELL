import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, type Browser } from '@playwright/test';

// SHC-100 (0.19.1): below 900 px a filling card's body is clamped to clamp(260px, 48vh, 440px) with its overflow hidden. That
// suits a drawing, which needs a definite height, and cut flowing content: a long table lost its rows and a wide one its right
// columns at 390 px, with no way to reach them (CAOS_Contraste U16-R2b, eight of its review batches). A body whose own child is a
// table, or that holds an element marked `data-caos-flow`, now takes the height of its content and scrolls sideways; a drawing
// alone keeps the clamp; at 1280 nothing changes. An equation that scrolls sideways fades its right edge on a phone.

const ROWS = 30;
const COLS = 9;
const table = (id: string) =>
  `<table class="caos-table" data-t="${id}"><thead><tr>${Array.from({ length: COLS }, (_, c) => `<th>Column ${c + 1} of the table</th>`).join('')}</tr></thead><tbody>` +
  Array.from({ length: ROWS }, (_, r) => `<tr>${Array.from({ length: COLS }, (_, c) => `<td>${(r + 1) * 1000 + c}.25 units</td>`).join('')}</tr>`).join('') +
  '</tbody></table>';
const card = (id: string, body: string) =>
  `<figure class="caos-plot fill" data-card="${id}"><figcaption class="caos-plot-head"><span class="caos-plot-title">${id}</span></figcaption>` +
  `<div class="caos-plot-body">${body}</div></figure>`;
const PAGE =
  '<div class="caos-views-row">' +
  card('flow', `<div data-caos-flow><p>A drawing and its table.</p><div style="height:200px;background:#8884"></div>${table('flow')}</div>`) +
  card('direct', table('direct')) +
  card('drawing', '<div style="height:100%;background:#8884"></div>') +
  '</div>' +
  '<div class="prose"><div class="equation" data-eq><span style="display:inline-block;width:1400px">a very wide equation</span></div></div>';

let browser: Browser, server: Server, address: string;
before(async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    if ((req.url ?? '/').startsWith('/styles.css')) {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html data-theme="light" lang="en"><head><link rel="stylesheet" href="/styles.css"></head><body style="margin:0;padding:12px">${PAGE}</body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

const BODIES = `Object.fromEntries([...document.querySelectorAll('[data-card]')].map((c) => {
  const b = c.querySelector(':scope > .caos-plot-body');
  const s = getComputedStyle(b);
  b.scrollLeft = b.scrollWidth;
  const last = c.querySelector('tbody tr:last-child td:last-child');
  const lr = last ? last.getBoundingClientRect() : null;
  const br = b.getBoundingClientRect();
  return [c.dataset.card, { h: br.height, sh: b.scrollHeight, ch: b.clientHeight, sw: b.scrollWidth, cw: b.clientWidth, ox: s.overflowX, oy: s.overflowY,
    lastInside: lr ? lr.right <= br.right + 1 && lr.bottom <= br.bottom + 1 && lr.left >= br.left - 1 : null }];
}))`;

for (const lang of ['en', 'es'] as const) {
  test(`at 390 px a flowing body takes its content's height and scrolls sideways to its last column, a drawing keeps the clamp (${lang})`, async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(`${address}/?lang=${lang}`);
      const b = (await page.evaluate(BODIES)) as Record<string, { h: number; sh: number; ch: number; sw: number; cw: number; ox: string; oy: string; lastInside: boolean | null }>;
      for (const id of ['flow', 'direct']) {
        const x = b[id];
        assert.ok(x.h > 440, `${id}: the body grew past the clamp (${x.h} px)`);
        assert.ok(x.sh <= x.ch + 1, `${id}: no row is cut at the bottom (scrollHeight ${x.sh}, clientHeight ${x.ch})`);
        assert.equal(x.ox, 'auto', `${id}: the body scrolls sideways`);
        assert.ok(x.sw > x.cw, `${id}: the table is wider than the phone`);
        assert.equal(x.lastInside, true, `${id}: scrolled to its end, the last cell of the last row is inside the body`);
      }
      const d = b.drawing;
      assert.ok(d.h >= 259 && d.h <= 441, `drawing: the clamp holds (${d.h} px)`);
      assert.equal(d.ox, 'hidden', 'drawing: its overflow stays hidden');
    } finally {
      await page.close();
    }
  });
}

test('at 390 px a wide equation fades its right edge and keeps a gap after its end', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(address);
    const e = (await page.evaluate(`(() => { const s = getComputedStyle(document.querySelector('[data-eq]')); return { mask: s.maskImage || s.webkitMaskImage, pr: s.paddingRight, ox: s.overflowX }; })()`)) as { mask: string; pr: string; ox: string };
    assert.match(e.mask, /linear-gradient/);
    assert.equal(e.pr, '24px');
    assert.equal(e.ox, 'auto');
  } finally {
    await page.close();
  }
});

test('at 1280 px nothing changes: a filling body keeps its hidden overflow and no equation fades', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(address);
    const b = (await page.evaluate(BODIES)) as Record<string, { oy: string; ox: string }>;
    for (const id of ['flow', 'direct', 'drawing']) assert.equal(b[id].ox, 'hidden', `${id} at 1280`);
    const mask = (await page.evaluate(`getComputedStyle(document.querySelector('[data-eq]')).maskImage`)) as string;
    assert.ok(!/linear-gradient/.test(mask), 'no fade at 1280');
  } finally {
    await page.close();
  }
});
