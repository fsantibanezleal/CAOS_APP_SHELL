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

// Known defect 65 (issue 213, CEFOP_DinHot): when a story step mounted, the header layer reported bands from cards measured in
// an earlier layout (a stage still 0 px wide, or a narrower one) before the settled band, so a product that pads its drawing by
// the band resized it two or three times. Three entries: a stage that opens at 0 px and takes its width 300 ms later, the same with its
// cards kept out of layout for 400 ms more (laid out on heights measured at 0 px), and a story whose step link mounts a stage with three header cards at 2560 x 1440. Every band reported, and every value of
// --caos-callout-band read on every animation frame, must be the settled one.
const SWING = `
  import React, { useEffect, useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { MemoryRouter } from 'react-router';
  import { SceneCallouts } from './src/workbench/SceneCallouts';
  import { StoryFrame } from './src/workbench/StoryFrame';
  const q = new URLSearchParams(location.search);
  const items = [
    { id: 'speed', eyebrow: { en: 'Bead speed at the hold' }, value: '0.42', unit: 'um/s', state: 'normal', anchor: { x: .2, y: .5 }, source: { en: 'Replay of the offline result' } },
    { id: 'force', eyebrow: { en: 'Trap force' }, value: '3.1', unit: 'pN', state: 'warning', anchor: { x: .5, y: .5 }, source: { en: 'Derived from the stiffness and the displacement' } },
    { id: 'drift', eyebrow: { en: 'Drift' }, value: '12', unit: 'nm', state: 'selected', anchor: { x: .8, y: .5 }, source: { en: 'Synthetic data' } },
  ];
  (window as any).__bands = [];
  (window as any).__frames = [];
  function record() { const layer = document.querySelector('[data-caos-callout-layer]'); (window as any).__frames.push(layer ? getComputedStyle(layer).getPropertyValue('--caos-callout-band').trim() : ''); requestAnimationFrame(record); }
  requestAnimationFrame(record);
  const layer = <SceneCallouts items={items as any} placement="header" onLayout={(info: { bandHeight: number }) => (window as any).__bands.push(info.bandHeight)} />;
  // grow: the stage opens at 0 px and takes its width 300 ms later; hidden: the cards are also kept out of layout until 700 ms
  // (display: none), so the layer lays them out at the full width for 400 ms on heights measured at 0 px; __narrow then
  // narrows the stage, a real change of layout
  function Growing({ hide }: { hide: boolean }) {
    const [w, setW] = useState('0px');
    const [hidden, setHidden] = useState(hide);
    (window as any).__narrow = () => setW('420px');
    useEffect(() => { const t = setTimeout(() => setW('100%'), 300); const u = setTimeout(() => setHidden(false), 700); return () => { clearTimeout(t); clearTimeout(u); }; }, []);
    return <div data-cards-hidden={hidden ? '' : undefined} style={{ position: 'relative', width: w, height: 600 }}>{hidden && <style>{'[data-cards-hidden] .caos-scene-callout { display: none; }'}</style>}{layer}</div>;
  }
  function Story() {
    const [active, setActive] = useState('s1');
    (window as any).__step = () => setActive('s2');
    const steps = [1, 2].map((n) => ({ id: 's' + n, number: n, verb: 'Inspect', headline: 'Finding ' + n, summary: 'Summary', href: '/story/s' + n, accent: n,
      stage: n === 2 ? <div style={{ position: 'relative', width: '100%', height: '100%' }}>{layer}</div> : <div>Setup</div>, panel: <p>Evidence</p> }));
    return <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}><StoryFrame steps={steps as any} activeId={active} onStepChange={(id: string) => setActive(id)} /></div>;
  }
  createRoot(document.getElementById('root')!).render(<MemoryRouter>{q.get('mode') === 'story' ? <Story /> : <Growing hide={q.get('mode') === 'hidden'} />}</MemoryRouter>);
`;

