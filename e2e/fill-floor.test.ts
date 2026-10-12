import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, type Browser } from '@playwright/test';

// The stage floor of a filling card (shell 0.11.1): two or three filling cards stacked in a short column used to be
// squeezed below the gate's 140 px stage floor, most of all in the wide fallback font, because the card had no minimum
// height of its own. At 1280 px and wider a filling card now keeps its own minimum (see styles.css); the containing
// panel scrolls when the cards do not fit. Below 1280 px nothing changes.

const FLOOR = 140;
const WIDE_FONT = ':root, :root[data-theme] { --font-sans: Verdana, "DejaVu Sans", sans-serif !important; }';
const NOTES = {
  en: Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of a long note that the requirements ask for.`).join(' <br> '),
  es: Array.from({ length: 12 }, (_, i) => `Línea ${i + 1} de una nota larga que piden los requisitos de la vista.`).join(' <br> '),
};
const TITLES = {
  en: 'Infected, model against simulation at the checkpoints',
  es: 'Infectados, modelo contra simulación en los puntos de control',
};

let browser: Browser, server: Server, address: string;
before(async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
      return;
    }
    const n = Number(url.searchParams.get('n') ?? 2);
    const h = Number(url.searchParams.get('h') ?? 520);
    const lang = (url.searchParams.get('lang') ?? 'en') as 'en' | 'es';
    const card = (i: number) =>
      `<figure class="caos-plot fill" data-plot="c${i}"><figcaption class="caos-plot-head"><span class="caos-plot-title">${TITLES[lang]}</span>` +
      '<span class="caos-plot-actions"><span class="badge">live</span></span></figcaption>' +
      '<div class="caos-plot-body"><div style="height:100%;background:#8884"></div></div>' +
      `<p class="caos-plot-note">${NOTES[lang]}</p></figure>`;
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<!doctype html><html data-theme="light" lang="${lang}"><head><link rel="stylesheet" href="/styles.css"><style>${WIDE_FONT}</style></head>` +
        '<body style="margin:0"><div style="display:flex;flex-direction:column;height:' + h + 'px;width:640px">' +
        `<div class="caos-views-col" id="col" style="flex:1 1 0;overflow-y:auto">${Array.from({ length: n }, (_, i) => card(i)).join('')}</div></div></body></html>`,
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

const STAGES = `[...document.querySelectorAll('.caos-plot.fill')].map((c) => c.querySelector(':scope > .caos-plot-body').getBoundingClientRect().height)`;

for (const [w, h] of [[1280, 800], [1600, 900]] as const) {
  for (const lang of ['en', 'es'] as const) {
    const size = `${w}x${h}`;
    test(`stacked filling cards keep the stage floor at ${size} in ${lang} with the wide font`, async () => {
      for (const n of [2, 3]) {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        try {
          // the column of a 1280 x 800 instrument panel is about 520 px tall
          await page.goto(`${address}/?n=${n}&lang=${lang}&h=${Math.round(h * 0.65)}`);
          const stages = (await page.evaluate(STAGES)) as number[];
          assert.equal(stages.length, n);
          for (const [i, s] of stages.entries()) assert.ok(s >= FLOOR, `card ${i + 1} of ${n} keeps ${s} px of drawing (floor ${FLOOR})`);
        } finally {
          await page.close();
        }
      }
    });
  }
}

test('a filling card alone in a tall column still fills it', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(`${address}/?n=1&lang=en&h=700`);
    const card = (await page.evaluate(`document.querySelector('.caos-plot.fill').getBoundingClientRect().height`)) as number;
    assert.ok(Math.abs(card - 700) < 2, `the card fills its 700 px column (${card})`);
  } finally {
    await page.close();
  }
});

test('below 1280 px the filling card has no minimum height of its own', async () => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  try {
    await page.goto(`${address}/?n=2&lang=en&h=300`);
    const min = (await page.evaluate(`getComputedStyle(document.querySelector('.caos-plot.fill')).minHeight`)) as string;
    assert.ok(min === '0px' || min === 'auto', `min-height is ${min}`);
  } finally {
    await page.close();
  }
});
