import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser } from '@playwright/test';

// The rail's knobs (CAOS_APP_SHELL#77): a knob's head is one row, its label at the left and its value at the right,
// inside the rail as everywhere else. Until 0.9.3 the rail's generic label rule stacked every value under its label,
// a line per knob, and a rail of eight variants and three knobs scrolled at 1280x800 (CAOS_Fragmenta, wide font).

let browser: Browser, server: Server, address: string;
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const script = await build({
    stdin: {
      contents: `
        import React from 'react'; import { createRoot } from 'react-dom/client';
        import { Knob } from './src/workbench/Controls';
        function Rail() {
          return (
            <aside className="caos-wb-rail" style={{ width: '232px' }}>
              <Knob id="short" label={{ en: 'Stemming / burden', es: 'Taco / bordo' }} value={0.89} min={0} max={2} step={0.01} onChange={() => {}} />
              <Knob id="long" label={{ en: 'The ratio of the bench height to the burden of the pattern', es: 'x' }} value={2.67} min={0} max={5} step={0.01} onChange={() => {}} />
              <label id="picker">Case<select className="select"><option>One</option></select></label>
            </aside>
          );
        }
        createRoot(document.getElementById('root')).render(<Rail />);
      `,
      resolveDir: root,
      sourcefile: 'rail.tsx',
      loader: 'tsx',
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    if (req.url === '/rail.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(script.outputFiles[0].text);
    } else if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html data-theme="light"><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/rail.js"></script></body></html>');
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

test('a knob in the rail keeps its value on the label row; a long label wraps beside it; a labelled select stays stacked', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(address);
    await page.locator('[data-control="long"]').waitFor();
    const selectors = {
      shortHead: '[data-control="short"] .caos-knob-head',
      shortLabel: '[data-control="short"] .caos-knob-head > span:first-child',
      shortValue: '[data-control="short"] .caos-knob-value',
      longLabel: '[data-control="long"] .caos-knob-head > span:first-child',
      longValue: '[data-control="long"] .caos-knob-value',
      pickerText: '#picker',
      picker: '#picker select',
    };
    type Box = { top: number; bottom: number; left: number; right: number; height: number };
    // No named helper inside the page function: the TypeScript loader wraps named functions in a helper the page lacks.
    const boxes = (await page.evaluate(
      (all) =>
        Object.fromEntries(
          Object.entries(all).map(([key, selector]) => {
            const r = document.querySelector(selector)!.getBoundingClientRect();
            return [key, { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }];
          }),
        ),
      selectors,
    )) as Record<keyof typeof selectors, Box>;
    const { shortHead, shortLabel, shortValue, longLabel, longValue, picker, pickerText } = boxes;
    assert.ok(Math.abs(shortValue.top - shortLabel.top) < 2, `the value sits on the label's row: ${JSON.stringify(boxes)}`);
    assert.ok(Math.abs(shortValue.right - shortHead.right) < 1, 'the value ends at the right of the head');
    assert.ok(longLabel.height > shortLabel.height * 1.5, 'a long label wraps');
    assert.ok(longValue.top < longLabel.bottom && longValue.left > longLabel.right - 1, 'and its value stays beside it');
    assert.ok(picker.top > pickerText.top + 8, 'a select labelled in the rail keeps its text above it');
  } finally {
    await page.close();
  }
});
