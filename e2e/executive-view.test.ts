import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser } from '@playwright/test';

// The executive view (shell 0.13.0): the four sections are sub-tabs; each one and the three inline illustrations fit the column
// at phone and desktop widths, in both themes and both languages, every label stays inside its drawing, also in a wide font,
// and the sub-tabs are reachable by keyboard.

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
    const file = /^\/executive\/(pain|situation|proposal)\.svg$/.exec(url);
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
          const seen: string[] = [];
          // the four sections are the four sub-tabs: visit each and measure what it shows
          for (let tab = 0; tab < 5; tab += 1) {
            const where2 = `${where}, sub-tab ${tab + 1}`;
            if (tab > 0) await page.locator('[data-exec-tabs] [role="tab"]').nth(tab).click();
            const expected = [1, 0, 1, 0, 1][tab];
            await page.waitForFunction((n) => document.querySelectorAll('[data-exec-illustration] svg').length === n, expected);
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
              const notes = [...view.querySelectorAll('[data-exec-notes] > li')].map((li) => { const a = li.querySelector('a'); const r = li.getBoundingClientRect(); return { href: a ? a.getAttribute('href') : null, w: r.width, h: r.height, right: r.right }; });
              return { scrollW: de.scrollWidth, innerW: window.innerWidth, valid: view.getAttribute('data-executive-valid'), sections: [...view.querySelectorAll('[data-exec-section]')].map((s) => Number(s.getAttribute('data-exec-section'))), tabs: [...view.querySelectorAll('[data-exec-tabs] [role="tab"]')].map((t) => t.getAttribute('aria-selected')), notes, figures };
            })()`) as { scrollW: number; innerW: number; valid: string; sections: number[]; tabs: string[]; notes: Array<{ href: string | null; w: number; h: number; right: number }>; figures: Array<{ name: string; w: number; h: number; col: number; bad: string[]; langs: string[]; img: number }> };
            assert.equal(m.valid, 'true', where2);
            assert.deepEqual(m.sections, [tab + 1], `${where2}: one section at a time, in its own sub-tab`);
            assert.deepEqual(m.tabs, [0, 1, 2, 3, 4].map((i) => String(i === tab)), `${where2}: the selected sub-tab`);
            assert.ok(m.scrollW <= m.innerW, `${where2}: the page scrolls sideways (${m.scrollW} > ${m.innerW})`);
            assert.equal(m.notes.length, 7, `${where2}: the source notes stay visible`);
            for (const n of m.notes) assert.ok(n.href?.startsWith('https://') && n.h > 0 && n.right <= m.innerW, `${where2}: a source note is a visible https link inside the column`);
            for (const f of m.figures) {
              seen.push(f.name);
              assert.deepEqual(f.bad, [], `${where2}: ${f.name} has labels outside its drawing`);
              assert.ok(f.w <= f.col + 1 && f.w > 200, `${where2}: ${f.name} is ${f.w}px in a ${f.col}px column`);
              assert.deepEqual(f.langs, [lang], `${where2}: ${f.name} shows labels of ${f.langs.join(',')}`);
              assert.equal(f.img, 0, `${where2}: an img tag`);
            }
          }
          assert.deepEqual(seen, ['pain', 'situation', 'proposal'], where);
          await page.close();
        }
      }
    }
  }
});

test('the five sub-tabs are reachable by keyboard and the source notes stay visible', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(address);
  await page.waitForSelector('[data-exec-tabs] [role="tab"]');
  const tabs = page.locator('[data-exec-tabs] [role="tab"]');
  assert.equal(await tabs.count(), 5);
  const selected = async () => page.evaluate(() => [...document.querySelectorAll('[data-exec-tabs] [role="tab"]')].findIndex((t) => t.getAttribute('aria-selected') === 'true'));
  const section = async () => page.evaluate(() => [...document.querySelectorAll('[data-exec-section]')].map((s) => s.getAttribute('data-exec-section')).join(','));
  assert.equal(await selected(), 0);
  await tabs.nth(0).focus();
  const steps: Array<[string, number]> = [['ArrowRight', 1], ['ArrowRight', 2], ['ArrowRight', 3], ['ArrowRight', 4], ['ArrowRight', 0], ['End', 4], ['Home', 0], ['ArrowLeft', 4]];
  for (const [key, want] of steps) {
    await page.keyboard.press(key);
    assert.equal(await selected(), want, `${key} selects sub-tab ${want + 1}`);
    assert.equal(await section(), String(want + 1), `${key} shows section ${want + 1} alone`);
    assert.equal(await page.locator('[data-exec-notes] > li a[href^="https://"]').count(), 7, `${key}: the notes are still there`);
  }
  // the rendered tab row is one row (ADR-0071 rule 4) at the narrowest width
  await page.setViewportSize({ width: 390, height: 900 });
  const rows = await page.evaluate(() => {
    const tops = [...document.querySelectorAll('[data-exec-tabs] [role="tab"]')].map((t) => Math.round(t.getBoundingClientRect().top)).filter((v, i, a) => a.indexOf(v) === i);
    return tops.length;
  });
  assert.equal(rows, 1, 'the sub-tab row is one row at 390 px');
  await page.close();
});

test('the lede and every part of the executive view take the full width of the document column at 1280 and 1600 px', async () => {
  for (const width of [1280, 1600]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(address);
    await page.waitForSelector('[data-executive-view] figure svg');
    const read = `(() => {
      const pb = document.querySelector('.page-body');
      const cs = getComputedStyle(pb);
      const column = pb.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const w = (el) => Math.round(el.getBoundingClientRect().width);
      const lede = document.querySelector('.page-head .lede');
      const view = document.querySelector('[data-executive-view]');
      const parts = [['landing', view.querySelector('.caos-exec-landing')], ['.subtabs', view.querySelector('.subtabs')], ['notes', view.querySelector('.caos-exec-notes-wrap')], ['links', view.querySelector('.caos-exec-links')]];
      const section = view.querySelector('[data-exec-section]');
      if (section) {
        parts.push(['section ' + section.getAttribute('data-exec-section'), section]);
        for (const child of section.children) parts.push(['section ' + section.getAttribute('data-exec-section') + ' > ' + child.tagName.toLowerCase() + '.' + String(child.className).split(' ')[0], child]);
      }
      return { column, lede: w(lede), parts: parts.filter(([, e]) => e).map(([name, e]) => [name, w(e)]) };
    })()`;
    const first = (await page.evaluate(read)) as { column: number; lede: number; parts: Array<[string, number]> };
    assert.ok(first.lede >= first.column - 1, `${width}px: the lede is ${first.lede}px in a ${first.column}px column`);
    const seen: string[] = [];
    for (let tab = 0; tab < 5; tab += 1) {
      if (tab > 0) await page.locator('[data-exec-tabs] [role="tab"]').nth(tab).click();
      const m = (await page.evaluate(read)) as { column: number; lede: number; parts: Array<[string, number]> };
      for (const [name, got] of m.parts) {
        seen.push(name);
        assert.ok(got >= m.column - 1, `${width}px, sub-tab ${tab + 1}: ${name} is ${got}px in a ${m.column}px column`);
      }
    }
    assert.ok(seen.some((n) => n.includes('ul.')) && seen.some((n) => n.includes('figure.')) && seen.some((n) => n.includes('p.caos-exec-key')) && seen.some((n) => n.includes('ol.')), `${width}px: the lists, the figures, the key messages and the actions were measured`);
    await page.close();
  }
});

test('a source note with a long URL wraps inside the column at 390 px (BL-053)', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(address);
  await page.waitForSelector('[data-executive-view] .caos-exec-notes li');
  const m = await page.evaluate(`(() => {
    const ol = document.querySelector('[data-executive-view] .caos-exec-notes');
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = 'https://www.cmfchile.cl/portal/principal/613/articles-' + 'x'.repeat(120) + '.pdf';
    a.textContent = a.href;
    li.appendChild(a);
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
    await route.fulfill({ response: r, body: (await r.text()).replace(/\bkey_statement:\s*\{/, 'key_statement_x: {') });
  });
  await page.goto(address);
  await page.waitForSelector('[data-executive-view]');
  assert.equal(await page.getAttribute('[data-executive-view]', 'data-executive-valid'), 'false');
  assert.ok((await page.textContent('[data-executive-view]'))?.includes('key_statement'));
  assert.equal(await page.locator('[data-exec-section]').count(), 0);
  await page.close();
});
