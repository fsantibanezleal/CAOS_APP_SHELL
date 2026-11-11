import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startHarness, type Harness } from './harness.ts';

// Known defect 64 (issue 212, CEFOP_DinHot): a mark that moves (a "now" line while a trace plays) was part of the chart's
// structure key, so every frame rebuilt the uPlot instance and the reader's crosshair and readout were dropped (G20: "the arrow
// keys do not move the crosshair"). The mark here moves on every animation frame while the reader drives the keyboard.

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { createRoot } from 'react-dom/client';
    import { useEffect, useState } from 'react';
    import { UPlotChart } from './src/chart';
    const xs = Array.from({ length: 400 }, (_, i) => i / 10);
    const ys = xs.map((t) => Math.sin(t / 3) * 10 + t);
    function App() {
      const [mark, setMark] = useState(2);
      const [playing, setPlaying] = useState(false);
      const [label, setLabel] = useState('Feed');
      window.__play = () => setPlaying(true);
      window.__relabel = () => setLabel('Feed, corrected');
      useEffect(() => {
        if (!playing) return undefined;
        let frame = 0;
        const step = () => { setMark((m) => (m >= 38 ? 2 : m + 0.05)); window.__frames = (window.__frames ?? 0) + 1; frame = requestAnimationFrame(step); };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
      }, [playing]);
      return <div style={{ width: 800, height: 460 }}><UPlotChart height={420}
        x={{ values: xs, label: 'Time', unit: 's' }} y={{ label: 'Position', unit: 'nm' }}
        series={[{ label, values: ys }]}
        marks={[{ x: mark, label: 'Now' }]} /></div>;
    }
    createRoot(document.getElementById('root')).render(<App />);
  `);
});
after(async () => { await h?.close(); });

test('SHC-104 a mark that moves every frame redraws the chart in place: the keyboard crosshair and its readout work and survive, and a series change still rebuilds (known defect 64)', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1000, height: 700 } });
  try {
    await page.goto(h.address);
    await page.waitForSelector('.caos-chart[data-drawn="1"] canvas');
    await page.evaluate(() => { (window as any).__canvas = document.querySelector('.caos-chart canvas'); (window as any).__play(); });
    await page.waitForFunction(() => ((window as any).__frames ?? 0) > 20);
    const markAt = () => page.evaluate(() => document.querySelector('.caos-chart')?.getAttribute('data-mark-boxes') ?? '');
    const readout = () => page.locator('.caos-chart-readout').textContent();
    const rest = await readout();
    await page.locator('[data-chart-focus]').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    const first = await readout();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    const second = await readout();
    assert.notEqual(first, rest, `ArrowRight while the mark moves reads a value (at rest "${rest}", after the key "${first}")`);
    assert.notEqual(second, first, `two more ArrowRight move the crosshair on while the mark moves ("${first}" then "${second}")`);
    const m1 = await markAt();
    await page.waitForTimeout(1000);
    const m2 = await markAt();
    assert.notEqual(m1, m2, 'the mark kept moving and was drawn at its new place');
    assert.equal(await readout(), second, 'the readout survives one second of a moving mark');
    assert.equal(await page.evaluate(() => document.querySelector('.caos-chart canvas') === (window as any).__canvas), true, 'the uPlot canvas is the same one after one second of a moving mark (no rebuild)');
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-chart-focus')), true, 'the plot keeps keyboard focus');
    // a change of the series is a change of structure: the chart is built again
    await page.evaluate(() => (window as any).__relabel());
    await page.waitForFunction(() => document.querySelector('.caos-chart canvas') !== (window as any).__canvas, undefined, { timeout: 5000 });
  } finally { await page.close(); }
});
