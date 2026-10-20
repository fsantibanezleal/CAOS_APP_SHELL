import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurfacePage, type SurfacePageProps } from '../src/content/SurfacePage.tsx';
import type { TabDef } from '../src/content/Tabs.tsx';
import { memoryKey } from '../src/lib/viewMemory.ts';
import { FOCUS_TEXT, type SurfaceFocusConfig, type ViewFocusConfig } from '../src/workbench/focus.ts';

/** Focus mode for a SurfacePage App (shell 0.16.0, BL-068, ADR-0070): the control, its words, and an unchanged surface without it. */

// ids come from useId (`_R_2_`): the snapshot names them by position
const norm = (html: string) => html.replace(/_R_\w+_/g, '_ID_');
const plain = (tabs: TabDef[], extra: Partial<SurfacePageProps> = {}) =>
  norm(renderToStaticMarkup(<SurfacePage title={{ en: 'Console', es: 'Consola' }} lede="Lede" actions={<button>Act</button>} tabs={tabs} instrument {...extra} />));

const TABS: TabDef[] = [
  { id: 'a', label: 'A', content: <p>PA</p> },
  { id: 'b', label: 'B', content: <p>PB</p> },
];
const WITH_STAGE: TabDef[] = [
  { id: 'list', label: 'List', content: <p>PLIST</p> },
  { id: 'engine', label: 'Engine', content: <p>PENGINE</p>, focus: { rail: <p>RAIL</p>, hud: [{ label: 'Peak', value: '3' }] } },
];

// The DOM of the surface in 0.15.0, captured before the change.
const SNAPSHOT =
  '<div class="page-body wide caos-surface" data-surface=""><div class="caos-surface-head"><div class="caos-surface-heading"><h1 class="caos-surface-title">Console</h1><p class="caos-surface-lede">Lede</p></div><div class="caos-surface-actions"><button>Act</button></div></div><div class="caos-surface-body" data-instrument=""><div class="tabs"><div class="tablist" role="tablist" aria-label="Console"><button id="_ID_-tab-a" role="tab" type="button" aria-selected="true" aria-controls="_ID_-panel-a" tabindex="0" class="tab active" data-tab="a">A</button><button id="_ID_-tab-b" role="tab" type="button" aria-selected="false" aria-controls="_ID_-panel-b" tabindex="-1" class="tab" data-tab="b">B</button></div><div id="_ID_-panel-a" role="tabpanel" aria-labelledby="_ID_-tab-a" tabindex="0" class="tabpanel" data-panel="a"><p>PA</p></div></div></div></div>';

test('a SurfacePage without focus renders exactly as in 0.15.0 (the DOM, the classes, no control)', () => {
  assert.equal(plain(TABS), SNAPSHOT);
  assert.equal(plain(TABS, { focus: false }), SNAPSHOT, 'focus={false} is the same as unset');
});

test('a SurfacePage with focus whose views set none renders as in 0.15.0, and no control shows', () => {
  assert.equal(plain(TABS, { focus: true }), SNAPSHOT);
  assert.doesNotMatch(plain(TABS, { focus: true }), /data-focus-enter/);
});

test('a view with focus set but no surface focus shows no control (the surface opts in)', () => {
  assert.doesNotMatch(plain(WITH_STAGE, { value: 'engine' }), /data-focus-enter/);
});

const head = (html: string) => html.slice(html.indexOf('<div class="caos-surface-head">'), html.indexOf('<div class="caos-surface-body"'));

test('with focus and a focusable view open, the control sits at the end of the tab row, in a slot beside the tab list, with its name', () => {
  const html = plain(WITH_STAGE, { focus: true, value: 'engine' });
  assert.match(html, /<button[^>]*data-focus-enter=""/, 'a real button');
  assert.ok(html.includes(`aria-label="${FOCUS_TEXT.enterViewLabel.en}"`), 'the accessible name');
  assert.ok(html.includes(`>${FOCUS_TEXT.enter.en}<`), 'the visible word');
  const list = html.indexOf('role="tablist"');
  const listEnd = html.indexOf('</div>', list);
  const slot = html.indexOf('data-tabs-slot=""');
  const control = html.indexOf('data-focus-enter');
  assert.ok(list > 0 && slot > listEnd && control > slot && control < html.indexOf('role="tabpanel"'), 'in a slot after the tab list (never inside it), before the panel');
  assert.match(html, /class="tabs tabs-has-slot"/);
  assert.equal(head(html), head(plain(WITH_STAGE, { value: 'engine' })), 'the head is what it was in 0.15.0: the control adds nothing to it');
  assert.doesNotMatch(html, /aria-hidden="true"[^>]*data-focus-enter|visibility:s*hidden/, 'visible, reachable');
  assert.equal((html.match(/data-focus-enter=""/g) ?? []).length, 1, 'one control');
  assert.doesNotMatch(html, /data-focus-shell/, 'the App frame, not Focus');
  assert.equal(FOCUS_TEXT.enterViewLabel.es, 'Abrir esta vista en modo enfoque');
});

