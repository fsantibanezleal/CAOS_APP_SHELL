import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allIntegers,
  axisTitleFits,
  bandsOf,
  barExtent,
  brushWindow,
  categoryAt,
  chartSummary,
  clipExtent,
  brushRange,
  DRAG_THRESHOLD,
  formatTime,
  leastLabelSpan,
  sameData,
  defaultChartName,
  firstVisible,
  isZoomed,
  keyAction,
  memberAt,
  memberSlots,
  unusedLegendTones,
  panRange,
  revealValue,
  roundWindow,
  stepIndex,
  stepWindow,
  thinRows,
  windowRange,
  windowZoomed,
  wheelFactor,
  wrapLines,
  zoomRange,
} from '../src/chart/interaction.ts';
import { niceStep, niceStepAt, niceTicks, textWidth } from '../src/chart/text.ts';
import { formatTicks } from '../src/lib/format.ts';

/** Shell 0.19.0: Tier A of the interactive-visualization rubric on every shell chart, and the three defects the Contraste
 * capture review found (integer ticks on a bar chart, square roots in prose, an axis title that is cut). The pure rules. */

// ---- zoom and pan of a range ---------------------------------------------------------------------------------------

test('zoomRange: zooming in keeps the anchor where it is on the screen and stays inside the full range', () => {
  const full: [number, number] = [0, 100];
  const [lo, hi] = zoomRange(full, full, 25, 0.5);
  assert.deepEqual([lo, hi], [12.5, 62.5], 'half the span, the anchor at a quarter of the view as before');
  assert.equal((25 - lo) / (hi - lo), 0.25);
  const [a, b] = zoomRange([0, 100], full, 0, 0.1);
  assert.deepEqual([a, b], [0, 10], 'zooming at the left edge stays at the left edge');
  const [c, d] = zoomRange([0, 100], full, 100, 0.1);
  assert.deepEqual([c, d], [90, 100], 'and at the right edge');
});

test('zoomRange: zooming out never leaves the full range, and a range as wide as the full one is the full one', () => {
  const full: [number, number] = [0, 100];
  assert.deepEqual(zoomRange([40, 60], full, 50, 100), [0, 100]);
  assert.deepEqual(zoomRange([0, 100], full, 50, 2), [0, 100]);
  const [lo, hi] = zoomRange([90, 100], full, 95, 4);
  assert.ok(lo >= 0 && hi <= 100 && Math.abs(hi - lo - 40) < 1e-9, `slid back inside: ${lo} ${hi}`);
});

test('zoomRange: the span never goes below a thousandth of the full span, or the least span given', () => {
  const full: [number, number] = [0, 1000];
  let r: [number, number] = [0, 1000];
  for (let i = 0; i < 80; i++) r = zoomRange(r, full, 500, 0.5);
  assert.ok(Math.abs(r[1] - r[0] - 1) < 1e-9, `least span ${r[1] - r[0]}`);
  let q: [number, number] = [0, 10];
  for (let i = 0; i < 20; i++) q = zoomRange(q, [0, 10], 5, 0.5, { minSpan: 2 });
  assert.ok(Math.abs(q[1] - q[0] - 2) < 1e-9);
});

test('zoomRange: on a log axis the zoom is made in decades and stays positive', () => {
  const full: [number, number] = [1, 10000];
  const [lo, hi] = zoomRange(full, full, 100, 0.5, { log: true });
  assert.ok(Math.abs(Math.log10(hi) - Math.log10(lo) - 2) < 1e-9, `two decades of four: ${lo} ${hi}`);
  assert.ok(Math.abs(Math.log10(lo) - 1) < 1e-9, 'the anchor, 100, at the middle as before');
  assert.ok(lo > 0 && hi > 0);
  // a log axis whose range reaches 0 is zoomed linearly, never to NaN
  const r = zoomRange([0, 10], [0, 10], 5, 0.5, { log: true });
  assert.ok(r.every(Number.isFinite));
});

