import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { createLinkedViewStore } from '../src/workbench/linkedViews';
import { layoutCalloutHeader, layoutSceneCallouts, type SceneCalloutDef } from '../src/workbench/SceneCallouts';
import { StoryFrame, type StoryStep } from '../src/workbench/StoryFrame';
import { Scene3DFrame } from '../src/workbench/Scene3DFrame';
import { flyCamera, runStagedTransition } from '../src/workbench/motion';
import { cameraForBounds, detailTier, explodedOffsets, flowSpeed, sceneEnvironment } from '../src/workbench/scene3d';

test('ADR-0082 callout layout keeps three anchored labels inside the stage without overlap', () => {
  const items: SceneCalloutDef[] = [
    { id: 'a', eyebrow: 'Mill feed', value: '725.9', unit: 't/h', state: 'normal', anchor: { x: 0.24, y: 0.47 }, source: 'Live circuit trace' },
    { id: 'b', eyebrow: 'Power', value: '12.4', unit: 'MW', state: 'warning', anchor: { x: 0.52, y: 0.48 }, source: 'Plant power limit' },
    { id: 'c', eyebrow: 'Water', value: '88', unit: 'm³/h', state: 'selected', anchor: { x: 0.79, y: 0.5 }, source: 'Live circuit trace' },
  ];
  for (const compact of [false, true]) {
    const boxes = layoutSceneCallouts(items, 1080, 620, compact);
    assert.equal(boxes.length, 3);
    for (const [i, box] of boxes.entries()) {
      assert.ok(box.left >= 0 && box.top >= 0 && box.left + box.width <= 1080 && box.top + box.height <= 620, `box ${i} is on stage`);
      for (const other of boxes.slice(i + 1)) assert.ok(!(box.left < other.left + other.width && box.left + box.width > other.left && box.top < other.top + other.height && box.top + box.height > other.top), 'callouts do not overlap');
    }
  }
});

test('adversarial: compact callouts never cover their own or another scene subject anchor', () => {
  const item: SceneCalloutDef = { id: 'feed', eyebrow: 'Feed', value: '720', unit: 't/h', state: 'normal', anchor: { x: 1 / 3, y: .5 }, source: 'Reference stream' };
  const boxes = layoutSceneCallouts([item], 300, 400, true);
  const anchor = { x: item.anchor.x * 300, y: item.anchor.y * 400 };
  assert.equal(boxes.length, 1);
  assert.ok(!covers(boxes[0]!, anchor.x, anchor.y, 8), `callout covers its own subject at (${anchor.x}, ${anchor.y}): ${JSON.stringify(boxes[0])}`);
});

function covers(box: { left: number; top: number; width: number; height: number }, x: number, y: number, clearance: number) {
  return x >= box.left - clearance && x <= box.left + box.width + clearance && y >= box.top - clearance && y <= box.top + box.height + clearance;
}

test('ADR-0082 reserved callout band separates data cards from diagram geometry', () => {
  const items: SceneCalloutDef[] = [
    { id: 'feed', eyebrow: 'Slurry', value: '720', unit: 't/h', state: 'normal', anchor: { x: .2, y: .5 }, source: 'Live circuit trace' },
    { id: 'water', eyebrow: 'Water', value: '150', unit: 'm³/h', state: 'selected', anchor: { x: .5, y: .55 }, source: 'Live circuit trace' },
    { id: 'tailings', eyebrow: 'Tailings', value: '701.4', unit: 't/h', state: 'warning', anchor: { x: .8, y: .8 }, source: 'Live circuit trace' },
  ];
  for (const [width, height, compact] of [[1080, 620, false], [360, 388, true]] as const) {
    const boxes = layoutCalloutHeader(items, width, height, compact);
    assert.equal(boxes.length, 3);
    assert.ok(boxes.every((box) => box.top + box.height <= (compact ? 128 : 84)), 'every callout stays in the reserved top band');
    for (const [i, box] of boxes.entries()) for (const other of boxes.slice(i + 1)) {
      assert.ok(!(box.left < other.left + other.width && box.left + box.width > other.left && box.top < other.top + other.height && box.top + box.height > other.top), 'cards do not cover one another');
    }
    assert.ok(boxes.every((box, index) => box.anchorX === items[index]!.anchor.x * width && box.anchorY === items[index]!.anchor.y * height), 'each leader retains its own scene anchor');
  }
});

