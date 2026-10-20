import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { drawYMarks, namedRepeats, SOLO_DIM_ALPHA, soloKey, soloStyle, tickLabelAt, tickSplits, UPlotChart, xScaleRange } from '../src/chart/UPlotChart.tsx';
import { referenceLineName } from '../src/chart/text.ts';

/** Shell 0.18.0 (CAOS_Fragmenta 0.09.000, BL-042): what CAOS_Fragmenta's own uPlot wrapper did and the shell's chart did not:
 * named x ticks, a key that solos a series, an x range, dots on short lines and an unlabelled reference line. */

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);
const ticks = [
  { value: 2, label: { en: 'site held out', es: 'sitio retenido' } },
  { value: 0, label: { en: 'random', es: 'aleatorio' } },
  { value: 1, label: { en: 'deduplicated', es: 'deduplicado' } },
];

// ---- named ticks ---------------------------------------------------------------------------------------------------

test('tickSplits: the tick values inside the range, ascending, each once', () => {
  assert.deepEqual(tickSplits(ticks, -0.5, 2.5), [0, 1, 2]);
  assert.deepEqual(tickSplits(ticks, 0.5, 1.5), [1], 'a tick outside the range is not drawn');
  assert.deepEqual(tickSplits([...ticks, { value: 1, label: 'again' }], 0, 2), [0, 1, 2], 'a value listed twice ticks once');
  assert.deepEqual(tickSplits(ticks, 0, 2), [0, 1, 2], 'the ends of the range are inside');
});

test('tickSplits: a list of one, an empty list, and non-finite values', () => {
  assert.deepEqual(tickSplits([ticks[0]], 0, 5), [2]);
  assert.deepEqual(tickSplits([], 0, 5), []);
  assert.deepEqual(tickSplits([{ value: Number.NaN, label: 'x' }, { value: Infinity, label: 'y' }, ticks[1]], -1, 5), [0]);
});

test('tickSplits: on a log axis only the ticks above 0 and inside the range, in order', () => {
  const t = [0.001, 100, 1, 10, 0, -5, 1e6].map((value) => ({ value, label: String(value) }));
  assert.deepEqual(tickSplits(t, 0.5, 200, true), [1, 10, 100]);
  assert.deepEqual(tickSplits(t, -10, 5, false), [-5, 0, 0.001, 1], 'a linear axis keeps 0 and the negatives inside its range');
});

test('tickLabelAt: the label of the tick at an x, in the page language; none for an x that is no tick', () => {
  assert.equal(tickLabelAt(ticks, 1, 'en'), 'deduplicated');
  assert.equal(tickLabelAt(ticks, 1, 'es'), 'deduplicado');
  assert.equal(tickLabelAt(ticks, 0, 'es'), 'aleatorio');
  assert.equal(tickLabelAt(ticks, 1.5, 'en'), null);
  assert.equal(tickLabelAt(undefined, 1, 'en'), null);
  assert.equal(tickLabelAt([], 1, 'en'), null);
});

// ---- the x range ---------------------------------------------------------------------------------------------------

test('xScaleRange: the given range widens the data; the overlays widen it further; none given leaves uPlot its own', () => {
  assert.deepEqual(xScaleRange([0, 1, 2], null, [-0.5, 2.5], false), [-0.5, 2.5]);
  assert.deepEqual(xScaleRange([0, 1, 2], null, [0.5, 1.5], false), [0, 2], 'at least the range: data outside it still shows');
  assert.deepEqual(xScaleRange([0, 1, 2], { x: [-3, 1] }, [-0.5, 2.5], false), [-3, 2.5], 'overlays still widen it');
  assert.equal(xScaleRange([0, 1, 2], null, undefined, false), null);
  assert.deepEqual(xScaleRange([0, 1, 2], { x: [-3, 4] }, undefined, false), [-3, 4], 'as in 0.17.0 without a range');
  assert.deepEqual(xScaleRange([1], { x: [1, 1] }, undefined, false), [0, 2], 'one x alone: a unit either side, as in 0.17.0');
  assert.deepEqual(xScaleRange([1], { x: [1, 1] }, undefined, true), [0.1, 10], 'on a log axis a decade either side');
  assert.equal(xScaleRange([1, 2], null, [0, 3], true), null, 'a log axis cannot start at 0: uPlot keeps its own');
});

// ---- the solo key --------------------------------------------------------------------------------------------------

