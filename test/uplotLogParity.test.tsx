import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { clampMark, decadeOnly, drawMarks, nudgeMark, overlayExtent, parityBox, UPlotChart } from '../src/chart/UPlotChart.tsx';
import { formatTicks } from '../src/lib/format.ts';

/** Shell 0.17.0 S1 (CAOS_APP_SHELL#65, CAOS_MANAGE plans/app-shell BL-029): what CAOS_Fragmenta's own uPlot wrapper
 * does and the shell's chart did not. */

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);

// ---- a log x axis labels the decades only -------------------------------------------------------------------------

test('decadeOnly: a log axis keeps the labels of the powers of ten and blanks the rest; null stays null', () => {
  assert.deepEqual(decadeOnly([1, 2, 5, 10, 20, 50, 100]), [1, null, null, 10, null, null, 100]);
  assert.deepEqual(decadeOnly([0.001, 0.002, 0.01, 0.05, 0.1, null, 1]), [0.001, null, 0.01, null, 0.1, null, 1]);
  // a power of ten that floating point writes inexactly is still a decade
  assert.deepEqual(decadeOnly([1e-7, 3e-7, 1e-6]), [1e-7, null, 1e-6]);
  // zero, a negative and a non-finite tick are no decade
  assert.deepEqual(decadeOnly([0, -10, Infinity, 10]), [null, null, null, 10]);
});

test('decadeOnly: a range with no decade in it keeps its ticks, so the axis is never left unlabelled', () => {
  assert.deepEqual(decadeOnly([20, 30, 50, 70]), [20, 30, 50, 70]);
  assert.deepEqual(decadeOnly([null, null]), [null, null]);
  assert.deepEqual(decadeOnly([]), []);
});

test('decade labels follow the interface language: 1,000 in English, 1.000 in Spanish, a blank for every other tick', () => {
  const ticks = decadeOnly([1, 2, 5, 10, 100, 500, 1000, 2000]);
  assert.deepEqual(formatTicks(ticks, 'en', { digits: 4 }), ['1', '', '', '10', '100', '', '1,000', '']);
  assert.deepEqual(formatTicks(ticks, 'es', { digits: 4 }), ['1', '', '', '10', '100', '', '1.000', '']);
  // below 1e-4 the axis writes every label in scientific notation, the decimal separator of the language
  const small = decadeOnly([1e-6, 3e-6, 1e-5, 1e-4]);
  assert.deepEqual(formatTicks(small, 'en', { digits: 4 }), ['1e-6', '', '1e-5', '1e-4'].map((s) => s.replace('e', 'E')));
  assert.equal(formatTicks(small, 'es', { digits: 4 })[1], '');
});

// ---- the parity box is square -------------------------------------------------------------------------------------

test('parityBox: the side is the smaller of the box width and the height asked for, or of the box height when it fills', () => {
  assert.equal(parityBox(420, 460, 400, false), 400);
  assert.equal(parityBox(300, 460, 400, false), 300);
  assert.equal(parityBox(320, 620, 400, true), 320);
  assert.equal(parityBox(500, 240, 400, true), 240);
  assert.equal(parityBox(0, 240, 400, true), 0);
});

// ---- labelled markers keep apart on a log axis --------------------------------------------------------------------

test('drawMarks: a 60 cm target beside a 100 cm limit on a log axis print their labels apart', () => {
  const calls: { text: string; x: number; y: number }[] = [];
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
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    setLineDash: () => undefined,
    measureText: (t: string) => ({ width: t.length * 6 }),
    strokeText: () => undefined,
    fillText: (text: string, x: number, y: number) => calls.push({ text, x, y }),
  };
  // a log axis from 1 to 1000 over 300 px: 100 px a decade
  const u = { ctx, bbox: { left: 0, top: 0, width: 300, height: 200 }, valToPos: (v: number) => (Math.log10(v) / 3) * 300 };
  drawMarks(u as never, [{ x: 100, label: 'limit 100 cm' }, { x: 60, label: 'target 60 cm' }], { color: '#c80', halo: '#fff', family: 'sans-serif' });
  assert.equal(calls.length, 2);
  const [a, b] = calls;
  const overlap = a.y === b.y && a.x < b.x + b.text.length * 6 && b.x < a.x + a.text.length * 6;
  assert.ok(!overlap, `two labels, one place: ${JSON.stringify(calls)}`);
});

// ---- a draggable horizontal marker has a keyboard path ------------------------------------------------------------

