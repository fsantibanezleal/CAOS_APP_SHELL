import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startTierPage, type TierPage } from './tier-harness.ts';

// Shell 0.19.0, D16-21, S2: grouped bars. `BarDatum.group` puts consecutive data in one category band (side by side when vertical, one under
// another when horizontal) and the category axis prints the group label once; `BarChartProps.legend` says what each tone means. The form
// is Contraste's provision by segment under three regimes (c07 GroupedBars).
let t: TierPage;
before(async () => {
  t = await startTierPage(`
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { BarChart } from './src/index';
    import { useLangStore } from './src/lib/lang';
    const q = new URLSearchParams(location.search);
    useLangStore.getState().setLang(q.get('lang') === 'es' ? 'es' : 'en');
    const form = q.get('form') ?? 'h';
    const segments = [
      { id: 'retail', label: { en: 'Retail', es: 'Minorista' } },
      { id: 'corp', label: { en: 'Corporate', es: 'Corporativo' } },
      { id: 'sov', label: { en: 'Sovereign', es: 'Soberano' } },
    ];
    const regimes = [
      { id: 'base', label: { en: 'Base', es: 'Base' }, tone: 'accent' as const },
      { id: 'stress', label: { en: 'Stress', es: 'Estrés' }, tone: 'warn' as const },
      { id: 'severe', label: { en: 'Severe', es: 'Severo' }, tone: 'good' as const },
    ];
    const numbers = [[12, 18, 25], [30, 41, 55], [8, 9, 14]];
    const data = segments.flatMap((g, gi) => regimes.map((r, ri) => ({ id: g.id + '-' + r.id, label: r.label, group: g, value: numbers[gi][ri], tone: r.tone })));
    const legend = regimes.map((r) => ({ tone: r.tone, label: r.label }));
    const axis = { label: { en: 'Provision', es: 'Provisión' }, unit: { en: 'USD m', es: 'MUSD' }, format: { decimals: 0 } };
    const unequal = [
      ...regimes.map((r, ri) => ({ id: 'a-' + r.id, label: r.label, group: segments[0], value: [5, 6, 7][ri], tone: r.tone })),
      { id: 'b-base', label: regimes[0].label, group: segments[1], value: 9, tone: regimes[0].tone },
      ...regimes.slice(0, 2).map((r, ri) => ({ id: 'c-' + r.id, label: r.label, group: segments[2], value: [3, 4][ri], tone: r.tone })),
    ];
    const box = (child: React.ReactNode, wd = 640) => (<div><div style={{ width: wd, maxWidth: '100%' }}>{child}</div><div style={{ height: 1200 }}>after the chart</div></div>);
    const title = { en: 'Provision by segment', es: 'Provisión por segmento' };
    const forms: Record<string, () => React.ReactNode> = {
      h: () => box(<BarChart title={title} axis={axis} data={data} legend={legend} />),
      v: () => box(<BarChart title={title} axis={axis} data={data} legend={legend} orientation="vertical" />),
      unequal: () => box(<BarChart title={title} axis={axis} data={unequal} legend={legend} orientation="vertical" />),
      unequalh: () => box(<BarChart title={title} axis={axis} data={unequal} legend={legend} />),
      vnarrow: () => box(<BarChart title={title} axis={axis} data={data} legend={legend} orientation="vertical" />, 340),
      floating: () => box(<BarChart title={title} axis={{ ...axis, range: [0, 80] }} data={data.map((d) => ({ ...d, span: [d.value / 2, d.value] as [number, number] }))} legend={legend} orientation="vertical" />),
      nolegend: () => box(<BarChart title={title} axis={axis} data={data} />),
      // F8-1 (the Contraste adoption): short vertical grouped bars that take a choice; some bars are a few pixels tall
      vselect: () => box(<BarChart title={title} axis={axis} height={160} data={data.map((d, i) => ({ ...d, value: [11473, 300, 12039][i % 3] }))} legend={legend} orientation="vertical" onSelect={() => undefined} />, Number(q.get('w') ?? 640)),
    };
    createRoot(document.getElementById('root')!).render((forms[form] ?? forms.h)());
  `);
});
after(async () => {
  await t?.close();
});

