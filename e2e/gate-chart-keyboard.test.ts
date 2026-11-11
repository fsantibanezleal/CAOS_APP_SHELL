import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installLib } from '../gate/inpage.mjs';
import { startHarness, type Harness } from './harness.ts';

let harness: Harness;
before(async () => {
  harness = await startHarness(`
    import { createRoot } from 'react-dom/client';
    import { UPlotChart } from './src/chart';
    createRoot(document.getElementById('root')).render(
      <div style={{ width: 900 }}>
        <UPlotChart title="Forecast paths" height={420}
          x={{ label: 'Lead', values: [1, 2, 3, 4, 5, 6] }}
          y={{ label: 'Value' }}
          series={[{ label: 'Forecast', values: [2, 4, 3, 5, 4, 3] }]}
          readout={index => 'Lead ' + (index + 1)}
        />
      </div>,
    );
  `);
});
after(async () => { await harness?.close(); });

test('G20 measures keyboard movement from a known lead even after pointer hover', async () => {
  const page = await harness.browser.newPage({ viewport: { width: 1050, height: 700 } });
  try {
    await page.addInitScript(installLib);
    for (const deadArrow of [false, true]) {
      await page.goto(harness.address);
      const chart = page.locator('.caos-chart[data-drawn="1"]');
      await chart.waitFor();
      await page.mouse.move(1, 1);
      await chart.locator('.u-over').hover({ position: { x: 2, y: 120 } });
      await page.waitForFunction(() => document.querySelector('.caos-chart-readout')?.textContent?.includes('Lead 1'));
      if (deadArrow) {
        await chart.locator('[data-chart-focus]').evaluate(stop => {
          stop.addEventListener('keydown', event => {
            if ((event as KeyboardEvent).key === 'ArrowRight') event.stopImmediatePropagation();
          }, { capture: true });
        });
      }
      const problems = await page.evaluate(async () => {
        const gate = (window as unknown as { __caosGate: {
          chartsTierA: (drive: boolean) => Promise<{ problems: string[] }[]>;
        } }).__caosGate;
        return (await gate.chartsTierA(true)).flatMap(chart => chart.problems);
      });
      assert.equal(problems.some(message => message.includes('the arrow keys do not move the crosshair')), deadArrow);
    }
  } finally {
    await page.close();
  }
});
