import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installLib } from '../gate/inpage.mjs';
import { startHarness, type Harness } from './harness';

let h: Harness;
before(async () => {
  h = await startHarness(`
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { AppShell, SurfacePage, SubTabs, useLangStore, applyTheme } from './src/index';
    const params = new URLSearchParams(location.search);
    const lang = params.get('lang') === 'es' ? 'es' : 'en';
    useLangStore.getState().setLang(lang);
    applyTheme(params.get('theme') === 'dark' ? 'dark' : 'light');
    const content = <SubTabs ariaLabel="Details" tabs={[
      { id: 'chart', label: 'Chart', content: <p data-result="chart">Process chart</p> },
      { id: 'table', label: 'Table', content: <p data-result="table">Recorded outcomes</p> },
    ]} />;
    createRoot(document.getElementById('root')).render(
      <AppShell config={{ product: { name: 'SurfaceFixture' }, version: '0.19.9', contain: true,
        routes: [{ path: '/introduction', en: 'Introduction', es: 'Introducción' }], links: {} }}>
        <SurfacePage document={params.get('document') !== '0'}
          title={{ en: 'Introduction', es: 'Introducción' }}
          lede={(lang === 'es' ? 'Un circuito conecta las decisiones con la evidencia. ' : 'A circuit connects decisions with their evidence. ').repeat(6)}
          actions={<button type="button">Source</button>}
          focus tabs={[
            { id: 'overview', label: 'Overview', focus: true, content: <p>Overview</p> },
            { id: 'analysis', label: 'Analysis', focus: true, content },
          ]} />
      </AppShell>
    );
  `);
});
after(async () => { await h?.close(); });

test('document surface fills its column and preserves Focus at desktop and phone sizes', async () => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    for (const lang of ['en', 'es']) for (const theme of ['light', 'dark']) {
      const page = await h.browser.newPage({ viewport });
      try {
        await page.goto(`${h.address}/introduction?lang=${lang}&theme=${theme}`);
        await page.locator('[data-doc-page]').waitFor();
        const widths = await page.evaluate(() => {
          const root = document.querySelector('[data-surface]')!;
          const style = getComputedStyle(root);
          return {
            roots: document.querySelectorAll('.page-body').length,
            column: root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
            padding: [parseFloat(style.paddingLeft), parseFloat(style.paddingRight)],
            head: root.querySelector('.caos-surface-heading')!.getBoundingClientRect().width,
            lede: root.querySelector('.caos-surface-lede')!.getBoundingClientRect().width,
            body: root.querySelector('.caos-surface-body')!.getBoundingClientRect().width,
            ledeMax: getComputedStyle(root.querySelector('.caos-surface-lede')!).maxWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
          };
        });
        assert.equal(widths.roots, 1, 'no outer padded document wrapper');
        assert.ok(widths.padding.every(p => p > 0), 'root owns the shell inset');
        for (const key of ['head', 'lede', 'body'] as const) {
          assert.ok(Math.abs(widths[key] - widths.column) <= 2, `${key} fills the document column: ${JSON.stringify(widths)}`);
        }
        assert.equal(widths.ledeMax, 'none');
        assert.ok(widths.documentScrollWidth <= viewport.width);
        await page.evaluate(installLib);
        const doc = await page.evaluate(() => (window as any).__caosGate.docPage());
        assert.ok(Math.abs(doc.ledeWidth - widths.column) <= 2, 'the real gate sees a full-column document lede');
        assert.ok(doc.ledeWords > 0, 'the real gate reads the document introduction');
        await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
        await page.getByRole('tab', { name: 'Table', exact: true }).click();
        for (const exit of ['Escape', 'button']) {
          await page.locator('[data-focus-enter]').click();
          await page.locator('[data-focus-shell]').waitFor();
          assert.equal(new URL(page.url()).searchParams.get('view'), 'analysis');
          assert.equal(new URL(page.url()).searchParams.get('focus'), '1');
          assert.equal(await page.locator('[data-result="table"]').count(), 1);
          if (exit === 'Escape') await page.keyboard.press('Escape');
          else await page.locator('[data-focus-exit]').click();
          await page.locator('[data-doc-page]').waitFor();
          assert.equal(new URL(page.url()).searchParams.has('focus'), false);
          assert.equal(new URL(page.url()).searchParams.get('view'), 'analysis');
          assert.equal(await page.getByRole('tab', { name: 'Table', selected: true }).count(), 1);
        }
      } finally { await page.close(); }
    }
  }
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(`${h.address}/introduction?document=0`);
    await page.locator('[data-surface]').waitFor();
    assert.equal(await page.locator('[data-doc-page]').count(), 0);
    const w = await page.evaluate(() => ({
      lede: document.querySelector('.caos-surface-lede')!.getBoundingClientRect().width,
      body: document.querySelector('.caos-surface-body')!.getBoundingClientRect().width,
      max: getComputedStyle(document.querySelector('.caos-surface-lede')!).maxWidth,
    }));
    assert.notEqual(w.max, 'none');
    assert.ok(w.lede < w.body - 100, 'generic surface retains its reading measure');
  } finally { await page.close(); }
});

