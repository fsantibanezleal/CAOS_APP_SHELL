import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { WorkbenchShell } from '../src/shell/WorkbenchShell.tsx';

test('workbench shell renders product slots, route semantics, landmark, and overlays', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/profile']}>
      <WorkbenchShell
        brand={<button type="button">CareerTwin</button>}
        routes={[
          { path: '/', label: 'Today', icon: <span>home</span> },
          { path: '/profile', label: 'Profile', icon: <span>person</span> },
        ]}
        navigationLabel="Primary navigation"
        sidebarFooter={<button type="button">Architecture</button>}
        headerLead={<button type="button">Search</button>}
        headerActions={<button type="button">Account</button>}
        overlays={<div role="dialog">Copilot</div>}
      >
        <h1>Professional profile</h1>
      </WorkbenchShell>
    </MemoryRouter>,
  );

  assert.match(html, /class="caos-workbench-shell app-shell"/);
  assert.match(html, /aria-label="Primary navigation"/);
  assert.match(html, /href="\/profile"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /class="active"/);
  assert.match(html, /id="main-content"/);
  assert.match(html, /Professional profile/);
  assert.match(html, /Architecture/);
  assert.match(html, /Search/);
  assert.match(html, /Account/);
  assert.match(html, /role="dialog"/);
});
