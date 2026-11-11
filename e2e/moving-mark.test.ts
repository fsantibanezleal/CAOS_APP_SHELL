import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startHarness, type Harness } from './harness.ts';

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { createRoot } from 'react-dom/client';
    import { useState } from 'react';
    import { UPlotChart } from './src/chart';
    function App() {
      const [mark, setMark] = useState(2);
      window.__moveMark = () => setMark((value) => value + 1);
      return <div style={{ width: 800, height: 460 }}><UPlotChart height={420}
        x={{ values: [0, 1, 2, 3, 4], label: 'Time' }} y={{ label: 'Rate' }}
        series={[{ label: 'Feed', values: [2, 4, 3, 5, 4] }]}
        marks={[{ x: mark, label: 'Moving now' }]} /></div>;
    }
    createRoot(document.getElementById('root')).render(<App />);
  `);
});
after(async () => { await h?.close(); });

test('a moving x mark redraws in place and preserves the chart canvas and crosshair', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1000, height: 700 } });
  try {
    await page.goto(h.address);
    await page.waitForSelector('.caos-chart[data-drawn="1"] canvas');
    const plot = page.locator('.u-over');
    await plot.hover({ position: { x: 240, y: 120 } });
    const before = await page.evaluate(() => {
      const chart = document.querySelector('.caos-chart')!;
      const canvas = chart.querySelector('canvas');
      (window as any).__originalCanvas = canvas;
      return { canvas, cursor: chart.querySelector('.u-cursor-x')?.getAttribute('style') ?? '' };
    });
    await page.evaluate(() => window.__moveMark());
    await page.waitForFunction(() => document.querySelector('.caos-chart')?.getAttribute('data-mark-boxes') !== null);
    const after = await page.evaluate(() => {
      const chart = document.querySelector('.caos-chart')!;
      return { sameCanvas: chart.querySelector('canvas') === (window as any).__originalCanvas, cursor: chart.querySelector('.u-cursor-x')?.getAttribute('style') ?? '' };
    });
    assert.ok(before.cursor, 'the reader has an active crosshair before the mark moves');
    assert.equal(after.sameCanvas, true, 'the uPlot instance is redrawn in place instead of reconstructed');
    assert.equal(after.cursor, before.cursor, 'the crosshair position survives the moving mark');
  } finally { await page.close(); }
});
