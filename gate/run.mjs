// caos-shell-gate runner: measures a built CAOS product in a real browser and fails on what a reader would meet.
// Every check embeds a trap recorded in the 2026-10-04 failure history (failure class 10: gates that measured the
// wrong thing); the self-test in this repository plants one defect per check and requires each to fail (G15).
//
//   G1 subject identity      the brand must match --expect-brand; a check that finds no subject fails
//   G2 mode identity         theme and language set with the shell's own storage keys, then read back
//   G3 errors                console.error, page errors, any GET answered 400 or above
//   G4 deep links            every route loaded directly (and with a trailing slash), 200 and rendered; artifacts
//                            are JSON, not the HTML fallback; a missing asset answers 404; doc text clears a floor
//   G5 scroll and reach      boxes inside the viewport, the rail and their scrollers; tall views scroll; nothing is
//                            cut; truncated text carries its full text; every control reachable by the pointer
//   G6 painted area          drawing surfaces have painted pixels, fill their stage, and cover at least half the
//                            viewport on the App route, measured on the screenshot, never on a host box
//   G7 walk everything       every route, tab, sub-tab and case, at five sizes, both themes, both languages,
//                            waiting for declared state (data-state, data-stale, data-drawn), never networkidle
//   G8 idle at rest          no sustained animation frames or DOM mutations after load and after a tab switch
//   G9 reactivity            each registered control changes the selection key and no view keeps an old one; the
//                            rendered case is the case asked for
// plus the ADR-0071 and ADR-0017 measures (viewport, one-row tabs, rail without scroll, centred prose, captions,
// references).

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng, paintedBox, unionArea } from './png.mjs';
import { servePages } from './serve.mjs';
import { installLib } from './inpage.mjs';

export const DEFAULTS = {
  sizes: '390x844,768x1024,1280x800,1600x900,2560x1440',
  themes: 'light,dark',
  langs: 'en,es',
  workbench: '/',
  idleMs: 3000,
  settleMs: 15000,
  textFloor: 400,
  instrumentMin: 0.5,
  stageFillMin: 0.3,
  viewportMinWidth: 1280,
  out: 'gate-output',
  maxShots: 40,
};

const RATE_LIMIT = 5; // frames or mutations per second at rest above which a loop is reported (G8)

async function loadKeys() {
  try {
    return await import(new URL('../dist/keys.js', import.meta.url).href);
  } catch {
    throw new Error('caos-shell-gate: dist/keys.js is missing; the shell package is not built (npm run build)');
  }
}

/**
 * @param {object} o options (see bin/caos-shell-gate.mjs)
 * @returns {Promise<object>} the report; `report.ok` is false on any failure
 */