test('clampMark: a value stays inside the range and snaps to the step', () => {
  const d = { min: 10, max: 90, step: 5 };
  assert.equal(clampMark(47, d), 45);
  assert.equal(clampMark(48, d), 50);
  assert.equal(clampMark(-4, d), 10);
  assert.equal(clampMark(400, d), 90);
  assert.equal(clampMark(33.3, { min: 0, max: 100 }), 33.3, 'without a step the value is kept');
  assert.equal(clampMark(Number.NaN, d), 10, 'a value that is not a number falls to the lower end');
});

test('nudgeMark: the arrows move one step, Page keys ten, Home and End go to the ends; other keys do nothing', () => {
  const d = { min: 0, max: 100, step: 1 };
  assert.equal(nudgeMark(50, 'ArrowUp', d), 51);
  assert.equal(nudgeMark(50, 'ArrowRight', d), 51);
  assert.equal(nudgeMark(50, 'ArrowDown', d), 49);
  assert.equal(nudgeMark(50, 'ArrowLeft', d), 49);
  assert.equal(nudgeMark(50, 'PageUp', d), 60);
  assert.equal(nudgeMark(50, 'PageDown', d), 40);
  assert.equal(nudgeMark(50, 'Home', d), 0);
  assert.equal(nudgeMark(50, 'End', d), 100);
  assert.equal(nudgeMark(99.5, 'ArrowUp', d), 100, 'a step past the end stops at the end');
  assert.equal(nudgeMark(0, 'ArrowDown', d), 0);
  assert.equal(nudgeMark(50, 'a', d), null);
  assert.equal(nudgeMark(50, 'Tab', d), null);
  // no step given: a hundredth of the range
  assert.equal(nudgeMark(50, 'ArrowUp', { min: 0, max: 200 }), 52);
});

test('nudgeMark: on a log axis a step is a factor, a hundredth of the range in decades', () => {
  const d = { min: 1, max: 1e4 };
  const up = nudgeMark(10, 'ArrowUp', d, true)!;
  assert.ok(Math.abs(Math.log10(up) - (1 + 4 / 100)) < 1e-9, `${up}`);
  const down = nudgeMark(10, 'ArrowDown', d, true)!;
  assert.ok(Math.abs(Math.log10(down) - (1 - 4 / 100)) < 1e-9, `${down}`);
  assert.equal(nudgeMark(10, 'End', d, true), 1e4);
  assert.equal(nudgeMark(1, 'ArrowDown', d, true), 1);
});

// ---- a points overlay on its own x --------------------------------------------------------------------------------

test('overlayExtent: the x and y of the series that bring their own x, null and non-finite values ignored', () => {
  const ext = overlayExtent([
    { label: 'line', values: [1, 2, 3] },
    { label: 'cases', values: [5, null, 9, 7], x: [10, 20, 30, Number.NaN], mode: 'points' },
  ]);
  assert.deepEqual(ext, { x: [10, 30], y: [5, 9] });
  assert.equal(overlayExtent([{ label: 'line', values: [1, 2] }]), null);
  assert.equal(overlayExtent([{ label: 'cases', values: [null], x: [4], mode: 'points' }]), null);
});

// ---- the host declares the new forms for the gate -----------------------------------------------------------------

test('UPlotChart declares its draggable lines and its overlay for the gate; a chart without them declares neither', () => {
  const on = html(
    <UPlotChart
      x={{ values: [1, 10, 100], label: 'Size', log: true }}
      y={{ label: 'Passing', range: [0, 100] }}
      series={[
        { label: 'Curve', values: [5, 50, 95] },
        { label: 'Measured', values: [20, 60], x: [3, 40], mode: 'points' },
      ]}
      yMarks={[
        { y: 80, label: 'target', drag: { min: 50, max: 95 } },
        { y: 20, label: 'floor' },
      ]}
      onYMarkChange={() => undefined}
    />,
  );
  assert.match(on, /data-y-drag="1"/);
  assert.match(on, /data-overlay="1"/);
  assert.match(on, /data-y-marks="2"/);
  assert.match(on, /data-series="2"/);
  const off = html(<UPlotChart x={{ values: [1, 2], label: 'x' }} y={{ label: 'y' }} series={[{ label: 's', values: [1, 2] }]} yMarks={[{ y: 1.5, label: 'm' }]} />);
  assert.doesNotMatch(off, /data-y-drag|data-overlay/);
});
