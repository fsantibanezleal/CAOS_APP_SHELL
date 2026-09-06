import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { AppShell, type ShellConfig } from '../src/shell/AppShell.tsx';

/**
 * ADR-0071 rule 1: an app surface IS the viewport. The stylesheet has carried
 * `.app-shell.fixed` for that since the containment fix, with the note "apps that
 * fill the viewport add it", and no app could: AppShell rendered a fixed class
 * string. `fixedRoutes` is the opt-in, per route, so a product's workbench is
 * contained while its doc routes keep the document scroll.
 *
 * Server renders see the router's location, so the class decision is provable here.
 */

const base: ShellConfig = {
  product: { name: 'Probe' },
  routes: [
    { path: '/', en: 'App', es: 'App' },
    { path: '/methodology', en: 'Methodology', es: 'Metodología' },
  ],
  links: { github: 'https://github.com/fsantibanezleal/probe' },
  version: '0.00.001',
};

function render(config: ShellConfig, path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AppShell config={config}>
        <div>surface</div>
      </AppShell>
    </MemoryRouter>,
  );
}

test('a route listed in fixedRoutes gets the contained shell', () => {
  const html = render({ ...base, fixedRoutes: ['/'] }, '/');
  assert.match(html, /class="app-shell fixed"/);
});

test('a route not listed keeps the document scroll', () => {
  const html = render({ ...base, fixedRoutes: ['/'] }, '/methodology');
  assert.match(html, /class="app-shell"/);
  assert.doesNotMatch(html, /app-shell fixed/);
});

test('the root path matches exactly, never as a prefix of every route', () => {
  // '/' as a prefix would fix every route of the app; it is exact by design.
  const html = render({ ...base, fixedRoutes: ['/'] }, '/methodology');
  assert.doesNotMatch(html, /app-shell fixed/);
});

test('a non-root path matches its sub-routes', () => {
  const cfg = { ...base, fixedRoutes: ['/lab'] };
  assert.match(render(cfg, '/lab'), /app-shell fixed/);
  assert.match(render(cfg, '/lab/case-1'), /app-shell fixed/);
  assert.doesNotMatch(render(cfg, '/laboratory'), /app-shell fixed/);
});

test('fixed: true contains every route', () => {
  assert.match(render({ ...base, fixed: true }, '/methodology'), /app-shell fixed/);
});

test('without the field nothing changes for existing consumers', () => {
  assert.doesNotMatch(render(base, '/'), /app-shell fixed/);
});
