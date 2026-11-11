import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Page } from '@playwright/test';
import { startHarness } from './harness.ts';

// Two sets of header callouts in a StoryFrame stage, in the language the URL asks for: the shell's showcase fixture
// (test/gate-fixture/app.tsx, ShowcaseInstrument) and long, wrapping sources declared in reverse anchor order.
const ENTRY = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { MemoryRouter } from 'react-router';
  import { SceneCallouts } from './src/workbench/SceneCallouts';
  import { StoryFrame } from './src/workbench/StoryFrame';
  import { useLangStore } from './src/lib/lang';
  const q = new URLSearchParams(location.search);
  const lang = q.get('lang') === 'es' ? 'es' : 'en';
  useLangStore.setState({ lang });
  document.documentElement.lang = lang;
  const FIXTURE = [
    { id: 'feed', eyebrow: { en: 'Mill feed', es: 'Alimentación del molino' }, value: '720', unit: { en: 't/h', es: 't/h' }, state: 'normal', anchor: { x: .22, y: .45 }, source: { en: 'Live case trace', es: 'Traza activa del caso' } },
    { id: 'power', eyebrow: { en: 'Mill power', es: 'Potencia del molino' }, value: '12.4', unit: { en: 'MW', es: 'MW' }, state: 'warning', anchor: { x: .52, y: .5 }, source: { en: 'Operating contract', es: 'Contrato operativo' } },
    { id: 'recovery', eyebrow: { en: 'Recovery', es: 'Recuperación' }, value: '84.2', unit: { en: '%', es: '%' }, state: 'selected', anchor: { x: .8, y: .45 }, source: { en: 'Live case trace', es: 'Traza activa del caso' } },
  ];
  const WRAPPED = [
    { id: 'throw', eyebrow: { en: 'Throw', es: 'Excentricidad' }, value: '38', unit: 'mm', state: 'normal', anchor: { x: .86, y: .62 }, source: { en: 'Liner survey', es: 'Levantamiento del revestimiento' } },
    { id: 'nip', eyebrow: { en: 'Nip angle', es: 'Angulo de pellizco' }, value: '21.5', unit: 'deg', state: 'alarm', anchor: { x: .52, y: .58 }, source: { en: 'Derived from the measured open and closed side settings of the last liner survey', es: 'Derivado de las aberturas medidas del lado abierto y del lado cerrado en el último levantamiento' } },
    { id: 'css', eyebrow: { en: 'Closed side', es: 'Lado cerrado' }, value: '152', unit: 'mm', state: 'selected', anchor: { x: .14, y: .55 }, source: { en: 'Liner survey of the campaign, corrected for wear', es: 'Levantamiento de la campaña, corregido por desgaste' } },
  ];
  const items = q.get('set') === 'wrapped' ? WRAPPED : FIXTURE;
  (window as any).__bands = [];
  (window as any).__bandFrames = [];
  function recordBand() { const layer = document.querySelector('[data-caos-callout-layer]'); if (layer) (window as any).__bandFrames.push(getComputedStyle(layer).getPropertyValue('--caos-callout-band').trim()); requestAnimationFrame(recordBand); }
  requestAnimationFrame(recordBand);
  function Stage() {
    return <div style={{ position: 'relative', width: '100%', height: '100%' }}><SceneCallouts items={items as any} placement="header" onLayout={(info: { bandHeight: number }) => (window as any).__bands.push(info.bandHeight)} /></div>;
  }
  const steps = [1, 2, 3].map((n) => ({ id: 's' + n, number: n, verb: 'Inspect', headline: 'Finding ' + n, summary: 'Summary', href: '/story/s' + n, accent: n, stage: <Stage />, panel: <p>Evidence</p> }));
  createRoot(document.getElementById('root')!).render(<MemoryRouter><div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}><StoryFrame steps={steps as any} activeId="s1" onStepChange={() => {}} /></div></MemoryRouter>);
