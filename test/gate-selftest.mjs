// G15: the gate proves itself. The fixture product (test/gate-fixture) is built once and served as GitHub Pages
// serves a site; the gate must pass it clean in the full matrix, and every planted defect must make the check that
// owns it fail with its own message. A check that cannot fail on its plant is a check that agrees with a broken
// app (failure class 10). Run with `npm run test:gate` (needs playwright and its chromium).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';
import { buildFixture, makePlant } from './gate-fixture/build.mjs';
import { runGate } from '../gate/run.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const work = join(root, '.gate-selftest');
const clean = join(work, 'clean');
const BRAND = 'GateFixture';
const QUICK = { sizes: '1280x800', themes: 'light', langs: 'en', idleMs: 600, wideFont: false };

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
  { id: 'stage-floor', check: 'G6', re: /the drawing of .* keeps \d+ px under its note \(floor 140 px\)/, opts: { routes: '/' } },
  { id: 'repeat-ticks', check: 'G6', re: /axis tick label\(s\) repeat the label before them/, opts: { routes: '/' } },
  { id: 'never-ready', check: 'G7', re: /data-state="loading"/, opts: { routes: '/,/benchmark', settleMs: 3000 } },
  { id: 'raf-loop', check: 'G8', re: /animation frames/, opts: { routes: '/' } },
  { id: 'mutation-loop', check: 'G8', re: /DOM mutations/, opts: { routes: '/' } },
  { id: 'dead-knob', check: 'G9', re: /control "scale" did not change the selection key/, opts: { routes: '/' } },
  { id: 'wrong-case', check: 'G9', re: /asked for case [\w-]+; the workbench shows/, opts: { routes: '/' } },
  { id: 'no-controls', check: 'G9', re: /no registered control/, opts: { routes: '/' } },
  { id: 'stuck-view', check: 'G9', re: /did not settle|keep an earlier selection key/, opts: { routes: '/', settleMs: 3000 } },
  { id: 'label-cut', check: 'G10', re: /"planted label past the edge" is cut by \d+px/, trail: /validation > table/, opts: { routes: '/' } },
  { id: 'label-overlap', check: 'G10', re: /"first planted label" and "second planted label" overlap/, trail: /validation > table/, opts: { routes: '/' } },
  { id: 'label-wide', check: 'G10', re: /"a label sized for a narrow font only" is cut/, mode: /wide-font/, opts: { routes: '/,/introduction', wideFont: true, wideFontSizes: '1280x800' } },
  { id: 'decimal-point', check: 'G11', re: /writes 0\.25 with a decimal point/, also: /writes 2\.7e-08 with a decimal point/, opts: { langs: 'es', routes: '/,/introduction' } },
  { id: 'sticky-off', check: 'G12', re: /active sub-tab .* is out of view/, opts: { routes: '/,/implementation' } },
  { id: 'refs-mid', check: 'ADR-0017.4', re: /references must be the last block of the page or tab/, opts: { routes: '/,/introduction' } },
  { id: 'refs-missing', check: 'ADR-0017.4', re: /cite references the page never lists/, opts: { routes: '/,/introduction' } },
  { id: 'unavailable-unexplained', check: 'G6', re: /data-state="unavailable".*reason/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-short', check: 'G6', re: /data-state="unavailable".*reason/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-beside-blank', check: 'G6', re: /is blank/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-hidden', check: 'G6', re: /nothing is drawn in the instrument/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-opacity', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-zero', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-offscreen', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-sronly', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-fontsize', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-clippath', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-textindent', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-tinyfont', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-punct', check: 'G6', re: /data-state="unavailable".*reason/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-hidden-text', check: 'G6', re: /data-state="unavailable".*reason/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-collapsed-chart', check: 'G6', re: /a drawing is present but not visible/, trail: /pending/, opts: { routes: '/' } },
  { id: 'unavailable-invisible-chart', check: 'G6', re: /a drawing is present but not visible/, trail: /pending/, opts: { routes: '/' } },
  { id: 'low-contrast', check: 'G13', re: /contrast \d\.\d\d:1, below 4\.5:1/, opts: { routes: '/,/introduction' } },
  // ADR-0017 2.1: the required areas of the documentation pages; each fails with its own floor
  { id: 'floor-no-executive', check: 'ADR-0017.2', re: /no executive view; the top-level topics are \[none\]/, opts: { routes: '/introduction' } },
  { id: 'floor-exec-second', check: 'ADR-0017.2', re: /the executive view is not the first topic \(the first is "technical"\)/, opts: { routes: '/introduction' } },
  { id: 'floor-exec-equation', check: 'ADR-0017.2', re: /executive view \(EN\): 1 equation\(s\); the executive view holds no equation/, opts: { routes: '/introduction' } },
  { id: 'floor-five-sections', check: 'ADR-0017.2', re: /no section declares the area "math"/, opts: { routes: '/introduction' } },
  { id: 'floor-glossary-nine', check: 'ADR-0017.2', re: /math area.*9 glossary items, the floor is 10/, opts: { routes: '/introduction' } },
  { id: 'floor-pipeline-unordered', check: 'ADR-0017.2', re: /pipeline area.*0 steps in an ordered list, the floor is 4/, opts: { routes: '/introduction' } },
  { id: 'floor-honesty-none', check: 'ADR-0017.2', re: /honesty area.*0 honest callouts, exactly 1 is required/, opts: { routes: '/introduction' } },
  { id: 'floor-area-unknown', check: 'ADR-0017.2', re: /declares the unknown area "extras"/, opts: { routes: '/introduction' } },
  { id: 'floor-method-topics', check: 'ADR-0017.2', re: /Methodology \(EN\): 5 topics, the floor is 6/, opts: { routes: '/methodology' } },
  { id: 'floor-method-dense', check: 'ADR-0017.2', re: /method area, topic "Theory" \(EN\): 3 dense paragraphs, the floor is 4/, opts: { routes: '/methodology' } },
  { id: 'floor-method-equations', check: 'ADR-0017.2', re: /method area, topic "Numerics" \(EN\): 1 captioned equation, the floor is 2/, opts: { routes: '/methodology' } },
  { id: 'floor-method-figure', check: 'ADR-0017.2', re: /method area, topic "Numerics" \(EN\): 0 figures with a caption, the floor is 1/, opts: { routes: '/methodology' } },
  { id: 'floor-method-honest', check: 'ADR-0017.2', re: /method area, topic "Theory" \(EN\): 2 honest callouts, exactly 1 is required/, opts: { routes: '/methodology' } },
  { id: 'floor-method-learned', check: 'ADR-0017.2', re: /Methodology \(EN\): 1 topic of kind learned, the floor is 2/, opts: { routes: '/methodology' } },
  { id: 'floor-lede-short', check: 'ADR-0017.2', re: /Experiments \(EN\): the lede holds 3 word\(s\), the floor is 35/, opts: { routes: '/experiments' } },
  { id: 'floor-impl-architecture', check: 'ADR-0017.2', re: /no section declares the area "architecture"/, opts: { routes: '/implementation' } },
  { id: 'floor-exp-datasets', check: 'ADR-0017.2', re: /no section declares the area "datasets"/, opts: { routes: '/experiments' } },
  { id: 'floor-bench-caveat', check: 'ADR-0017.2', re: /no section declares the area "caveat"/, opts: { routes: '/benchmark' } },
  { id: 'floor-es-area', check: 'ADR-0017.2', re: /Implementation \(ES\): no section declares the area "lanes"/, opts: { routes: '/implementation', langs: 'es' } },
  { id: 'floor-waiver-reason', check: 'ADR-0017.2', re: /the waiver for "comparison" has a reason of 5 character/, opts: { routes: '/benchmark' } },
  { id: 'floor-waiver-unknown', check: 'ADR-0017.2', re: /the waiver for "nonsense" is refused/, opts: { routes: '/benchmark' } },
  { id: 'floor-hidden', check: 'ADR-0017.2', re: /method area, topic "Theory" \(EN\): 2 dense paragraphs, the floor is 4/, opts: { routes: '/methodology' } },
  { id: 'floor-duplicate', check: 'ADR-0017.2', re: /method area, topic "Theory" \(EN\): 1 dense paragraph, the floor is 4/, opts: { routes: '/methodology' } },
  { id: 'floor-waiver-other', check: 'ADR-0017.2', re: /pipeline area.*0 steps in an ordered list, the floor is 4/, not: /(math area|area "math")/, opts: { routes: '/introduction' } },
  { id: 'area-hidden-filler', check: 'ADR-0017.2', re: /executive view \(EN\): \d+ field\(s\) are in the page and a reader cannot read them/, opts: { routes: '/introduction' } },
  // 0.11.0 gate review: what a reader cannot read, whatever the box says; the views; the visible parts of a statement, item or step
  { id: 'area-hidden-textindent', check: 'ADR-0017.2', re: /executive view \(EN\): \d+ field\(s\) are in the page and a reader cannot read them/, opts: { routes: '/introduction' } },
  { id: 'area-hidden-tinyfont', check: 'ADR-0017.2', re: /executive view \(EN\): \d+ field\(s\) are in the page and a reader cannot read them/, opts: { routes: '/introduction' } },
  { id: 'area-hidden-clippath', check: 'ADR-0017.2', re: /executive view \(EN\): \d+ field\(s\) are in the page and a reader cannot read them/, opts: { routes: '/introduction' } },
  { id: 'floor-exec-not-default', check: 'ADR-0017.2', re: /the executive view is not the view the page opens on \(it opens on "technical"\)/, opts: { routes: '/introduction' } },
  { id: 'floor-math-outside', check: 'ADR-0017.2', re: /section "The governing mathematics" sits outside the two views/, also: /executive view \(EN\): 3 equation\(s\); the executive view holds no equation/, opts: { routes: '/introduction' } },
  { id: 'floor-glossary-hidden', check: 'ADR-0017.2', re: /math area.*1 glossary item, the floor is 10/, opts: { routes: '/introduction' } },
  { id: 'floor-steps-hidden', check: 'ADR-0017.2', re: /pipeline area.*1 step in an ordered list, the floor is 4/, opts: { routes: '/introduction' } },
  { id: 'floor-steps-empty', check: 'ADR-0017.2', re: /pipeline area.*0 steps in an ordered list, the floor is 4/, opts: { routes: '/introduction' } },
  { id: 'floor-waiver-punct', check: 'ADR-0017.2', re: /the waiver for "comparison" has a reason of 12 character/, opts: { routes: '/benchmark' } },
  { id: 'floor-exec-transparent-es', check: 'G13', re: /contrast 1\.00:1/, mode: /light es$/, opts: { routes: '/introduction', langs: 'en,es' } },
  { id: 'floor-method-norefs', check: 'ADR-0017.2', re: /method area, topic "Theory" \(EN\): 0 references cited, the floor is 1/, opts: { routes: '/methodology' } },
  { id: 'floor-live-button', check: 'ADR-0017.2', re: /live area.*0 controls, the floor is 1/, opts: { routes: '/benchmark' } },
  // 0.12.0: the executive view is the shell's ExecutiveView on content/executive.json (docs/06_executive-view.md); the gate checks it whole
  { id: 'exec-invalid-data', check: 'ADR-0017.2', re: /executive view \(EN\): the data file is not valid in the page: .*why_now\.figure.*tagline/, opts: { routes: '/introduction' } },
  { id: 'exec-outcomes-two', check: 'ADR-0017.2', re: /the data file is not valid in the page: outcomes: needs at least 3 item\(s\), has 2/, opts: { routes: '/introduction' } },
  { id: 'exec-dialogue-six', check: 'ADR-0017.2', re: /the data file is not valid in the page: dialogue: allows at most 5 item\(s\), has 6/, opts: { routes: '/introduction' } },
  { id: 'exec-four-cs-present', check: 'ADR-0017.2', re: /the data file is not valid in the page: four_cs: is not allowed yet/, opts: { routes: '/introduction' } },
  { id: 'exec-old-areas', check: 'ADR-0017.2', re: /declares the unknown area "initiative"/, also: /no ExecutiveView \(\[data-executive-view\]\)/, opts: { routes: '/introduction' } },
  { id: 'exec-fifth-section', check: 'ADR-0017.2', re: /executive view \(EN\): 1 DocSection\(s\) placed in the executive view \(A fifth section\); the view has exactly its four sections and takes none/, opts: { routes: '/introduction' } },
  { id: 'exec-stranger-text', check: 'ADR-0017.2', re: /executive view \(EN\): 1 block\(s\) beside the ExecutiveView \("A paragraph a product placed beside the executive/, opts: { routes: '/introduction' } },
  { id: 'exec-long-sentence', check: 'ADR-0017.2', re: /Introduction, executive view \(EN\): field "vision": a sentence of 31 words; the limit is 30/, also: /Introduction, executive view \(ES\): field "vision": a sentence of 31 words/, opts: { routes: '/introduction', langs: 'en,es' } },
  { id: 'exec-es-only-long', check: 'ADR-0017.2', re: /Introduction, executive view \(ES\): field "vision": a sentence of 31 words; the limit is 30/, not: /executive view \(EN\): field "vision"/, opts: { routes: '/introduction', langs: 'en,es' } },
  { id: 'exec-citation-inline', check: 'ADR-0017.2', re: /field "vision": holds an inline citation/, opts: { routes: '/introduction' } },
  { id: 'exec-equation-text', check: 'ADR-0017.2', re: /field "vision": holds an equation or a TeX marker/, opts: { routes: '/introduction' } },
  { id: 'exec-illustration-colour', check: 'ADR-0017.2', re: /illustration "initiative" uses literal colour\(s\) fill: #1f77b4|illustration "initiative" uses literal colour\(s\) stroke: #1f77b4/, opts: { routes: '/introduction' } },
  { id: 'exec-illustration-chart', check: 'ADR-0017.2', re: /illustration "problem" declares a chart \(data-chart\)/, opts: { routes: '/introduction' } },
  { id: 'exec-illustration-label-outside', check: 'ADR-0017.2', re: /illustration "initiative": label\(s\) outside the viewBox: "Past the edge of the drawing"/, opts: { routes: '/introduction' } },
  { id: 'exec-illustration-missing', check: 'ADR-0017.2', re: /illustration "solution": the file "executive\/solution\.svg" did not load/, opts: { routes: '/introduction' } },
];

/** Legitimate pages that the gate once failed (ADR-0017 2.1 allows them): each must pass every check, in both languages. */
const LEGIT = [
  { id: 'legit-engine-subtabs', opts: { routes: '/,/implementation' } },
  { id: 'legit-method-view-tabs', opts: { routes: '/,/methodology' } },
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
  // G14: one page shows every capture, the wide-font pass's included
  const index = readFileSync(join(work, 'out-clean', 'index.html'), 'utf8');
  assert.ok(r.captures >= 30, `${r.captures} captures`);
  for (const name of readdirSync(join(work, 'out-clean', 'shots'))) assert.ok(index.includes(`shots/${name}`), `index.html shows ${name}`);
  assert.ok(readdirSync(join(work, 'out-clean', 'shots')).some((n) => n.endsWith('_wide.png')), 'the wide-font pass captured its states');
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
      if (p.not) assert.ok(!r.failures.some((f) => f.check === p.check && p.not.test(f.message)), `plant ${p.id} failed ${p.check} with ${p.not}, a floor its waiver names; failures:
${show(r)}`);
      if (p.also) assert.ok(r.failures.some((f) => f.check === p.check && p.also.test(f.message)), `plant ${p.id} did not also fail ${p.check} with ${p.also}`);
      assert.ok(hit, `plant ${p.id} did not fail ${p.check} with ${p.re}${p.trail ? ` at ${p.trail}` : ''}; failures:\n${show(r) || '(none)'}`);
    });
  }
});

describe('a legitimate page passes the gate', { concurrency: 3 }, () => {
  for (const p of LEGIT) {
    test(`legit: ${p.id}`, { timeout: 600_000 }, async () => {
      const dir = makePlant(clean, join(work, `plant-${p.id}`), p.id);
      const r = await runGate({ ...QUICK, langs: 'en,es', serve: dir, expectBrand: BRAND, out: join(work, `out-${p.id}`), ...p.opts });
      assert.equal(r.failures.length, 0, `the legitimate page ${p.id} failed:
${show(r)}`);
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
