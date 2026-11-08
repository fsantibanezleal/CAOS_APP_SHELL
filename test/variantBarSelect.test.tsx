import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VariantBar } from '../src/workbench/VariantBar.tsx';

/** SHW-063 (issue 207, known defect 61): `VariantBar` `layout: 'select'` draws the variants as one native select with the shell's display. */
const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);
const VARIANTS = [
  { id: 'a', label: { en: 'Baseline', es: 'Base' }, note: { en: 'as observed', es: 'como se observa' } },
  { id: 'b', label: { en: 'Drift in the covariates of the second site', es: 'Deriva' }, note: { en: 'covariates shifted', es: 'covariables desplazadas' }, lane: 'replay' as const },
  { id: 'c', label: { en: 'Disabled one', es: 'Deshabilitada' }, disabled: true },
];

test('SHW-063: the select layout is one native select with the shell display, the count, the lane and the note of the active variant', () => {
  const out = html(<VariantBar variants={VARIANTS} activeId="b" onSelect={() => undefined} lane="live" layout="select" />);
  assert.match(out, /data-variant-bar=""/);
  assert.match(out, /data-variant-count="3"/);
  assert.match(out, /Variants \(3\)/);
  assert.match(out, /<select[^>]*data-control="variant"/);
  assert.doesNotMatch(out, /role="radiogroup"/);
  assert.doesNotMatch(out, /class="chip/);
  assert.match(out, /class="cs-select-wrap"/);
  assert.match(out, /class="cs-select-display"[^>]*aria-hidden="true"><span class="cs-select-text">Drift in the covariates of the second site</);
  assert.equal((out.match(/<option /g) ?? []).length, 3);
  assert.match(out, /<option value="b" selected="">Drift in the covariates of the second site</);
  assert.match(out, /<option value="c" disabled="">Disabled one</);
  assert.match(out, /covariates shifted/);
  assert.match(out, /data-lane="replay"/);
});

test('SHW-063: the select layout has an accessible name from the title and renders with one variant', () => {
  const out = html(<VariantBar variants={[VARIANTS[0]]} activeId="a" onSelect={() => undefined} layout="select" title={{ en: 'Methods', es: 'Métodos' }} />);
  assert.match(out, /aria-label="Methods"/);
  assert.match(out, /Methods \(1\)/);
  assert.match(out, /<option value="a" selected="">Baseline</);
});

test('SHW-063: the default layout stays the chip row, unchanged', () => {
  const chips = html(<VariantBar variants={VARIANTS} activeId="b" onSelect={() => undefined} lane="live" />);
  const explicit = html(<VariantBar variants={VARIANTS} activeId="b" onSelect={() => undefined} lane="live" layout="chips" />);
  assert.equal(explicit, chips);
  assert.match(chips, /class="caos-chip-row" role="radiogroup"/);
  assert.doesNotMatch(chips, /<select/);
});