test('on a view with no stage the control keeps its space but is hidden from sight, the accessibility tree and the keyboard', () => {
  const html = plain(WITH_STAGE, { focus: true, value: 'list' });
  const button = html.slice(html.indexOf('<button', html.indexOf('data-tabs-slot')), html.indexOf('</button>', html.indexOf('data-tabs-slot')));
  assert.match(button, /data-focus-enter=""/, 'the control is in the row, so the row does not move');
  assert.match(button, /aria-hidden="true"/);
  assert.match(button, /tabindex="-1"/);
  assert.match(button, /style="visibility:hidden"/);
  assert.equal(head(html), head(plain(WITH_STAGE, { value: 'list' })), 'the head is what it was');
});

test('the control follows the open view: the first view of the row decides when nothing names another', () => {
  assert.match(plain(WITH_STAGE, { focus: true }), /aria-hidden="true"[^>]*data-focus-enter|data-focus-enter=""[^>]*aria-hidden="true"/, 'the list view is first and has no stage: hidden');
  assert.doesNotMatch(plain([...WITH_STAGE].reverse(), { focus: true }), /aria-hidden="true"[^>]*data-focus-enter|data-focus-enter=""[^>]*aria-hidden="true"/, 'the engine view first: the control shows');
});

test('a headless surface with focus adds no head, and the surface marks its view parameter for the gate (data-view-param)', () => {
  const headless = (props: Partial<SurfacePageProps>) => norm(renderToStaticMarkup(<SurfacePage tabs={WITH_STAGE} {...props} />));
  const html = headless({ focus: true, value: 'engine' });
  assert.doesNotMatch(html, /caos-surface-head/, 'no head appears');
  assert.match(html, /data-surface="" data-view-param="view"/);
  assert.match(headless({ focus: true, value: 'engine', deepLinkView: 'mode' }), /data-view-param="mode"/);
  assert.match(headless({ focus: true, value: 'engine', deepLinkView: false }), /data-view-param=""/);
  assert.doesNotMatch(headless({ value: 'engine' }), /data-view-param/, 'a surface without focus keeps its 0.15.0 markup');
});

test('the view memory is keyed on the kind, the place and the ids, never on a localized name and never on the ids alone', () => {
  assert.equal(memoryKey('subtabs', '/alpha', ['a', 'b']), 'subtabs|/alpha|a,b');
  assert.notEqual(memoryKey('tabs', '', ['a', 'b']), memoryKey('subtabs', '', ['a', 'b']));
  assert.notEqual(memoryKey('subtabs', '/alpha', ['chart', 'table']), memoryKey('subtabs', '/beta', ['chart', 'table']), 'the same ids in another place are another row');
  assert.equal(memoryKey.length, 3, 'kind, place and ids: the name of the row is not an argument');
});

test('focus: true on a view takes every default, and a config takes title, description, hud and rail', () => {
  assert.match(plain([{ id: 'x', label: 'X', content: 'PX', focus: true }], { focus: true }), /data-focus-enter/);
  const cfg: ViewFocusConfig = { title: { en: 'T', es: 'T' }, description: { en: 'D', es: 'D' }, hud: [{ label: { en: 'L', es: 'L' }, value: '1' }], rail: <p>R</p> };
  const surface: SurfaceFocusConfig = { param: 'f', onChange: () => undefined };
  assert.match(plain([{ id: 'x', label: 'X', content: 'PX', focus: cfg }], { focus: surface }), /data-focus-enter/);
  // a config that is not a ViewFocusConfig is a type error (checked by the build)
  // @ts-expect-error hud entries need a label and a value
  const bad: ViewFocusConfig = { hud: [{ nope: 1 }] };
  void bad;
});

test('a surface without tabs has no view to focus: no control, whatever its focus', () => {
  const html = norm(renderToStaticMarkup(<SurfacePage title="Console" focus>BODY</SurfacePage>));
  assert.doesNotMatch(html, /data-focus-enter/);
});

test('Focus is one piece of code: CaseWorkbench and SurfacePage both use useFocusMode, neither keeps its own copy', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  for (const file of ['../src/workbench/CaseWorkbench.tsx', '../src/content/SurfacePage.tsx']) {
    const src = read(file);
    assert.match(src, /useFocusMode\(/, `${file} calls the shared hook`);
    assert.doesNotMatch(src, /key !== 'Escape'/, `${file} holds no Escape handler of its own`);
    assert.doesNotMatch(src, /setAttribute\('inert'/, `${file} holds no inert code of its own`);
  }
  assert.match(read('../src/shell/useFocusMode.ts'), /'Escape'/);
  assert.match(read('../src/index.ts'), /useFocusMode/, 'exported for a product with a frame of its own');
});
