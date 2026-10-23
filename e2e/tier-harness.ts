import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

// A page for the browser tests of Tier A (shell 0.19.0): the entry is bundled with esbuild and reads `?form=` to draw one
// chart or document, `?lang=` for the interface language; the stylesheets are the shell's own (styles.css, chart.css, uPlot's, KaTeX's).
// `window.setLang`, `window.setTheme` are exposed to the entry by the entry itself. Not a test (no `.test.` in the name).

const root = fileURLToPath(new URL('..', import.meta.url));

export interface TierPage {
  browser: Browser;
  address: string;
  close: () => Promise<void>;
  /** Opens a form in a new page; `errors` collects page errors and console errors. */
  open: (query: string, opts?: { width?: number; height?: number; touch?: boolean }) => Promise<{ page: Page; context: BrowserContext; errors: string[] }>;
}

export async function startTierPage(entry: string): Promise<TierPage> {
  const script = await build({
    stdin: { contents: entry, resolveDir: root, sourcefile: 'tier-entry.tsx', loader: 'tsx' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const chartCss = await readFile(new URL('../chart.css', import.meta.url), 'utf8');
  const uplotCss = await readFile(new URL('../node_modules/uplot/dist/uPlot.min.css', import.meta.url), 'utf8');
  const katexCss = await readFile(new URL('../node_modules/katex/dist/katex.min.css', import.meta.url), 'utf8');
  const server: Server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url === '/entry.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(script.outputFiles[0].text);
    } else if (url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      // the @import of styles.css points at KaTeX's sheet, served below from the same place
      res.end(uplotCss + css.replace('@import "katex/dist/katex.min.css";', '') + chartCss);
    } else if (url === '/katex.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(katexCss.replace(/url\(fonts\//g, 'url(/katex-fonts/'));
    } else if (url.startsWith('/katex-fonts/')) {
      readFile(fileURLToPath(new URL(`../node_modules/katex/dist/fonts/${url.slice('/katex-fonts/'.length)}`, import.meta.url)))
        .then((b) => {
          res.setHeader('Content-Type', url.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream');
          res.end(b);
        })
        .catch(() => {
          res.statusCode = 404;
          res.end();
        });
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/katex.css"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch();
  return {
    browser,
    address,
    close: async () => {
      await browser.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
    open: async (query, opts = {}) => {
      const context = await browser.newContext({ viewport: { width: opts.width ?? 900, height: opts.height ?? 700 }, hasTouch: Boolean(opts.touch), isMobile: Boolean(opts.touch) && (opts.width ?? 900) < 600 });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto(`${address}/?${query}`);
      return { page, context, errors };
    },
  };
}