test('soloStyle: nothing soloed leaves every series as drawn; a solo dims the others to 0.12 and 1 px and keeps the chosen one', () => {
  assert.equal(SOLO_DIM_ALPHA, 0.12);
  assert.deepEqual(soloStyle(null, 0, 2), { alpha: 1, width: 2 });
  assert.deepEqual(soloStyle(1, 1, 3), { alpha: 1, width: 3 });
  assert.deepEqual(soloStyle(1, 0, 3), { alpha: 0.12, width: 1 });
  assert.deepEqual(soloStyle(0, 2, 1), { alpha: 0.12, width: 1 });
});

test('with solo the key entries are buttons, none pressed at rest, reachable by Tab (no tabindex), even for one series', () => {
  const two = html(<UPlotChart height={200} solo x={{ values: [1, 2, 3], label: 'Day' }} y={{ label: 'People' }} series={[{ label: 'A', values: [1, 2, 3] }, { label: 'B', values: [3, 2, 1] }]} />);
  assert.equal((two.match(/<button type="button"/g) ?? []).length, 2);
  assert.equal((two.match(/aria-pressed="false"/g) ?? []).length, 2);
  assert.ok(!/tabindex/.test(two), 'a button is in the Tab order by itself');
  const one = html(<UPlotChart height={200} solo x={{ values: [1, 2, 3], label: 'Day' }} y={{ label: 'People' }} series={[{ label: 'A', values: [1, 2, 3] }]} />);
  assert.equal((one.match(/<button type="button"/g) ?? []).length, 1, 'one series: the key still toggles');
});

// ---- nothing changes for a chart that uses none of it ------------------------------------------------------------

test('a chart with none of the new options renders exactly as in 0.17.0', () => {
  const two = html(<UPlotChart height={200} x={{ values: [1, 2, 3], label: 'Day' }} y={{ label: 'People' }} series={[{ label: 'A', values: [1, 2, 3] }, { label: 'B', values: [3, 2, 1] }]} yMarks={[{ y: 2, label: 'level' }]} />);
  assert.equal(
    two,
    '<div class="caos-chart" data-series="2" data-axis-titles="Day|People" data-ticks-cut="0" data-ticks-repeat="0" data-drawn="0" data-y-marks="1"><div class="caos-chart-plot"></div><ul class="caos-chart-legend" aria-label="Series of the chart"><li class="caos-chart-key" data-mode="line"><span class="caos-chart-swatch" style="--swatch:var(--color-accent)" aria-hidden="true"></span>A</li><li class="caos-chart-key" data-mode="line"><span class="caos-chart-swatch" style="--swatch:var(--color-magenta)" aria-hidden="true"></span>B</li></ul><p class="caos-chart-readout" aria-live="polite" title="Hover the chart to read the values">Hover the chart to read the values</p></div>',
  );
  const one = html(<UPlotChart height={200} x={{ values: [1, 2, 3], label: 'Day' }} y={{ label: 'People' }} series={[{ label: 'A', values: [1, 2, 3] }]} />);
  assert.equal(
    one,
    '<div class="caos-chart" data-series="1" data-axis-titles="Day|People" data-ticks-cut="0" data-ticks-repeat="0" data-drawn="0"><div class="caos-chart-plot"></div><p class="caos-chart-readout" aria-live="polite" title="Hover the chart to read the values">Hover the chart to read the values</p></div>',
  );
});

// ---- an unlabelled reference line ----------------------------------------------------------------------------------

function fakeChart(ys: Record<number, number>) {
  const texts: { text: string; x: number; y: number }[] = [];
  const lines: number[] = [];
  const ctx = {
    font: '',
    textAlign: 'right',
    textBaseline: 'middle',
    lineJoin: 'miter',
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    moveTo: (_x: number, y: number) => lines.push(y),
    lineTo: () => undefined,
    stroke: () => undefined,
    setLineDash: () => undefined,
    measureText: (t: string) => ({ width: t.length * 6 }),
    strokeText: () => undefined,
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y }),
  };
  const u = { ctx, bbox: { left: 0, top: 0, width: 300, height: 200 }, valToPos: (v: number) => ys[v] ?? 100 };
  return { u, texts, lines };
}
const style = { color: '#c80', halo: '#fff', family: 'sans-serif' };

test('drawYMarks: a line with no label is drawn, with no text', () => {
  const { u, texts, lines } = fakeChart({ 0: 150 });
  drawYMarks(u as never, [{ y: 0 }], style);
  assert.deepEqual(lines, [150]);
  assert.deepEqual(texts, []);
  const empty = fakeChart({ 0: 150 });
  drawYMarks(empty.u as never, [{ y: 0, label: '' }], style);
  assert.deepEqual(empty.texts, [], 'an empty label is no label');
});

