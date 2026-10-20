import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { after, before, test } from 'node:test';
import { decodePng, paintedBox, unionArea } from '../gate/png.mjs';
import { servePages } from '../gate/serve.mjs';
import { ANIMATION_MAX_SECONDS, analyseSvgAnimation, animationFailures } from '../gate/areas.mjs';

/** The gate's own building blocks, without a browser: the Pages-faithful server and the pixel arithmetic of G6. */

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** An RGB PNG of `w` x `h` on a background, with one filled rectangle; rows use filter 1 (sub) to exercise unfiltering. */
function png(w: number, h: number, bg: number[], rect: { x: number; y: number; w: number; h: number; c: number[] } | null): Buffer {
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y += 1) {
    const raw = Buffer.alloc(w * 3);
    for (let x = 0; x < w; x += 1) {
      const inRect = rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const c = inRect ? rect.c : bg;
      raw[x * 3] = c[0];
      raw[x * 3 + 1] = c[1];
      raw[x * 3 + 2] = c[2];
    }
    const sub = Buffer.alloc(w * 3);
    for (let i = 0; i < raw.length; i += 1) sub[i] = (raw[i] - (i >= 3 ? raw[i - 3] : 0)) & 255;
    rows.push(Buffer.concat([Buffer.from([1]), sub]));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

test('G6 arithmetic: a drawn rectangle is found exactly, a uniform region is blank, unions do not double count', () => {
  const img = decodePng(png(120, 80, [250, 250, 250], { x: 30, y: 20, w: 40, h: 10, c: [20, 90, 200] }));
  assert.equal(img.width, 120);
  assert.equal(img.height, 80);
  assert.deepEqual(paintedBox(img, { x: 0, y: 0, w: 120, h: 80 }), { x: 30, y: 20, w: 40, h: 10, painted: 400 });
  assert.equal(paintedBox(decodePng(png(50, 40, [12, 12, 12], null)), { x: 0, y: 0, w: 50, h: 40 }), null);
  assert.equal(unionArea([{ x: 0, y: 0, w: 40, h: 40 }, { x: 20, y: 0, w: 40, h: 40 }], 100, 100), 60 * 40);
});

let dir = '';
let server: { url: string; close: () => Promise<void> };
before(async () => {
  // Inside the checkout's ignored work folder, never the system temp directory.
  const work = fileURLToPath(new URL('../.gate-selftest/', import.meta.url));
  mkdirSync(work, { recursive: true });
  dir = mkdtempSync(join(work, 'serve-'));
  writeFileSync(join(dir, 'index.html'), '<p>home</p>');
  mkdirSync(join(dir, 'methodology'));
  writeFileSync(join(dir, 'methodology', 'index.html'), '<p>methodology</p>');
  writeFileSync(join(dir, 'about.html'), '<p>about</p>');
  writeFileSync(join(dir, '404.html'), '<p>not found</p>');
  mkdirSync(join(dir, 'data'));
  writeFileSync(join(dir, 'data', 'a.json'), '{"ok":true}');
  server = await servePages(dir);
});
after(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

test('the local server answers as GitHub Pages does (G4 runs against what will be deployed)', async () => {
  const get = (p: string) => fetch(new URL(p, server.url), { redirect: 'manual' });
  assert.equal((await get('/')).status, 200);
  const dirNoSlash = await get('/methodology');
  assert.equal(dirNoSlash.status, 301);
  assert.equal(dirNoSlash.headers.get('location'), '/methodology/');
  assert.equal(await (await get('/methodology/')).text(), '<p>methodology</p>');
  assert.equal(await (await get('/about')).text(), '<p>about</p>');
  const json = await get('/data/a.json');
  assert.equal(json.status, 200);
  assert.match(json.headers.get('content-type') ?? '', /application\/json/);
  const missing = await get('/data/missing.json');
  assert.equal(missing.status, 404, 'no SPA fallback: a missing artifact is a 404');
  assert.equal(await missing.text(), '<p>not found</p>');
  assert.equal((await get('/../secret')).status, 404);
});

test('an animated SVG is found, measured and checked for its reduced-motion block', () => {
  const svg = (inner: string, style = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${style ? `<style>${style}</style>` : ''}${inner}</svg>`;
  const still = analyseSvgAnimation(svg('<rect/>'));
  assert.equal(still.animated, false, 'a still is not animated');
  assert.deepEqual(animationFailures(still, 'pain'), []);
  const good = analyseSvgAnimation(svg('<rect class="a"/>', '@keyframes grow { from { opacity: 0 } to { opacity: 1 } } .a { animation: grow 4s ease-out infinite; } @media (prefers-reduced-motion: reduce) { .a { animation: none; opacity: 1; } }'));
  assert.deepEqual([good.animated, good.css, good.smil, good.reducedBlock, good.neutralises, good.seconds], [true, true, false, true, true, 4]);
  assert.deepEqual(animationFailures(good, 'pain'), []);
  const noBlock = analyseSvgAnimation(svg('<rect class="a"/>', '@keyframes grow { to { opacity: 1 } } .a { animation: grow 4s; }'));
  assert.match(animationFailures(noBlock, 'pain').join('|'), /illustration "pain" is animated and has no @media \(prefers-reduced-motion: reduce\) block/);
  const idle = analyseSvgAnimation(svg('<rect class="a"/>', '@keyframes grow { to { opacity: 1 } } .a { animation: grow 4s; } @media (prefers-reduced-motion: reduce) { .a { opacity: 1; } }'));
  assert.match(animationFailures(idle, 'pain').join('|'), /does not stop its CSS animation/);
  const smil = analyseSvgAnimation(svg('<rect><animate attributeName="width" from="1" to="9" dur="4s" begin="1s" fill="freeze"/></rect>', '@media (prefers-reduced-motion: reduce) { rect { width: 9px; } }'));
  assert.deepEqual([smil.animated, smil.css, smil.smil, smil.reducedBlock, smil.seconds], [true, false, true, true, 5]);
  assert.deepEqual(animationFailures(smil, 'situation'), [], 'a SMIL animation needs the block, not animation: none');
  const long = analyseSvgAnimation(svg('<rect class="a"/>', '.a { animation: grow 8s 3s infinite; } @keyframes grow { to { opacity: 1 } } @media (prefers-reduced-motion: reduce) { .a { animation: none; } }'));
  assert.equal(long.seconds, 11);
  assert.match(animationFailures(long, 'pain').join('|'), new RegExp(`plays for 11 s; the limit is ${ANIMATION_MAX_SECONDS} s`));
  const ms = analyseSvgAnimation(svg('<rect class="a"/>', '.a { animation-name: grow; animation-duration: 2500ms; } @keyframes grow { to { opacity: 1 } } @media (prefers-reduced-motion: reduce) { .a { animation-name: none; } }'));
  assert.equal(ms.seconds, 2.5);
  assert.deepEqual(animationFailures(ms, 'pain'), []);
  assert.equal(ANIMATION_MAX_SECONDS, 10);
});

test('a finite count of cycles plays that many times and an over-long play is refused', () => {
  const svg = (style: string, inner = '<rect class="a"/>') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>${style}</style>${inner}</svg>`;
  const block = '@media (prefers-reduced-motion: reduce) { .a { animation: none; } }';
  const five = analyseSvgAnimation(svg(`@keyframes g { to { opacity: 1 } } .a { animation: g 4s ease 5; } ${block}`));
  assert.equal(five.seconds, 20);
  assert.match(animationFailures(five, 'pain').join('|'), /plays for 20 s; the limit is 10 s/);
  const count = analyseSvgAnimation(svg(`@keyframes g { to { opacity: 1 } } .a { animation-name: g; animation-duration: 4s; animation-iteration-count: 3; } ${block}`));
  assert.equal(count.seconds, 12);
  const loop = analyseSvgAnimation(svg(`@keyframes g { to { opacity: 1 } } .a { animation: g 4s infinite; } ${block}`));
  assert.equal(loop.seconds, 4, 'a loop counts one cycle');
  const smil = analyseSvgAnimation(svg('@media (prefers-reduced-motion: reduce) { rect { width: 9px; } }', '<rect><animate attributeName="width" dur="4s" repeatCount="3"/></rect>'));
  assert.equal(smil.seconds, 12);
  const once = analyseSvgAnimation(svg(`@keyframes g { to { opacity: 1 } } .a { animation: g 4s ease 1; } ${block}`));
  assert.equal(once.seconds, 4);
});

test('--spa-fallback answers as nginx try_files does: an extensionless path that matches no file gets index.html with 200, a path with an extension stays 404; off by default (shell 0.16.0)', async () => {
  const spa = await servePages(dir, '/', 0, { spaFallback: true });
  try {
    const get = (p: string) => fetch(new URL(p, spa.url), { redirect: 'manual' });
    const deep = await get('/some/deep/route');
    assert.equal(deep.status, 200, 'an unknown extensionless path answers the app shell');
    assert.equal(await deep.text(), '<p>home</p>');
    assert.equal((await get('/app')).status, 200);
    assert.equal(await (await get('/about')).text(), '<p>about</p>', 'a path that matches a file still serves it');
    assert.equal(await (await get('/methodology/')).text(), '<p>methodology</p>');
    const missing = await get('/data/missing.json');
    assert.equal(missing.status, 404, 'a missing artifact still fails');
    assert.equal(await missing.text(), '<p>not found</p>');
    assert.equal((await get('/assets/gone.js')).status, 404);
  } finally {
    await spa.close();
  }
  const pages = await fetch(new URL('/some/deep/route', server.url), { redirect: 'manual' });
  assert.equal(pages.status, 404, 'without the option the server is GitHub Pages: no fallback');
});

test('--spa-fallback edge paths, as documented: a directory without an index, a dotted directory name, a dotfile and a query string (shell 0.16.0)', async () => {
  mkdirSync(join(dir, 'assets'), { recursive: true });
  const spa = await servePages(dir, '/', 0, { spaFallback: true });
  try {
    const get = (p: string) => fetch(new URL(p, spa.url), { redirect: 'manual' });
    // a directory with no index.html answers the app shell (nginx would answer 301, then 403)
    const directory = await get('/assets');
    assert.equal(directory.status, 200);
    assert.equal(await directory.text(), '<p>home</p>');
    // a dot in a directory name reads as an extension: the route is a 404, not the app (nginx would serve the app)
    assert.equal((await get('/route/with.dot/')).status, 404);
    assert.equal((await get('/app/run.v2')).status, 404);
    // a dotfile has no extension: it answers the app shell, never the file
    const dotfile = await get('/.env');
    assert.equal(dotfile.status, 200);
    assert.equal(await dotfile.text(), '<p>home</p>');
    // the query string is no part of the path: an extensionless path with one answers the app shell, a missing file with one stays 404
    assert.equal((await get('/some/route?x=1.5')).status, 200);
    assert.equal((await get('/missing.js?v=2')).status, 404);
  } finally {
    await spa.close();
  }
});
