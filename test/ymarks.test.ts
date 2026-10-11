import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rangeWithLevels, YMARK_TONE_TOKENS } from '../src/chart/UPlotChart.tsx';

// The y range of a chart that has reference lines (CAOS_APP_SHELL#94): it takes in every level, so a line is drawn.

test('rangeWithLevels: a level above the data raises the top, a level below lowers the bottom', () => {
  assert.deepEqual(rangeWithLevels(10, 20, [30]), [10, 30]);
  assert.deepEqual(rangeWithLevels(10, 20, [2]), [2, 20]);
  assert.deepEqual(rangeWithLevels(10, 20, [2, 30, 15]), [2, 30]);
});

test('rangeWithLevels: levels inside the data leave the extent as it is', () => {
  assert.deepEqual(rangeWithLevels(10, 20, [12, 18]), [10, 20]);
  assert.deepEqual(rangeWithLevels(10, 20, []), [10, 20]);
});

test('rangeWithLevels: a chart with no data takes the levels alone; no data and no level has no range', () => {
  assert.deepEqual(rangeWithLevels(null, null, [4, 9]), [4, 9]);
  assert.equal(rangeWithLevels(null, null, []), null);
});

test('rangeWithLevels: on a log axis a level at 0 or below is ignored, the others are taken in', () => {
  assert.deepEqual(rangeWithLevels(1e-3, 1e-1, [0, -5], true), [1e-3, 1e-1]);
  assert.deepEqual(rangeWithLevels(1e-3, 1e-1, [0, 1e-6, 5], true), [1e-6, 5]);
  assert.equal(rangeWithLevels(null, null, [0], true), null);
  // the same level on a linear axis is a level like any other
  assert.deepEqual(rangeWithLevels(1, 2, [0]), [0, 2]);
});

test('rangeWithLevels: an end a level pushed out moves a further share of the span; the other end stays', () => {
  const [lo, hi] = rangeWithLevels(10, 20, [30], false, 0.05)!;
  assert.equal(lo, 10);
  assert.ok(Math.abs(hi - 31) < 1e-9, `${hi}`);
  const [a, b] = rangeWithLevels(1e-3, 1e-1, [1e-5], true, 0.05)!;
  assert.equal(b, 1e-1);
  assert.ok(a < 1e-5 && a > 1e-6, `${a}`);
  assert.deepEqual(rangeWithLevels(10, 20, [12], false, 0.05), [10, 20], 'a level inside moves nothing');
});

test('rangeWithLevels: a level that is not finite is ignored', () => {
  assert.deepEqual(rangeWithLevels(1, 2, [Infinity, NaN]), [1, 2]);
});

test('every tone of a reference line has its shell colour token', () => {
  assert.deepEqual(YMARK_TONE_TOKENS, {
    warn: '--color-warn',
    bad: '--color-bad',
    good: '--color-good',
    neutral: '--color-fg-subtle',
  });
});
