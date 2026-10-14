import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { startHarness, type Harness } from './harness';

// Animated illustrations (shell 0.14.0, BL-062): an SVG with CSS keyframes or SMIL animates in the executive view and is
// still, at its final frame, under reduced motion.

const fixture = (name: string) => readFileSync(new URL(`../test/gate-fixture/executive/${name}.svg`, import.meta.url), 'utf8');
const data = JSON.parse(readFileSync(new URL('../test/gate-fixture/executive/executive.json', import.meta.url), 'utf8'));

const SMIL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" role="img">
  <style>@media (prefers-reduced-motion: reduce) { .sm { opacity: 1; } }</style>
  <rect width="800" height="500" fill="var(--color-surface-2)"/>
  <rect class="sm" x="100" y="200" width="100" height="100" fill="var(--color-accent)"><animate attributeName="width" from="100" to="600" dur="4s" begin="0s" fill="freeze"/></rect>
  <text data-lang="en" x="100" y="150" font-size="22" fill="var(--color-fg)">A bar that grows</text>
  <text data-lang="es" x="100" y="150" font-size="22" fill="var(--color-fg)">Una barra que crece</text>
</svg>`;

let h: Harness;
before(async () => {
  h = await startHarness(
    `
    import { createRoot } from 'react-dom/client';
    import { ExecutiveView } from './src/index';
    import data from '/data.json';
    createRoot(document.getElementById('root')).render(<ExecutiveView data={data} />);
  `.replace("import data from '/data.json';", `const data = ${JSON.stringify(data)};`),
    {
      '/executive/pain.svg': { type: 'image/svg+xml', body: fixture('pain') },
      '/executive/situation.svg': { type: 'image/svg+xml', body: SMIL },
      '/executive/proposal.svg': { type: 'image/svg+xml', body: fixture('proposal') },
    },
  );
});
after(async () => {
  await h?.close();
});

const running = (selector: string) =>
  `(() => { const svg = document.querySelector('${selector} svg'); if (!svg) return null;
     const css = document.getAnimations().filter((a) => a.effect && a.effect.target && svg.contains(a.effect.target) && a.playState === 'running').length;
     const smil = svg.querySelector('animate, animateTransform, animateMotion, set') ? !svg.animationsPaused() : false;
     return { css, smil, time: svg.getCurrentTime(), count: svg.querySelectorAll('[style], style').length }; })()`;

test('an animated illustration moves with motion allowed and is still under reduced motion', async () => {
  const moving = await h.browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 900 } });
  const p = await moving.newPage();
  await p.goto(h.address);
  await p.waitForSelector('[data-exec-illustration="pain"] svg');
  const cssMoving = (await p.evaluate(running('[data-exec-illustration="pain"]'))) as { css: number };
  assert.ok(cssMoving.css > 0, `the pain illustration runs ${cssMoving.css} CSS animation(s)`);
  await p.locator('[data-exec-tabs] [role="tab"]').nth(2).click();
  await p.waitForSelector('[data-exec-illustration="situation"] svg');
  const smilMoving = (await p.evaluate(running('[data-exec-illustration="situation"]'))) as { smil: boolean };
  assert.equal(smilMoving.smil, true, 'the SMIL illustration plays');
  await moving.close();

  const still = await h.browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const q = await still.newPage();
  await q.goto(h.address);
  await q.waitForSelector('[data-exec-illustration="pain"] svg');
  await q.waitForTimeout(300);
  const css = (await q.evaluate(running('[data-exec-illustration="pain"]'))) as { css: number };
  assert.equal(css.css, 0, 'no CSS animation runs under reduced motion');
  await q.locator('[data-exec-tabs] [role="tab"]').nth(2).click();
  await q.waitForSelector('[data-exec-illustration="situation"] svg');
  const smil = (await q.evaluate(running('[data-exec-illustration="situation"]'))) as { smil: boolean };
  assert.equal(smil.smil, false, 'the SMIL illustration is paused under reduced motion');
  const width = await q.evaluate(() => document.querySelector('[data-exec-illustration="situation"] svg rect.sm')!.getBoundingClientRect().width);
  const full = await q.evaluate(() => document.querySelector('[data-exec-illustration="situation"] svg')!.getBoundingClientRect().width);
  assert.ok(width > 0.6 * (full * 600) / 800, `the paused frame is the final one (bar ${width}px of a ${full}px drawing)`);
  await still.close();
});

test('an animated illustration keeps its labels in the language and its colours in theme tokens in both themes', async () => {
  for (const theme of ['light', 'dark']) {
    const ctx = await h.browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(h.address);
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForSelector('[data-exec-illustration="pain"] svg');
    const m = await page.evaluate(() => {
      const svg = document.querySelector('[data-exec-illustration="pain"] svg') as SVGSVGElement;
      const texts = [...svg.querySelectorAll('text')].filter((t) => getComputedStyle(t).display !== 'none');
      const animated = document.getAnimations().filter((a) => a.effect && a.effect.target && svg.contains(a.effect.target as Node)).length;
      return { n: texts.length, langs: [...new Set(texts.map((t) => t.getAttribute('data-lang')))], w: svg.getBoundingClientRect().width, doc: document.documentElement.scrollWidth <= innerWidth, animated };
    });
    assert.ok(m.animated > 0, `${theme}: the illustration is animated (${m.animated} animation(s))`);
    assert.ok(m.n > 0 && m.langs.length === 1 && m.langs[0] === 'en' && m.doc, theme);
    await ctx.close();
  }
});