test('zoomRange: a factor or an anchor that is not a number gives back the full range', () => {
  assert.deepEqual(zoomRange([2, 4], [0, 10], Number.NaN, 0.5), [0, 10]);
  assert.deepEqual(zoomRange([2, 4], [0, 10], 3, Number.NaN), [0, 10]);
  assert.deepEqual(zoomRange([2, 4], [0, 10], 3, -1), [0, 10]);
  assert.deepEqual(zoomRange([2, 4], [5, 5], 3, 0.5), [5, 5], 'an empty full range is returned as it is');
});

test('panRange: moves by a share of the span, keeps the span, stops at the ends of the full range', () => {
  const full: [number, number] = [0, 100];
  assert.deepEqual(panRange([20, 40], full, 0.5), [30, 50]);
  assert.deepEqual(panRange([20, 40], full, -5), [0, 20]);
  assert.deepEqual(panRange([60, 90], full, 5), [70, 100]);
  assert.deepEqual(panRange([0, 100], full, 0.5), [0, 100], 'nothing to pan when the whole range is shown');
  const lg = panRange([10, 100], [1, 1000], 1, true);
  assert.ok(Math.abs(Math.log10(lg[1]) - Math.log10(lg[0]) - 1) < 1e-9 && Math.abs(lg[0] - 100) < 1e-6, `a decade to the right: ${lg}`);
});

test('revealValue: a value inside the view leaves it, one outside slides it to the value', () => {
  const full: [number, number] = [0, 100];
  assert.deepEqual(revealValue([20, 40], full, 30), [20, 40]);
  const [lo, hi] = revealValue([20, 40], full, 80);
  assert.ok(lo < 80 && hi > 80 && Math.abs(hi - lo - 20) < 1e-9);
  assert.deepEqual(revealValue([20, 40], full, 100), [80, 100], 'kept inside the full range');
});

test('isZoomed: any range other than the full one is zoomed, to a billionth of the span', () => {
  assert.equal(isZoomed([0, 100], [0, 100]), false);
  assert.equal(isZoomed([0, 100 + 1e-12], [0, 100]), false);
  assert.equal(isZoomed([0, 99], [0, 100]), true);
  assert.equal(isZoomed([1, 100], [0, 100]), true);
});

test('wheelFactor: scrolling up zooms in, down zooms out, lines and pages count more than pixels, a huge delta is bounded', () => {
  assert.ok(wheelFactor(-100) < 1 && wheelFactor(100) > 1 && wheelFactor(0) === 1);
  assert.ok(Math.abs(wheelFactor(-100) * wheelFactor(100) - 1) < 1e-12);
  assert.ok(wheelFactor(-3, 1) < wheelFactor(-3, 0));
  assert.ok(wheelFactor(-1, 2) < wheelFactor(-1, 1));
  assert.ok(wheelFactor(-1e9) > 0.3 && wheelFactor(1e9) < 3);
});

// ---- the keyboard model --------------------------------------------------------------------------------------------

test('keyAction: arrows move the crosshair, Shift with them pans, Home and End go to the ends, + and - zoom, 0 and Escape reset, Enter and Space choose', () => {
  assert.equal(keyAction('ArrowRight'), 'next');
  assert.equal(keyAction('ArrowDown'), 'next');
  assert.equal(keyAction('ArrowLeft'), 'prev');
  assert.equal(keyAction('ArrowUp'), 'prev');
  assert.equal(keyAction('ArrowRight', { shift: true }), 'panNext');
  assert.equal(keyAction('ArrowLeft', { shift: true }), 'panPrev');
  assert.equal(keyAction('Home'), 'first');
  assert.equal(keyAction('End'), 'last');
  assert.equal(keyAction('+', { shift: true }), 'zoomIn', 'a plus is typed with Shift on most keyboards');
  assert.equal(keyAction('='), 'zoomIn');
  assert.equal(keyAction('-'), 'zoomOut');
  assert.equal(keyAction('0'), 'reset');
  assert.equal(keyAction('Escape'), 'reset');
  assert.equal(keyAction('Enter'), 'activate');
  assert.equal(keyAction(' '), 'activate');
  assert.equal(keyAction('a'), null);
  assert.equal(keyAction('Tab'), null, 'Tab is never taken: focus leaves the chart');
});