test('drawYMarks: an unlabelled line reserves no room, so the labelled ones place themselves as without it', () => {
  const alone = fakeChart({ 5: 100 });
  drawYMarks(alone.u as never, [{ y: 5, label: 'limit' }], style);
  const among = fakeChart({ 5: 100, 6: 100, 7: 98 });
  drawYMarks(among.u as never, [{ y: 6 }, { y: 5, label: 'limit' }, { y: 7 }], style);
  assert.deepEqual(among.texts, alone.texts);
  assert.equal(among.lines.length, 3, 'all three lines are drawn');
});

test('a chart with an unlabelled reference line among labelled ones declares them all', () => {
  const m = html(<UPlotChart height={200} x={{ values: [1, 2], label: 'Day' }} y={{ label: 'People' }} series={[{ label: 'A', values: [1, 2] }]} yMarks={[{ y: 0 }, { y: 1, label: 'level' }]} />);
  assert.match(m, /data-y-marks="2"/);
});

// ---- the fix round of 0.18.0 (review of 2026-10-20) ----------------------------------------------------------------

test('namedRepeats: every duplicate label counts, adjacent or not; empty labels are no label', () => {
  assert.deepEqual(namedRepeats(['A', 'B', 'C']), { n: 0, names: [] });
  assert.deepEqual(namedRepeats(['A', 'A', 'B']), { n: 1, names: ['A'] });
  assert.deepEqual(namedRepeats(['A', 'B', 'A']), { n: 1, names: ['A'], }, 'a repeat that is not adjacent');
  assert.deepEqual(namedRepeats(['A', 'B', 'A', 'B', 'A']), { n: 3, names: ['A', 'B'] });
  assert.deepEqual(namedRepeats(['', 'A', '', 'A']), { n: 1, names: ['A'] });
  assert.deepEqual(namedRepeats([]), { n: 0, names: [] });
});

test('tickLabelAt: an x within 1e-9 of the span of a tick is on it; a value listed twice keeps its first label', () => {
  const t = [{ value: 0.1, label: 'low' }, { value: 0.2, label: 'mid' }, { value: 0.3, label: 'high' }];
  assert.equal(tickLabelAt(t, 0.1 + 0.2, 'en', 0.2), 'high');
  assert.equal(tickLabelAt(t, 0.1 + 0.2, 'en'), null, 'without a span only an exact x is on a tick');
  assert.equal(tickLabelAt(t, 0.3001, 'en', 0.2), null);
  const dup = [{ value: 1, label: 'B' }, { value: 1, label: 'C' }];
  assert.equal(tickLabelAt(dup, 1, 'en'), 'B', 'the first label of a value wins');
  assert.deepEqual(tickSplits(dup, 0, 2), [1]);
});

test('xScaleRange: on a log axis a range that reaches 0 or below is ignored alone, the overlays still widen the scale', () => {
  assert.deepEqual(xScaleRange([1, 100], { x: [1, 500] }, [0, 10], true), [1, 500]);
  assert.deepEqual(xScaleRange([1, 100], { x: [1, 500] }, [-3, 10], true), [1, 500]);
  assert.equal(xScaleRange([1, 100], null, [0, 10], true), null, 'nothing else widens it: uPlot keeps its own');
  assert.deepEqual(xScaleRange([1, 100], null, [0.5, 1000], true), [0.5, 1000], 'a positive range is used');
});

test('soloKey: the series id, else its English label', () => {
  assert.equal(soloKey({ label: { en: 'Alpha', es: 'Alfa' }, values: [] }), 'Alpha');
  assert.equal(soloKey({ label: 'Alpha', values: [] }), 'Alpha');
  assert.equal(soloKey({ id: 'a1', label: { en: 'Alpha', es: 'Alfa' }, values: [] }), 'a1');
});

test('referenceLineName: the name of an unlabelled handle in both languages, numbered when several share a chart', () => {
  assert.equal(referenceLineName('en', 1, 1), 'Reference line');
  assert.equal(referenceLineName('es', 1, 1), 'Línea de referencia');
  assert.equal(referenceLineName('en', 2, 3), 'Reference line 2');
  assert.equal(referenceLineName('es', 2, 3), 'Línea de referencia 2');
});
