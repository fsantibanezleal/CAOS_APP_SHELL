import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, type Browser } from '@playwright/test';

// SHW-045 / CAOS_APP_SHELL#161: the Spanish replay badge must fit a real narrow MT plot column.

let browser: Browser;
let server: Server;
let address: string;

const card = (index: number) => `
  <figure class="caos-plot" data-plot="Resistividad aparente ${index}">
    <figcaption class="caos-plot-head">
      <span class="caos-plot-title">Resistividad aparente</span>
      <span class="caos-plot-actions">
        <span class="caos-badges">
          <span class="badge caos-lane caos-lane-replay">Reproduce el resultado precalculado</span>
          <span class="badge caos-prov caos-prov-synthetic">Datos sintéticos</span>
        </span>
      </span>
    </figcaption>
    <div class="caos-plot-body">Resultado numérico</div>
  </figure>`;

before(async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html lang="es" data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><main style="width:calc(100% - 32px);max-width:1500px;margin:16px auto"><div style="display:grid;grid-template-columns:minmax(170px,.6fr) minmax(0,2fr);gap:20px"><aside></aside><div id="mt-curves" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">${card(1)}${card(2)}</div></div></main></body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

test('PlotCard captions wrap Spanish lane and provenance badges inside narrow grid columns', async () => {
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  await page.goto(address);
  const result = await page.evaluate(() => {
    const plots = [...document.querySelectorAll<HTMLElement>('.caos-plot')];
    return {
      documentWidth: document.documentElement.scrollWidth,
      plots: plots.map((plot) => {
        const caption = plot.querySelector<HTMLElement>('.caos-plot-head')!;
        const title = caption.querySelector<HTMLElement>('.caos-plot-title')!;
        const actions = caption.querySelector<HTMLElement>('.caos-plot-actions')!;
        const badge = actions.querySelector<HTMLElement>('.caos-lane')!;
        const card = plot.getBoundingClientRect();
        const action = actions.getBoundingClientRect();
        const heading = title.getBoundingClientRect();
        const label = badge.getBoundingClientRect();
        return {
          width: plot.clientWidth,
          scrollWidth: plot.scrollWidth,
          captionWidth: caption.clientWidth,
          captionScrollWidth: caption.scrollWidth,
          actionTop: action.top,
          titleTop: heading.top,
          actionRight: action.right,
          badgeRight: label.right,
          cardRight: card.right,
        };
      }),
    };
  });

  assert.equal(result.documentWidth, 768, `document widened: ${JSON.stringify(result)}`);
  assert.equal(result.plots.length, 2);
  for (const [index, plot] of result.plots.entries()) {
    assert.ok(plot.width <= 265, `plot ${index} exceeded its 265px grid track: ${JSON.stringify(plot)}`);
    assert.ok(plot.scrollWidth <= plot.width, `plot ${index} has horizontal overflow: ${JSON.stringify(plot)}`);
    assert.ok(plot.captionScrollWidth <= plot.captionWidth, `caption ${index} has horizontal overflow: ${JSON.stringify(plot)}`);
    assert.ok(plot.actionTop > plot.titleTop, `caption ${index} did not move its actions to a second line: ${JSON.stringify(plot)}`);
    assert.ok(plot.actionRight <= plot.cardRight + 0.5, `actions ${index} protrude from the card: ${JSON.stringify(plot)}`);
    assert.ok(plot.badgeRight <= plot.cardRight + 0.5, `badge ${index} protrudes from the card: ${JSON.stringify(plot)}`);
  }
  await page.close();
});

test('PlotCard caption remains on one row when translated labels fit', async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(address);
  const rows = await page.locator('.caos-plot').evaluateAll((plots) => plots.map((plot) => {
    const title = plot.querySelector('.caos-plot-title')!.getBoundingClientRect();
    const actions = plot.querySelector('.caos-plot-actions')!.getBoundingClientRect();
    return { sameRow: Math.abs(title.top - actions.top) < 1, plotWidth: plot.clientWidth, title, actions };
  }));
  assert.ok(rows.every((row) => row.sameRow), `wide captions wrapped unexpectedly: ${JSON.stringify(rows)}`);
  await page.close();
});
