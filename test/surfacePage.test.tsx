import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurfacePage } from '../src/content/SurfacePage';

const tabs = [{ id: 'diagram', label: 'Diagram', focus: true, content: <p>Process evidence</p> }];
const render = (document?: boolean) => renderToStaticMarkup(
  <SurfacePage title="Introduction" lede="A document introduction" tabs={tabs} focus document={document} />,
);

test('document mode marks one document root and retains tabs and Focus', () => {
  const html = render(true);
  assert.match(html, /class="page-body wide caos-surface caos-surface-doc"/);
  assert.equal((html.match(/data-doc-page=""/g) ?? []).length, 1);
  assert.equal((html.match(/page-body/g) ?? []).length, 1);
  assert.match(html, /class="caos-surface-lede lede"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /data-focus-enter=""/);
});

test('the default and false document modes preserve generic surface markup', () => {
  assert.equal(render(), render(false));
  assert.doesNotMatch(render(), /caos-surface-doc|data-doc-page/);
  assert.match(render(), /class="caos-surface-lede"/);
});
