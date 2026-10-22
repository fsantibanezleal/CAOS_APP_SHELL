import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startTierPage, type TierPage } from './tier-harness.ts';

// Shell 0.19.0, D16-21: the two forms of BarChart the products still drew by hand. S1 floating bars (`BarDatum.span`: waterfalls and
// bridges), S2 grouped bars with a legend (`BarDatum.group`, `BarChartProps.legend`). Each form carries the whole of Tier A.
let t: TierPage;
before(async () => {
  t = await startTierPage(`
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { BarChart } from './src/index';
    import { useLangStore } from './src/lib/lang';
    const w = window as unknown as Record<string, any>;
    w.__selected = [];
    const q = new URLSearchParams(location.search);
    useLangStore.getState().setLang(q.get('lang') === 'es' ? 'es' : 'en');
    const form = q.get('form') ?? 'waterfall';
    const axis = { label: { en: 'Capital', es: 'Capital' }, unit: { en: 'USD m', es: 'MUSD' }, format: { decimals: 0 } };
    // S1: the waterfall of four layers that end in a total (Contraste c18 Waterfall)
    const waterfall = [
      { id: 'l1', label: 'Layer 1', value: 40, span: [0, 40] as [number, number], tone: 'accent' as const },
      { id: 'l2', label: 'Layer 2', value: 25, span: [40, 65] as [number, number], tone: 'accent' as const },
      { id: 'l3', label: 'Layer 3', value: 20, span: [65, 85] as [number, number], tone: 'accent' as const },
      { id: 'l4', label: 'Layer 4', value: 7, span: [85, 92] as [number, number], tone: 'accent' as const },
      { id: 'tot', label: 'Total', value: 92, span: [0, 92] as [number, number], tone: 'good' as const, hint: 'the sum of the layers' },
    ];
    // S1: a bridge from one total to another through signed steps; the totals are dots, the axis does not start at zero (Contraste c07 BridgeView)
    const bridge = [
      { id: 'open', label: 'Opening', value: 120, span: [120, 120] as [number, number], tone: 'accent' as const },
      { id: 'a', label: 'Step A', value: 15, span: [120, 135] as [number, number], tone: 'good' as const },
      { id: 'b', label: 'Step B', value: -22, span: [135, 113] as [number, number], tone: 'bad' as const },
      { id: 'c', label: 'Step C', value: 6, span: [113, 119] as [number, number], tone: 'good' as const },
      { id: 'close', label: 'Closing', value: 119, span: [119, 119] as [number, number], tone: 'accent' as const },
    ];
    const box = (child: React.ReactNode, wd = 640) => (<div><div style={{ width: wd, maxWidth: '100%' }}>{child}</div><div style={{ height: 1200 }}>after the chart</div></div>);
    const forms: Record<string, () => React.ReactNode> = {
      waterfall: () => box(<BarChart title="Capital by layer" axis={axis} data={waterfall} onSelect={(id) => w.__selected.push(id)} />),
      waterfallv: () => box(<BarChart title="Capital by layer" orientation="vertical" axis={axis} data={waterfall} />),
      bridge: () => box(<BarChart title="Capital bridge" axis={{ ...axis, range: [100, 140] }} data={bridge} />),
      bridgev: () => box(<BarChart title="Capital bridge" orientation="vertical" axis={{ ...axis, range: [100, 140] }} data={bridge} />),
      reversed: () => box(<BarChart title="Same bar" axis={axis} data={[
        { id: 'fwd', label: 'Forward', value: 30, span: [20, 50] as [number, number] },
        { id: 'rev', label: 'Reversed', value: 30, span: [50, 20] as [number, number] },
        { id: 'zero', label: 'Zero length', value: 0, span: [35, 35] as [number, number] },
      ]} />),
      clip: () => box(<BarChart title="Clipped" axis={{ ...axis, range: [100, 140] }} data={[
        { id: 'wide', label: 'Wide', value: 60, span: [90, 150] as [number, number] },
        { id: 'below', label: 'Below', value: 5, span: [80, 95] as [number, number] },
        { id: 'in', label: 'Inside', value: 10, span: [110, 120] as [number, number] },
      ]} />),
      missing: () => box(<BarChart title="Missing ends" axis={axis} data={[
        { id: 'ok', label: 'Whole', value: 10, span: [0, 10] as [number, number] },
        { id: 'nullend', label: 'Null end', value: 4, span: [10, null] as unknown as [number, number] },
        { id: 'nullvalue', label: 'Null value', value: null, span: [10, 14] as [number, number] },
      ]} />),
      es: () => box(<BarChart title={{ en: 'Capital by layer', es: 'Capital por capa' }} axis={axis} data={waterfall} />),
      narrow: () => box(<BarChart title="Capital by layer" axis={axis} data={waterfall} />, Number(q.get('w') ?? 70)),
    };
    createRoot(document.getElementById('root')!).render((forms[form] ?? forms.waterfall)());
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
const bars = (page: Page) => page.locator('svg [data-bar]');

/** The value axis as the page draws it: each tick's value and its position along the axis, then a bar's extent in values. */
async function scaleOf(page: Page, horizontal: boolean) {
  return page.evaluate((hz) => {
    const svg = document.querySelector('.caos-bars svg')!;
    const ticks = [...svg.querySelectorAll(':scope > g')]
      .filter((g) => g.querySelector(':scope > line') && g.querySelector(':scope > text'))
      .map((g) => {
        const line = g.querySelector(':scope > line')!;
        return { v: Number((g.querySelector(':scope > text')!.textContent ?? '').replace(/[^\d.-]/g, '')), p: Number(line.getAttribute(hz ? 'x1' : 'y1')) };
      });
    return ticks;
  }, horizontal);
}
async function extents(page: Page, horizontal: boolean) {
  return page.evaluate((hz) => {
    return [...document.querySelectorAll('svg [data-bar]')].map((g) => {
      const r = g.querySelector('rect');
      const c = g.querySelector('circle');
      if (r) {
        const x = Number(r.getAttribute('x'));
        const y = Number(r.getAttribute('y'));
        const wd = Number(r.getAttribute('width'));
        const ht = Number(r.getAttribute('height'));
        return { id: g.getAttribute('data-bar')!, kind: 'rect', a: hz ? x : y, b: hz ? x + wd : y + ht, thick: hz ? ht : wd };
      }
      if (c) {
        const cx = Number(c.getAttribute('cx'));
        const cy = Number(c.getAttribute('cy'));
        const rr = Number(c.getAttribute('r'));
        return { id: g.getAttribute('data-bar')!, kind: 'circle', a: (hz ? cx : cy) - 0, b: (hz ? cx : cy) + 0, thick: rr * 2 };
      }
      return { id: g.getAttribute('data-bar')!, kind: 'none', a: NaN, b: NaN, thick: 0 };
    });
  }, horizontal);
}
/** A pixel position back to a value, from the two ends of the axis. */
const valueAt = (ticks: { v: number; p: number }[], p: number) => {
  const a = ticks[0];
  const b = ticks[ticks.length - 1];
  return a.v + ((p - a.p) / (b.p - a.p)) * (b.v - a.v);
};

test('S1 waterfall: four layers and a total are drawn end to end on the value axis, each at its own span (horizontal and vertical)', async () => {
  for (const [form, horizontal] of [['waterfall', true], ['waterfallv', false]] as const) {
    const { page, errors } = await open(`form=${form}`);
    try {
      const ticks = await scaleOf(page, horizontal);
      assert.equal(ticks[0].v, 0, `${form}: the axis starts at zero ${JSON.stringify(ticks)}`);
      const ext = await extents(page, horizontal);
      assert.equal(ext.length, 5, form);
      const spans = [[0, 40], [40, 65], [65, 85], [85, 92], [0, 92]];
      ext.forEach((e, i) => {
        assert.equal(e.kind, 'rect', `${form}: ${e.id}`);
        const [lo, hi] = [valueAt(ticks, Math.min(e.a, e.b)), valueAt(ticks, Math.max(e.a, e.b))].sort((p, q) => p - q);
        assert.ok(Math.abs(lo - spans[i][0]) < 0.6 && Math.abs(hi - spans[i][1]) < 0.6, `${form}: ${e.id} covers ${lo.toFixed(1)}..${hi.toFixed(1)}, wanted ${spans[i]}`);
      });
      // the layers meet: each starts where the one before it ends
      for (let i = 1; i < 4; i++) {
        const prev = ext[i - 1];
        const cur = ext[i];
        assert.ok(Math.abs(Math.max(prev.a, prev.b) - Math.min(cur.a, cur.b)) < 1.5 || Math.abs(Math.min(prev.a, prev.b) - Math.max(cur.a, cur.b)) < 1.5, `${form}: ${cur.id} meets ${prev.id}`);
      }
      // the value written at the bar is the layer's size, not its end
      const texts = await page.locator('svg [data-bar] text').allTextContents();
      assert.ok(texts.includes('25') && texts.includes('92'), `${form}: ${texts}`);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
});

test('S1 bridge: the totals are dots as thick as the steps, the axis does not start at zero, a negative step lies left of its start', async () => {
  for (const [form, horizontal] of [['bridge', true], ['bridgev', false]] as const) {
    const { page, errors } = await open(`form=${form}`);
    try {
      const ticks = await scaleOf(page, horizontal);
      assert.ok(ticks[0].v >= 100 && ticks[ticks.length - 1].v <= 140, `${form}: the axis is the range asked for: ${JSON.stringify(ticks)}`);
      const ext = await extents(page, horizontal);
      assert.deepEqual(ext.map((e) => e.kind), ['circle', 'rect', 'rect', 'rect', 'circle'], form);
      const step = ext[1].thick;
      assert.ok(Math.abs(ext[0].thick - step) < 1.5 && Math.abs(ext[4].thick - step) < 1.5, `${form}: dot ${ext[0].thick} is as thick as a step (${step})`);
      // the dots sit at their totals
      const dot = await page.evaluate((hz) => [...document.querySelectorAll('svg [data-bar] circle')].map((c) => Number(c.getAttribute(hz ? 'cx' : 'cy'))), horizontal);
      assert.ok(Math.abs(valueAt(ticks, dot[0]) - 120) < 0.6 && Math.abs(valueAt(ticks, dot[1]) - 119) < 0.6, `${form}: dots at ${dot.map((p) => valueAt(ticks, p).toFixed(1))}`);
      // Step B: 135 down to 113 (its ends given reversed): the bar covers 113..135, and in a horizontal bridge it lies left of Step A's end
      const b = ext[2];
      const [lo, hi] = [valueAt(ticks, b.a), valueAt(ticks, b.b)].sort((p, q) => p - q);
      assert.ok(Math.abs(lo - 113) < 0.6 && Math.abs(hi - 135) < 0.6, `${form}: Step B covers ${lo.toFixed(1)}..${hi.toFixed(1)}`);
      // the amount written is the signed amount of the step
      const texts = await page.locator('svg [data-bar] text').allTextContents();
      assert.ok(texts.some((s) => /^[-−]22$/.test(s)), `${form}: the step states its amount: ${texts}`);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
});

test('S1 readout and table: a floating bar reads "from a to b" and the table has both ends; the summary and the keyboard walk every bar', async () => {
  const { page, errors } = await open('form=waterfall');
  try {
    await page.focus('[data-chart-focus]');
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowDown');
      seen.push(await readout(page));
    }
    assert.deepEqual(seen, [
      'Layer 1: 40 USD m · from 0 to 40',
      'Layer 2: 25 USD m · from 40 to 65',
      'Layer 3: 20 USD m · from 65 to 85',
      'Layer 4: 7 USD m · from 85 to 92',
      'Total: 92 USD m · the sum of the layers · from 0 to 92',
    ]);
    const table = page.locator('table[data-chart-table]');
    assert.deepEqual(await table.locator('thead th').allTextContents(), ['Category', 'Capital (USD m)', 'From', 'To', 'Note']);
    assert.deepEqual(await table.locator('tbody tr').nth(1).locator('th, td').allTextContents(), ['Layer 2', '25', '40', '65', '']);
    assert.equal(await page.locator('.caos-bars-host').getAttribute('data-spans'), '5');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
  const es = await open('form=es&lang=es');
  try {
    assert.deepEqual(await es.page.locator('table[data-chart-table] thead th').allTextContents(), ['Categoría', 'Capital (MUSD)', 'Desde', 'Hasta', 'Nota']);
    await es.page.focus('[data-chart-focus]');
    await es.page.keyboard.press('ArrowDown');
    await es.page.keyboard.press('ArrowDown');
    assert.equal(await readout(es.page), 'Layer 2: 25 MUSD · de 40 a 65');
  } finally {
    await es.page.close();
  }
});

test('S1 Tier A: wheel and brush zoom, the reset control and the keys work on a floating chart as on a plain one', async () => {
  const { page, errors } = await open('form=bridge');
  try {
    assert.equal(await page.locator('.caos-bars-host').getAttribute('data-spans'), '5', 'the chart declares its floating bars');
    await page.focus('[data-chart-focus]');
    await page.keyboard.press('+');
    assert.equal(await page.locator('.caos-bars-host').getAttribute('data-zoomed'), '1');
    assert.equal(await page.locator('.caos-chart-reset').count(), 1);
    assert.ok((await bars(page).count()) < 5, 'fewer bars in view');
    await page.locator('.caos-chart-reset').click();
    assert.equal(await page.locator('.caos-bars-host').getAttribute('data-zoomed'), null);
    const r = (await page.locator('.caos-bars svg').boundingBox())!;
    await page.mouse.move(r.x + r.width / 2, r.y + 4 + (r.height - 70) * 0.3);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width / 2, r.y + 4 + (r.height - 70) * 0.7, { steps: 8 });
    await page.mouse.up();
    assert.equal(await page.locator('.caos-bars-host').getAttribute('data-zoomed'), '1', 'the brush zooms');
    await page.keyboard.press('0');
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.caos-bars-host').getAttribute('data-zoomed'), '1', 'the wheel zooms the focused chart');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('S1 edge cases: reversed ends draw the same bar; a zero length is a dot; a span outside the range is clipped; a null end draws nothing', async () => {
  const rev = await open('form=reversed');
  try {
    const ticks = await scaleOf(rev.page, true);
    const ext = await extents(rev.page, true);
    assert.equal(ext[0].kind, 'rect');
    assert.ok(Math.abs(ext[0].a - ext[1].a) < 0.01 && Math.abs(ext[0].b - ext[1].b) < 0.01, 'the same bar');
    assert.equal(ext[2].kind, 'circle', 'a zero length is a dot');
    assert.ok(ticks.length >= 2);
  } finally {
    await rev.page.close();
  }
  const clip = await open('form=clip');
  try {
    const ticks = await scaleOf(clip.page, true);
    const ext = await extents(clip.page, true);
    const lo = Math.min(...ticks.map((x) => x.p));
    const hi = Math.max(...ticks.map((x) => x.p));
    assert.equal(ext[0].kind, 'rect');
    assert.ok(Math.min(ext[0].a, ext[0].b) >= lo - 0.5 && Math.max(ext[0].a, ext[0].b) <= hi + 0.5, `the wide bar stays on the axis: ${ext[0].a}..${ext[0].b} of ${lo}..${hi}`);
    assert.equal(ext[1].kind, 'none', 'a bar wholly below the range draws nothing');
    assert.equal(ext[2].kind, 'rect');
    assert.deepEqual(clip.errors, []);
  } finally {
    await clip.page.close();
  }
  const miss = await open('form=missing');
  try {
    const ext = await extents(miss.page, true);
    assert.deepEqual(ext.map((e) => e.kind), ['rect', 'none', 'none']);
    await miss.page.focus('[data-chart-focus]');
    await miss.page.keyboard.press('End');
    assert.match(await readout(miss.page), /^Null value: (not available|n\/a|—)/i);
    assert.deepEqual(miss.errors, []);
  } finally {
    await miss.page.close();
  }
});

test('S1: at 0 px and at 70 px a floating chart raises no console error', async () => {
  for (const w of [0, 70]) {
    const { page, errors } = await t.open(`form=narrow&w=${w}`, { width: 300, height: 600 });
    try {
      await page.waitForTimeout(400);
      assert.deepEqual(errors, [], `width ${w}`);
      if (w > 0) assert.equal(await page.locator('.caos-bars-host').getAttribute('data-spans'), '5', 'drawn, with its floating bars');
    } finally {
      await page.close();
    }
  }
});