const fixture = (drawing: string, rootStyle = '') => `
  <main data-doc-page><div data-executive-view>
  <figure data-exec-illustration="pain" data-exec-file="fixture.svg">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200" style="${rootStyle}">
      ${drawing}
    </svg><figcaption>Process diagram</figcaption>
  </figure></div></main>`;
const measure = async (page: any) => page.evaluate(() => (window as any).__caosGate.docPage().executive.illustrations[0]);

test('executive measurement uses root-space bounds for transformed SVG text', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(h.address);
    await page.evaluate(installLib);
    const cases = [
      { name: 'translated inside', drawing: '<g transform="translate(160 50)"><text x="-120" y="25" font-size="14">Dentro</text></g>', outside: false },
      { name: 'translated outside', drawing: '<g transform="translate(450 0)"><text x="20" y="50" font-size="14">Fuera</text></g>', outside: true },
      { name: 'scaled inside', drawing: '<g transform="translate(150 40) scale(2 .6)"><text x="-50" y="25" font-size="14">Scale</text></g>', outside: false },
      { name: 'scaled outside', drawing: '<g transform="scale(3 1)"><text x="190" y="25" font-size="14">Scale</text></g>', outside: true },
      { name: 'rotated inside', drawing: '<g transform="translate(100 100) rotate(45)"><text x="-10" y="0" font-size="14">Rotate</text></g>', outside: false },
      { name: 'rotated outside', drawing: '<g transform="translate(40 30) rotate(180)"><text x="20" y="0" font-size="14">Outside</text></g>', outside: true },
      { name: 'nested viewport', drawing: '<svg x="120" y="30" width="160" height="80" viewBox="0 0 80 40"><g transform="translate(40 5)"><text x="-20" y="15" font-size="14">Nested</text></g></svg>', outside: false },
      { name: 'nested outside', drawing: '<svg x="380" y="30" width="160" height="80" viewBox="0 0 80 40"><text x="20" y="15" font-size="14">Nested</text></svg>', outside: true },
    ];
    for (const rootStyle of ['', 'transform:translate(25px,10px) scale(1.2) rotate(8deg)']) {
      for (const sample of cases) {
        await page.setContent(fixture(sample.drawing, rootStyle));
        const info = await measure(page);
        assert.equal(info.labels, 1, sample.name);
        assert.equal(info.outside.length > 0, sample.outside, `${sample.name}: ${JSON.stringify(info)}`);
      }
    }
  } finally { await page.close(); }
});

