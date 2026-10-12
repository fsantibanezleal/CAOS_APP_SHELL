import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser, type Page } from '@playwright/test';
import * as shell from '../src/index.ts';

// Shell 0.11.0 (CAOS_APP_SHELL#96): the references of a documentation page are ONE block at the end of the page, or of
// the open tab panel, each citation once, in the order of first appearance. A `DocSection` registers its ids in a
// layout effect, which node cannot run without a DOM (and the shell takes no DOM emulation as a dependency), so the
// scenarios run in Chromium; the ordering rule itself is a pure function tested directly.

test('firstAppearance lists each id once, in the order the sections give them', () => {
  assert.deepEqual(shell.firstAppearance([['b', 'a'], ['a', 'c'], ['c', 'd']]), ['b', 'a', 'c', 'd']);
  assert.deepEqual(shell.firstAppearance([[], ['x', 'x']]), ['x']);
  assert.deepEqual(shell.firstAppearance([]), []);
});

let browser: Browser, server: Server, address: string;
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const script = await build({
    stdin: {
      contents: `
        import React from 'react'; import { createRoot } from 'react-dom/client';
        import { CitationsProvider, DocPage, DocSection, SubTabs, Tabs, useLangStore } from './src/index';
        const items = [
          { id: 'a', label: 'A 2001', citation: 'Alpha, A. (2001) First work.', doi: '10.1/a' },
          { id: 'b', label: 'B 2002', citation: 'Beta, B. (2002) Second work.', doi: '10.1/b' },
          { id: 'c', label: 'C 2003', citation: 'Gamma, C. (2003) Third work.', url: 'https://example.org/c' },
          { id: 'd', label: 'D 2004', citation: 'Delta, D. (2004) Fourth work.', doi: '10.1/d' },
        ];
        const S = (n, refs, no) => (
          <DocSection key={n} title={{ en: 'Part ' + n, es: 'Parte ' + n }} refs={refs} noRefsReason={no}>
            <p>Text of part {n}.</p>
          </DocSection>
        );
        const none = { en: 'A summary.', es: 'Un resumen.' };
        const scenarios = {
          page: () => (
            <DocPage title={{ en: 'T', es: 'T' }} lede="lede">
              {S(1, ['b', 'a'])}{S(2, ['a', 'c'])}{S(3, ['c', 'd'])}
            </DocPage>
          ),
          tabs: () => (
            <DocPage wide title={{ en: 'T', es: 'T' }} lede="lede">
              <Tabs initial="one" tabs={[
                { id: 'one', label: 'One', content: [S(1, ['a']), S(2, ['b'])] },
                { id: 'two', label: 'Two', content: [S(3, ['c', 'd'])] },
              ]} />
            </DocPage>
          ),
          subtabs: () => (
            <DocPage wide title={{ en: 'T', es: 'T' }} lede="lede">
              {S(0, ['d'])}
              <Tabs tabs={[{ id: 'one', label: 'One', content: [
                S(1, ['a']),
                <SubTabs key="s" tabs={[{ id: 'x', label: 'X', content: [S(2, ['b'])] }]} />,
              ] }]} />
            </DocPage>
          ),
          noRefs: () => (
            <DocPage title={{ en: 'T', es: 'T' }} lede="lede">
              {S(1, undefined, none)}{S(2, [], none)}
            </DocPage>
          ),
        };
        window.mount = (name) => {
          createRoot(document.getElementById('root')).render(<CitationsProvider items={items}>{scenarios[name]()}</CitationsProvider>);
        };
        window.setLang = (l) => useLangStore.getState().setLang(l);
      `,
      resolveDir: root,
      sourcefile: 'doc-refs.tsx',
      loader: 'tsx',
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  server = createServer((req, res) => {
    if (req.url === '/doc-refs.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(script.outputFiles[0].text);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html data-theme="light"><body><div id="root"></div><script type="module" src="/doc-refs.js"></script></body></html>');
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

async function open(scenario: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(address);
  await page.waitForFunction('typeof window.mount === "function"');
  await page.evaluate(`window.mount(${JSON.stringify(scenario)})`);
  await page.waitForSelector('[data-doc-page]');
  return page;
}

/** The citations the visible blocks list, per block: the text before the link, in order. */
const blocks = (page: Page) =>
  page.$$eval('[data-doc-references]', (els) =>
    els.map((el) => ({
      heading: el.querySelector('h2')?.textContent,
      items: [...el.querySelectorAll('li')].map((li) => li.querySelector('span')?.textContent),
      links: [...el.querySelectorAll('li a')].map((a) => `${a.textContent}|${a.getAttribute('href')}`),
      parent: el.parentElement?.className,
      last: el.parentElement?.lastElementChild === el,
    })),
  );

test('a DocPage of three sections ends in one block, each citation once, in the order of first appearance', async () => {
  const page = await open('page');
  const b = await blocks(page);
  assert.equal(b.length, 1);
  assert.equal(b[0].heading, 'References');
  assert.deepEqual(b[0].items, ['Beta, B. (2002) Second work.', 'Alpha, A. (2001) First work.', 'Gamma, C. (2003) Third work.', 'Delta, D. (2004) Fourth work.']);
  assert.deepEqual(b[0].links, ['doi:10.1/b|https://doi.org/10.1/b', 'doi:10.1/a|https://doi.org/10.1/a', 'link|https://example.org/c', 'doi:10.1/d|https://doi.org/10.1/d']);
  assert.ok(b[0].last, 'the block is the last element of the page body');
  assert.equal(await page.$$eval('.th-refs', (e) => e.length), 0, 'no section renders its own Refs row any more');
  assert.equal(await page.$$eval('[data-doc-section]:not([data-refs])', (e) => e.length), 0);
  await page.close();
});

test('inside Tabs the block of the open panel lists only that panel, at its end', async () => {
  const page = await open('tabs');
  let b = await blocks(page);
  assert.equal(b.length, 1);
  assert.deepEqual(b[0].items, ['Alpha, A. (2001) First work.', 'Beta, B. (2002) Second work.']);
  assert.match(b[0].parent ?? '', /tabpanel/);
  assert.ok(b[0].last);
  await page.click('[data-tab="two"]');
  await page.waitForSelector('[data-panel="two"]');
  b = await blocks(page);
  assert.equal(b.length, 1);
  assert.deepEqual(b[0].items, ['Gamma, C. (2003) Third work.', 'Delta, D. (2004) Fourth work.']);
  await page.close();
});

test('the innermost scope wins: sub-tab panel, tab panel and page each list their own sections', async () => {
  const page = await open('subtabs');
  const b = await blocks(page);
  assert.equal(b.length, 3);
  const byParent = Object.fromEntries(b.map((x) => [/subtabpanel/.test(x.parent ?? '') ? 'sub' : /tabpanel/.test(x.parent ?? '') ? 'tab' : 'page', x.items]));
  assert.deepEqual(byParent.sub, ['Beta, B. (2002) Second work.']);
  assert.deepEqual(byParent.tab, ['Alpha, A. (2001) First work.']);
  assert.deepEqual(byParent.page, ['Delta, D. (2004) Fourth work.']);
  assert.ok(b.every((x) => x.last));
  await page.close();
});

test('a section with a reason and no refs adds nothing, and no block renders', async () => {
  const page = await open('noRefs');
  assert.deepEqual(await blocks(page), []);
  assert.equal(await page.$$eval('[data-no-refs-reason="A summary."]', (e) => e.length), 2);
  await page.close();
});

test('switching the language keeps the order and translates the heading', async () => {
  const page = await open('page');
  const before = (await blocks(page))[0].items;
  await page.evaluate('window.setLang("es")');
  await page.waitForFunction('document.querySelector("[data-doc-references] h2")?.textContent === "Referencias"');
  const after = await blocks(page);
  assert.equal(after.length, 1);
  assert.deepEqual(after[0].items, before);
  await page.close();
});
