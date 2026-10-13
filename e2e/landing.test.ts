import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser } from '@playwright/test';

// The landing (shell 0.13.0, Felipe 2026-10-13): the root and any unknown entry open the Introduction on its executive view;
// the App has its own route; an old App link (the root with ?case=) still reaches the case; the nav order is the Introduction,
// the App, then the other pages.

let browser: Browser, server: Server, address: string;
const root = fileURLToPath(new URL('..', import.meta.url));
const fixtureDir = new URL('../test/gate-fixture/executive/', import.meta.url);

before(async () => {
  const script = await build({
    stdin: {
      contents: `
        import React from 'react'; import { createRoot } from 'react-dom/client';
        import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
        import { AppShell, DocPage, ExecutiveView, Landing, STANDARD_ROUTES, Tabs } from './src/index';
        import data from './test/gate-fixture/executive/executive.json';
        const config = { product: { name: 'LandingFixture' }, routes: STANDARD_ROUTES, links: { github: 'https://github.com/fsantibanezleal/CAOS_APP_SHELL' }, version: '0.13.0', build: 'test', license: { en: 'MIT licence', es: 'Licencia MIT' }, visibility: 'public' };
        function Intro() {
          return (
            <DocPage title={{ en: 'Introduction', es: 'Introducción' }} lede="The executive view first.">
              <Tabs tabs={[
                { id: 'executive', label: 'Executive view', content: <ExecutiveView data={data} /> },
                { id: 'technical', label: 'Technical view', content: <p>Technical view.</p> },
              ]} />
            </DocPage>
          );
        }
        function App() { const { search } = useLocation(); return <div data-app="" data-search={search}>The App {search}</div>; }
        const Plain = ({ name }) => <p>{name}</p>;
        createRoot(document.getElementById('root')).render(
          <BrowserRouter>
            <AppShell config={config}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/introduction" element={<Intro />} />
                <Route path="/app" element={<App />} />
                {['methodology', 'implementation', 'experiments', 'benchmark'].map((id) => <Route key={id} path={'/' + id} element={<Plain name={id} />} />)}
                <Route path="*" element={<Landing />} />
              </Routes>
            </AppShell>
          </BrowserRouter>,
        );
      `,
      resolveDir: root,
      sourcefile: 'landing.tsx',
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
    const url = (req.url ?? '/').split('?')[0];
    const file = /^\/executive\/(initiative|problem|solution)\.svg$/.exec(url);
    if (url === '/landing.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(script.outputFiles[0].text);
    } else if (url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
    } else if (file) {
      readFile(new URL(`${file[1]}.svg`, fixtureDir)).then((b) => {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.end(b);
      });
    } else {
      // a host with a single-page fallback, as a dev server answers
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html lang="en" data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/landing.js"></script></body></html>');
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

test('the root and an unknown entry open the Introduction on its executive view', async () => {
  for (const entry of ['/', '/no-such-page']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${address}${entry}`);
    await page.waitForSelector('[data-executive-view]');
    const m = await page.evaluate(() => ({
      path: location.pathname,
      selected: [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map((t) => (t.textContent ?? '').trim())[0],
      valid: document.querySelector('[data-executive-view]')?.getAttribute('data-executive-valid'),
      h1: document.querySelector('h1')?.textContent,
    }));
    assert.equal(m.path, '/introduction', `${entry} opened ${m.path}`);
    assert.equal(m.selected, 'Executive view', `${entry}: the executive view is the open view`);
    assert.equal(m.valid, 'true');
    assert.equal(m.h1, 'Introduction');
    await page.close();
  }
});

test('an old App URL with ?case= still reaches the case on the App route', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${address}/?case=B2&view=table#top`);
  await page.waitForSelector('[data-app]');
  const m = await page.evaluate(() => ({ path: location.pathname, search: location.search, hash: location.hash, seen: document.querySelector('[data-app]')?.getAttribute('data-search') }));
  assert.deepEqual(m, { path: '/app', search: '?case=B2&view=table', hash: '#top', seen: '?case=B2&view=table' });
  await page.close();
});

test('the navigation lists the Introduction first, then the App, then the other pages', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(address);
  await page.waitForSelector('header nav a');
  const hrefs = await page.$$eval('header nav a', (as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
  assert.deepEqual(hrefs, ['/introduction', '/app', '/methodology', '/implementation', '/experiments', '/benchmark']);
  const active = await page.$$eval('header nav a.active', (as) => as.map((a) => (a.textContent ?? '').trim()));
  assert.deepEqual(active, ['Introduction']);
  await page.close();
});
