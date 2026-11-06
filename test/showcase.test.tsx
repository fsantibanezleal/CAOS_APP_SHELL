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
