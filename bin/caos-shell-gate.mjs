#!/usr/bin/env node
// caos-shell-gate: the measured web baseline of a CAOS product (ADR-0071, ADR-0017, ADR-0016 as amended 2026-10-04).
//
// Runs a built product in a real browser and MEASURES, for every route x size x theme x language:
//   - the page is the viewport: no horizontal overflow, no document scroll            (ADR-0071 rule 1)
//   - every tab bar is one row; the control rail shows its controls without scrolling (rules 4, 6)
//   - the instrument covers at least half of a workbench route                       (rule 8)
//   - a capped prose page is centred in its container                                  (ADR-0017 s1)
//   - no bibliography dump, every equation captioned, every doc section ends in refs  (ADR-0017 s2, s4)
//   - the requested theme is applied, and no console or page error occurs
// and, from the App route, reaches every header route by a REAL pointer click (ADR-0071 rule 9).
//
// Usage: npx caos-shell-gate --url http://127.0.0.1:4173 [--routes /,/introduction,...] [--workbench /]
//        [--sizes 1280x800,1600x900,2560x1440] [--themes light,dark] [--langs en,es] [--out gate-output]
// Needs `playwright` in the consuming project (optional peer dependency). Exit 1 on any failure.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_ROUTES = '/,/introduction,/methodology,/implementation,/experiments,/benchmark';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.url) {
  console.error('caos-shell-gate: --url is required (the running build, for example http://127.0.0.1:4173)');
  process.exit(2);
}
const base = args.url.replace(/\/$/, '');
const routes = (args.routes ?? DEFAULT_ROUTES).split(',').map((r) => r.trim()).filter(Boolean);
const workbench = new Set((args.workbench ?? '/').split(',').map((r) => r.trim()));
const sizes = (args.sizes ?? '1280x800,1600x900,2560x1440').split(',').map((s) => s.split('x').map(Number));
const themes = (args.themes ?? 'light,dark').split(',');
const langs = (args.langs ?? 'en,es').split(',');
const outDir = args.out ?? 'gate-output';
const settle = Number(args.wait ?? 700);
mkdirSync(outDir, { recursive: true });

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('caos-shell-gate: install playwright in this project (npm i -D playwright) to run the gate');
  process.exit(2);
}

/** Runs in the page: every measurement the gate decides on. */
function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const de = document.documentElement;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const rows = [...document.querySelectorAll('[role="tablist"]')].filter(visible).map((tl) => {
    const tops = new Set([...tl.children].filter(visible).map((c) => Math.round(c.getBoundingClientRect().top)));
    return tops.size;
  });
  const railEl = document.querySelector('[data-rail]');
  const instEl = document.querySelector('[data-instrument]');
  let instrument = null;
  if (instEl) {
    const b = instEl.getBoundingClientRect();
    const w = Math.max(0, Math.min(b.right, vw) - Math.max(b.left, 0));
    const h = Math.max(0, Math.min(b.bottom, vh) - Math.max(b.top, 0));
    instrument = (w * h) / (vw * vh);
  }
  let offCentre = null;
  const prose = document.querySelector('.page-body:not(.wide)');
  if (prose) {
    const parent = prose.parentElement;
    const pb = prose.getBoundingClientRect();
    const cb = parent.getBoundingClientRect();
    const inner = parent.clientWidth;
    offCentre = Math.abs(pb.left - cb.left - (inner - pb.width) / 2);
  }
  return {
    vw,
    vh,
    scrollW: de.scrollWidth,
    scrollH: de.scrollHeight,
    tablistRows: rows,
    rail: railEl ? { scroll: railEl.scrollHeight, client: railEl.clientHeight } : null,
    instrument,
    offCentre,
    referenceLists: document.querySelectorAll('.reference-list').length,
    uncaptionedEquations: [...document.querySelectorAll('.equation')].filter((e) => !e.querySelector('.equation-caption')).length,
    sectionsWithoutRefs: document.querySelectorAll('[data-no-refs-reason="missing"]').length,
    theme: de.dataset.theme ?? null,
  };
}

