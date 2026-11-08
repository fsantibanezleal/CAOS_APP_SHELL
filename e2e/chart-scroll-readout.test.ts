import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { startHarness, type Harness } from './harness';

// SHC readout rule (issue 208, known defect 62): the gate's document walk scrolls the page under a resting pointer, the browser re-dispatches the
// pointer position at the chart that came under it, and the chart's readout changed while the walk read the page ("document text changed during
// traversal"). The readout and the cursor now change only on a real move, a pointer enter or leave, or the keyboard.

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { createRoot } from 'react-dom/client';
    import { UPlotChart } from './src/chart';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/chart.css';
    document.head.append(link);
    function App() {
      return (
        <div style={{ width: 640 }}>
          <div style={{ height: 600 }}>spacer above the chart</div>
          <UPlotChart height={260}
            x={{ values: [1, 2, 3, 4, 5, 6, 7, 8], label: 'Step' }}
            y={{ label: 'Level' }}
            series={[{ label: 'Alpha', values: [3, 5, 4, 8, 6, 9, 7, 12] }]} />
          <div style={{ height: 1200 }}>spacer below the chart</div>
        </div>
      );
    }
    createRoot(document.getElementById('root')!).render(<App />);
  `, { '/chart.css': { type: 'text/css', body: await readFile(new URL('../chart.css', import.meta.url), 'utf8') } });
});
after(async () => {
  await h?.close();
});

const REST = 'Hover the chart to read the values';
const readout = (page: Page) => page.locator('.caos-chart-readout').first().innerText();
async function open(): Promise<Page> {
  const page = await h.browser.newPage({ viewport: { width: 800, height: 500 } });
  await page.goto(h.address);
  await page.waitForSelector('.caos-chart[data-drawn="1"] canvas');
  await page.waitForTimeout(300);
  return page;
}

/** Scrolls the page with the wheel (the pointer stays where it is) until the plot's top is 40 px above the given y, lets the browser settle, and
 * then does what the browser does after a scroll under a resting pointer: it re-dispatches the pointer position (same client coordinates) to the
 * element now under it, as mouseover, mouseenter and mousemove. Headless Chromium dispatches the enter events of that re-dispatch on its own and the move
 * only on some frames, so the test sends the whole set, deterministically. */
async function scrollChartUnder(page: Page, x: number, y: number) {
  const top = await page.evaluate(() => document.querySelector('.u-over')!.getBoundingClientRect().top);
  const delta = Math.round(top - (y - 40));
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, delta);
  await page.waitForFunction((b) => window.scrollY > b, before);
  await page.waitForTimeout(800);
  await page.evaluate(([cx, cy]) => {
    const el = document.elementFromPoint(cx, cy);
    if (!el) throw new Error('nothing under the pointer');
    const init = { clientX: cx, clientY: cy, screenX: cx, screenY: cy, view: window };
    el.dispatchEvent(new MouseEvent('mouseover', { ...init, bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseenter', init));
    el.dispatchEvent(new MouseEvent('mousemove', { ...init, bubbles: true }));
  }, [x, y]);
  await page.waitForTimeout(100);
}

test('SHC-readout a page scroll under a resting pointer leaves the chart readout at rest, a real move reads the values', async () => {
  const page = await open();
  assert.equal(await readout(page), REST);
  // the pointer rests on the spacer, above the chart
  await page.mouse.move(300, 250);
  await page.mouse.move(302, 252);
  assert.equal(await readout(page), REST);
  // the page scrolls: the chart comes under the resting pointer and the browser re-dispatches the pointer position
  await scrollChartUnder(page, 302, 252);
  const under = await page.evaluate(() => {
    const over = document.querySelector('.u-over') as HTMLElement;
    const r = over.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  });
  assert.ok(under.top < 252 && under.bottom > 252 && under.left < 302 && under.right > 302, `the chart is not under the pointer: ${JSON.stringify(under)}`);
  assert.equal(await readout(page), REST, 'the readout followed a scroll-synthesised pointer');
  // a real move reads the values
  await page.mouse.move(320, 262);
  assert.notEqual(await readout(page), REST, 'a real pointer move reads nothing');
  assert.match(await readout(page), /Alpha/);
  // the plot was moved by the scroll: the real move reads the point under the pointer now (the plot's x runs 1 to 8 across its width)
  const frac = await page.evaluate(() => {
    const r = document.querySelector('.u-over')!.getBoundingClientRect();
    return (320 - r.left) / r.width;
  });
  const step = Number(/Step (\d+)/.exec(await readout(page))?.[1]);
  assert.ok(Math.abs(step - (1 + frac * 7)) <= 0.6, `the readout reads step ${step} at ${(frac * 100).toFixed(0)}% of the plot`);
  await page.close();
});

test('SHC-readout the keyboard crosshair reads the values as before, and a later scroll does not move it', async () => {
  const page = await open();
  await page.locator('.caos-chart-plot').focus();
  await page.keyboard.press('ArrowRight');
  const read = await readout(page);
  assert.notEqual(read, REST, 'the keyboard crosshair reads nothing');
  // the page goes back to the top (focus scrolled the chart into view) and the pointer rests on the spacer above the chart
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(300, 250);
  await scrollChartUnder(page, 300, 250);
  assert.equal(await readout(page), read, 'a scroll under a resting pointer moved the keyboard crosshair');
  await page.close();
});

test('SHC-readout a scroll that takes the plot away from a resting pointer does not clear the readout until the pointer moves again', async () => {
  const page = await open();
  // a real move onto the plot reads the values
  await page.evaluate(() => document.querySelector('.u-over')!.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const at = await page.evaluate(() => {
    const r = document.querySelector('.u-over')!.getBoundingClientRect();
    return { x: Math.round(r.left + r.width * 0.4), y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.move(at.x - 20, at.y);
  await page.mouse.move(at.x, at.y);
  const read = await readout(page);
  assert.notEqual(read, REST, 'a real pointer move reads nothing');
  // the page scrolls the plot away from the pointer; the browser sends the leave at the pointer's own coordinates
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(800);
  await page.evaluate(([cx, cy]) => {
    const over = document.querySelector('.u-over')!;
    over.dispatchEvent(new MouseEvent('mouseleave', { clientX: cx, clientY: cy, view: window }));
  }, [at.x, at.y]);
  await page.waitForTimeout(100);
  assert.equal(await readout(page), read, 'the readout was cleared by a scroll-synthesised leave');
  // the pointer moves again, away from the plot: the held leave is applied
  await page.mouse.move(at.x + 30, at.y + 10);
  await page.waitForTimeout(100);
  assert.equal(await readout(page), REST, 'the held leave was never applied');
  await page.close();
});
