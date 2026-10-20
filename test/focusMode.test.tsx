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

test('a workbench with a focus configuration shows the Focus control at the end of the group tab row, with a name in both languages', () => {
  // the server render follows the English default; the Spanish words are checked here as constants and in the browser (e2e/focus-mode.test.ts)
  const html = bench(true);
  assert.match(html, /<button[^>]*data-focus-enter=""/, 'a real button');
  assert.ok(html.includes(`aria-label="${FOCUS_TEXT.enterLabel.en}"`), `the accessible name "${FOCUS_TEXT.enterLabel.en}"`);
  assert.ok(html.includes(`>${FOCUS_TEXT.enter.en}<`), 'the visible word');
  const slot = html.indexOf('data-tabs-slot');
  const list = html.indexOf('role="tablist"');
  assert.ok(list > 0 && slot > list && html.indexOf('data-focus-enter') > slot, 'the control is in the slot after the tab list');
  assert.ok(html.indexOf('data-focus-enter') > html.indexOf('data-case-workbench'), 'inside the instrument, not in the rail');
  const head = html.slice(html.indexOf('caos-wb-rail-head'), html.indexOf('data-case-workbench'));
  assert.doesNotMatch(head, /data-focus-enter/, 'not in the rail head (shell 0.17.0, BL-074)');
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

test('the case select takes the rail head alone: the Focus control is not in its row, so no case name is cut beside it (shell 0.17.0, BL-074)', () => {
  const html = bench(true);
  assert.doesNotMatch(html, /cs-select-row/, 'no row beside the select');
  assert.equal((html.match(/data-focus-enter=""/g) ?? []).length, 1, 'one control');
  const slot = html.indexOf('data-tabs-slot');
  assert.ok(html.indexOf('data-focus-enter') > slot && slot > html.indexOf('<select'), 'the select first, the control later in the tab row');
});

test('whatever the case picker (select, chips or none) the Focus control sits in the tab row slot and the rail head gets no row for it', () => {
  const mk = (layout?: 'select' | 'chips') =>
    renderToStaticMarkup(
      <CaseWorkbench
        caseId="c1"
        cases={layout ? { cases: [{ id: 'c1', name: 'First' }], selectedId: 'c1', onSelect: () => undefined, layout } : undefined}
        groups={[{ id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <p>MODEL</p> }]}
        context={{ content: <p>CONTEXT</p> }}
        focus
      />,
    );
  for (const layout of ['select', 'chips', undefined] as const) {
    const html = mk(layout);
    assert.equal((html.match(/data-focus-enter=""/g) ?? []).length, 1, `${layout}: one control`);
    assert.ok(html.indexOf('data-focus-enter') > html.indexOf('data-tabs-slot'), `${layout}: in the tab row slot`);
    assert.doesNotMatch(html, /cs-select-row/, `${layout}: no select row`);
  }
  assert.doesNotMatch(mk(undefined), /caos-wb-rail-head/, 'no case picker and no variants: no rail head at all');
});

test('a product accessory on a select picker still shares the select row; the Focus control no longer does', () => {
  const html = renderToStaticMarkup(
    <CaseWorkbench
      caseId="c1"
      cases={{ cases: [{ id: 'c1', name: 'First' }], selectedId: 'c1', onSelect: () => undefined, layout: 'select', accessory: <span data-product-accessory="">ACC</span> }}
      groups={[{ id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <p>MODEL</p> }]}
      context={{ content: <p>CONTEXT</p> }}
      focus
    />,
  );
  const row = html.indexOf('class="cs-select-row"');
  assert.ok(row > 0 && html.indexOf('data-product-accessory') > row, 'the product accessory is on the select row');
  assert.ok(html.indexOf('data-focus-enter') > html.indexOf('data-tabs-slot'), 'the Focus control is in the tab row');
});

/** Shell 0.14.3 (SHW-037): inside Focus the rail head shows the pickers without the Focus control. */
const inFocusMarkup = (layout: 'select' | 'chips' | 'none', accessory?: React.ReactNode) => {
  const g = globalThis as unknown as { window?: unknown };
  const had = 'window' in g;
  const prior = g.window;
  g.window = { location: { search: '?focus=1' } };
  try {
    return renderToStaticMarkup(
      <CaseWorkbench
        caseId="c1"
        cases={layout === 'none' ? undefined : { cases: [{ id: 'c1', name: 'First' }], selectedId: 'c1', onSelect: () => undefined, layout, accessory }}
        groups={[{ id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <p>MODEL</p> }]}
        context={{ content: <p>CONTEXT</p> }}
        focus
      />,
    );
  } finally {
    if (had) g.window = prior;
    else delete g.window;
  }
};

test('inside Focus the rail head never shows the Focus control: select picker, chips and no picker', () => {
  for (const layout of ['select', 'chips', 'none'] as const) {
    const html = inFocusMarkup(layout);
    assert.match(html, /data-focus-shell=""/, `${layout}: the focus frame is open`);
    assert.doesNotMatch(html, /data-focus-enter/, `${layout}: no Focus control inside Focus`);
    assert.match(html, /data-focus-exit=""/, `${layout}: the exit control is there`);
  }
});

test('inside Focus a product accessory on the case picker still renders in the focus rail', () => {
  for (const layout of ['select', 'chips'] as const) {
    const html = inFocusMarkup(layout, <span data-product-accessory="">ACC</span>);
    assert.match(html, /data-focus-shell=""/);
    assert.match(html, /data-product-accessory=""/, `${layout}: the product's own accessory shows in the focus rail`);
    assert.doesNotMatch(html, /data-focus-enter/);
  }
});

test('the case select is the native select on top of an aria-hidden display of the selected name (shell 0.17.0, the consumer trial)', () => {
  const html = bench(true);
  const wrap = html.indexOf('class="cs-select-wrap"');
  assert.ok(wrap > 0, 'a wrap');
  const display = html.indexOf('class="cs-select-display"', wrap);
  const select = html.indexOf('<select', wrap);
  assert.ok(display > wrap && select > display, 'the display first, the native select after it (on top)');
  assert.match(html.slice(display, select), /aria-hidden="true"[^>]*><span class="cs-select-text">First<\/span>/, 'the display is hidden from assistive tools and holds the selected name');
  assert.match(html.slice(select, html.indexOf('</select>', select)), /aria-label="Case selector"/, 'the select keeps its accessible name');
  assert.doesNotMatch(html.slice(display, select), /style=/, 'no height until some name needs more than one line (measured in the browser)');
});
