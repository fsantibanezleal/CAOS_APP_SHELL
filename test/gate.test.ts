import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { after, before, test } from 'node:test';
import { decodePng, paintedBox, unionArea } from '../gate/png.mjs';
import { servePages } from '../gate/serve.mjs';

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
