// Unit tests for the no-compute-bomb loop core (src/lib/vizLoop.ts). A controllable fake clock +
// rAF queue drives the state machine deterministically, no DOM. Guards the four invariants of the
// portfolio rule: default paused, run-once-then-stop, looping opt-in, and halt on a hidden tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVizLoop, type VizLoopDeps } from '../src/lib/vizLoop.ts';

function harness() {
  let t = 0;
  let queued: ((now: number) => void) | null = null;
  let id = 0;
  const deps: VizLoopDeps = {
    raf: (cb) => {
      queued = cb;
      return ++id;
    },
    caf: () => {
      queued = null;
    },
  };
  // advance the clock by dt and deliver the pending frame (if any), like a real rAF firing.
  const step = (dt: number) => {
    t += dt;
    const cb = queued;
    queued = null;
    if (cb) cb(t);
  };
  const skip = (dt: number) => {
    t += dt;
  }; // advance the clock WITHOUT firing a frame (simulates a hidden tab)
  const hasFrame = () => queued !== null;
  return { deps, step, skip, hasFrame };
}

test('default paused: nothing runs until play()', () => {
  const h = harness();
  let frames = 0;
  const loop = createVizLoop(() => { frames++; }, {}, h.deps);
  assert.equal(loop.isPlaying(), false);
  assert.equal(h.hasFrame(), false);
  h.step(16);
  assert.equal(frames, 0, 'no frame should fire while paused');
});

test('play() runs frames with dt and elapsed', () => {
  const h = harness();
  const seen: Array<[number, number]> = [];
  const loop = createVizLoop((dt, e) => { seen.push([dt, e]); }, {}, h.deps);
  loop.play();
  assert.equal(loop.isPlaying(), true);
  h.step(16); // first frame: baseline, dt 0
  h.step(16); // second frame: dt 16
  h.step(16);
  assert.deepEqual(seen[0], [0, 0]);
  assert.deepEqual(seen[1], [16, 16]);
  assert.deepEqual(seen[2], [16, 32]);
});

test('run once then stop: returning false completes and pauses (onComplete fires once)', () => {
  const h = harness();
  let completes = 0;
  let frames = 0;
  const loop = createVizLoop(() => { frames++; return frames < 3 ? true : false; },
    { onComplete: () => completes++ }, h.deps);
  loop.play();
  h.step(16); // 1
  h.step(16); // 2
  h.step(16); // 3 -> returns false -> complete
  assert.equal(loop.isPlaying(), false, 'loop pauses after completion');
  assert.equal(loop.isRunning(), false, 'intent cleared after completion');
  assert.equal(completes, 1);
  assert.equal(h.hasFrame(), false, 'no further frames requested');
  h.step(16);
  assert.equal(frames, 3, 'no extra frame after completion');
});

test('durationMs caps the pass and clamps the final elapsed', () => {
  const h = harness();
  let lastE = -1;
  let completes = 0;
  const loop = createVizLoop((_dt, e) => { lastE = e; }, // never returns false
    { durationMs: 100, onComplete: () => completes++ }, h.deps);
  loop.play();
  h.step(0); // baseline
  h.step(40); // e=40
  h.step(40); // e=80
  h.step(40); // e would be 120 -> capped to 100, then complete
  assert.equal(lastE, 100, 'final frame elapsed is clamped to durationMs');
  assert.equal(completes, 1);
  assert.equal(loop.isPlaying(), false);
});

test('loop:true repeats and resets elapsed each pass', () => {
  const h = harness();
  const elapseds: number[] = [];
  let frames = 0;
  const loop = createVizLoop((_dt, e) => { elapseds.push(e); frames++; return frames % 2 === 0 ? false : true; },
    { loop: true }, h.deps);
  loop.play();
  h.step(0); // f1 e0 -> true
  h.step(20); // f2 e20 -> false -> loop resets
  h.step(20); // f3 e0 (new pass baseline) -> true
  h.step(20); // f4 e20 -> false -> loop
  assert.deepEqual(elapseds, [0, 20, 0, 20]);
  assert.equal(loop.isPlaying(), true, 'a looping viz keeps running');
});

test('hidden tab halts the rAF but keeps intent; visible resumes', () => {
  const h = harness();
  let frames = 0;
  const loop = createVizLoop(() => { frames++; }, {}, h.deps);
  loop.play();
  h.step(16);
  assert.equal(frames, 1);
  loop.setHidden(true);
  assert.equal(loop.isPlaying(), false, 'no frames requested while hidden');
  assert.equal(loop.isRunning(), true, 'but the user still wants motion');
  assert.equal(h.hasFrame(), false);
  h.step(16);
  assert.equal(frames, 1, 'no frame fires while hidden');
  loop.setHidden(false);
  assert.equal(loop.isPlaying(), true, 'resumes when visible again');
  h.step(16);
  assert.equal(frames, 2);
});

test('elapsed excludes time spent hidden (no dt jump on resume)', () => {
  const h = harness();
  let lastE = -1;
  let lastDt = -1;
  const loop = createVizLoop((dt, e) => { lastDt = dt; lastE = e; }, {}, h.deps);
  loop.play();
  h.step(0); // baseline e0
  h.step(50); // e50
  loop.setHidden(true);
  h.skip(10_000); // 10s pass in the background — must NOT count
  loop.setHidden(false);
  h.step(16); // first frame back: baseline reset, dt ~0
  assert.equal(lastDt, 0, 'dt does not include the hidden gap');
  assert.equal(lastE, 50, 'elapsed continues from the pre-hide value, not +10s');
});

test('pause() stops frames and can resume; toggle flips state', () => {
  const h = harness();
  let frames = 0;
  const loop = createVizLoop(() => { frames++; }, {}, h.deps);
  loop.play();
  h.step(16);
  loop.pause();
  assert.equal(loop.isPlaying(), false);
  h.step(16);
  assert.equal(frames, 1, 'paused: no frame');
  loop.toggle(); // -> play
  assert.equal(loop.isPlaying(), true);
  h.step(16);
  assert.equal(frames, 2);
  loop.toggle(); // -> pause
  assert.equal(loop.isPlaying(), false);
});

test('restart resets elapsed to 0', () => {
  const h = harness();
  let lastE = -1;
  const loop = createVizLoop((_dt, e) => { lastE = e; }, {}, h.deps);
  loop.play();
  h.step(0);
  h.step(30);
  h.step(30);
  assert.equal(lastE, 60);
  loop.restart();
  h.step(16); // baseline of the new pass
  assert.equal(lastE, 0, 'restart zeroes elapsed');
});

test('dispose cancels any pending frame', () => {
  const h = harness();
  let frames = 0;
  const loop = createVizLoop(() => { frames++; }, {}, h.deps);
  loop.play();
  assert.equal(h.hasFrame(), true);
  loop.dispose();
  assert.equal(h.hasFrame(), false);
  h.step(16);
  assert.equal(frames, 0);
});