test('linked scene, panel and series selectors update one shared selection and cursor', () => {
  const store = createLinkedViewStore({ selectedId: 'SAG', cursor: 80 });
  store.getState().select('FL1', 'panel');
  assert.equal(store.getState().selectedId, 'FL1');
  assert.equal(store.getState().origin, 'panel');
  store.getState().showSeries('FL1.feed');
  store.getState().scrub(102);
  assert.equal(store.getState().seriesId, 'FL1.feed');
  assert.equal(store.getState().cursor, 102);
});

test('linked selection is reciprocal and the shared cursor can be scrubbed in either view', () => {
  const store = createLinkedViewStore();
  const sceneSelect = store.getState().select;
  sceneSelect('cyclone', 'scene');
  assert.equal(store.getState().selectedId, 'cyclone');
  assert.equal(store.getState().origin, 'scene');
  store.getState().select('cyclone', 'panel');
  assert.equal(store.getState().selectedId, 'cyclone');
  assert.equal(store.getState().origin, 'panel');
  store.getState().scrub(118.5);
  assert.equal(store.getState().cursor, 118.5);
});

test('story frame exposes each deep link, step number, finding headline, stage and docked panel', () => {
  const steps: StoryStep[] = [1, 2, 3].map((number) => ({
    id: `step-${number}`, number, verb: { en: `Inspect ${number}`, es: `Inspeccionar ${number}` },
    headline: { en: `Stream reaches ${number * 10} t/h`, es: `Flujo alcanza ${number * 10} t/h` },
    summary: { en: 'Reference case, not telemetry.', es: 'Caso de referencia, no telemetría.' }, href: `/story/step-${number}`, accent: number as 1 | 2 | 3,
    stage: createElement('svg', { role: 'img', 'aria-label': `Scene ${number}`, viewBox: '0 0 100 100' }, createElement('circle', { cx: 50, cy: 50, r: 20 })), panel: createElement('p', null, `Evidence ${number}`),
  }));
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(StoryFrame, { steps, activeId: 'step-2', onStepChange: () => undefined })));
  assert.match(html, /data-story-step="step-2"/);
  assert.match(html, /data-story-headline/);
  assert.match(html, /href="\/story\/step-1"/);
  assert.match(html, /data-stage-panel/);
});

test('the shared 3D frame gives product-owned renderers a full-size accessible scene and separate context', () => {
  const html = renderToStaticMarkup(createElement(Scene3DFrame, {
    label: 'Grinding mill and classifier', controls: createElement('button', null, 'Reset camera'),
    legend: createElement('p', null, 'Reference geometry'), status: createElement('p', null, 'Synthetic replay'),
  }, createElement('canvas', { 'aria-label': '3D grinding circuit' })));
  assert.match(html, /data-caos-scene3d-frame/);
  assert.match(html, /role="region" aria-label="Grinding mill and classifier"/);
  assert.match(html, /data-caos-scene3d-renderer/);
  assert.match(html, /Reset camera/);
  assert.match(html, /Scene legend/);
  assert.match(html, /role="status"/);
  const spanish = renderToStaticMarkup(createElement(Scene3DFrame, { label: 'Escena del circuito', legendLabel: 'Leyenda de escena', legend: 'Geometría de referencia' }, createElement('svg')));
  assert.match(spanish, /aria-label="Leyenda de escena"/);
});

test('reduced motion applies story transitions immediately and camera flies to the final pose', async () => {
  const order: number[] = [];
  await runStagedTransition([{ run: () => order.push(1) }, { run: () => order.push(2) }], { reducedMotion: true });
  assert.deepEqual(order, [1, 2]);
  let position: readonly [number, number, number] = [0, 0, 0];
  let target: readonly [number, number, number] = [0, 0, 0];
  await flyCamera({ setPosition: (x, y, z) => { position = [x, y, z]; }, lookAt: (x, y, z) => { target = [x, y, z]; } }, { position: [0, 0, 0], target: [0, 0, 0] }, { position: [5, 4, 3], target: [1, 2, 1] }, { reducedMotion: true });
  assert.deepEqual(position, [5, 4, 3]);
  assert.deepEqual(target, [1, 2, 1]);
});

