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

test('the Focus control shares the case select row, so the rail head is no taller with it (shell 0.14.1)', () => {
  // on a row of its own it added 37px to the rail head, and rails with little slack scrolled (ADR-0071 rule 6)
  const html = bench(true);
  const row = html.indexOf('class="cs-select-row"');
  assert.ok(row > 0, 'the select sits in a row with the control');
  const select = html.indexOf('<select', row);
  const enter = html.indexOf('data-focus-enter', row);
  const rowEnd = html.indexOf('</div>', enter);
  assert.ok(select > row && enter > select && rowEnd > enter, 'the select first, then the control, inside that one row');
  assert.equal((html.match(/data-focus-enter=""/g) ?? []).length, 1, 'one control, not a second one in the rail head');
});

test('with case chips, or with no case picker, the Focus control keeps a row of its own in the rail head', () => {
  const chips = renderToStaticMarkup(
    <CaseWorkbench
      caseId="c1"
      cases={{ cases: [{ id: 'c1', name: 'First' }], selectedId: 'c1', onSelect: () => undefined, layout: 'chips' }}
      groups={[{ id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <p>MODEL</p> }]}
      context={{ content: <p>CONTEXT</p> }}
      focus
    />,
  );
  assert.doesNotMatch(chips, /cs-select-row/);
  assert.equal((chips.match(/data-focus-enter=""/g) ?? []).length, 1);
  assert.ok(chips.indexOf('data-focus-enter') > chips.lastIndexOf('cs-chips'), 'after the chips');
  const none = renderToStaticMarkup(
    <CaseWorkbench caseId="c1" groups={[{ id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <p>MODEL</p> }]}
      context={{ content: <p>CONTEXT</p> }} focus />,
  );
  assert.equal((none.match(/data-focus-enter=""/g) ?? []).length, 1);
  assert.doesNotMatch(none, /cs-select-row/);
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
