import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import type { ShellConfig } from '../src/shell/AppShell.tsx';

/**
 * SHF-037 (base defect BD-1, found by CEFOP_DinHot): the footer licence is a name, not a quantity.
 * A reader who chose Spanish: the stored language is read when the shell loads, so it is set before the import.
 */
(globalThis as { localStorage?: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
  getItem: (k: string) => (k === 'caos.lang' ? 'es' : null),
  setItem: () => undefined,
};

const spdx = { en: 'Apache-2.0 licence', es: 'Licencia Apache-2.0' };
const base: ShellConfig = {
  product: { name: 'Probe' },
  routes: [{ path: '/', en: 'App', es: 'App' }],
  links: { github: 'https://github.com/fsantibanezleal/probe' },
  version: '0.00.001',
  license: spdx,
  visibility: 'public',
};

async function footer(config: ShellConfig): Promise<string> {
  const { AppShell } = await import('../src/shell/AppShell.tsx');
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      <AppShell config={config}>
        <div>surface</div>
      </AppShell>
    </MemoryRouter>,
  );
  return html.slice(html.indexOf('class="footer-meta"'), html.indexOf('</footer>'));
}

test('SHF-037: the footer licence carries translate="no" on a Spanish page and marks no other footer text', async () => {
  const meta = await footer(base);
  assert.match(meta, /<span class="faint" translate="no">Licencia Apache-2\.0<\/span>/);
  assert.equal((meta.match(/translate="no"/g) ?? []).length, 1);
});

test('SHF-037: the deprecated footer.license path gets the same attribute', async () => {
  const { license: _omit, ...rest } = base;
  const meta = await footer({ ...rest, footer: { license: spdx } } as ShellConfig);
  assert.match(meta, /<span class="faint" translate="no">Licencia Apache-2\.0<\/span>/);
});