test('keyAction: a key with Ctrl, Meta or Alt is the browser\'s page zoom and is not handled', () => {
  for (const mods of [{ ctrl: true }, { meta: true }, { alt: true }]) {
    assert.equal(keyAction('+', mods), null);
    assert.equal(keyAction('-', mods), null);
    assert.equal(keyAction('0', mods), null);
    assert.equal(keyAction('ArrowLeft', mods), null);
  }
});

test('stepIndex: from nothing the first or the last, the ends hold, Home and End jump', () => {
  assert.equal(stepIndex(null, 'next', 5), 0);
  assert.equal(stepIndex(null, 'prev', 5), 4);
  assert.equal(stepIndex(2, 'next', 5), 3);
  assert.equal(stepIndex(2, 'prev', 5), 1);
  assert.equal(stepIndex(4, 'next', 5), 4);
  assert.equal(stepIndex(0, 'prev', 5), 0);
  assert.equal(stepIndex(2, 'first', 5), 0);
  assert.equal(stepIndex(2, 'last', 5), 4);
  assert.equal(stepIndex(0, 'next', 0), null, 'an empty chart has no point to stop on');
  assert.equal(stepIndex(9, 'next', 5), 0, 'a stale index starts again');
});

test('firstVisible: the first index inside a zoomed view, none when the view holds no x', () => {
  assert.equal(firstVisible([1, 2, 3, 4, 5], 2.5, 4.5), 2);
  assert.equal(firstVisible([1, 2, 3], 10, 20), null);
  assert.equal(firstVisible([], 0, 1), null);
});

// ---- the window of categories of a bar chart ------------------------------------------------------------------------

test('roundWindow: whole bars only, at least two, inside the data', () => {
  assert.deepEqual(roundWindow([1.4, 4.6], 10), [1, 5]);
  assert.deepEqual(roundWindow([3, 3.2], 10), [3, 5], 'a window of fewer than two bars is widened');
  assert.deepEqual(roundWindow([9, 10], 10), [8, 10], 'widened to the left at the end');
  assert.deepEqual(roundWindow([-3, 50], 10), [0, 10]);
  assert.deepEqual(roundWindow([0, 1], 1), [0, 1], 'one bar alone is a window of one');
});

test('windowRange, windowZoomed: no window is the whole list; any other is zoomed', () => {
  assert.deepEqual(windowRange(8, null), [0, 8]);
  assert.deepEqual(windowRange(8, [2, 5]), [2, 5]);
  assert.equal(windowZoomed(8, null), false);
  assert.equal(windowZoomed(8, [0, 8]), false);
  assert.equal(windowZoomed(8, [0, 7]), true);
  assert.equal(windowZoomed(8, [1, 8]), true);
});

test('categoryAt: the bar under a position along the category axis, in a window or in the whole list', () => {
  assert.equal(categoryAt(0, 0, 100, [0, 10], 10), 0);
  assert.equal(categoryAt(99, 0, 100, [0, 10], 10), 9);
  assert.equal(categoryAt(55, 0, 100, [0, 10], 10), 5);
  assert.equal(categoryAt(55, 0, 100, [4, 8], 10), 6, 'a window of 4 bars from 4: the middle is bar 6');
  assert.equal(categoryAt(-5, 0, 100, [0, 10], 10), null);
  assert.equal(categoryAt(105, 0, 100, [0, 10], 10), null);
  assert.equal(categoryAt(50, 100, 100, [0, 10], 10), null, 'an empty axis has no bar');
});

test('brushWindow: a drag selects every bar it touches, in either direction, and nothing outside the axis', () => {
  assert.deepEqual(brushWindow(25, 55, 0, 100, [0, 10], 10), [2, 6]);
  assert.deepEqual(brushWindow(55, 25, 0, 100, [0, 10], 10), [2, 6]);
  assert.deepEqual(brushWindow(-50, 29, 0, 100, [0, 10], 10), [0, 3], 'a brush that starts outside is cut to the axis');
  assert.deepEqual(brushWindow(31, 33, 0, 100, [0, 10], 10), [3, 5], 'a brush over one bar widens to two');
  assert.equal(brushWindow(10, 20, 100, 100, [0, 10], 10), null);
});

