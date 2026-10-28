import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, type Browser } from '@playwright/test';

// The note of a filling card (CAOS_APP_SHELL#95): it kept its natural height and left the stage what was left, so a long
// note left the drawing a few pixels (Contraste measured 10 to 90 px at 1280 x 800). In a filling card the note keeps at
// most 35% of the card and scrolls beyond it; below 900 px, where the document scrolls and the body has a fixed height,
// the note is not capped.

let browser: Browser, server: Server, address: string;
const NOTE = Array.from({ length: 20 }, (_, i) => `Line ${i + 1} of a long note that the requirements ask for.`).join(' <br> ');
before(async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><html data-theme="light"><head><link rel="stylesheet" href="/styles.css"></head><body style="margin:0">' +
        '<div style="display:flex;flex-direction:column;height:600px;width:700px">' +
        '<figure class="caos-plot fill" id="card"><figcaption class="caos-plot-head"><span class="caos-plot-title">Card</span></figcaption>' +
        '<div class="caos-plot-body" id="body"><div style="height:100%;background:#8884"></div></div>' +
        `<p class="caos-plot-note" id="note">${NOTE}</p></figure></div>` +
        '<div data-caos-note-fit style="display:flex;flex-direction:column;height:600px;width:700px">' +
        '<figure class="caos-plot fill" id="fcard"><figcaption class="caos-plot-head"><span class="caos-plot-title">Card</span></figcaption>' +
        '<div class="caos-plot-body" id="fbody"><div style="height:100%;background:#8884"></div></div>' +
        `<p class="caos-plot-note" id="fnote">${NOTE} <br> ${NOTE}</p></figure></div>` +
        '<div data-caos-note-fit style="display:flex;flex-direction:column;height:600px;width:700px">' +
        '<figure class="caos-plot fill" id="scard"><figcaption class="caos-plot-head"><span class="caos-plot-title">Card</span></figcaption>' +
        '<div class="caos-plot-body" id="sbody"><div style="height:100%;background:#8884"></div></div>' +
        `<p class="caos-plot-note" id="snote">${NOTE.split(' <br> ').slice(0, 12).join(' <br> ')}</p></figure></div></body></html>`,
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

const SIZES = `(() => {
  const h = (s) => document.querySelector(s).getBoundingClientRect().height;
  const note = document.querySelector('#note');
  return { card: h('#card'), body: h('#body'), note: h('#note'), noteScroll: note.scrollHeight, noteClient: note.clientHeight };
})()`;

test('a twenty-line note in a 600 px filling card takes at most 35% of the card and scrolls', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(address);
    const s = (await page.evaluate(SIZES)) as { card: number; body: number; note: number; noteScroll: number; noteClient: number };
    assert.ok(Math.abs(s.card - 600) < 2, `the card fills its 600 px box (${s.card})`);
    assert.ok(s.note <= 0.35 * s.card + 1, `the note takes ${s.note} px of ${s.card}, over 35%`);
    assert.ok(s.noteScroll > s.noteClient + 20, `the note scrolls (${s.noteScroll} px of content in ${s.noteClient})`);
    assert.ok(s.body >= 0.5 * s.card, `the body keeps the rest (${s.body} px of ${s.card})`);
  } finally {
    await page.close();
  }
});

test('below 900 px the note is not capped (the document scrolls)', async () => {
  const page = await browser.newPage({ viewport: { width: 700, height: 800 } });
  try {
    await page.goto(address);
    const s = (await page.evaluate(SIZES)) as { card: number; body: number; note: number; noteScroll: number; noteClient: number };
    assert.ok(s.noteScroll <= s.noteClient + 1, `the note shows all its lines (${s.noteScroll} px of content in ${s.noteClient})`);
  } finally {
    await page.close();
  }
});

const FIT = `(() => {
  const h = (s) => document.querySelector(s).getBoundingClientRect().height;
  const n = (s) => document.querySelector(s);
  return { card: h('#fcard'), body: h('#fbody'), note: h('#fnote'), scroll: n('#fnote').scrollHeight, client: n('#fnote').clientHeight,
           scard: h('#scard'), snote: h('#snote'), sscroll: n('#snote').scrollHeight, sclient: n('#snote').clientHeight };
})()`;

test('SHC-101: under data-caos-note-fit at 1280 px a note takes what it needs, the body keeps the stage floor, and a note too long scrolls', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(address);
    const s = (await page.evaluate(FIT)) as Record<string, number>;
    assert.ok(Math.abs(s.card - 600) < 2, `the card fills its 600 px box (${s.card})`);
    assert.ok(s.note > 0.35 * s.card + 1, `the note is not capped at 35% (${s.note} px of ${s.card})`);
    assert.ok(s.body >= 139, `the body keeps the 140 px stage floor (${s.body})`);
    assert.ok(s.scroll > s.client + 20, `the note too long for the card scrolls in its own box (${s.scroll} px in ${s.client})`);
    assert.ok(s.snote > 0.35 * s.scard + 1 && s.sscroll <= s.sclient + 1, `a twelve-line note that fits is whole (${s.sscroll} px in ${s.sclient})`);
  } finally {
    await page.close();
  }
});

test('SHC-101: under data-caos-note-fit below 1280 px the 35% cap stays', async () => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  try {
    await page.goto(address);
    const s = (await page.evaluate(FIT)) as Record<string, number>;
    assert.ok(s.note <= 0.35 * s.card + 1, `the note keeps the cap (${s.note} px of ${s.card})`);
  } finally {
    await page.close();
  }
});