test('SHW-065 a header layer reports only its settled band when its stage opens at 0 px or a story step mounts it (known defect 65)', async () => {
  const h = await startHarness(SWING);
  try {
    for (const mode of ['grow', 'hidden', 'story'] as const) {
      const page = await h.browser.newPage({ viewport: mode === 'story' ? { width: 2560, height: 1440 } : { width: 1280, height: 800 } });
      await page.goto(`${h.address}?mode=${mode}`);
      if (mode === 'story') {
        await page.waitForTimeout(300);
        await page.evaluate(() => (window as any).__step());
      }
      await settled(page);
      await page.waitForTimeout(600);
      const r = await page.evaluate(() => {
        const layer = document.querySelector('[data-caos-callout-layer]') as HTMLElement;
        const top = layer.getBoundingClientRect().top;
        const measured = Math.max(...[...layer.querySelectorAll('[data-caos-callout]')].map((c) => c.getBoundingClientRect().bottom)) - top;
        return { bands: (window as any).__bands as number[], frames: ((window as any).__frames as string[]).filter((v) => v !== ''), measured };
      });
      assert.ok(r.bands.length >= 1, `${mode}: the layer reports its band`);
      for (const b of r.bands) assert.ok(Math.abs(b - r.measured) <= 1, `${mode}: onLayout reported ${r.bands.join(', ')} px; only the settled ${r.measured.toFixed(1)} px is a real band`);
      const near = (v: string) => Math.abs(Number.parseFloat(v) - r.measured) <= 1;
      const first = r.frames.findIndex(near);
      assert.ok(first >= 0, `${mode}: --caos-callout-band reaches the settled band (values seen: ${[...new Set(r.frames)].join(', ')})`);
      const transient = r.frames.slice(0, first).filter((v) => Number.parseFloat(v) > 0);
      const left = r.frames.slice(first).filter((v) => !near(v));
      assert.deepEqual([...new Set(transient)], [], `${mode}: --caos-callout-band showed a transient band before the settled ${r.measured.toFixed(1)} px`);
      assert.deepEqual([...new Set(left)], [], `${mode}: --caos-callout-band left the settled band ${r.measured.toFixed(1)} px`);
      if (mode !== 'story') {
        // a real change of layout: the band goes from the settled value to the new settled value, never through another
        await page.evaluate(() => { (window as any).__frames = []; (window as any).__bands = []; (window as any).__narrow(); });
        await settled(page);
        await page.waitForTimeout(400);
        const n = await page.evaluate(() => {
          const layer = document.querySelector('[data-caos-callout-layer]') as HTMLElement;
          const top = layer.getBoundingClientRect().top;
          return { bands: (window as any).__bands as number[], frames: (window as any).__frames as string[], measured: Math.max(...[...layer.querySelectorAll('[data-caos-callout]')].map((c) => c.getBoundingClientRect().bottom)) - top };
        });
        assert.ok(n.measured > r.measured + 20, `${mode}: the narrow stage stacks the cards (${n.measured.toFixed(1)} px, was ${r.measured.toFixed(1)})`);
        const either = (v: string) => Math.abs(Number.parseFloat(v) - r.measured) <= 1 || Math.abs(Number.parseFloat(v) - n.measured) <= 1;
        assert.deepEqual([...new Set(n.frames.filter((v) => !either(v)))], [], `${mode}: on a resize --caos-callout-band went through a value other than ${r.measured.toFixed(1)} and ${n.measured.toFixed(1)} px`);
        for (const b of n.bands) assert.ok(Math.abs(b - n.measured) <= 1, `${mode}: on a resize onLayout reported ${n.bands.join(', ')} px; the new band is ${n.measured.toFixed(1)} px`);
      }
      await page.close();
    }
  } finally { await h.close(); }
});

