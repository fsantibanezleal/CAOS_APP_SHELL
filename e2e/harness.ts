import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser } from '@playwright/test';

// A small page for a browser test of one shell component: the entry source is bundled with esbuild, the stylesheet is the
// shell's own, and extra files (an illustration, say) are served from memory. Not a test itself (no `.test.` in the name).

const root = fileURLToPath(new URL('..', import.meta.url));

export interface Harness {
  browser: Browser;
  address: string;
  close: () => Promise<void>;
}

export async function startHarness(entry: string, files: Record<string, { type: string; body: string | Buffer }> = {}): Promise<Harness> {
  const script = await build({
    stdin: { contents: entry, resolveDir: root, sourcefile: 'harness-entry.tsx', loader: 'tsx' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const server: Server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url === '/entry.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(script.outputFiles[0].text);
    } else if (url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
    } else if (files[url]) {
      res.setHeader('Content-Type', files[url].type);
      res.end(files[url].body);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<!doctype html><html lang="en" data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>',
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
  };
}