// ---- touch ---------------------------------------------------------------------------------------------------------

// ---- text and tables -----------------------------------------------------------------------------------------------

test('wrapLines: a title is broken at words into as many lines as it needs and never shortened', () => {
  const title = 'Accumulated CVA and DVA (USD millions, 99% one-sided)';
  const lines = wrapLines(title, 120, 11);
  assert.ok(lines.length >= 2);
  assert.equal(lines.join(' '), title, 'every word is there');
  assert.ok(lines.every((l) => textWidth(l, 11) <= 120 + 0.5), 'every line fits');
  assert.deepEqual(wrapLines('short', 500, 11), ['short']);
  assert.deepEqual(wrapLines('', 100, 11), ['']);
});

test('wrapLines: a word longer than a line is broken, so nothing runs out of the drawing', () => {
  const lines = wrapLines('Konstantinopolitanischerdudelsackpfeifer', 60, 11);
  assert.ok(lines.length > 1 && lines.every((l) => textWidth(l, 11) <= 60 + 0.5));
  assert.equal(lines.join(''), 'Konstantinopolitanischerdudelsackpfeifer');
});

test('axisTitleFits: a title fits along an axis when its width is within the room', () => {
  assert.equal(axisTitleFits('Share', 200), true);
  assert.equal(axisTitleFits('Accumulated CVA and DVA (USD millions)', 100), false);
  assert.equal(axisTitleFits('x', -5), false);
});

test('thinRows: every row up to the most, else every k-th with the last one kept', () => {
  assert.deepEqual(thinRows(3, 5), [0, 1, 2]);
  assert.deepEqual(thinRows(0, 5), []);
  const rows = thinRows(10000, 1000);
  assert.ok(rows.length <= 1001 && rows[0] === 0 && rows[rows.length - 1] === 9999);
});

test('allIntegers: counts are whole, a fraction or a missing value is judged by the finite ones', () => {
  assert.equal(allIntegers([0, 1, 5, null, undefined]), true);
  assert.equal(allIntegers([0, 1.5]), false);
  assert.equal(allIntegers([]), true);
});

test('sameData: the same values in a fresh array match; any changed value, a swap, a tiny relative change or a changed length does not (M6)', () => {
  const a = [[1, 2, 3], [4, null, 6]];
  assert.equal(sameData(a, [[1, 2, 3], [4, null, 6]]), true);
  assert.equal(sameData(a, [[1, 2, 3], [4, undefined, 6]]), true, 'a missing value is a missing value');
  assert.equal(sameData(a, [[1, 2, 3], [4, null, 7]]), false);
  assert.equal(sameData(a, [[1, 2, 3], [4, 6, null]]), false);
  assert.equal(sameData(a, [[1, 2, 3, 4], [4, null, 6, 7]]), false);
  assert.equal(sameData(a, [[1, 2, 3]]), false, 'a column fewer');
  const col = Array.from({ length: 120 }, (_, i) => i * i);
  const swapped = [...col];
  [swapped[0], swapped[97]] = [swapped[97], swapped[0]];
  assert.equal(sameData([col], [swapped]), false, 'the values at 0 and 97 swapped (the old fingerprint weighed both by 1)');
  assert.equal(sameData([[1e17, 3]], [[1e17 + 16, 3]]), false, 'a change far below the sum of the column');
  const same = [1, 2, 3];
  assert.equal(sameData([same], [same]), true, 'the same array');
});

