import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser } from '@playwright/test';

// A document's text takes the full width of its column and its references close the page (CAOS_APP_SHELL#96).
// Until 0.11.0 the prose rule capped every paragraph at 78ch with no centring, so on a wide page the text ran in a
// narrow column at the left; and every section ended in its own references row, between the sections.

let browser: Browser, server: Server, address: string;
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const script = await build({
    stdin: {
      contents: `
        import React from 'react'; import { createRoot } from 'react-dom/client';
        import { CitationsProvider, DocPage, DocSection, Equation } from './src/index';
        const items = [
          { id: 'a', label: 'A 2001', citation: 'Alpha, A. (2001) First work.', doi: '10.1/a' },
          { id: 'b', label: 'B 2002', citation: 'Beta, B. (2002) Second work.', doi: '10.1/b' },
        ];
        const long = 'A long paragraph of documentation text that runs well past seventy-eight characters on one line so a measure cap would show. '.repeat(6);
        function Page() {
          return (
            <CitationsProvider items={items}>
              <DocPage wide title={{ en: 'Methodology', es: 'Metodologia' }} lede="lede">
                <DocSection title={{ en: 'One', es: 'Uno' }} refs={['a']}>
                  <p id="para">{long}</p>
                  <ul><li id="item">{long}</li></ul>
                  <Equation tex="x = y" caption="A caption under its equation." />
                </DocSection>
                <DocSection title={{ en: 'Two', es: 'Dos' }} refs={['b', 'a']}><p>{long}</p></DocSection>
              </DocPage>
            </CitationsProvider>
          );
        }
        createRoot(document.getElementById('root')).render(<Page />);
      `,
      resolveDir: root,
      sourcefile: 'doc-layout.tsx',
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
    if (req.url === '/doc-layout.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(script.outputFiles[0].text);
    } else if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html data-theme="light"><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/doc-layout.js"></script></body></html>');
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

test('a wide document page: text fills its section, the references block is the last element of the body', async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(address);
  await page.waitForSelector('[data-doc-references]');
  const m = await page.evaluate(`(() => {
    const content = (el) => { const cs = getComputedStyle(el); return el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); };
    const para = document.getElementById('para');
    const section = para.closest('section');
    const body = document.querySelector('.page-body');
    const cap = document.querySelector('.equation-caption');
    const block = document.querySelector('[data-doc-references]');
    return {
      para: para.getBoundingClientRect().width,
      section: content(section),
      item: document.getElementById('item').getBoundingClientRect().width,
      body: content(body),
      caption: cap.getBoundingClientRect().width,
      blocks: document.querySelectorAll('[data-doc-references]').length,
      lastIsBlock: body.lastElementChild === block,
      refs: [...block.querySelectorAll('li > span')].map((s) => s.textContent),
      rows: document.querySelectorAll('.th-refs').length,
    };
  })()`) as { para: number; section: number; item: number; body: number; caption: number; blocks: number; lastIsBlock: boolean; refs: string[]; rows: number };
  assert.ok(m.section > 1000, `the wide document column is ${m.section}px; it should be wide at 1600x900`);
  assert.ok(Math.abs(m.para - m.section) <= 1, `a paragraph is ${m.para}px wide in a ${m.section}px section`);
  assert.ok(m.item < m.section && m.item > m.section - 60, `a list item is ${m.item}px in a ${m.section}px section (the list indent only)`);
  assert.ok(m.caption < m.body, `a caption keeps its measure (${m.caption}px), it does not fill the ${m.body}px column`);
  assert.equal(m.blocks, 1);
  assert.ok(m.lastIsBlock, 'the references block is the last element of the page body');
  assert.deepEqual(m.refs, ['Alpha, A. (2001) First work.', 'Beta, B. (2002) Second work.']);
  assert.equal(m.rows, 0, 'no section ends in its own references row');
  await page.close();
});
