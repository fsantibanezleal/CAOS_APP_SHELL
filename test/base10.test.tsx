import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { nearestPoint, parityRange, UPlotChart } from '../src/chart/UPlotChart.tsx';

/** The 0.10.0 base (CAOS_APP_SHELL#84; CAOS_MANAGE plans/app-shell BL-029): what CAOS_Fragmenta's parity plot needs. */

test('nearestPoint: the point nearest in the plane, over every series; null positions are no point', () => {
  // two points 2 px apart in x and 200 px apart in y: the pointer beside the upper one names it, not the x neighbour
  const xs = [10, 12, 300];
  const ys = [
    [400, 200, null],
    [null, null, 20],
  ];
  assert.equal(nearestPoint(xs, ys, 10.5, 205), 1);
  assert.equal(nearestPoint(xs, ys, 11, 395), 0);
  assert.equal(nearestPoint(xs, ys, 290, 30), 2, 'a point of the second series');
  assert.equal(nearestPoint([NaN, 5], [[1, null]], 0, 0), null, 'no point has both positions');
  assert.equal(nearestPoint([], [], 0, 0), null);
});

test('UPlotChart declares its reference lines', () => {
  const html = renderToStaticMarkup(
    <UPlotChart
      parity
      x={{ values: [1, 2], label: 'Measured' }}
      y={{ label: 'Predicted' }}
      series={[{ label: 'Blasts', values: [1, 2], mode: 'points', size: 14 }]}
      yMarks={[{ y: 1.5, label: 'null model' }]}
    />,
  );
  assert.match(html, /data-y-marks="1"/);
  assert.match(html, /data-parity="1"/);
});

test('a parity range takes in the reference lines; the readout at rest is the caller\'s hint', () => {
  const html = renderToStaticMarkup(
    <UPlotChart
      parity
      x={{ values: [1, 2], label: 'Measured' }}
      y={{ label: 'Predicted' }}
      series={[{ label: 'Blasts', values: [1, 2], mode: 'points' }]}
      hint={{ en: 'Point at a blast for its error', es: 'Apunte a un tiro para ver su error' }}
      readout={(i) => `blast ${i}`}
    />,
  );
  assert.match(html, /<p class="caos-chart-readout"[^>]*>Point at a blast for its error<\/p>/);
  const [lo, hi] = parityRange([1, 2], [1.5], [8]);
  assert.ok(Math.abs(lo - 0.65) < 1e-12 && Math.abs(hi - 8.35) < 1e-12, `the range spans the level 8: ${lo} to ${hi}`);
});