// Known defect 67 (CAOS_ChancaDEM): the eyebrow and the value shared the card's first row, so a value of about seven characters
// left the eyebrow a column of about 55 px at 164 px and wrapped it to four lines. The value now has its own row; the eyebrow
// takes the card's width (two lines at most for 22 characters, where 0.25.0 needed four or more), and nothing is cut.
const LONG = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { SceneCallouts } from './src/workbench/SceneCallouts';
  import { useLangStore } from './src/lib/lang';
  const q = new URLSearchParams(location.search);
  const lang = q.get('lang') === 'es' ? 'es' : 'en';
  useLangStore.setState({ lang });
  document.documentElement.lang = lang;
  const items = [
    { id: 'belt', eyebrow: { en: 'Feed belt speed', es: 'Velocidad de la correa' }, value: '1250.75', unit: 't/h', state: 'selected', anchor: { x: .15, y: .6 }, source: { en: 'Belt scale', es: 'Pesómetro' }, trend: 'up' },
    { id: 'power', eyebrow: { en: 'Crusher power draw', es: 'Potencia del chancador' }, value: '1843.20', unit: 'kW', state: 'warning', anchor: { x: .5, y: .6 }, source: { en: 'Drive', es: 'Accionamiento' } },
    { id: 'css', eyebrow: { en: 'Closed side setting', es: 'Abertura lado cerrado' }, value: '152.375', unit: 'mm', state: 'inactive', anchor: { x: .85, y: .6 }, source: { en: 'Survey', es: 'Levantamiento' } },
  ];
  createRoot(document.getElementById('root')!).render(<div style={{ position: 'relative', width: '100%', height: 500 }}><SceneCallouts items={items as any} placement="header" /></div>);
`;

test('SHW-066 the callout value sits on its own row under the eyebrow; at 164 and 184 px no eyebrow or value is cut and the eyebrow keeps the card width (known defect 67)', async () => {
  const h = await startHarness(LONG);
  try {
    const page = await h.browser.newPage();
    for (const [width, cardW] of [[390, 164], [1280, 184]] as const) for (const lang of ['en', 'es'] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${h.address}?lang=${lang}`);
      await settled(page);
      const cards = await page.locator('.caos-scene-callout').evaluateAll((nodes) => nodes.map((card) => {
        const c = card.getBoundingClientRect(), cs = getComputedStyle(card);
        const eyebrow = card.querySelector('.caos-callout-eyebrow') as HTMLElement, value = card.querySelector('strong') as HTMLElement;
        const e = eyebrow.getBoundingClientRect(), v = value.getBoundingClientRect();
        const inner = c.width - Number.parseFloat(cs.borderLeftWidth) - Number.parseFloat(cs.borderRightWidth) - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight);
        const line = Number.parseFloat(getComputedStyle(eyebrow).fontSize) * 1.25;
        const state = card.querySelector('[data-callout-state-label]') as HTMLElement;
        return { id: card.getAttribute('data-caos-callout'), card: c.width, inner, eyebrowW: e.width, eyebrowLines: Math.round(e.height / line), eyebrowBottom: e.bottom, valueTop: v.top,
          eyebrowCut: eyebrow.scrollWidth - eyebrow.clientWidth, valueCut: value.scrollWidth - value.clientWidth, stateCut: state.scrollWidth - state.clientWidth, stateShown: state.getBoundingClientRect().height > 0 };
      }));
      assert.equal(cards.length, 3);
      for (const k of cards) {
        const where = `${width} ${lang} ${k.id}`;
        assert.ok(Math.abs(k.card - cardW) < 1, `${where}: the card is ${k.card} px (expected ${cardW})`);
        assert.ok(k.valueTop >= k.eyebrowBottom - 0.5, `${where}: the value begins under its eyebrow (${k.valueTop} < ${k.eyebrowBottom})`);
        // the eyebrow holds at least 70% of the card's content box (0.25.0: about 40%), and its text takes two lines at most
        assert.ok(k.eyebrowW >= 0.7 * k.inner, `${where}: the eyebrow is ${k.eyebrowW.toFixed(1)} px wide in a ${k.inner.toFixed(1)} px card`);
        assert.ok(k.eyebrowLines <= 2, `${where}: the eyebrow wraps to ${k.eyebrowLines} lines`);
        assert.ok(k.eyebrowCut <= 0 && k.valueCut <= 0 && k.stateCut <= 0, `${where}: nothing is cut (eyebrow ${k.eyebrowCut}, value ${k.valueCut}, state ${k.stateCut} px)`);
        assert.ok(k.stateShown, `${where}: the state label is shown`);
      }
    }
    await page.close();
  } finally { await h.close(); }
});