function judge(route, m, theme, errors) {
  const f = [];
  if (m.scrollW > m.vw) f.push(`horizontal overflow: scrollWidth ${m.scrollW} > ${m.vw}`);
  if (m.scrollH > m.vh) f.push(`the document scrolls: scrollHeight ${m.scrollH} > ${m.vh}`);
  m.tablistRows.forEach((n, i) => n > 1 && f.push(`tab bar ${i + 1} wraps onto ${n} rows`));
  if (m.rail && m.rail.scroll > m.rail.client + 1) f.push(`the rail scrolls: ${m.rail.scroll} > ${m.rail.client}`);
  if (workbench.has(route)) {
    if (m.instrument === null) f.push('no [data-instrument] on a workbench route');
    else if (m.instrument < 0.5) f.push(`the instrument covers ${(100 * m.instrument).toFixed(1)}% of the viewport (< 50%)`);
  }
  if (m.offCentre !== null && m.offCentre > 2) f.push(`prose page off-centre by ${m.offCentre.toFixed(1)}px`);
  if (m.referenceLists > 0) f.push(`${m.referenceLists} bibliography dump(s); use per-section Refs`);
  if (m.uncaptionedEquations > 0) f.push(`${m.uncaptionedEquations} equation(s) without a caption`);
  if (m.sectionsWithoutRefs > 0) f.push(`${m.sectionsWithoutRefs} doc section(s) end without references or a stated reason`);
  if (m.theme !== theme) f.push(`theme not applied: data-theme=${m.theme}, expected ${theme}`);
  errors.forEach((e) => f.push(`console or page error: ${e}`));
  return f;
}

const browser = await chromium.launch();
const report = [];
let failures = 0;
for (const [w, h] of sizes) {
  for (const theme of themes) {
    for (const lang of langs) {
      const context = await browser.newContext({ viewport: { width: w, height: h } });
      await context.addInitScript(
        ([t, l]) => {
          localStorage.setItem('caos.theme', t);
          localStorage.setItem('caos.lang', l);
        },
        [theme, lang],
      );
      for (const route of routes) {
        const page = await context.newPage();
        const errors = [];
        page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
        page.on('pageerror', (err) => errors.push(String(err)));
        await page.goto(base + route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(settle);
        const m = await page.evaluate(measure);
        const fails = judge(route, m, theme, errors);
        const slug = route === '/' ? 'app' : route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
        await page.screenshot({ path: join(outDir, `${slug}_${w}x${h}_${theme}_${lang}.png`) });
        report.push({ route, size: `${w}x${h}`, theme, lang, measures: m, failures: fails });
        failures += fails.length;
        await page.close();
      }
      await context.close();
    }
  }
}

// Reachability by pointer (ADR-0071 rule 9): from the App route, click every header route with the mouse.
{
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const nav = [];
  for (const route of routes.filter((r) => r !== '/')) {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    const link = page.locator(`header a[href$="${route}"]`).first();
    const box = (await link.count()) ? await link.boundingBox() : null;
    let ok = false;
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(300);
      ok = new URL(page.url()).pathname.replace(/\/$/, '') === route.replace(/\/$/, '');
    }
    nav.push({ route, reachable: ok });
    if (!ok) failures += 1;
  }
  report.push({ check: 'pointer reachability', nav });
  await context.close();
}

await browser.close();
writeFileSync(join(outDir, 'gate-report.json'), JSON.stringify(report, null, 2));
for (const r of report) {
  if (r.failures?.length) console.log(`FAIL ${r.route} ${r.size} ${r.theme} ${r.lang}\n  - ${r.failures.join('\n  - ')}`);
  if (r.nav) r.nav.filter((n) => !n.reachable).forEach((n) => console.log(`FAIL ${n.route} not reachable by a pointer click from /`));
}
const combos = report.filter((r) => r.route).length;
console.log(failures ? `caos-shell-gate: ${failures} failure(s) in ${combos} measured views` : `caos-shell-gate: OK, ${combos} measured views, every route reachable by pointer`);
process.exit(failures ? 1 : 0);
