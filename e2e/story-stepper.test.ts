import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startHarness } from './harness.ts';

test('SHW-055 six story tabs stay on one reachable row at mobile tablet and desktop widths', async () => {
  const h = await startHarness(`
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { MemoryRouter } from 'react-router';
    import { StoryFrame } from './src/workbench/StoryFrame';
    function App() {
      const [activeId, setActive] = useState('step-1');
      const steps = Array.from({ length: 6 }, (_, i) => ({ id: 'step-' + (i + 1), number: i + 1,
        verb: 'Inspect the evidence', headline: 'Six steps share one observed history', summary: 'Recorded case',
        href: '/story/' + (i + 1), accent: 1, stage: <p>Actual stage</p>, panel: <p>Evidence panel</p> }));
      return <MemoryRouter><StoryFrame steps={steps} activeId={activeId} onStepChange={setActive} /></MemoryRouter>;
    }
    createRoot(document.getElementById('root')!).render(<App />);
  `);
  try {
    const page = await h.browser.newPage();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1024 });
      await page.goto(h.address);
      const tabs = page.locator('[data-story-link]');
      await tabs.last().waitFor();
      const tops = await tabs.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
      assert.ok(Math.max(...tops) - Math.min(...tops) < 1, `all six tabs share a row at ${width}px`);
      for (let i = 0; i < 6; i++) {
        await tabs.nth(i).click();
        assert.equal(await tabs.nth(i).getAttribute('aria-selected'), 'true');
      }
      await page.locator('[data-story]').focus();
      await page.keyboard.press('Home');
      assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');
      await page.keyboard.press('End');
      assert.equal(await tabs.last().getAttribute('aria-selected'), 'true');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.close();
  } finally { await h.close(); }
});
