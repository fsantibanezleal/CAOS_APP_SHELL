// G15: the gate proves itself. The fixture product (test/gate-fixture) is built once and served as GitHub Pages
// serves a site; the gate must pass it clean in the full matrix, and every planted defect must make the check that
// owns it fail with its own message. A check that cannot fail on its plant is a check that agrees with a broken
// app (failure class 10). Run with `npm run test:gate` (needs playwright and its chromium).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';
import { buildFixture, makePlant } from './gate-fixture/build.mjs';
import { runGate } from '../gate/run.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const work = join(root, '.gate-selftest');
const clean = join(work, 'clean');
const BRAND = 'GateFixture';
const QUICK = { sizes: '1280x800', themes: 'light', langs: 'en', idleMs: 600 };

/** One plant per check (and per distinct trap inside a check); `expect` must appear among the failures. */
const PLANTS = [
  { id: 'brand', check: 'G1', re: /not "GateFixture"/ },
  { id: 'mode-theme', check: 'G2', re: /data-theme=dark/, opts: { routes: '/,/introduction' } },
  { id: 'mode-lang', check: 'G2', re: /<html lang> is en/, opts: { langs: 'es', routes: '/,/introduction' } },
  { id: 'console', check: 'G3', re: /planted: the methodology page fails/, opts: { routes: '/,/methodology' } },
  { id: 'http404', check: 'G3', re: /HTTP 404 for .*missing\.json/, opts: { routes: '/,/benchmark' } },
  { id: 'case-only', check: 'G3', re: /planted: the high-contact case fails/, trail: /case c-high/, opts: { routes: '/' } },
  { id: 'deeplink', check: 'G4', re: /methodology answered 404/, opts: { routes: '/,/methodology' } },
  { id: 'fallback-json', check: 'G4', re: /artifact.json did not answer JSON/, opts: { routes: '/,/benchmark' } },
  { id: 'thin-doc', check: 'G4', re: /characters of text/, opts: { routes: '/,/experiments' } },
  { id: 'missing-200', check: 'G4', re: /a missing asset answered 200/, server: 'spa', opts: { routes: '/' } },
  { id: 'clip', check: 'G5', re: /cuts \d+px of content/, opts: { routes: '/,/introduction' } },
  { id: 'hoverflow', check: 'G5', re: /cuts \d+px of content horizontally|scrolls sideways/, opts: { routes: '/,/introduction' } },
  { id: 'mobile-only', check: 'G5', re: /horizontal overflow|outside the viewport|scrolls sideways/, mode: /^390x844/, opts: { sizes: '390x844,1280x800', routes: '/,/introduction' } },
  { id: 'covered', check: 'G5', re: /is covered by/, opts: { routes: '/' } },
  { id: 'rail-overflow', check: 'G5', re: /outside the rail/, opts: { routes: '/' } },
  { id: 'truncated', check: 'G5', re: /truncated text/, opts: { routes: '/' } },
  { id: 'deep-defect', check: 'G5', re: /scrolls sideways/, trail: /validation > table/, opts: { routes: '/' } },
  { id: 'shrunk-tabs', check: 'G5', re: /cuts its tabs by \d+px/, trail: /validation > daily/, opts: { routes: '/' } },
  { id: 'blank', check: 'G6', re: /is blank/, opts: { routes: '/' } },
  { id: 'small', check: 'G6', re: /draws on \d+% of its stage/, opts: { routes: '/' } },
  { id: 'repeat-ticks', check: 'G6', re: /axis tick label\(s\) repeat the label before them/, opts: { routes: '/' } },
  { id: 'never-ready', check: 'G7', re: /data-state="loading"/, opts: { routes: '/,/benchmark', settleMs: 3000 } },
  { id: 'raf-loop', check: 'G8', re: /animation frames/, opts: { routes: '/' } },
  { id: 'mutation-loop', check: 'G8', re: /DOM mutations/, opts: { routes: '/' } },
  { id: 'dead-knob', check: 'G9', re: /control "scale" did not change the selection key/, opts: { routes: '/' } },
  { id: 'wrong-case', check: 'G9', re: /asked for case [\w-]+; the workbench shows/, opts: { routes: '/' } },
  { id: 'no-controls', check: 'G9', re: /no registered control/, opts: { routes: '/' } },
  { id: 'stuck-view', check: 'G9', re: /did not settle|keep an earlier selection key/, opts: { routes: '/', settleMs: 3000 } },
];

/** A static server with an SPA fallback: every unknown path answers index.html with 200 (the G4 plant). */
function serveSpa(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = join(dir, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = existsSync(join(file, 'index.html')) ? join(file, 'index.html') : join(dir, 'index.html');
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((d) => server.close(() => d())) })));
}

const show = (r) => r.failures.map((f) => `[${f.check}] ${f.route} ${f.mode} ${f.trail} :: ${f.message}`).join('\n');

before(async () => {
  await buildFixture(clean);
});

test('the clean fixture passes every check in the full matrix (five sizes, both themes, both languages)', { timeout: 1_800_000 }, async () => {
  const r = await runGate({ serve: clean, expectBrand: BRAND, idleMs: 1000, out: join(work, 'out-clean') });
  assert.ok(r.states > 100, `the walk measured ${r.states} states; it should cover every route, tab and case`);
  assert.equal(r.failures.length, 0, `the clean fixture failed:\n${show(r)}`);
});

describe('every planted defect fails the check that owns it', { concurrency: 4 }, () => {
  const servers = [];
  after(async () => {
    for (const s of servers) await s.close();
  });
  for (const p of PLANTS) {
    test(`${p.check}: ${p.id}`, { timeout: 600_000 }, async () => {
      const dir = makePlant(clean, join(work, `plant-${p.id}`), p.id);
      const target = p.server === 'spa' ? await serveSpa(dir) : null;
      if (target) servers.push(target);
      const r = await runGate({
        ...QUICK,
        ...(target ? { url: target.url } : { serve: dir }),
        expectBrand: BRAND,
        out: join(work, `out-${p.id}`),
        ...(p.opts ?? {}),
      });
      const hit = r.failures.find((f) => f.check === p.check && p.re.test(f.message) && (!p.trail || p.trail.test(f.trail)) && (!p.mode || p.mode.test(f.mode)));
      assert.ok(hit, `plant ${p.id} did not fail ${p.check} with ${p.re}${p.trail ? ` at ${p.trail}` : ''}; failures:\n${show(r) || '(none)'}`);
    });
  }
});

test('the CLI exits 2 without a subject and 1 on a failing subject', { timeout: 300_000 }, () => {
  const bin = join(root, 'bin', 'caos-shell-gate.mjs');
  const misuse = spawnSync(process.execPath, [bin, '--serve', clean], { encoding: 'utf8' });
  assert.equal(misuse.status, 2, misuse.stderr);
  assert.match(misuse.stderr, /--expect-brand is required/);
  const wrong = spawnSync(process.execPath, [bin, '--serve', clean, '--expect-brand', 'SomethingElse', '--sizes', '1280x800', '--themes', 'light', '--langs', 'en', '--out', join(work, 'out-cli')], { encoding: 'utf8' });
  assert.equal(wrong.status, 1, wrong.stdout + wrong.stderr);
  assert.match(wrong.stdout, /FAIL \[G1\]/);
});
