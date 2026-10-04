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
  license: { en: 'MIT licence', es: 'Licencia MIT' },
  visibility: 'public',
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

test('the repository action retains an accessible destination with a renderable icon', () => {
  const html = render(base, '/');
  const link = html.match(/<a\b[^>]*href="https:\/\/github\.com\/fsantibanezleal\/probe"[^>]*>[\s\S]*?<\/a>/)?.[0];
  assert.ok(link, 'Repository link remains available');
  assert.match(link, /aria-label="[^"]+"/);
  assert.match(link, /<svg\b[^>]*aria-hidden="true"/);
});

test('the footer shows the product licence it is given, with no default (S5), and attribution is configurable', () => {
  const html = render(base, '/');
  assert.match(html, /Developed by/);
  assert.match(html, /MIT licence/);
  assert.doesNotMatch(html, /MIT licensed · open source/);
  const anonymous = render({ ...base, license: { en: 'Apache-2.0', es: 'Apache-2.0' }, footer: { attribution: false } }, '/');
  assert.doesNotMatch(anonymous, /Developed by/);
  assert.match(anonymous, /Apache-2.0/);
  const team = render({ ...base, footer: { attribution: { en: 'Maintained by the project team', es: 'Mantenido por el equipo' } } }, '/');
  assert.match(team, /Maintained by the project team/);
});

test('a private product shows no source link (S5)', () => {
  const html = render({ ...base, visibility: 'private' }, '/');
  assert.doesNotMatch(html, /github\.com\/fsantibanezleal\/probe/);
});

test('the footer carries the display version and the build id (S6)', () => {
  const html = render({ ...base, version: '0.07.000', build: 'abc1234' }, '/');
  assert.match(html, /v0\.07\.000 · abc1234/);
  assert.match(html, /data-version="0.07.000"/);
});