`;

/** Waits until the card boxes stop moving (the layer measures its cards and lays them out again). */
async function settled(page: Page) {
  await page.locator('[data-caos-callout]').nth(2).waitFor();
  let last = '';
  for (let i = 0; i < 40; i += 1) {
    const now = JSON.stringify(await page.locator('[data-caos-callout]').evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect()).map((r) => [r.left, r.top, r.width, r.height].map(Math.round))));
    if (now === last) return;
    last = now;
    await page.waitForTimeout(80);
  }
}

const WORDS = { en: { normal: 'normal', warning: 'warning', selected: 'selected', alarm: 'alarm' }, es: { normal: 'normal', warning: 'aviso', selected: 'seleccionado', alarm: 'alarma' } } as const;

test('SHW-059 every callout shows its state as a visible word with a glyph, and the label truncates no eyebrow or value at 390 and 1280 in en and es (known defect 58)', async () => {
  const h = await startHarness(ENTRY);
  try {
    const page = await h.browser.newPage();
    for (const width of [390, 1280]) for (const lang of ['en', 'es'] as const) {
      await page.setViewportSize({ width, height: width < 760 ? 844 : 800 });
      await page.goto(`${h.address}?lang=${lang}`);
      await settled(page);
      const cards = await page.locator('[data-caos-callout]').evaluateAll((nodes) => nodes.map((card) => {
        const label = card.querySelector('[data-callout-state-label]') as HTMLElement | null;
        const r = label?.getBoundingClientRect();
        // no named helper here: the test runner's transform would wrap it in a function the page does not have
        const eyebrow = card.querySelector('.caos-callout-eyebrow')!, value = card.querySelector('strong')!;
        return {
          id: card.getAttribute('data-caos-callout'), state: card.getAttribute('data-callout-state'), label: label?.innerText.trim() ?? null,
          visible: Boolean(label && r && r.width > 0 && r.height > 0 && label.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })),
          eyebrowCut: eyebrow.scrollWidth - eyebrow.clientWidth, valueCut: value.scrollWidth - value.clientWidth, labelCut: label ? label.scrollWidth - label.clientWidth : -1,
        };
      }));
      assert.equal(cards.length, 3);
      for (const card of cards) {
        const word = WORDS[lang][card.state as keyof typeof WORDS.en];
        assert.ok(card.visible, `${width} ${lang}: the ${card.id} callout shows its state label`);
        assert.ok(card.label?.endsWith(word), `${width} ${lang}: the ${card.id} callout reads "${word}" (got "${card.label}")`);
        assert.ok(card.labelCut <= 0, `${width} ${lang}: the ${card.id} state label is whole (${card.labelCut} px cut)`);
        assert.ok(card.eyebrowCut <= 0, `${width} ${lang}: the ${card.id} eyebrow is whole (${card.eyebrowCut} px cut)`);
        assert.ok(card.valueCut <= 0, `${width} ${lang}: the ${card.id} value is whole (${card.valueCut} px cut)`);
      }
    }
    await page.close();
  } finally { await h.close(); }
});

/** Whether two segments cross at a point inside both (a shared end is not a crossing). */
function cross(a: number[], b: number[]) {
  const [x1, y1, x2, y2] = a as [number, number, number, number];
  const [x3, y3, x4, y4] = b as [number, number, number, number];
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

test('SHW-061 header cards with wrapped sources never cover one another, their leaders never cross and the band is the measured one (known defect 60)', async () => {
  const h = await startHarness(ENTRY);
  try {
    const page = await h.browser.newPage();
    for (const width of [390, 1280]) for (const lang of ['en', 'es'] as const) {
      await page.setViewportSize({ width, height: width < 760 ? 844 : 800 });
      await page.goto(`${h.address}?set=wrapped&lang=${lang}`);
      await settled(page);
      const facts = await page.evaluate(() => {
        const layer = document.querySelector('[data-caos-callout-layer]') as HTMLElement;
        const top = layer.getBoundingClientRect().top;
        const cards = [...layer.querySelectorAll('[data-caos-callout]')].map((card) => { const r = card.getBoundingClientRect(); return { id: card.getAttribute('data-caos-callout')!, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
        const leaders = [...layer.querySelectorAll('[data-caos-callout-leader]')].map((line) => ['x1', 'y1', 'x2', 'y2'].map((k) => Number(line.getAttribute(k))));
        const wraps = [...layer.querySelectorAll('.caos-callout-source')].map((s) => s.getClientRects().length > 1 || s.getBoundingClientRect().height > 1.6 * Number.parseFloat(getComputedStyle(s).fontSize) * 1.25);
        return { cards, leaders, wraps, band: getComputedStyle(layer).getPropertyValue('--caos-callout-band').trim(), measured: Math.max(...cards.map((c) => c.bottom)) - top, reported: ((window as any).__bands as number[]).at(-1) };
      });
      assert.ok(facts.wraps.some(Boolean), `${width} ${lang}: a source wraps`);
      for (let i = 0; i < facts.cards.length; i += 1) for (let j = i + 1; j < facts.cards.length; j += 1) {
        const a = facts.cards[i]!, b = facts.cards[j]!;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        assert.ok(!(ox > 0.5 && oy > 0.5), `${width} ${lang}: cards ${a.id} and ${b.id} overlap by ${ox.toFixed(1)} x ${oy.toFixed(1)} px`);
      }
      assert.equal(facts.leaders.length, 3, `${width} ${lang}: one leader per card`);
      for (let i = 0; i < facts.leaders.length; i += 1) for (let j = i + 1; j < facts.leaders.length; j += 1) {
        assert.ok(!cross(facts.leaders[i]!, facts.leaders[j]!), `${width} ${lang}: leaders ${i} and ${j} cross (${JSON.stringify(facts.leaders)})`);
      }
      assert.match(facts.band, /^\d+(\.\d+)?px$/, `${width} ${lang}: the layer sets --caos-callout-band in px (got "${facts.band}")`);
      assert.ok(Math.abs(Number.parseFloat(facts.band) - facts.measured) <= 1, `${width} ${lang}: --caos-callout-band ${facts.band} is the measured band ${facts.measured.toFixed(1)} px`);
      assert.ok(typeof facts.reported === 'number' && Math.abs(facts.reported - facts.measured) <= 1, `${width} ${lang}: onLayout reports the measured band (${facts.reported} for ${facts.measured.toFixed(1)} px)`);
    }
    await page.close();
  } finally { await h.close(); }
});

test('SHW-065 only publishes the settled callout band during mount and measurement', async () => {
  const h = await startHarness(ENTRY);
  try {
    const page = await h.browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${h.address}?set=wrapped&lang=es`);
    await settled(page);
    await page.waitForTimeout(100);
    const bands = await page.evaluate(() => ({ callbacks: (window as any).__bands as number[], frames: (window as any).__bandFrames as string[] }));
    assert.ok(bands.callbacks.length > 0, 'the settled layout reports its band');
    assert.equal(new Set(bands.callbacks.map((band) => Math.round(band))).size, 1, `callbacks contain only one settled band: ${bands.callbacks.join(', ')}`);
    assert.equal(new Set(bands.frames.filter((band) => Number.parseFloat(band) > 0)).size, 1, `the CSS variable exposes only one settled band: ${bands.frames.join(', ')}`);
    await page.close();
  } finally { await h.close(); }
});

test('SHW-066 every callout value occupies its own row below the eyebrow', async () => {
  const h = await startHarness(ENTRY);
  try {
    const page = await h.browser.newPage();
    for (const width of [390, 1280]) for (const lang of ['en', 'es'] as const) {
      await page.setViewportSize({ width, height: width < 760 ? 844 : 800 });
      await page.goto(`${h.address}?set=wrapped&lang=${lang}`);
      await settled(page);
      const rows = await page.locator('.caos-scene-callout').evaluateAll((cards) => cards.map((card) => {
        const eyebrow = card.querySelector('.caos-callout-eyebrow')!.getBoundingClientRect();
        const value = card.querySelector('strong')!.getBoundingClientRect();
        return { eyebrowBottom: eyebrow.bottom, valueTop: value.top };
      }));
      assert.equal(rows.length, 3);
      for (const [i, row] of rows.entries()) assert.ok(row.valueTop >= row.eyebrowBottom - 0.5, `${width} ${lang}: value ${i + 1} begins below its eyebrow`);
    }
    await page.close();
  } finally { await h.close(); }
});