test('scene helpers frame authored bounds, bound rate motion, explode stable parts and switch detail by distance', () => {
  const pose = cameraForBounds({ min: { x: -10, y: 0, z: -4 }, max: { x: 10, y: 8, z: 4 } }, 16 / 9);
  assert.deepEqual(pose.target, [0, 4, 0]);
  assert.ok(Math.hypot(...pose.position) > 10);
  assert.equal(flowSpeed(0, 20), 0);
  assert.equal(flowSpeed(1e6, 10), 1.25);
  const offsets = explodedOffsets([{ id: 'left', center: { x: -1, y: 0, z: 0 } }, { id: 'right', center: { x: 1, y: 0, z: 0 } }], 2);
  assert.equal(offsets.left?.x, -2);
  assert.equal(offsets.right?.x, 2);
  assert.equal(detailTier(8), 'high');
  assert.equal(detailTier(40), 'medium');
  assert.equal(detailTier(100), 'low');
  assert.equal(sceneEnvironment('dark').background, '#101a22');
  assert.equal(sceneEnvironment('light').key.castShadow, true);
});

test('SHW-057: StoryFrame exposes the requested mobile stage floor on its root', () => {
  const steps: StoryStep[] = [1, 2, 3].map((number) => ({
    id: `step-${number}`, number, verb: { en: `Inspect ${number}`, es: `Inspeccionar ${number}` },
    headline: { en: `Finding ${number}`, es: `Hallazgo ${number}` }, summary: { en: 'Summary', es: 'Resumen' },
    href: `/story/step-${number}`, accent: number as 1 | 2 | 3, stage: createElement('svg'), panel: createElement('p', null, 'Evidence'),
  }));
  const render = (mobileStageMinHeight?: number) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(StoryFrame, {
    steps, activeId: 'step-1', onStepChange: () => undefined, mobileStageMinHeight,
  })));
  assert.match(render(), /--caos-story-stage-minimum:300px/);
  assert.match(render(640), /--caos-story-stage-minimum:640px/);
  for (const invalid of [299, 901, 640.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => render(invalid), RangeError);
  }
});

test('SHW-059: every scene callout shows its state as a word with a non-colour glyph (known defect 58)', async () => {
  // English here; the Spanish words are read in test/calloutsEs.test.tsx (the shell reads the stored language when it loads)
  const { SceneCallouts } = await import('../src/workbench/SceneCallouts');
  const states = ['normal', 'warning', 'alarm', 'selected', 'inactive'] as const;
  const items: SceneCalloutDef[] = states.map((state, index) => ({ id: state, eyebrow: 'Feed', value: String(100 + index), unit: 't/h', state, anchor: { x: (index + 1) / 6, y: .5 }, source: 'Live trace' }));
  const words = ['normal', 'warning', 'alarm', 'selected', 'inactive'];
  const html = renderToStaticMarkup(createElement(SceneCallouts, { items, placement: 'header' }));
  const glyphs = new Set<string>();
  for (const [index, state] of states.entries()) {
    const card = new RegExp(`data-caos-callout="${state}"[\\s\\S]*?</article>`).exec(html)?.[0] ?? '';
    assert.match(card, /data-callout-state-label=""/, `the ${state} callout carries a data-callout-state-label: ${card}`);
    const label = /data-callout-state-glyph=""[^>]*>([^<]+)<\/span>([^<]*)<\/span>/.exec(card);
    assert.ok(label, `the ${state} label is a glyph and a word: ${card}`);
    const [, glyph, word] = label;
    assert.equal(word!.trim(), words[index], `the ${state} callout reads "${words[index]}"`);
    assert.ok(!/[\p{L}\p{N}]/u.test(glyph!), `the ${state} label has a non-letter glyph (got ${glyph})`);
    glyphs.add(glyph!);
  }
  assert.equal(glyphs.size, states.length, 'each state has a glyph of its own shape, not only a colour');
});