async function open(query: string, opts?: Parameters<TierPage['open']>[1]) {
  const o = await t.open(query, opts);
  await o.page.waitForSelector('.caos-bars[data-drawn="1"] svg', { timeout: 10000 });
  return o;
}
const readout = async (page: Page) => ((await page.locator('.caos-bars-readout').textContent()) ?? '').replace(/ /g, ' ');
const rects = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('svg [data-bar]')].map((g) => {
      const r = g.querySelector('rect')!;
      return { id: g.getAttribute('data-bar')!, x: Number(r.getAttribute('x')), y: Number(r.getAttribute('y')), w: Number(r.getAttribute('width')), h: Number(r.getAttribute('height')), fill: r.getAttribute('fill') ?? '' };
    }),
  );
const NAMES = ['Retail, Base: 12 USD m', 'Retail, Stress: 18 USD m', 'Retail, Severe: 25 USD m', 'Corporate, Base: 30 USD m', 'Corporate, Stress: 41 USD m', 'Corporate, Severe: 55 USD m', 'Sovereign, Base: 8 USD m', 'Sovereign, Stress: 9 USD m', 'Sovereign, Severe: 14 USD m'];

test('S2 legend: a list of what each tone means, in the order given, with the tone of each swatch', async () => {
  for (const form of ['h', 'v']) {
    const { page, errors } = await open(`form=${form}`);
    try {
      const items = page.locator('.caos-bars-legend li');
      assert.deepEqual(await items.allTextContents(), ['Base', 'Stress', 'Severe'], form);
      assert.deepEqual(await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-tone'))), ['accent', 'warn', 'good']);
      const swatch = await items.evaluateAll((els) => els.map((e) => getComputedStyle(e.querySelector('.caos-bars-swatch')!).backgroundColor));
      assert.equal(new Set(swatch).size, 3, `three distinct colours: ${swatch}`);
      assert.equal(await page.locator('.caos-bars-legend').getAttribute('aria-label'), 'Legend');
      assert.equal(await page.locator('.caos-bars-host').getAttribute('data-legend'), '3');
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
  const none = await open('form=nolegend');
  try {
    assert.equal(await none.page.locator('.caos-bars-legend').count(), 0, 'no legend prop, no legend');
  } finally {
    await none.page.close();
  }
});

test('S2 layout: the group label is printed once; members stand side by side (vertical) or one under another (horizontal), one band per group', async () => {
  const v = await open('form=v');
  try {
    const all = await v.page.locator('.caos-bars svg').evaluate((svg) => [...svg.querySelectorAll('text')].map((x) => x.textContent ?? ''));
    for (const g of ['Retail', 'Corporate', 'Sovereign']) assert.equal(all.filter((x) => x === g).length, 1, `${g} once in ${all}`);
    assert.equal(await v.page.locator('.caos-bars-host').getAttribute('data-groups'), '3');
    const r = await rects(v.page);
    assert.equal(r.length, 9);
    for (let g = 0; g < 3; g++) {
      const m = r.slice(g * 3, g * 3 + 3);
      assert.ok(m[0].x + m[0].w <= m[1].x + 0.5 && m[1].x + m[1].w <= m[2].x + 0.5, `group ${g}: side by side ${JSON.stringify(m.map((q) => [q.x, q.w]))}`);
      assert.ok(m.every((q) => Math.abs(q.y + q.h - (m[0].y + m[0].h)) < 0.5), 'they stand on one baseline');
    }
    assert.ok(r[2].x + r[2].w < r[3].x && r[5].x + r[5].w < r[6].x, 'the groups are apart');
    assert.deepEqual(r.slice(0, 3).map((q) => q.fill), ['var(--color-accent)', 'var(--color-warn)', 'var(--color-good)']);
    assert.ok(r[1].h > r[0].h && r[2].h > r[1].h, 'taller for larger values');
  } finally {
    await v.page.close();
  }
  const h = await open('form=h');
  try {
    const all = await h.page.locator('.caos-bars svg').evaluate((svg) => [...svg.querySelectorAll('text')].map((x) => x.textContent ?? ''));
    for (const g of ['Retail', 'Corporate', 'Sovereign']) assert.equal(all.filter((x) => x === g).length, 1, `${g} once in ${all}`);
    const r = await rects(h.page);
    for (let g = 0; g < 3; g++) {
      const m = r.slice(g * 3, g * 3 + 3);
      assert.ok(m[0].y + m[0].h <= m[1].y + 0.5 && m[1].y + m[1].h <= m[2].y + 0.5, `group ${g}: one under another`);
      assert.ok(m.every((q) => Math.abs(q.x - m[0].x) < 0.5), 'they start on one line');
    }
    assert.ok(r[3].y - (r[2].y + r[2].h) > r[1].y - (r[0].y + r[0].h) + 2, 'a wider gap between groups than inside one');
  } finally {
    await h.page.close();
  }
});

test('S2 readout, keyboard and table: "group, label: value" in order group by group, member by member; the table has a group column', async () => {
  for (const form of ['h', 'v']) {
    const { page, errors } = await open(`form=${form}`);
    try {
      await page.focus('[data-chart-focus]');
      const key = form === 'h' ? 'ArrowDown' : 'ArrowRight';
      const seen: string[] = [];
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press(key);
        seen.push(await readout(page));
      }
      assert.deepEqual(seen, NAMES, form);
      await page.keyboard.press('Home');
      assert.equal(await readout(page), NAMES[0]);
      await page.keyboard.press('End');
      assert.equal(await readout(page), NAMES[8]);
      const table = page.locator('table[data-chart-table]');
      assert.deepEqual(await table.locator('thead th').allTextContents(), ['Group', 'Category', 'Provision (USD m)', 'Note']);
      assert.equal(await table.locator('tbody tr').count(), 9);
      assert.deepEqual(await table.locator('tbody tr').nth(4).locator('th, td').allTextContents(), ['Corporate', 'Stress', '41', '']);
      assert.match((await page.locator('.caos-chart-summary').textContent()) ?? '', /^Bar chart, Provision by segment: 9 bars\./);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
  const es = await open('form=v&lang=es');
  try {
    assert.deepEqual(await es.page.locator('table[data-chart-table] thead th').allTextContents(), ['Grupo', 'Categoría', 'Provisión (MUSD)', 'Nota']);
    await es.page.focus('[data-chart-focus]');
    await es.page.keyboard.press('End');
    assert.equal(await readout(es.page), 'Soberano, Severo: 14 MUSD');
    assert.equal(await es.page.locator('.caos-bars-legend').getAttribute('aria-label'), 'Leyenda');
  } finally {
    await es.page.close();
  }
});

test('S2 pointer: pointing at a member reads that member, in both orientations, and the crosshair marks it', async () => {
  for (const form of ['h', 'v']) {
    const { page } = await open(`form=${form}`);
    try {
      const r = await rects(page);
      for (const i of [1, 4, 8]) {
        const box = (await page.locator('.caos-bars svg').boundingBox())!;
        await page.mouse.move(box.x + r[i].x + r[i].w / 2, box.y + r[i].y + r[i].h / 2);
        await page.waitForTimeout(80);
        assert.equal(await readout(page), NAMES[i], `${form} member ${i}`);
        assert.equal(await page.locator('svg [data-cursor="1"]').getAttribute('data-bar'), ['retail', 'corp', 'sov'][Math.floor(i / 3)] + '-' + ['base', 'stress', 'severe'][i % 3]);
      }
    } finally {
      await page.close();
    }
  }
});

test('S2 Tier A: zoom is by group (the window holds whole groups), with the keys, the brush and the reset control', async () => {
  const { page, errors } = await open('form=v');
  try {
    const host = page.locator('.caos-bars-host');
    assert.equal(await host.getAttribute('data-window'), '0,3');
    assert.equal(await host.getAttribute('data-zoomable'), '1');
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('End');
    await page.keyboard.press('+');
    assert.equal(await host.getAttribute('data-zoomed'), '1');
    const [s, e] = ((await host.getAttribute('data-window')) ?? '').split(',').map(Number);
    assert.equal(e - s, 2, 'two groups is the least');
    assert.equal(await page.locator('svg [data-bar]').count(), 6, 'two groups of three in view');
    assert.equal(await readout(page), NAMES[8], 'the crosshair keeps its bar');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await readout(page), NAMES[7]);
    await page.locator('.caos-chart-reset').click();
    assert.equal(await host.getAttribute('data-zoomed'), null);
    assert.equal(await page.locator('svg [data-bar]').count(), 9);
    // a brush across the second group zooms to whole groups; the wheel zooms the focused chart and the double-click goes back
    const b = (await page.locator('.caos-bars svg').boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.42, b.y + b.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.5, { steps: 8 });
    await page.mouse.up();
    assert.equal(await host.getAttribute('data-zoomed'), '1', 'the brush zooms');
    const [bs, be] = ((await host.getAttribute('data-window')) ?? '').split(',').map(Number);
    assert.ok(Number.isInteger(bs) && Number.isInteger(be) && be - bs >= 2, `whole groups: ${bs}..${be}`);
    await page.mouse.dblclick(b.x + 30, b.y + 30);
    assert.equal(await host.getAttribute('data-zoomed'), null);
    await page.focus('[data-chart-focus]');
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(200);
    assert.equal(await host.getAttribute('data-zoomed'), '1', 'the wheel zooms the focused chart');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('S2 edge cases: groups of unequal size (3, 1, 2) keep one bar width and centre each group; no console error at 390 px', async () => {
  const v = await open('form=unequal');
  try {
    const r = await rects(v.page);
    assert.equal(r.length, 6);
    assert.ok(Math.abs(r[0].w - r[3].w) < 0.5 && Math.abs(r[0].w - r[4].w) < 0.5, 'one bar width');
    // the group of one is centred in its band: the same centre as the middle member of the group of three, one band apart
    const band = (r[3].x + r[3].w / 2) - (r[1].x + r[1].w / 2);
    const c1 = r[1].x + r[1].w / 2;
    const c2 = r[3].x + r[3].w / 2;
    const c3 = (r[4].x + r[5].x + r[5].w) / 2;
    assert.ok(Math.abs(c2 - c1 - band) < 0.5 && Math.abs(c3 - c2 - band) < 1, `centres ${c1.toFixed(1)}, ${c2.toFixed(1)}, ${c3.toFixed(1)}`);
    await v.page.focus('[data-chart-focus]');
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      await v.page.keyboard.press('ArrowRight');
      seen.push(await readout(v.page));
    }
    assert.deepEqual(seen.map((x) => x.split(':')[0]), ['Retail, Base', 'Retail, Stress', 'Retail, Severe', 'Corporate, Base', 'Sovereign, Base', 'Sovereign, Stress']);
    assert.deepEqual(v.errors, []);
  } finally {
    await v.page.close();
  }
  const h = await open('form=unequalh');
  try {
    assert.equal((await rects(h.page)).length, 6);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.page.close();
  }
  for (const form of ['v', 'h', 'floating']) {
    const m = await open(`form=${form}`, { width: 390, height: 800, touch: true });
    try {
      assert.equal(await m.page.evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), true, `${form}: nothing scrolls sideways`);
      assert.equal(await m.page.locator('svg [data-bar]').count(), 9);
      assert.deepEqual(m.errors, []);
    } finally {
      await m.page.close();
    }
  }
});

test('S2 on a narrow band: three members of a group at 340 px keep their value labels apart', async () => {
  const { page, errors } = await open('form=vnarrow', { width: 390, height: 800 });
  try {
    assert.equal(await page.locator('.caos-bars-host').getAttribute('data-groups'), '3');
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll('svg [data-bar]')].map((g) => {
        const r = g.querySelector('text')!.getBoundingClientRect();
        return { l: r.left, r: r.right, t: r.top, b: r.bottom };
      }),
    );
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap = a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
        assert.equal(overlap, false, `value labels ${i} and ${j} overlap`);
      }
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

// ---- the re-review of 0.19.0 (m4) and the Contraste adoption (F8-1) ----

type Rect = { l: number; r: number; t: number; b: number };
/** Each member's name on the drawing (`text[data-member]`), the group labels and the value labels, in the drawing's pixels. */
async function memberTexts(page: Page): Promise<{ w: number; members: (Rect & { id: string; name: string })[]; others: (Rect & { name: string })[] }> {
  // a string, so the test runner's transform adds no helper the page does not have
  return page.evaluate(`(() => {
    const svg = document.querySelector('.caos-bars svg');
    const s = svg.getBoundingClientRect();
    function rel(r) { return { l: r.left - s.left, r: r.right - s.left, t: r.top - s.top, b: r.bottom - s.top }; }
    const members = [...svg.querySelectorAll('[data-bar]')].map((g) => {
      const m = g.querySelector('text[data-member]');
      return { id: g.getAttribute('data-bar'), name: m ? m.textContent : '', ...(m ? rel(m.getBoundingClientRect()) : { l: 0, r: 0, t: 0, b: 0 }) };
    });
    const others = [...svg.querySelectorAll('text:not([data-member])')].map((x) => ({ name: x.textContent, ...rel(x.getBoundingClientRect()) }));
    return { w: s.width, members, others };
  })()`);
}
const overlaps = (a: Rect, b: Rect) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

test('m4: each member of a group is named on the drawing (its label, or its first letters when the slot is narrow), clear of every other text; the legend keeps the tone', async () => {
  const MEMBERS = ['Base', 'Stress', 'Severe'];
  for (const [form, wd, whole] of [['v', 640, true], ['h', 640, true], ['h', 390, true], ['vnarrow', 340, false]] as const) {
    const { page, errors } = await open(`form=${form}`, { width: wd + 50, height: 900 });
    try {
      const d = await memberTexts(page);
      assert.equal(d.members.length, 9, form);
      d.members.forEach((m, i) => {
        const label = MEMBERS[i % 3];
        assert.ok(m.name.length > 0 && label.startsWith(m.name), `${form}: member ${m.id} is named "${m.name}" (its label is ${label})`);
        if (whole) assert.equal(m.name, label, `${form}: there is room for the whole label of ${m.id}`);
        assert.ok(m.l >= -0.5 && m.r <= d.w + 0.5, `${form}: ${m.id}'s name lies inside the drawing`);
      });
      for (let i = 0; i < d.members.length; i++) {
        for (let j = i + 1; j < d.members.length; j++) assert.ok(!overlaps(d.members[i], d.members[j]), `${form}: the names of ${d.members[i].id} and ${d.members[j].id} overlap`);
        for (const o of d.others) assert.ok(!overlaps(d.members[i], o), `${form}: the name of ${d.members[i].id} lies over "${o.name}"`);
      }
      assert.equal(await page.locator('.caos-bars-legend li').count(), 3, 'the legend is still drawn');
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
  // the member names do not depend on the legend
  const plain = await t.open('form=nolegend');
  try {
    await plain.page.waitForSelector('.caos-bars[data-drawn="1"] svg');
    assert.equal(await plain.page.locator('svg text[data-member]').count(), 9, 'grouped without a legend: still named');
  } finally {
    await plain.page.close();
  }
});

test('F8-1: short vertical grouped bars that take a choice (onSelect) receive the pointer at the centre of each bar box', async () => {
  for (const wd of [390, 1280]) {
    const { page, errors } = await open(`form=vselect&w=${wd}`, { width: wd + 40, height: 900 });
    try {
      assert.equal(await page.locator('svg [data-bar][role="button"]').count(), 9);
      const missed = await page.evaluate(() =>
        [...document.querySelectorAll('svg [data-bar][role="button"]')].flatMap((g) => {
          const r = g.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return hit && (hit === g || g.contains(hit)) ? [] : [`${g.getAttribute('data-bar')} is covered by ${hit?.tagName}`];
        }),
      );
      assert.deepEqual(missed, [], `${wd}`);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
});
