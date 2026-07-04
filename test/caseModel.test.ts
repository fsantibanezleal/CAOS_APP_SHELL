// Unit tests for the CaseSelector v2 model (src/case/caseModel.ts): source presence + ordering,
// category grouping order, source filtering, tooltip composition, and ?case= deep-link round-trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type CaseDef,
  caseKind,
  casesInSource,
  caseTooltip,
  groupByCategory,
  readCaseParam,
  sourcesPresent,
  withCaseParam,
} from '../src/case/caseModel.ts';

const DECK: CaseDef[] = [
  { id: 'A01', name: 'porphyry', category: 'A · deposits', anchor: 'opt 26,086,899' },
  { id: 'A02', name: 'vein', category: 'A · deposits', expectedBand: '±5%' },
  { id: 'CTRL', name: 'empty pit', category: 'CTRL', kind: 'synthetic' },
  { id: 'R01', name: 'Newman1', category: 'MineLib', kind: 'real', anchor: 'published' },
  { id: 'UP', name: 'your file', kind: 'uploaded' },
];

test('caseKind defaults to synthetic', () => {
  assert.equal(caseKind({ id: 'x', name: 'x' }), 'synthetic');
  assert.equal(caseKind({ id: 'x', name: 'x', kind: 'real' }), 'real');
});

test('sourcesPresent returns present lanes in canonical order', () => {
  assert.deepEqual(sourcesPresent(DECK), ['synthetic', 'real', 'uploaded']);
  assert.deepEqual(sourcesPresent([{ id: 'a', name: 'a', kind: 'real' }]), ['real']);
  // canonical order regardless of deck order
  assert.deepEqual(
    sourcesPresent([{ id: 'u', name: 'u', kind: 'uploaded' }, { id: 's', name: 's' }]),
    ['synthetic', 'uploaded'],
  );
});

test('groupByCategory preserves first-seen category and within-group order', () => {
  const g = groupByCategory(DECK);
  assert.deepEqual(g.map((x) => x.category), ['A · deposits', 'CTRL', 'MineLib', '']);
  assert.deepEqual(g[0]!.cases.map((c) => c.id), ['A01', 'A02']);
  assert.equal(g[3]!.category, '', 'a case with no category groups under the empty key');
});

test('casesInSource filters by lane; undefined source returns all', () => {
  assert.deepEqual(casesInSource(DECK, 'synthetic').map((c) => c.id), ['A01', 'A02', 'CTRL']);
  assert.deepEqual(casesInSource(DECK, 'real').map((c) => c.id), ['R01']);
  assert.deepEqual(casesInSource(DECK, 'uploaded').map((c) => c.id), ['UP']);
  assert.equal(casesInSource(DECK, undefined).length, DECK.length);
});

test('caseTooltip joins anchor and expectedBand, empty when neither', () => {
  assert.equal(caseTooltip(DECK[0]!), 'opt 26,086,899');
  assert.equal(caseTooltip(DECK[1]!), '±5%');
  assert.equal(caseTooltip({ id: 'x', name: 'x', anchor: 'a', expectedBand: 'b' }), 'a · b');
  assert.equal(caseTooltip(DECK[2]!), '');
});

test('deep-link param round-trips through a query string', () => {
  assert.equal(readCaseParam('?case=A02'), 'A02');
  assert.equal(readCaseParam('?foo=1', 'case'), null);
  assert.equal(readCaseParam('?scenario=R01', 'scenario'), 'R01');
  assert.equal(withCaseParam('', 'A01'), '?case=A01');
  assert.equal(withCaseParam('?keep=1', 'A02'), '?keep=1&case=A02');
  // replacing an existing value keeps other params
  assert.equal(readCaseParam(withCaseParam('?case=old&keep=1', 'new'), 'case'), 'new');
});
