import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser } from '@playwright/test';

// The executive view (shell 0.12.0): the four sections and the three inline illustrations fit the column at phone and
// desktop widths, in both themes and both languages, and every label stays inside its drawing, also in a wide font.

let browser: Browser, server: Server, address: string;
const root = fileURLToPath(new URL('..', import.meta.url));
const fixtureDir = new URL('../test/gate-fixture/executive/', import.meta.url);

before(async () => {
  const script = await build({
    stdin: {
      contents: `
        import React from 'react'; import { createRoot } from 'react-dom/client';
        import { DocPage, ExecutiveView, Tabs, useLangStore } from './src/index';
        import data from './test/gate-fixture/executive/executive.json';
        // the composition every product uses (an Introduction: the page, its two views, the executive one first)
        function App() {
          return (
            <DocPage title={{ en: 'Introduction', es: 'Introducción' }} lede="The executive view first, then the technical view.">
              <Tabs tabs={[
                { id: 'executive', label: 'Executive view', content: <ExecutiveView data={data} /> },
                { id: 'technical', label: 'Technical view', content: <p>Technical view.</p> },
              ]} />
            </DocPage>
          );
        }
        createRoot(document.getElementById('root')).render(<App />);
        window.__setLang = (l) => useLangStore.getState().setLang(l);
      `,
      resolveDir: root,
      sourcefile: 'executive-view.tsx',
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
    const url = req.url ?? '/';
    const file = /^\/executive\/(initiative|problem|solution)\.svg$/.exec(url);
    if (url === '/executive-view.js') {
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
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html lang="en" data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/executive-view.js"></script></body></html>');
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

const WIDE = ':root, :root[data-theme] { --font-sans: Verdana, "DejaVu Sans", sans-serif !important; }';

test('the executive view fits 390, 1280 and 1600 px in both themes and both languages with every label inside its drawing', async () => {
  for (const width of [390, 1280, 1600]) {
    for (const theme of ['light', 'dark']) {
      for (const lang of ['en', 'es']) {
        for (const wide of [false, true]) {
          const where = `${width}px ${theme} ${lang}${wide ? ' wide font' : ''}`;
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          await page.addInitScript(`try { localStorage.setItem('caos.lang', '${lang}'); } catch (e) {}`);
          await page.goto(address);
          await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
          if (wide) await page.addStyleTag({ content: WIDE });
          await page.waitForSelector('[data-executive-view] figure svg');
          await page.waitForFunction(() => document.querySelectorAll('[data-exec-illustration] svg').length === 3);
          const m = await page.evaluate(`(() => {
            const de = document.documentElement;
            const view = document.querySelector('[data-executive-view]');
            const figures = [...document.querySelectorAll('[data-exec-illustration]')].map((f) => {
              const svg = f.querySelector('svg');
              const vb = svg.viewBox.baseVal;
              const r = svg.getBoundingClientRect();
              const bad = [];
              for (const t of svg.querySelectorAll('text')) {
                if (getComputedStyle(t).display === 'none') continue;
                const b = t.getBBox();
                if (b.x < vb.x - 1 || b.y < vb.y - 1 || b.x + b.width > vb.x + vb.width + 1 || b.y + b.height > vb.y + vb.height + 1) bad.push(t.textContent);
              }
              const visible = [...svg.querySelectorAll('text')].filter((t) => getComputedStyle(t).display !== 'none').map((t) => t.getAttribute('data-lang'));
              return { name: f.getAttribute('data-exec-illustration'), w: r.width, h: r.height, col: view.getBoundingClientRect().width, bad, langs: [...new Set(visible)], img: f.querySelectorAll('img').length };
            });
            return { scrollW: de.scrollWidth, innerW: window.innerWidth, valid: view.getAttribute('data-executive-valid'), sections: view.querySelectorAll('[data-exec-section]').length, figures };
          })()`) as { scrollW: number; innerW: number; valid: string; sections: number; figures: Array<{ name: string; w: number; h: number; col: number; bad: string[]; langs: string[]; img: number }> };
          assert.equal(m.valid, 'true', where);
          assert.equal(m.sections, 4, where);
          assert.ok(m.scrollW <= m.innerW, `${where}: the page scrolls sideways (${m.scrollW} > ${m.innerW})`);
          assert.deepEqual(m.figures.map((f) => f.name), ['initiative', 'problem', 'solution'], where);
          for (const f of m.figures) {
            assert.deepEqual(f.bad, [], `${where}: ${f.name} has labels outside its drawing`);
            assert.ok(f.w <= f.col + 1 && f.w > 200, `${where}: ${f.name} is ${f.w}px in a ${f.col}px column`);
            assert.deepEqual(f.langs, [lang], `${where}: ${f.name} shows labels of ${f.langs.join(',')}`);
            assert.equal(f.img, 0, `${where}: an img tag`);
          }
          await page.close();
        }
      }
    }
  }
});

test('a source note with a long URL wraps inside the column at 390 px (BL-053)', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(address);
  await page.waitForSelector('[data-executive-view] .caos-exec-notes li');
  const m = await page.evaluate(`(() => {
    const ol = document.querySelector('[data-executive-view] .caos-exec-notes');
    const li = document.createElement('li');
    li.textContent = 'https://www.cmfchile.cl/portal/principal/613/articles-' + 'x'.repeat(120) + '.pdf';
    ol.appendChild(li);
    const de = document.documentElement;
    return { scrollW: de.scrollWidth, innerW: window.innerWidth, noteW: li.getBoundingClientRect().right };
  })()`) as { scrollW: number; innerW: number; noteW: number };
  assert.ok(m.scrollW <= m.innerW, `the page scrolls sideways (${m.scrollW} > ${m.innerW}) with a long URL in a source note`);
  assert.ok(m.noteW <= m.innerW, `the note ends at ${m.noteW} px past ${m.innerW}`);
  await page.close();
});

test('an invalid data file shows its error in the browser and no section', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/executive-view.js', async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()).replace(/\bvision:\s*\{/, 'vision_x: {') });
  });
  await page.goto(address);
  await page.waitForSelector('[data-executive-view]');
  assert.equal(await page.getAttribute('[data-executive-view]', 'data-executive-valid'), 'false');
  assert.ok((await page.textContent('[data-executive-view]'))?.includes('vision'));
  assert.equal(await page.locator('[data-exec-section]').count(), 0);
  await page.close();
});
