import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, type Browser } from '@playwright/test';

// A chip under the pointer (known shell defect 33): the hover rule `.chip:hover:not(:disabled)` outranked `.chip.on`,
// so the active chip, the one a reader has just clicked and still points at, wrote its label in the text colour on the
// accent: 3.04:1 in the light theme, under the 4.5:1 of G13 (found by the gate on CAOS_Contraste's rail sections).

let browser: Browser, server: Server, address: string;
/** Longer than the chip's colour transition, so a colour is read where the pointer leaves it. */
const TRANSITION_MS = 400;
before(async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
      return;
    }
    const theme = req.url?.includes('dark') ? 'dark' : 'light';
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<!doctype html><html data-theme="${theme}"><head><link rel="stylesheet" href="/styles.css"></head><body>` +
        '<div class="caos-chip-row"><button type="button" class="chip on" id="on">Grade and definition</button>' +
        '<button type="button" class="chip" id="off">Projection</button>' +
        '<button type="button" class="chip" id="dis" disabled>Interval</button></div>' +
        '<div><button type="button" class="cs-chip on" id="case-on">C04</button><button type="button" class="cs-chip" id="case-off">C05</button></div>' +
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

/** The WCAG contrast of an element's text colour on its background, both as the browser computes them. The page
 * script is a string: a function handed to the page would carry the test runner's helpers with it. */
const CONTRAST = `(sel) => {
  const el = document.querySelector(sel);
  const cs = getComputedStyle(el);
  const rgb = (s) => (s.match(/\\d+(\\.\\d+)?/g) || []).slice(0, 3).map(Number);
  const f = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const lum = (v) => 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]);
  const a = lum(rgb(cs.color));
  const b = lum(rgb(cs.backgroundColor));
  return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), color: cs.color, background: cs.backgroundColor };
}`;
async function contrastOf(page: import('@playwright/test').Page, selector: string): Promise<{ ratio: number; color: string; background: string }> {
  return page.evaluate(`(${CONTRAST})(${JSON.stringify(selector)})`);
}

for (const theme of ['light', 'dark'] as const) {
  test(`the active chip keeps its contrast under the pointer (${theme})`, async () => {
    const page = await browser.newPage();
    await page.goto(`${address}/${theme}`);
    const rest = await contrastOf(page, '#on');
    await page.hover('#on');
    await page.waitForTimeout(TRANSITION_MS);
    const hovered = await contrastOf(page, '#on');
    assert.ok(rest.ratio >= 4.5, `at rest ${rest.color} on ${rest.background}: ${rest.ratio.toFixed(2)}:1`);
    assert.ok(hovered.ratio >= 4.5, `hovered ${hovered.color} on ${hovered.background}: ${hovered.ratio.toFixed(2)}:1`);
    assert.equal(hovered.color, rest.color, 'the active chip keeps its label colour under the pointer');
    // an inactive chip still answers the pointer: its label darkens to the text colour
    const before = await contrastOf(page, '#off');
    await page.hover('#off');
    await page.waitForTimeout(TRANSITION_MS);
    const after = await contrastOf(page, '#off');
    assert.notEqual(after.color, before.color, 'an inactive chip answers the pointer');
    assert.ok(after.ratio >= 4.5, `inactive hovered: ${after.ratio.toFixed(2)}:1`);
    // the chosen case's chip keeps its accent under the pointer too
    const caseRest = await contrastOf(page, '#case-on');
    await page.hover('#case-on');
    await page.waitForTimeout(TRANSITION_MS);
    const caseHovered = await contrastOf(page, '#case-on');
    assert.equal(caseHovered.color, caseRest.color, "the chosen case's chip keeps its accent under the pointer");
    assert.equal(caseHovered.background, caseRest.background);
    await page.close();
  });
}