export async function runGate(o) {
  const opt = { ...DEFAULTS, ...o };
  if (!opt.expectBrand) throw new Error('caos-shell-gate: --expect-brand is required (G1: the gate never measures an unnamed subject)');
  if (!opt.url && !opt.serve) throw new Error('caos-shell-gate: --url or --serve is required (there is no default target)');
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('caos-shell-gate: install playwright in this project (npm i -D playwright) to run the gate');
  }
  const { THEME_STORAGE_KEY, LANG_STORAGE_KEY } = await loadKeys();

  const sizes = String(opt.sizes).split(',').map((s) => s.trim().split('x').map(Number));
  const themes = String(opt.themes).split(',').map((s) => s.trim());
  const langs = String(opt.langs).split(',').map((s) => s.trim());
  const workbenchRoutes = new Set(String(opt.workbench).split(',').map((s) => s.trim()).filter(Boolean));
  const primarySize = sizes.find(([w]) => w >= opt.viewportMinWidth) ?? sizes[0];
  const shotsDir = join(opt.out, 'shots');
  // Every run starts from an empty capture folder: a capture left by an earlier run is stale evidence.
  rmSync(shotsDir, { recursive: true, force: true });
  mkdirSync(shotsDir, { recursive: true });

  let server = null;
  let base = opt.url;
  if (opt.serve) {
    server = await servePages(opt.serve, opt.basePath ?? '/');
    base = server.url;
  }
  base = base.endsWith('/') ? base : `${base}/`;
  const basePath = new URL(base).pathname;
  const urlFor = (route) => new URL(route.replace(/^\//, ''), base).href;
  const routeOf = (href) => {
    const p = new URL(href, base).pathname;
    return p.startsWith(basePath) ? `/${p.slice(basePath.length)}`.replace(/\/$/, '') || '/' : null;
  };

  const failures = [];
  // The smallest measured values against each floor, so a pass shows its margin (and a CI font change that eats it
  // is visible before it fails).
  const minima = { drawnShare: null, stageFill: null };
  const low = (k, value, where) => {
    if (minima[k] === null || value < minima[k].value) minima[k] = { value: Number(value.toFixed(4)), route: where.route, mode: where.mode, trail: where.trail };
  };
  let shots = 0;
  let states = 0;
  const fail = (check, where, message) => failures.push({ check, route: where.route ?? '', mode: where.mode ?? '', trail: where.trail ?? '', message });
  const artifacts = new Map();

  const browser = await chromium.launch();
  const openContext = async ([w, h], theme, lang) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await ctx.addInitScript(
      ([tk, lk, t, l]) => {
        try {
          localStorage.setItem(tk, t);
          localStorage.setItem(lk, l);
        } catch {
          /* storage unavailable: G2 reports the mode that came back */
        }
      },
      [THEME_STORAGE_KEY, LANG_STORAGE_KEY, theme, lang],
    );
    await ctx.addInitScript(installLib);
    return ctx;
  };

  const newPage = async (ctx) => {
    const page = await ctx.newPage();
    const sink = [];
    page.on('console', (m) => {
      if (m.type() === 'error') sink.push(`console.error: ${m.text().slice(0, 300)}`);
    });
    page.on('pageerror', (e) => sink.push(`page error: ${String(e).slice(0, 300)}`));
    page.on('response', (r) => {
      const req = r.request();
      if (req.method() !== 'GET') return;
      if (r.status() >= 400) sink.push(`HTTP ${r.status()} for ${r.url()}`);
      const type = req.resourceType();
      let pathname = '';
      try {
        pathname = new URL(r.url()).pathname;
      } catch {
        /* not a URL */
      }
      if ((type === 'fetch' || type === 'xhr') && pathname.endsWith('.json') && r.status() < 400 && !artifacts.has(pathname)) {
        artifacts.set(
          pathname,
          r.text().then(
            (t) => t.trimStart().slice(0, 1),
            () => '',
          ),
        );
      }
    });
    return { page, sink };
  };

  const settle = async (page) => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))).catch(() => undefined);
    const t0 = Date.now();
    let last = 'timeout';
    let streak = 0;
    while (Date.now() - t0 < opt.settleMs) {
      const why = await page.evaluate(() => (window.__caosGate && window.__caosGate.ready ? window.__caosGate.ready() : 'the gate library is not installed')).catch((e) => `evaluate failed: ${e.message}`);
      if (why === '') {
        streak += 1;
        if (streak >= 2) return '';
      } else {
        streak = 0;
        last = why;
      }
      await page.waitForTimeout(60);
    }
    return last;
  };

  const drain = (sink, where) => {
    for (const e of sink.splice(0)) fail('G3', where, e);
  };

  // Every route in every mode keeps its capture, for the person who reads them (the gate measures, it does not judge
  // content); only failure captures are capped, so a run with many failures does not fill the disk.
  const saveShot = async (page, name, failure = false) => {
    if (failure) {
      if (shots >= opt.maxShots) return;
      shots += 1;
    }
    await page.screenshot({ path: join(shotsDir, name) }).catch(() => undefined);
  };

  try {
    // ---- G4: a missing asset answers 404, not the HTML fallback.
    {
      const ctx = await browser.newContext();
      const res = await ctx.request.get(urlFor('/__caos_gate_missing__.json'), { maxRedirects: 0 }).catch((e) => ({ status: () => `error ${e.message}` }));
      if (res.status() !== 404) fail('G4', { route: '/__caos_gate_missing__.json' }, `a missing asset answered ${res.status()}, not 404 (an SPA fallback hides missing artifacts and broken deep links)`);
      await ctx.close();
    }

    // ---- G1: the subject, and the route list (from the header nav unless given).
    let routes = opt.routes ? String(opt.routes).split(',').map((r) => r.trim()).filter(Boolean) : null;
    {
      const ctx = await openContext(primarySize, themes[0], langs[0]);
      const { page, sink } = await newPage(ctx);
      await page.goto(urlFor('/'), { waitUntil: 'load', timeout: 30000 });
      const why = await settle(page);
      const id = await page.evaluate(() => window.__caosGate.identity());
      if (id.brand !== opt.expectBrand) {
        fail('G1', { route: '/' }, `the page at ${base} is "${id.brand ?? id.title}", not "${opt.expectBrand}"; nothing else is measured (a gate pointed at another product passes on it)`);
        await ctx.close();
        return finish();
      }
      if (why) fail('G7', { route: '/' }, `the App route never settled: ${why}`);
      if (!routes) {
        const hrefs = await page.$$eval('header nav a[href]', (as) => as.map((a) => a.href));
        routes = [...new Set(['/', ...hrefs.map(routeOf).filter(Boolean)])];
      }
      sink.splice(0);
      await ctx.close();
    }

    // ---- The walk: every mode, every route, every tab, every case (G2 to G9 and the ADR measures).
    for (const size of sizes) {
      for (const theme of themes) {
        for (const lang of langs) {
          const [w, h] = size;
          const mode = `${w}x${h} ${theme} ${lang}`;
          const primary = size === primarySize && theme === themes[0] && lang === langs[0];
          const idleHere = theme === themes[0] && lang === langs[0];
          const ctx = await openContext(size, theme, lang);
          const { page, sink } = await newPage(ctx);
          for (const route of routes) {
            const isWorkbench = workbenchRoutes.has(route);
            const at = { route, mode };
            const res = await page.goto(urlFor(route), { waitUntil: 'load', timeout: 30000 }).catch((e) => e);
            const status = res && typeof res.status === 'function' ? res.status() : `error ${res?.message ?? res}`;
            if (status !== 200) {
              fail('G4', at, `loaded directly, ${urlFor(route)} answered ${status}`);
              drain(sink, at);
              continue;
            }
            const why = await settle(page);
            if (why) fail('G7', at, `never settled: ${why}`);
            const id = await page.evaluate(() => window.__caosGate.identity());
            if (id.brand !== opt.expectBrand) {
              fail('G1', at, `the route renders "${id.brand ?? id.title}", not "${opt.expectBrand}"`);
              drain(sink, at);
              continue;
            }
            if (id.theme !== theme) fail('G2', at, `asked for the ${theme} theme through ${THEME_STORAGE_KEY}; the document has data-theme=${id.theme}`);
            if (!String(id.lang ?? '').startsWith(lang)) fail('G2', at, `asked for ${lang} through ${LANG_STORAGE_KEY}; <html lang> is ${id.lang}`);
            if (route !== '/' && id.activeHref && routeOf(id.activeHref) !== route) fail('G4', at, `loaded directly, the page shows route ${routeOf(id.activeHref)}`);

            const walkState = { tested: new Set(), keyedViews: 0, controls: 0, tablists: 0 };
            await processState(page, sink, { ...at, trail: '' }, { route, isWorkbench, primary, idle: idleHere, first: true, size, w, h, theme, lang, walkState });

            if (primary && route !== '/') {
              // G4: the trailing-slash form a static host serves for a materialised route.
              const slash = `${urlFor(route)}/`;
              const r2 = await page.goto(slash, { waitUntil: 'load', timeout: 30000 }).catch((e) => e);
              const s2 = r2 && typeof r2.status === 'function' ? r2.status() : `error ${r2?.message ?? r2}`;
              if (s2 !== 200) fail('G4', at, `${slash} answered ${s2}`);
              else {
                await settle(page);
                const id2 = await page.evaluate(() => window.__caosGate.identity());
                if (id2.brand !== opt.expectBrand) fail('G4', at, `${slash} renders "${id2.brand ?? id2.title}"`);
                else if (id2.activeHref && routeOf(id2.activeHref) !== route) fail('G4', at, `${slash} shows route ${routeOf(id2.activeHref)}`);
              }
              drain(sink, { ...at, trail: 'trailing slash' });
              await page.goto(urlFor(route), { waitUntil: 'load', timeout: 30000 });
              await settle(page);
              sink.splice(0);
            }

            await walkTabs(page, sink, { ...at }, [], new Set(), { route, isWorkbench, primary, idle: primary, size, w, h, theme, lang, walkState });

            if (isWorkbench) await walkCases(page, sink, at, { route, isWorkbench, primary, size, w, h, theme, lang, walkState });

            if (primary && isWorkbench) {
              const f = await page.evaluate(() => window.__caosGate.facts());
              if (!f.workbench) fail('G9', at, 'no [data-case-workbench] on a workbench route');
              else if (!f.workbench.replayOnly) {
                if (walkState.controls === 0) fail('G9', at, 'the workbench has no registered control ([data-control]) and does not declare itself replay-only');
                if (walkState.keyedViews === 0) fail('G9', at, 'no view declares the selection key it shows (PlotCard or Readout dataKey); reactivity cannot be verified');
              }
              if (walkState.tablists === 0) fail('G7', at, 'the workbench shows no tab list to walk');
            }
          }

          if (primary) {
            // ADR-0071 rule 9 / G5: every header route reached by a real pointer click from the App route.
            for (const route of routes.filter((r) => r !== '/')) {
              await page.goto(urlFor('/'), { waitUntil: 'load', timeout: 30000 });
              await settle(page);
              const link = page.locator('header nav a[href]');
              const hrefs = await link.evaluateAll((as) => as.map((a) => a.href));
              const idx = hrefs.findIndex((href) => routeOf(href) === route);
              let ok = false;
              if (idx >= 0) {
                // A reader scrolls a narrow nav row to the link first; so does the gate, then clicks with the pointer.
                await link.nth(idx).evaluate((el) => window.__caosGate.bringEl(el));
                const box = await link.nth(idx).boundingBox();
                if (box) {
                  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                  await page.waitForURL((u) => routeOf(u.href) === route, { timeout: 3000 }).catch(() => undefined);
                  ok = routeOf(page.url()) === route;
                }
              }
              if (!ok) fail('G5', { route, mode }, 'not reachable by a pointer click on the header link from the App route');
              sink.splice(0);
            }
          }
          await ctx.close();
        }
      }
    }

    // ---- G4: artifacts answered as JSON.
    for (const [pathname, first] of artifacts) {
      const c = await first;
      if (c !== '{' && c !== '[') fail('G4', { route: pathname }, `the artifact ${pathname} did not answer JSON (starts with "${c}"; the HTML fallback?)`);
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }
  return finish();

  // ------------------------------------------------------------------------------------------------------------
  async function processState(page, sink, where, s) {
    states += 1;
    // On a narrow screen the instrument stacks under the rail; a reader scrolls to the open view, and so does the gate.
    if (s.isWorkbench && s.w < opt.viewportMinWidth) {
      await page.evaluate(() => window.__caosGate.bring('[data-case-workbench] [role="tabpanel"]')).catch(() => undefined);
    }
    const f = await page.evaluate(() => window.__caosGate.facts());
    const big = s.w >= opt.viewportMinWidth;
    if (f.docW > f.vw + 1) fail('G5', where, `horizontal overflow: the document is ${f.docW}px wide in a ${f.vw}px viewport`);
    if (f.beyondCount) fail('G5', where, `${f.beyondCount} element(s) outside the viewport: ${f.beyond.join('; ')}`);
    if (big && f.docH > f.vh + 1) fail('ADR-0071.1', where, `the document scrolls: ${f.docH}px in a ${f.vh}px viewport (the page is the viewport)`);
    for (const r of f.rows) if (r.rows > 1) fail('ADR-0071.4', where, `tab row "${r.name}" wraps onto ${r.rows} rows`);
    for (const r of f.rows) if (r.cut > 1) fail('G5', where, `tab row "${r.name}" cuts its tabs by ${r.cut}px (a row shrunk under its panel)`);
    if (f.rail) {
      if (big && f.rail.scroll > f.rail.client + 1) fail('ADR-0071.6', where, `the rail scrolls: ${f.rail.scroll}px of content in ${f.rail.client}px`);
      if (f.rail.outsideCount) fail('G5', where, `${f.rail.outsideCount} rail element(s) outside the rail: ${f.rail.outside.join('; ')}`);
    }
    if (f.truncatedCount) fail('G5', where, `${f.truncatedCount} truncated text(s) without the full text in a title: ${f.truncated.join('; ')}`);
    for (const c of f.clipped) fail('G5', where, c);
    if (f.offCentre !== null && f.offCentre > 2) fail('ADR-0017.1', where, `the prose page is off-centre by ${f.offCentre.toFixed(1)}px`);
    if (f.referenceLists) fail('ADR-0017.4', where, `${f.referenceLists} bibliography dump(s); references belong at the end of each section`);
    if (f.uncaptioned) fail('ADR-0017.2', where, `${f.uncaptioned} equation(s) without a caption`);
    if (f.sectionsWithoutRefs) fail('ADR-0017.4', where, `${f.sectionsWithoutRefs} section(s) end without references or a stated reason`);
    if (s.first && !s.isWorkbench && f.pageText < opt.textFloor) fail('G4', where, `the page body holds ${f.pageText} characters of text (floor ${opt.textFloor}); the route rendered without its content`);

    if (s.isWorkbench) {
      if (!f.instrument) fail('G6', where, 'no [data-instrument] on a workbench route');
      else await paintedChecks(page, f, where, big);
      if (f.workbench && s.walkState) {
        const keyed = (await page.evaluate(() => window.__caosGate.views())).filter((v) => v.key);
        s.walkState.keyedViews += keyed.length;
      }
    }

    if (s.first) await saveShot(page, `${slug(s.route)}_${s.w}x${s.h}_${s.theme}_${s.lang}.png`);

    if (s.idle) {
      const idle = await page.evaluate((ms) => window.__caosGate.idle(ms), opt.idleMs);
      const secs = idle.ms / 1000;
      if (idle.raf / secs > RATE_LIMIT) fail('G8', where, `${idle.raf} animation frames in ${secs}s at rest (a loop runs with nothing to show)`);
      if (idle.mutations / secs > RATE_LIMIT) fail('G8', where, `${idle.mutations} DOM mutations in ${secs}s at rest: ${idle.sample.join('; ')}`);
    }

    for (const m of await page.evaluate(() => window.__caosGate.scrolls())) fail('G5', where, m);
    const reach = await page.evaluate(() => window.__caosGate.reach());
    if (reach.unreachableCount) fail('G5', where, `${reach.unreachableCount} control(s) not reachable by the pointer: ${reach.unreachable.join('; ')}`);

    if (s.primary && s.isWorkbench && s.walkState) await reactivity(page, sink, where, s);
    drain(sink, where);
    const failedHere = failures.some((x) => x.route === where.route && x.mode === where.mode && x.trail === where.trail && x.check !== 'G3');
    if (failedHere) await saveShot(page, `fail_${slug(s.route)}_${s.w}x${s.h}_${s.theme}_${s.lang}_${shots + 1}.png`, true);
  }

  async function paintedChecks(page, f, where, big) {
    if (f.prose) return; // the context write-up is prose, measured as a document, not as a drawing
    if (f.surfaces.length === 0) {
      fail('G6', where, 'nothing is drawn in the instrument (no canvas, svg drawing, image or table)');
      return;
    }
    const clip = { x: Math.floor(f.instrument.x), y: Math.floor(f.instrument.y), width: Math.max(1, Math.floor(f.instrument.w)), height: Math.max(1, Math.floor(f.instrument.h)) };
    let img;
    try {
      img = decodePng(await page.screenshot({ clip }));
    } catch (e) {
      fail('G6', where, `the instrument could not be captured: ${e.message}`);
      return;
    }
    // Per stage: the painted extent of its drawings (union of their painted boxes), judged against the stage.
    const stages = new Map();
    for (const s of f.surfaces) {
      if (s.right > f.vw + 1) fail('G6', where, `${s.label} extends to ${Math.round(s.right)}px, past the ${f.vw}px page`);
      const st = stages.get(s.stageKey) ?? { label: s.label, kinds: new Set(), stage: s.stage, view: s.view, painted: [] };
      st.kinds.add(s.kind);
      const box = paintedBox(img, { x: s.x - clip.x, y: s.y - clip.y, w: s.w, h: s.h });
      if (box) st.painted.push({ x: box.x + clip.x, y: box.y + clip.y, w: box.w, h: box.h });
      stages.set(s.stageKey, st);
    }
    const counted = [];
    for (const st of stages.values()) {
      if (st.painted.length === 0) {
        fail('G6', where, `${st.label} (${[...st.kinds].join(', ')}, ${Math.round(st.stage.w)}x${Math.round(st.stage.h)}) is blank: nothing is painted on it`);
        continue;
      }
      const x0 = Math.min(...st.painted.map((b) => b.x));
      const y0 = Math.min(...st.painted.map((b) => b.y));
      const x1 = Math.max(...st.painted.map((b) => b.x + b.w));
      const y1 = Math.max(...st.painted.map((b) => b.y + b.h));
      const fill = ((x1 - x0) * (y1 - y0)) / Math.max(1, st.stage.w * st.stage.h);
      if (big) low('stageFill', fill, where);
      if (fill < opt.stageFillMin) {
        if (big) fail('G6', where, `${st.label} draws on ${(100 * fill).toFixed(0)}% of its stage (floor ${(100 * opt.stageFillMin).toFixed(0)}%)`);
        continue;
      }
      counted.push(st.view);
    }
    if (big) {
      // The instrument share counts only the views whose drawing passed: empty instrument space, and the cards of
      // blank or underfilled drawings, never count (ADR-0071 rule 8, measured on what is drawn).
      const share = unionArea(counted, f.vw, f.vh) / (f.vw * f.vh);
      low('drawnShare', share, where);
      if (share < opt.instrumentMin) fail('G6', where, `the drawn views cover ${(100 * share).toFixed(1)}% of the viewport (floor ${(100 * opt.instrumentMin).toFixed(0)}% on the App route, ADR-0071 rule 8)`);
    }
  }

  async function reactivity(page, sink, where, s) {
    const controls = await page.evaluate(() => window.__caosGate.controls());
    s.walkState.controls += controls.length;
    for (const c of controls) {
      if (s.walkState.tested.has(c.id)) continue;
      s.walkState.tested.add(c.id);
      const at = { ...where, trail: `${where.trail ? `${where.trail} > ` : ''}control ${c.id}` };
      const before = await workbenchKey(page);
      const changed = await changeControl(page, c).catch((e) => `error: ${e.message.split('\n')[0]}`);
      if (changed !== true) {
        fail('G9', at, `control "${c.id}" (${c.kind}) could not be changed: ${changed || 'no alternative value'}`);
        continue;
      }
      const why = await settle(page);
      if (why) {
        fail('G9', at, `after changing "${c.id}" the views did not settle: ${why}`);
        continue;
      }
      const after = await workbenchKey(page);
      if (after === before) fail('G9', at, `control "${c.id}" did not change the selection key (data-state-key stayed ${before})`);
      const old = (await page.evaluate(() => window.__caosGate.views())).filter((v) => v.key && v.key !== after);
      if (old.length) fail('G9', at, `${old.length} view(s) keep an earlier selection key after "${c.id}" changed: ${old.slice(0, 3).map((v) => v.label).join('; ')}`);
      drain(sink, at);
    }
  }

  async function walkTabs(page, sink, where, trail, handled, s) {
    const lists = (await page.evaluate(() => window.__caosGate.tablists())).filter((l) => !handled.has(l.key) && !l.source);
    const parentKey = trail.length ? trail[trail.length - 1].key : null;
    const mine = lists.filter((l) => (parentKey ? l.owner === parentKey : l.owner === null));
    for (const tl of mine) {
      handled.add(tl.key);
      s.walkState.tablists += 1;
      for (let i = 0; i < tl.tabs.length; i += 1) {
        const label = tl.tabs[i];
        const here = [...trail, { key: tl.key, label }];
        const at = { ...where, trail: [...(where.case ? [`case ${where.case}`] : []), ...here.map((t) => t.label)].join(' > ') };
        if (i !== tl.active) {
          const tab = page.locator(tl.key).locator('[role="tab"]').filter({ visible: true }).nth(i);
          try {
            await tab.click({ timeout: 5000 });
          } catch (e) {
            fail('G7', at, `the tab could not be clicked: ${e.message.split('\n')[0]}`);
            continue;
          }
          const why = await settle(page);
          if (why) fail('G7', at, `never settled: ${why}`);
          await processState(page, sink, at, { ...s, first: false, idle: s.idle });
        }
        await walkTabs(page, sink, where, here, new Set(handled), s);
      }
      if (tl.active >= 0 && tl.tabs.length > 1) {
        await page.locator(tl.key).locator('[role="tab"]').filter({ visible: true }).nth(tl.active).click({ timeout: 5000 }).catch(() => undefined);
        await settle(page);
        sink.splice(0);
      }
    }
  }

  async function walkCases(page, sink, at, s) {
    const sources = (await page.evaluate(() => window.__caosGate.tablists())).find((l) => l.source);
    const sourceTabs = sources ? sources.tabs.map((_, i) => i) : [null];
    let total = 0;
    const sampleSet = opt.caseSample ? new Set(String(opt.caseSample).split(',').map((x) => x.trim())) : null;
    for (const si of sourceTabs) {
      if (si !== null && si !== sources.active) {
        await page.locator(sources.key).locator('[role="tab"]').nth(si).click({ timeout: 5000 }).catch(() => undefined);
        await settle(page);
      }
      const { kind, ids } = await page.evaluate(() => window.__caosGate.cases());
      total += ids.length;
      const pick = s.primary ? ids : sampleSet ? ids.filter((x) => sampleSet.has(x)) : [...new Set([ids[0], ids[ids.length - 1]])].filter(Boolean);
      for (const caseId of pick) {
        const where = { ...at, case: caseId, trail: `case ${caseId}` };
        try {
          if (kind === 'select') await page.locator('select[data-control="case"]').filter({ visible: true }).first().selectOption(caseId, { timeout: 5000 });
          else await page.locator(`[data-control="case"] [data-case="${caseId}"]`).filter({ visible: true }).first().click({ timeout: 5000 });
        } catch (e) {
          fail('G7', where, `the case could not be selected: ${e.message.split('\n')[0]}`);
          continue;
        }
        const why = await settle(page);
        if (why) fail('G7', where, `never settled: ${why}`);
        const shownCase = await page.evaluate(() => document.querySelector('[data-case-workbench]')?.getAttribute('data-case') ?? null);
        if (shownCase !== caseId) fail('G9', where, `asked for case ${caseId}; the workbench shows ${shownCase}`);
        await processState(page, sink, where, { ...s, first: false, idle: false });
        if (s.primary) await walkTabs(page, sink, where, [], new Set(), { ...s, idle: false });
      }
      if (s.primary && pick.length) {
        // A deep link selects the case it names (G9).
        const deep = pick[pick.length - 1];
        await page.goto(`${urlFor(s.route)}?case=${encodeURIComponent(deep)}`, { waitUntil: 'load', timeout: 30000 });
        await settle(page);
        const shownCase = await page.evaluate(() => document.querySelector('[data-case-workbench]')?.getAttribute('data-case') ?? null);
        if (shownCase !== deep) fail('G9', { ...at, trail: `?case=${deep}` }, `the deep link ?case=${deep} shows case ${shownCase}`);
        drain(sink, { ...at, trail: `?case=${deep}` });
        await page.goto(urlFor(s.route), { waitUntil: 'load', timeout: 30000 });
        await settle(page);
        sink.splice(0);
      }
    }
    if (total === 0 && !opt.singleCase) fail('G9', at, 'the workbench offers no case ([data-control="case"]); declare --single-case if it has one');
  }

  async function workbenchKey(page) {
    return page.evaluate(() => document.querySelector('[data-case-workbench]')?.getAttribute('data-state-key') ?? null);
  }

  async function changeControl(page, c) {
    const host = page.locator(c.path);
    if (c.kind === 'range') {
      const input = (await host.evaluate((e) => e.matches('input'))) ? host : host.locator('input[type="range"]').first();
      const v = await input.evaluate((e) => ({ value: Number(e.value), max: e.max === '' ? 100 : Number(e.max) }));
      await input.focus();
      await page.keyboard.press(v.value >= v.max ? 'ArrowLeft' : 'ArrowRight');
      return true;
    }
    if (c.kind === 'select') {
      const sel = (await host.evaluate((e) => e.tagName === 'SELECT')) ? host : host.locator('select').first();
      const idx = await sel.evaluate((e) => [...e.options].findIndex((o, i) => i !== e.selectedIndex && !o.disabled));
      if (idx < 0) return 'no other option';
      await sel.selectOption({ index: idx });
      return true;
    }
    if (c.kind === 'check') {
      await host.locator('input[type="checkbox"], input[type="radio"]:not(:checked)').first().click({ timeout: 5000 });
      return true;
    }
    if (c.kind === 'number') {
      const input = host.locator('input[type="number"]').first();
      const v = await input.evaluate((e) => ({ value: Number(e.value), step: Number(e.step) || 1 }));
      await input.fill(String(v.value + v.step));
      await input.press('Enter');
      return true;
    }
    if (c.kind === 'buttons') {
      const buttons = host.locator('button');
      const n = await buttons.count();
      for (let i = 0; i < n; i += 1) {
        const b = buttons.nth(i);
        const on = await b.evaluate(
          (e) => e.disabled || e.classList.contains('on') || e.classList.contains('active') || ['aria-pressed', 'aria-checked', 'aria-selected'].some((a) => e.getAttribute(a) === 'true'),
        );
        if (!on) {
          await b.click({ timeout: 5000 });
          return true;
        }
      }
      return 'every option is already selected';
    }
    return `unknown control kind (${c.kind})`;
  }

  function finish() {
    const checks = {};
    for (const f of failures) checks[f.check] = (checks[f.check] ?? 0) + 1;
    const report = { ok: failures.length === 0, base, expectBrand: opt.expectBrand, sizes: opt.sizes, themes: opt.themes, langs: opt.langs, states, minima, checks, failures };
    mkdirSync(opt.out, { recursive: true });
    writeFileSync(join(opt.out, 'gate-report.json'), JSON.stringify(report, null, 2));
    return report;
  }
}

function slug(route) {
  return route === '/' ? 'app' : route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
}