test('leastLabelSpan: the least span at which an axis of significant digits still labels its ticks apart (M2)', () => {
  // depth 1000 to 1490 with the default four digits: labels are whole numbers, so ticks must be at least 1 apart; a 600 px axis holds 12 ticks
  const least = leastLabelSpan(undefined, [1000, 1490], 600, 50);
  assert.ok(least >= 12 && least <= 14, String(least));
  assert.equal(leastLabelSpan({ decimals: 1 }, [1000, 1490], 600, 50), 0, 'fixed decimals have their own tick steps');
  const small = leastLabelSpan({ digits: 3 }, [1, 1.5], 600, 50);
  assert.ok(Math.abs(small - 0.13) < 1e-9, String(small));
  assert.equal(leastLabelSpan({ percent: true }, [0.1, 0.9], 600, 50) > 0, true);
  assert.equal(leastLabelSpan(undefined, [0, 0], 600, 50), 0);
  assert.equal(leastLabelSpan(undefined, [1e-9, 5e-9], 600, 50), 0, 'scientific notation has no fixed resolution');
});

test('formatTime: a date in the page language, with the time of day only when the span is under three days (M3)', () => {
  const en = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(1704067200 * 1000));
  const es = new Intl.DateTimeFormat('es-CL', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(1704067200 * 1000));
  assert.equal(formatTime(1704067200, 'en', 30 * 86400), en);
  assert.equal(formatTime(1704067200, 'es', 30 * 86400), es);
  assert.ok(formatTime(1704067200, 'en', 3600).length > en.length, 'the time of day shows on a short span');
  assert.ok(!/1,704/.test(formatTime(1704067200, 'en', 1)));
});

test('brushRange: the dragged range, in order, inside the full range and never narrower than the least span', () => {
  assert.deepEqual(brushRange([30, 20], [0, 100], 0), [20, 30]);
  assert.deepEqual(brushRange([-10, 20], [0, 100], 0), [0, 20]);
  assert.deepEqual(brushRange([95, 140], [0, 100], 0), [95, 100]);
  const [lo, hi] = brushRange([50, 50.001], [0, 100], 1);
  assert.ok(Math.abs(hi - lo - 1) < 1e-9 && lo < 50.001 && hi > 50, `${lo} ${hi}`);
  const edge = brushRange([99.9999, 100], [0, 100], 1);
  assert.ok(edge[1] <= 100 && Math.abs(edge[1] - edge[0] - 1) < 1e-9, `${edge}`);
  assert.deepEqual(brushRange([1, 99], [0, 100], 500), [0, 100], 'a least span past the full span is the full range');
});

test('DRAG_THRESHOLD: one threshold of 5 px for the bars and the lines (m2)', () => {
  assert.equal(DRAG_THRESHOLD, 5);
});

test('chartSummary: one line in the page language with the series, the x range and the extremes', () => {
  const en = chartSummary('en', { kind: 'line', name: 'Growth', count: 12, series: ['A', 'B'], xLabel: 'Year', xFrom: '2000', xTo: '2011', yLabel: 'Mass (kg)', low: { text: '1.0 kg', at: 'A, Year 2000' }, high: { text: '9.5 kg', at: 'B, Year 2011' } });
  assert.equal(en, 'Line chart, Growth: 12 points. series A, B. Year from 2000 to 2011. Mass (kg): lowest 1.0 kg at A, Year 2000, highest 9.5 kg at B, Year 2011.');
  const es = chartSummary('es', { kind: 'bars', name: 'Picos', count: 3, yLabel: 'Pico', low: { text: '2', at: 'Uno' }, high: { text: '9', at: 'Tres' } });
  assert.equal(es, 'Gráfico de barras, Picos: 3 barras. Pico: mínimo 2 en Uno, máximo 9 en Tres.');
  assert.ok(!en.includes('\n') && !es.includes('\n'));
  assert.equal(defaultChartName('en', 'Mass', 'Year'), 'Mass by Year');
  assert.equal(defaultChartName('es', 'Masa', 'Año'), 'Masa según Año');
});

// ---- D1: integer ticks ---------------------------------------------------------------------------------------------

