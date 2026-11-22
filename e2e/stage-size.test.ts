import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startHarness } from './harness';

test('Stage keeps its layout size under a transformed ancestor and after resize', async () => {
  const h = await startHarness(`
    import { createRoot } from 'react-dom/client';
    import { Stage } from './src/index';
    createRoot(document.getElementById('root')).render(
      <div id="frame" style={{ width: '433.625px', height: '266.375px', transform: 'translateY(7px) scale(.994)' }}>
        <Stage label={{ en: 'Response', es: 'Respuesta' }}>
          {({ width, height }) => <svg width={width} height={height} viewBox={\`0 0 \${width} \${height}\`}>
            <path fill="none" stroke="currentColor" d={\`M 0 0 L \${width} \${height}\`} />
          </svg>}
        </Stage>
      </div>
    );
  `);
  try {
    const page = await h.browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(h.address);
    const stage = page.locator('[data-stage]');
    await stage.locator('svg').waitFor();
    const dims = async () => stage.evaluate(el => {
      const svg = el.querySelector('svg')!;
      return [el.getAttribute('data-width'), el.getAttribute('data-height'), svg.getAttribute('viewBox')];
    });
    assert.deepEqual(await dims(), ['434', '266', '0 0 434 266']);
    await page.locator('#frame').evaluate(el => { el.style.transform = 'none'; });
    assert.deepEqual(await dims(), ['434', '266', '0 0 434 266']);
    await page.locator('#frame').evaluate(el => {
      el.style.width = '537.25px';
      el.style.height = '355.75px';
      el.style.transform = 'scale(.97)';
    });
    await page.waitForFunction(() => document.querySelector('[data-stage]')?.getAttribute('data-width') === '537');
    await page.locator('#frame').evaluate(el => { el.style.transform = 'none'; });
    assert.deepEqual(await dims(), ['537', '356', '0 0 537 356']);
    const measured = await stage.evaluate(el => {
      const box = el.getBoundingClientRect();
      const drawing = el.querySelector('svg')!.getBoundingClientRect();
      return [Math.abs(box.width - drawing.width), Math.abs(box.height - drawing.height)];
    });
    assert.ok(measured.every(delta => delta <= 0.5), measured.join(', '));
    assert.deepEqual(errors, []);
  } finally {
    await h.close();
  }
});