test('executive measurement fails closed on unavailable matrices and retains visibility and font floors', async () => {
  const page = await h.browser.newPage();
  try {
    await page.goto(h.address);
    await page.evaluate(installLib);
    for (const kind of ['missing-root', 'singular-root', 'missing-text', 'throwing-text']) {
      await page.setContent(fixture('<text x="20" y="40" font-size="14">Visible</text>'));
      await page.evaluate((kind) => {
        const root = document.querySelector('svg')!;
        const text = document.querySelector('text')!;
        if (kind === 'missing-root') root.getScreenCTM = () => null;
        if (kind === 'singular-root') root.getScreenCTM = () => new DOMMatrix([0, 0, 0, 1, 0, 0]);
        if (kind === 'missing-text') text.getScreenCTM = () => null;
        if (kind === 'throwing-text') text.getScreenCTM = () => { throw new Error('Unavailable'); };
      }, kind);
      const info = await measure(page);
      assert.equal(info.outside.length, 1, kind);
      assert.match(info.outside[0], /bounds unavailable/, kind);
    }
    await page.setContent(fixture('<text x="20" y="40" font-size="8">Too small</text><text x="20" y="80" font-size="9">At floor</text><text x="-400" y="40" style="display:none">Hidden</text>'));
    const info = await measure(page);
    assert.equal(info.labels, 2, 'same visibility filter; hidden label is not counted');
    assert.equal(info.small.length, 1, 'strict 9 px floor remains');
    assert.match(info.small[0], /Too small/);
    assert.deepEqual(info.outside, []);
    await page.setContent(fixture('<g clip-path="inset(0)"><text x="450" y="40" font-size="14">Clipped outside</text></g>'));
    assert.equal((await measure(page)).outside.length, 1, 'clipping does not waive visible geometry');
  } finally { await page.close(); }
});

test('rendered label font floor follows text screen scale including root rotation', async () => {
  const page = await h.browser.newPage();
  try {
    await page.goto(h.address);
    await page.evaluate(installLib);
    const cases = [
      { name: 'quarter group scale', transform: 'scale(.25)', size: 18, small: true, px: '4.5px' },
      { name: 'half group scale at floor', transform: 'scale(.5)', size: 18, small: false },
      { name: 'just below floor', transform: 'scale(.4999)', size: 18, small: true },
      { name: 'above floor', transform: 'scale(.75)', size: 18, small: false },
      { name: 'expanded small local font', transform: 'scale(2)', size: 5, small: false },
      { name: 'nonuniform compression', transform: 'scale(.25 1)', size: 18, small: true, px: '4.5px' },
      { name: 'group rotation preserves floor', transform: 'rotate(35) scale(.5)', size: 18, small: false },
      { name: 'root rotation cannot enlarge a small font', transform: '', size: 8.5, small: true, px: '8.5px' },
      { name: 'skew reduces minimum scale', transform: 'skewX(60)', size: 12, small: true },
    ];
    for (const rootStyle of ['', 'transform:rotate(45deg)']) {
      for (const sample of cases) {
        await page.setContent(fixture(`<g transform="translate(100 80) ${sample.transform}"><text x="0" y="0" font-size="${sample.size}">Label</text></g>`, rootStyle));
        const info = await measure(page);
        assert.equal(info.small.length, sample.small ? 1 : 0, `${sample.name}, ${rootStyle}: ${JSON.stringify(info)}`);
        if (sample.px) assert.ok(info.small[0].includes(sample.px), sample.name);
      }
    }
    await page.setContent(fixture('<text x="0" y="0" transform="translate(100 80) scale(.25)" font-size="18">Text transform</text>'));
    assert.match((await measure(page)).small[0], /4\.5px/, 'text-local scale also applies');
  } finally { await page.close(); }
});

test('unmeasurable text font scale fails explicitly', async () => {
  const page = await h.browser.newPage();
  try {
    await page.goto(h.address);
    await page.evaluate(installLib);
    for (const kind of ['missing', 'singular', 'nonfinite', 'throwing']) {
      await page.setContent(fixture('<text x="20" y="40" font-size="18">Visible label</text>'));
      await page.evaluate((kind) => {
        const text = document.querySelector('text')!;
        text.getScreenCTM = () => {
          if (kind === 'throwing') throw new Error('Unavailable matrix');
          if (kind === 'missing') return null;
          return new DOMMatrix(kind === 'singular' ? [0, 0, 0, 1, 0, 0] : [NaN, 0, 0, 1, 0, 0]);
        };
      }, kind);
      const info = await measure(page);
      assert.equal(info.small.length, 1, kind);
      assert.match(info.small[0], /font scale unavailable/, kind);
    }
  } finally { await page.close(); }
});