test('SHW-059: a callout without a recognised state gets no state label (it already fails G21)', async () => {
  const { SceneCallouts } = await import('../src/workbench/SceneCallouts');
  const item = { id: 'odd', eyebrow: 'Feed', value: '1', unit: 't/h', state: 'unknown' as unknown as SceneCalloutDef['state'], anchor: { x: .5, y: .5 }, source: 'Trace' };
  const html = renderToStaticMarkup(createElement(SceneCallouts, { items: [item] }));
  assert.match(html, /data-callout-state="unknown"/);
  assert.doesNotMatch(html, /data-callout-state-label/);
});

test('SHW-060: layoutCalloutHeader lays the cards out on measured heights, ordered by anchor x, stable for equal x (known defect 60)', () => {
  // declared in reverse x; the middle card grew when its source wrapped (104 px; the nominal card is 68 or 54 px)
  const items: SceneCalloutDef[] = [
    { id: 'right', eyebrow: 'Throw', value: '38', unit: 'mm', state: 'normal', anchor: { x: .85, y: .6 }, source: 'Liner survey' },
    { id: 'middle', eyebrow: 'Nip angle', value: '21.5', unit: 'deg', state: 'warning', anchor: { x: .5, y: .55 }, source: 'Derived from the measured open and closed side settings of the last survey' },
    { id: 'left', eyebrow: 'CSS', value: '152', unit: 'mm', state: 'selected', anchor: { x: .15, y: .5 }, source: 'Liner survey' },
  ];
  const heights = { right: 68, middle: 104, left: 68 };
  for (const [width, height, compact] of [[1080, 620, false], [360, 388, true]] as const) {
    const boxes = layoutCalloutHeader(items, width, height, compact, heights);
    assert.deepEqual(boxes.map((box) => box.id), ['left', 'middle', 'right'], `${width}px: boxes in anchor x order`);
    assert.equal(boxes.find((box) => box.id === 'middle')!.height, 104, `${width}px: the grown card is laid out at its measured height`);
    for (const [i, box] of boxes.entries()) {
      assert.ok(box.left >= 0 && box.left + box.width <= width, `${width}px: ${box.id} stays inside the layer`);
      for (const other of boxes.slice(i + 1)) assert.ok(!(box.left < other.left + other.width && box.left + box.width > other.left && box.top < other.top + other.height && box.top + box.height > other.top), `${width}px: ${box.id} and ${other.id} do not overlap at their measured heights`);
    }
    const firstRow = boxes.filter((box) => box.top === boxes[0]!.top);
    for (let i = 1; i < firstRow.length; i += 1) assert.ok(firstRow[i]!.left > firstRow[i - 1]!.left, `${width}px: a row reads left to right in anchor order`);
  }
  // the nominal heights stay the default: the existing call is unchanged
  assert.ok(layoutCalloutHeader(items, 1080, 620).every((box) => box.height === 68));
  // equal anchor x keeps the declaration order
  const tie = layoutCalloutHeader([{ ...items[0]!, id: 'p', anchor: { x: .4, y: .5 } }, { ...items[0]!, id: 'q', anchor: { x: .4, y: .5 } }, { ...items[0]!, id: 'r', anchor: { x: .1, y: .5 } }], 1080, 620);
  assert.deepEqual(tie.map((box) => box.id), ['r', 'p', 'q']);
});

test('SHW-061: layoutSceneCallouts places an anchored card at its measured height, the nominal one by default', () => {
  const items: SceneCalloutDef[] = [
    { id: 'a', eyebrow: 'Mill feed', value: '725.9', unit: 't/h', state: 'normal', anchor: { x: 0.24, y: 0.47 }, source: 'Live circuit trace' },
    { id: 'b', eyebrow: 'Power', value: '12.4', unit: 'MW', state: 'warning', anchor: { x: 0.52, y: 0.48 }, source: 'Plant power limit' },
  ];
  const boxes = layoutSceneCallouts(items, 1080, 620, false, { b: 96 });
  assert.equal(boxes[0]!.height, 68);
  assert.equal(boxes[1]!.height, 96);
  assert.ok(!(boxes[0]!.left < boxes[1]!.left + boxes[1]!.width && boxes[0]!.left + boxes[0]!.width > boxes[1]!.left && boxes[0]!.top < boxes[1]!.top + 96 && boxes[0]!.top + 68 > boxes[1]!.top), 'the grown card does not overlap the other');
});
