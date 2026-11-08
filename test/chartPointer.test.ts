import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newTrack, scrollSynthesised, SCROLL_WINDOW_MS } from '../src/chart/pointer.ts';

/** SHC-103 (issue 208, known defect 62): a chart reads a pointer event only when it is real. */
const at = (clientX: number, clientY: number, movementX = 0, movementY = 0) => ({ clientX, clientY, movementX, movementY });

test('SHC-103: an event at the position of the last pointer move is the browser re-dispatching it after a scroll', () => {
  const t = { ...newTrack(), x: 302, y: 252 };
  assert.equal(scrollSynthesised(t, at(302, 252), 1000), true);
  assert.equal(scrollSynthesised(t, at(302, 252, 0, 0), 5000), true, 'the time since the scroll does not matter once the position is known');
});

test('SHC-103: a move to another position is real, however small', () => {
  const t = { ...newTrack(), x: 302, y: 252 };
  assert.equal(scrollSynthesised(t, at(303, 252, 1, 0), 1000), false);
  assert.equal(scrollSynthesised(t, at(302, 251, 0, -1), 1000), false);
});

test('SHC-103: a touch or a pen is never judged, its compatibility mouse events are real', () => {
  for (const type of ['touch', 'pen']) {
    const t = { ...newTrack(), x: 302, y: 252, type };
    assert.equal(scrollSynthesised(t, at(302, 252), 1000), false, type);
  }
});

test('SHC-103: before the page has seen the pointer move, only a motionless event just after a scroll is a re-dispatch', () => {
  const t = { ...newTrack(), scrolledAt: 1000 };
  assert.equal(scrollSynthesised(t, at(40, 60), 1000 + SCROLL_WINDOW_MS - 1), true);
  assert.equal(scrollSynthesised(t, at(40, 60), 1000 + SCROLL_WINDOW_MS + 1), false, 'a later event is the reader moving');
  assert.equal(scrollSynthesised(t, at(40, 60, 3, 0), 1100), false, 'an event that carries movement is real');
  assert.equal(scrollSynthesised(newTrack(), at(40, 60), 0), false, 'no scroll seen, nothing is a re-dispatch');
});
