import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FocusShell } from '../src/shell/FocusShell';

test('focus shell gives the stage, HUD, return and rail distinct landmarks', () => {
  const html = renderToStaticMarkup(createElement(FocusShell, {
    stage: createElement('svg', { 'aria-label': 'Circuit' }),
    rail: createElement('input', { 'aria-label': 'Feed rate' }),
    title: 'Classification',
    description: 'Size-bin partition.',
    hud: [{ label: 'Recovery', value: '42 %' }],
    onExit: () => {},
    exitLabel: 'Return to workbench',
    stageLabel: 'Process stage',
  }));
  assert.match(html, /<main class="caos-focus-shell">/);
  assert.match(html, /<section class="caos-focus-stage" aria-label="Process stage">/);
  assert.match(html, /<aside class="caos-focus-rail">/);
  assert.match(html, /42 %/);
  assert.match(html, /Return to workbench/);
});
