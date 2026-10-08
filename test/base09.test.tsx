import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parityRange, seriesStyle, sortOrder, UPlotChart } from '../src/chart/UPlotChart.tsx';
import { formatNumber, formatTicks } from '../src/lib/format.ts';
import { ViewsRow } from '../src/workbench/ViewsRow.tsx';

/** The 0.9.0 base (CAOS_APP_SHELL#65; CAOS_MANAGE plans/app-shell BL-027 and BL-028): what CAOS_Fragmenta carried. */

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);

test('ViewsRow: each view in a shell column, the row split by shares', () => {
  const out = html(
    <ViewsRow shares={[3, 2]}>
      <p>A</p>
      <p>B</p>
      {null}
    </ViewsRow>,
  );
  assert.match(out, /^<div class="caos-views-row" data-views="2">/);
  assert.match(out, /<div class="caos-views-col" data-share="3" style="flex-grow:3"><p>A<\/p><\/div>/);
  assert.match(out, /<div class="caos-views-col" data-share="2" style="flex-grow:2"><p>B<\/p><\/div>/);
  const even = html(
    <ViewsRow>
      <p>A</p>
      <p>B</p>
    </ViewsRow>,
  );
  assert.doesNotMatch(even, /flex-grow/);
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.caos-views-col \{ display: flex; flex-direction: column; min-width: 0; min-height: 0;/);
});

test('sortOrder: uPlot draws by increasing x; an unsorted x is sorted and every index maps back', () => {
  assert.equal(sortOrder([1, 2, 3]), null);
  assert.equal(sortOrder([]), null);
  assert.deepEqual(sortOrder([5, 1, 3]), [1, 2, 0]);
  assert.deepEqual(sortOrder([2, 1, 2, 1]), [1, 3, 0, 2], 'ties keep their order');
});

test('parityRange: one padded range over both axes, absent values ignored', () => {
  const [lo, hi] = parityRange([0, 10], [2, null, 12]);
  assert.ok(Math.abs(lo - -0.6) < 1e-9 && Math.abs(hi - 12.6) < 1e-9, `${lo} ${hi}`);
  assert.deepEqual(parityRange([null], []), [0, 1]);
  const [a, b] = parityRange([5, 5]);
  assert.ok(a < 5 && b > 5, 'a single value still gets a range');
});

test('seriesStyle: past the six colours of the rotation, a repeated colour is dashed', () => {
  const s = (i: number) => seriesStyle({ label: 'x', values: [] }, i);
  assert.equal(s(0).color, '--color-accent');
  assert.equal(s(0).dash, undefined);
  assert.equal(s(6).color, '--color-accent');
  assert.deepEqual(s(6).dash, [6, 4]);
  assert.equal(seriesStyle({ label: 'x', values: [], color: '--color-bad' }, 7).dash, undefined, 'an explicit colour is the caller\'s');
  assert.deepEqual(seriesStyle({ label: 'x', values: [], dash: [2, 2] }, 1).dash, [2, 2]);
});

test('UPlotChart declares a parity plot, a log x axis and picking for the gate and the stylesheet', () => {
  const out = html(
    <UPlotChart
      parity
      x={{ values: [3, 1, 2], label: 'Observed', log: true }}
      y={{ label: 'Predicted' }}
      series={[{ label: 'p', values: [3.1, 0.9, 2.2], mode: 'points' }]}
      onPick={() => undefined}
    />,
  );
  assert.match(out, /data-parity="1"/);
  assert.match(out, /data-log-x="1"/);
  assert.match(out, /data-pick="1"/);
  const css = readFileSync(new URL('../chart.css', import.meta.url), 'utf8');
  assert.match(css, /\.caos-chart\[data-parity\] \.uplot \{ margin-inline: auto; \}/);
});

test('formatNumber: 1e-4 is fixed, also as the percent of 1e-6 that floating point leaves under it (known shell defect 32)', () => {
  // 1e-6 * 100 is 9.999999999999999e-5: on the boundary, not below it
  assert.equal(1e-6 * 100 < 1e-4, true);
  assert.equal(formatNumber(1e-6, 'en', { percent: true, digits: 2 }), '0.0001\u00a0%');
  assert.equal(formatNumber(1e-6, 'es', { percent: true, digits: 2 }), '0,0001\u00a0%');
  assert.equal(formatNumber(1e-4, 'en'), '0.0001');
  // truly below the boundary stays scientific
  assert.equal(formatNumber(9.99e-5, 'en'), '9.99E-5');
  assert.equal(formatNumber(9.99e-7, 'en', { percent: true, digits: 3 }), '9.99E-5\u00a0%');
  // one axis of PDs in percent, 1e-6 to 1e-2: every tick fixed, none scientific
  const ticks = formatTicks([1e-6, 1e-4, 1e-2], 'en', { percent: true, digits: 2 });
  assert.deepEqual(ticks, ['0.0001\u00a0%', '0.01\u00a0%', '1\u00a0%']);
  // an axis with a tick truly below the boundary is scientific throughout (known shell defect 19 holds)
  assert.equal(formatTicks([1e-7, 1e-4], 'en', { percent: true, digits: 2 }).every((s) => s.includes('E')), true);
});
