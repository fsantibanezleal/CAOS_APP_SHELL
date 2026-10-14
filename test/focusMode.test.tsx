import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaseWorkbench } from '../src/workbench/CaseWorkbench.tsx';
import { FOCUS_TEXT } from '../src/workbench/focus.ts';

/** Focus mode for the App (shell 0.14.0, BL-063): the control, its words in both languages, and an unchanged App without it. */

const bench = (focus?: React.ComponentProps<typeof CaseWorkbench>['focus']) =>
  renderToStaticMarkup(
    <CaseWorkbench
      caseId="c1"
      cases={{ cases: [{ id: 'c1', name: 'First' }], selectedId: 'c1', onSelect: () => undefined, layout: 'select' }}
      groups={[{ id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <p>MODEL</p> }]}
      context={{ content: <p>CONTEXT</p> }}
      focus={focus}
    />,
  );

test('a workbench with a focus configuration shows the Focus control in the rail head, with a name in both languages', () => {
  // the server render follows the English default; the Spanish words are checked here as constants and in the browser (e2e/focus-mode.test.ts)
  const html = bench(true);
  assert.match(html, /<button[^>]*data-focus-enter=""/, 'a real button');
  assert.ok(html.includes(`aria-label="${FOCUS_TEXT.enterLabel.en}"`), `the accessible name "${FOCUS_TEXT.enterLabel.en}"`);
  assert.ok(html.includes(`>${FOCUS_TEXT.enter.en}<`), 'the visible word');
  const head = html.indexOf('caos-wb-rail-head');
  assert.ok(head > 0 && html.indexOf('data-focus-enter') > head && html.indexOf('data-focus-enter') < html.indexOf('data-instrument'), 'the control sits in the rail head, beside the case picker');
  assert.equal(FOCUS_TEXT.enter.es, 'Enfocar');
  assert.equal(FOCUS_TEXT.enterLabel.es, 'Abrir este caso en modo enfoque');
  assert.equal(FOCUS_TEXT.exit.es, 'Volver a la App');
  assert.equal(FOCUS_TEXT.exit.en, 'Back to the App');
});

test('a workbench without a focus configuration shows no control and keeps its markup (nothing changes for existing consumers)', () => {
  const html = bench();
  assert.doesNotMatch(html, /data-focus-enter/);
  assert.doesNotMatch(html, /caos-focus/);
  assert.match(html, /data-case-workbench=""/);
  assert.match(html, /role="tablist"/);
  assert.doesNotMatch(bench(false), /data-focus-enter/);
});

test('the App renders in the App frame while focus is off (the stage is the tab panel, the rail stays)', () => {
  const html = bench({ title: { en: 'Case', es: 'Caso' } });
  assert.match(html, /data-workbench=""/);
  assert.match(html, /data-focus-enter=""/);
  assert.doesNotMatch(html, /data-focus-shell/);
});
