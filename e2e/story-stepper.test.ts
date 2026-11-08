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

test('SHW-058 a panel taller than the layout never shrinks or cuts the step row (known defect 57)', async () => {
  // .caos-story is a flex column; the layout's basis is its content, so a tall panel overflowed the column and every item
  // shrank in proportion. The stepper scrolls on x, so its automatic minimum height is 0: it lost 4 to 6 px (ChancaDEM, G5).
  const h = await startHarness(`
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { MemoryRouter } from 'react-router';
    import { StoryFrame } from './src/workbench/StoryFrame';
    const tall = new URLSearchParams(location.search).get('tall') === '1';
    const steps = Array.from({ length: 5 }, (_, i) => ({ id: 'step-' + (i + 1), number: i + 1,
      verb: 'Inspect the evidence', headline: 'Five steps share one observed history', summary: 'Recorded case',
      href: '/story/' + (i + 1), accent: 1, stage: <p>Actual stage</p>,
      panel: <div style={{ height: tall ? 3000 : 40 }}>Evidence panel</div> }));
    createRoot(document.getElementById('root')!).render(
      <MemoryRouter><div style={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
        <StoryFrame steps={steps} activeId="step-1" onStepChange={() => {}} />
      </div></MemoryRouter>);
  `);
  try {
    const page = await h.browser.newPage();
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      const measure = async (tall: boolean) => {
        await page.goto(`${h.address}?tall=${tall ? 1 : 0}`);
        await page.locator('[data-story-link]').last().waitFor();
        return page.locator('.caos-story-stepper').evaluate((el) => ({ height: el.getBoundingClientRect().height, cut: el.scrollHeight - el.clientHeight }));
      };
      const short = await measure(false);
      const tall = await measure(true);
      assert.ok(Math.abs(tall.height - short.height) < 0.5, `the step row keeps its height under a tall panel at ${width}px: ${short.height} then ${tall.height}`);
      assert.ok(tall.cut <= 0, `the step row is not cut under a tall panel at ${width}px (${tall.cut} px hidden)`);
    }
    await page.close();
  } finally { await h.close(); }
});

test('SHW-062 at a phone width every step verb of the story stepper is whole and every step is reachable (review m4)', async () => {
  // ChancaDEM on 0.23.2: at 390 px the 90 px columns cut the verbs to "M...", "Mi...", "Re..." and steps 4 and 5 sat off-screen.
  const h = await startHarness(`
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { MemoryRouter } from 'react-router';
    import { StoryFrame } from './src/workbench/StoryFrame';
    import { useLangStore } from './src/lib/lang';
    const lang = new URLSearchParams(location.search).get('lang') === 'es' ? 'es' : 'en';
    useLangStore.setState({ lang });
    const verbs = [
      { en: 'Measure', es: 'Medir' }, { en: 'Look inside', es: 'Mirar dentro' }, { en: 'Solve', es: 'Resolver' },
      { en: 'Compare', es: 'Comparar' }, { en: 'Operate', es: 'Operar' }, { en: 'Inspect the evidence', es: 'Inspeccionar la evidencia' },
    ];
    function App() {
      const [activeId, setActive] = useState('step-1');
      const steps = verbs.map((verb, i) => ({ id: 'step-' + (i + 1), number: i + 1, verb,
        headline: 'Six steps share one observed history', summary: 'Recorded case',
        href: '/story/' + (i + 1), accent: 1, stage: <p>Actual stage</p>, panel: <p>Evidence panel</p> }));
      return <MemoryRouter><StoryFrame steps={steps} activeId={activeId} onStepChange={setActive} /></MemoryRouter>;
    }
    createRoot(document.getElementById('root')!).render(<App />);
  `);
  try {
    const page = await h.browser.newPage();
    for (const width of [320, 390]) for (const lang of ['en', 'es']) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${h.address}?lang=${lang}`);
      const tabs = page.locator('[data-story-link]');
      await tabs.last().waitFor();
      const verbs = await page.locator('.caos-story-step-verb').evaluateAll((nodes) => nodes.map((n) => ({ text: (n as HTMLElement).innerText, cut: n.scrollWidth - n.clientWidth })));
      for (const verb of verbs) assert.ok(verb.cut <= 0, `${width} ${lang}: the verb "${verb.text}" is whole (${verb.cut} px cut)`);
      const tops = await tabs.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
      assert.ok(Math.max(...tops) - Math.min(...tops) < 1, `${width} ${lang}: the steps share one row`);
      const inView = async (i: number) => page.evaluate((index) => {
        const row = document.querySelector('.caos-story-stepper')!.getBoundingClientRect();
        const tab = document.querySelectorAll('[data-story-link]')[index]!.getBoundingClientRect();
        return tab.left >= row.left - 1 && tab.right <= row.right + 1 && tab.right <= innerWidth + 1;
      }, i);
      // the keyboard moves the row to the active step, so the last step is reachable without a pointer
      await page.locator('[data-story]').focus();
      await page.keyboard.press('End');
      await page.waitForTimeout(400);
      assert.equal(await tabs.last().getAttribute('aria-selected'), 'true');
      assert.ok(await inView(5), `${width} ${lang}: End shows the last step whole inside the row`);
      await page.keyboard.press('Home');
      await page.waitForTimeout(400);
      assert.ok(await inView(0), `${width} ${lang}: Home shows the first step whole inside the row`);
      for (let i = 0; i < 6; i += 1) {
        await tabs.nth(i).click();
        assert.equal(await tabs.nth(i).getAttribute('aria-selected'), 'true', `${width} ${lang}: step ${i + 1} is reachable by pointer`);
        await page.waitForTimeout(350);
        assert.ok(await inView(i), `${width} ${lang}: the active step ${i + 1} is shown whole inside the row`);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} ${lang}: no horizontal page scroll`);
    }
    await page.close();
  } finally { await h.close(); }
});