test('niceStepAt: a step that is a whole multiple of the resolution, never a fraction of it', () => {
  assert.equal(niceStepAt(0.4, 1), 1);
  assert.equal(niceStepAt(1, 1), 1);
  assert.equal(niceStepAt(1.2, 1), 2);
  assert.equal(niceStepAt(2.3, 1), 5);
  assert.equal(niceStepAt(6, 1), 10);
  assert.equal(niceStepAt(21, 1), 25, '25 is a whole number');
  assert.equal(niceStepAt(Number.NaN, 1), 1);
  assert.equal(niceStepAt(0.03, 0.1), 0.1, 'one decimal cannot tick finer than a tenth');
  assert.equal(niceStepAt(0.21, 0.1), 0.5, '0.25 would read 0.3: a multiple of 0.1 is taken');
  assert.equal(niceStepAt(0.7, 0.01), 1, 'a hundredth resolution takes round steps above it');
  assert.equal(niceStepAt(0.37, 0), niceStep(0.37), 'with no resolution it is niceStep');
});

test('niceTicks with a resolution of 1: counts from 0 to 2 tick at 0, 1, 2 and never read "0, 1, 1, 2, 2" (Contraste b05, b07, b08, b09)', () => {
  const fractional = niceTicks(0, 2, 400, 30);
  assert.ok(fractional.some((t) => !Number.isInteger(t)), 'without the option the ticks of 0 to 2 are fractional');
  const ticks = niceTicks(0, 2, 400, 30, 6, 1);
  assert.deepEqual(ticks, [0, 1, 2]);
  const labels = formatTicks(ticks, 'en', { digits: 3 });
  assert.deepEqual(labels, ['0', '1', '2']);
  assert.equal(new Set(labels).size, labels.length, 'no label repeats');
});

test('niceTicks with a resolution of 1: every tick is a whole number on every range, and the range stays covered', () => {
  for (const [lo, hi] of [[0, 1], [0, 2], [0, 3], [0, 7], [0, 13], [0, 87], [0, 1200], [-3, 4], [-0.3, 1.2], [0, 0]]) {
    for (const room of [60, 150, 400]) {
      const t = niceTicks(lo, hi, room, 30, 6, 1);
      assert.ok(t.every(Number.isInteger), `${lo}..${hi} in ${room}: ${t}`);
      assert.ok(t[0] <= lo && t[t.length - 1] >= hi, `${lo}..${hi} in ${room} covered by ${t}`);
      const labels = formatTicks(t, 'en', { digits: 3 });
      assert.equal(new Set(labels).size, labels.length, `no repeated label on ${lo}..${hi}: ${labels}`);
    }
  }
});

test('stepWindow: a key zoom always changes the window by at least a bar while it can, and stops at two bars and at all of them', () => {
  let w: [number, number] = [0, 8];
  const widths: number[] = [];
  for (let i = 0; i < 8; i++) {
    w = stepWindow(w, 8, 3.5, 0.7);
    widths.push(w[1] - w[0]);
  }
  assert.deepEqual(widths, [6, 4, 3, 2, 2, 2, 2, 2]);
  assert.ok(w[0] <= 3 && w[1] > 3, `the anchor bar stays: ${w}`);
  for (let i = 0; i < 10; i++) w = stepWindow(w, 8, 3.5, 1 / 0.7);
  assert.deepEqual(w, [0, 8], 'zooming out reaches every bar');
  assert.deepEqual(stepWindow([0, 3], 3, 1.5, 0.7), [1, 3], 'an anchor in the middle drops the first bar');
  assert.deepEqual(stepWindow([0, 2], 2, 1, 0.7), [0, 2], 'two bars cannot be zoomed');
});

test('niceTicks with a resolution of a tenth: ticks of fixed decimals never repeat a label (a share axis of 0.01 to 0.04 at one decimal)', () => {
  const free = formatTicks(niceTicks(0, 0.04, 300, 30), 'en', { decimals: 1 });
  assert.ok(new Set(free).size < free.length, `without the resolution the labels repeat: ${free}`);
  const t = niceTicks(0, 0.04, 300, 30, 6, 0.1);
  const labels = formatTicks(t, 'en', { decimals: 1 });
  assert.equal(new Set(labels).size, labels.length, `no repeat: ${labels}`);
  assert.ok(t[0] <= 0 && t[t.length - 1] >= 0.04);
});

// ---- floating bars (0.19.0, D16-21, S1) ----

