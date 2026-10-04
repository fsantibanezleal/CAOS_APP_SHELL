import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { Equation } from '../src/content/Equation.tsx';
import { Cite, CitationsProvider, ReferenceList } from '../src/content/Cite.tsx';
import { AppShell } from '../src/shell/AppShell.tsx';

/**
 * ADR rules the shell enforces at runtime (ADR-0078 "rules live in the base"): each violation is reported with
 * console.error, and the measured gate fails a page on any console error. One test per rule.
 */

function capture(fn: () => void): string[] {
  const seen: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    seen.push(args.map(String).join(' '));
  };
  try {
    fn();
  } finally {
    console.error = original;
  }
  return seen;
}

test('an equation without a caption is reported (ADR-0017 s2)', () => {
  assert.equal(capture(() => renderToStaticMarkup(<Equation tex="a=b" caption="Definition of a." />)).length, 0);
  const seen = capture(() => renderToStaticMarkup(<Equation tex="E = m c^2" />));
  assert.match(seen.join('\n'), /Equation without a caption/);
});

test('a citation without a doi or url, a duplicate id and an unknown Cite are reported (ADR-0017 s4)', () => {
  const seen = capture(() =>
    renderToStaticMarkup(
      <CitationsProvider
        items={[
          { id: 'a', label: 'A 2020', citation: 'A (2020)', doi: '10.1000/xyz' },
          { id: 'b', label: 'B 2021', citation: 'B (2021)' },
          { id: 'a', label: 'A again', citation: 'A (2020)', url: 'https://example.org' },
        ]}
      >
        <Cite id="a" />
        <Cite id="missing" />
      </CitationsProvider>,
    ),
  );
  const text = seen.join('\n');
  assert.match(text, /citation b has no doi or url/);
  assert.match(text, /duplicate citation id a/);
  assert.match(text, /unknown citation id missing/);
});

test('a bibliography dump is reported as banned (ADR-0017 s4)', () => {
  const seen = capture(() => renderToStaticMarkup(<ReferenceList />));
  assert.match(seen.join('\n'), /ReferenceList is banned/);
});

test('an architecture modal with fewer than five tabs is reported (ADR-0058)', () => {
  const tab = (id: string) => ({ id, en: id, es: id, body_en: 'x', body_es: 'x', svg: '<svg/>' });
  const seen = capture(() =>
    renderToStaticMarkup(
      <MemoryRouter>
        <AppShell
          config={{
            product: { name: 'P' },
            links: { github: 'https://github.com/x/y' },
            version: '0.07.000',
            architecture: { tabs: [tab('a'), tab('b'), tab('c')] },
          }}
        >
          <div />
        </AppShell>
      </MemoryRouter>,
    ),
  );
  assert.match(seen.join('\n'), /has 3 tabs; ADR-0058 requires at least 5/);
});