test('barExtent: a plain bar spans zero to its value; a span keeps its ends in the order given; a zero length is a dot', () => {
  assert.deepEqual(barExtent(5), { a: 0, b: 5, dot: false, given: false });
  assert.deepEqual(barExtent(-3), { a: 0, b: -3, dot: false, given: false });
  assert.deepEqual(barExtent(25, [40, 65]), { a: 40, b: 65, dot: false, given: true });
  assert.deepEqual(barExtent(-22, [135, 113]), { a: 135, b: 113, dot: false, given: true });
  assert.deepEqual(barExtent(0, [35, 35]), { a: 35, b: 35, dot: true, given: true });
});

test('barExtent: a missing value or a missing end draws nothing', () => {
  assert.equal(barExtent(null), null);
  assert.equal(barExtent(undefined, [1, 2]), null);
  assert.equal(barExtent(NaN), null);
  assert.equal(barExtent(4, [10, null]), null);
  assert.equal(barExtent(4, [undefined, 3]), null);
  assert.equal(barExtent(4, [Infinity, 3]), null);
});

test('clipExtent: a floating bar is cut to the range and a bar wholly outside draws nothing; a plain bar is left alone', () => {
  assert.deepEqual(clipExtent(barExtent(60, [90, 150]), 100, 140), { a: 100, b: 140, dot: false, given: true });
  assert.deepEqual(clipExtent(barExtent(60, [150, 90]), 100, 140), { a: 140, b: 100, dot: false, given: true });
  assert.equal(clipExtent(barExtent(5, [80, 95]), 100, 140), null);
  assert.equal(clipExtent(barExtent(5, [145, 160]), 100, 140), null);
  assert.equal(clipExtent(barExtent(0, [90, 90]), 100, 140), null);
  assert.deepEqual(clipExtent(barExtent(500), 0, 10), { a: 0, b: 500, dot: false, given: false });
  assert.equal(clipExtent(null, 0, 10), null);
});

// ---- grouped bars (0.19.0, D16-21, S2) ----

test('bandsOf: consecutive data with one group id share a band; no group is a band of its own; a group split in two is two bands', () => {
  assert.deepEqual(bandsOf(['a', 'a', 'a', 'b', 'c', 'c']), [
    { from: 0, to: 3, group: 'a' },
    { from: 3, to: 4, group: 'b' },
    { from: 4, to: 6, group: 'c' },
  ]);
  assert.deepEqual(bandsOf([undefined, null, undefined]), [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }]);
  assert.deepEqual(bandsOf(['a', 'b', 'a']).map((b) => b.group), ['a', 'b', 'a']);
  assert.deepEqual(bandsOf([]), []);
});

test('memberSlots and memberAt: the slots of a band are equal, a smaller group is centred, a position in a margin takes the nearest member', () => {
  const full = memberSlots(3, 3);
  assert.ok(Math.abs(full.size - 0.8 / 3) < 1e-12 && Math.abs(full.start - 0.1) < 1e-12);
  const one = memberSlots(1, 3);
  assert.ok(Math.abs(one.start + one.size / 2 - 0.5) < 1e-12, 'a group of one is in the middle of its band');
  assert.equal(memberAt(0.02, 3, 3), 0);
  assert.equal(memberAt(0.5, 3, 3), 1);
  assert.equal(memberAt(0.98, 3, 3), 2);
  assert.equal(memberAt(0.1, 1, 3), 0);
  assert.equal(memberAt(0.9, 1, 3), 0);
  assert.equal(memberAt(0.5, 2, 3), 1);
});

test('unusedLegendTones: the tones a legend names that no bar uses, once each, in legend order', () => {
  assert.deepEqual(unusedLegendTones(['accent', 'warn'], [{ tone: 'accent' }, { tone: 'warn' }, { tone: 'good' }, { tone: 'good' }, { tone: 'bad' }]), ['good', 'bad']);
  assert.deepEqual(unusedLegendTones(['accent'], [{ tone: 'accent' }]), []);
  assert.deepEqual(unusedLegendTones([], []), []);
});
