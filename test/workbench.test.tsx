import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { AppShell } from '../src/shell/AppShell.tsx';
import { CaseWorkbench, MAX_WORKBENCH_GROUPS } from '../src/workbench/CaseWorkbench.tsx';
import { LaneBadge } from '../src/workbench/LaneBadge.tsx';
import { Gauge, PlotCard, Readout, Verdict } from '../src/workbench/Readouts.tsx';
import { VariantBar } from '../src/workbench/VariantBar.tsx';
import { WorkbenchLayout } from '../src/workbench/WorkbenchLayout.tsx';
import { DocPage, DocSection } from '../src/content/DocPage.tsx';
import { CitationsProvider } from '../src/content/Cite.tsx';

/**
 * The workbench primitives (0.7.0) carry the structural rules of ADR-0016 §9, ADR-0017 and ADR-0071 as amended
 * 2026-10-04, so a product composes them instead of re-deriving them. Each test pins one rule.
 */

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);

test('WorkbenchLayout is the full-viewport workbench with a marked instrument (ADR-0071 rules 2 and 8)', () => {
  const out = html(<WorkbenchLayout rail={<p>controls</p>}>instrument</WorkbenchLayout>);
  assert.match(out, /class="page-body wide caos-wb"/);
  assert.match(out, /data-instrument=""/);
  assert.match(out, /<aside class="caos-wb-rail" aria-label="Controls"/);
});

test('a rail given as sections shows one section at a time, never all of them (ADR-0071 rule 6)', () => {
  const out = html(
    <WorkbenchLayout
      rail={[
        { id: 'case', label: { en: 'Case', es: 'Caso' }, content: <p>CASE-PANEL</p> },
        { id: 'policy', label: { en: 'Policy', es: 'Politica' }, content: <p>POLICY-PANEL</p> },
      ]}
    >
      x
    </WorkbenchLayout>,
  );
  assert.match(out, /CASE-PANEL/);
  assert.doesNotMatch(out, /POLICY-PANEL/);
  assert.match(out, /class="chip on"[^>]*>Case</);
});

test('CaseWorkbench orders the groups, then the comparison, then the context (ADR-0016 §9 amended)', () => {
  const out = html(
    <CaseWorkbench
      caseId="c1"
      groups={[
        { id: 'model', label: 'Model', content: 'M' },
        { id: 'validation', label: 'Validation', lane: 'live', content: 'V' },
      ]}
      compare={{ content: 'C' }}
      context={{ content: 'X' }}
    />,
  );
  const order = [...out.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(order, ['Model', 'Validation', 'Compare variants', 'Context']);
  assert.match(out, /data-group-count="4"/);
});

test('CaseWorkbench refuses more than six peer groups (ADR-0071 rule 5)', () => {
  const groups = Array.from({ length: MAX_WORKBENCH_GROUPS }, (_, i) => ({ id: `g${i}`, label: `G${i}`, content: i }));
  assert.throws(() => html(<CaseWorkbench caseId="c1" groups={groups} context={{ content: 'x' }} />), /at most 6 peers/);
});

test('VariantBar shows the count, the active regime, its note and its lane on one row', () => {
  const out = html(
    <VariantBar
      variants={[
        { id: 'a', label: 'Baseline', note: 'as observed' },
        { id: 'b', label: 'Drift', note: 'covariates shifted', lane: 'replay' },
      ]}
      activeId="b"
      onSelect={() => undefined}
      lane="live"
    />,
  );
  assert.match(out, /Variants \(2\)/);
  assert.match(out, /class="caos-chip-row"/);
  assert.match(out, /aria-checked="true" class="chip on"[^>]*>Drift</);
  assert.match(out, /covariates shifted/);
  assert.match(out, /data-lane="replay"/);
});

test('LaneBadge states the lane in the user language, English by default', () => {
  assert.match(html(<LaneBadge lane="offline" />), /Offline only/);
});

test('readouts format numbers in the interface language and show absent values honestly (S7, S8)', () => {
  const out = html(
    <>
      <Readout
        lane="live"
        provenance="real"
        items={[
          { label: 'AUC', value: 0.78134, unitless: true, better: 'higher', good: 0.75, bad: 0.6, format: { decimals: 3 } },
          { label: 'Peak', value: null, unit: 'obligors' },
        ]}
      />
      <Gauge title="PSI" value={0.12} min={0} max={0.5} unitless zones={[{ from: 0, to: 0.1, tone: 'good', label: 'little' }]} />
      <Verdict title="Opinion" code="cond" messages={{ cond: { tone: 'warn', text: 'Approve with conditions' } }} />
      <PlotCard title="ROC" lane="replay" provenance="synthetic">chart</PlotCard>
    </>,
  );
  assert.match(out, /0.781/);
  assert.match(out, /tone-good/);
  assert.match(out, /not available/);
  assert.match(out, /role="meter"[^>]*aria-valuenow="0.12"/);
  assert.match(out, /data-verdict="warn"/);
  assert.match(out, /Approve with conditions/);
  assert.match(out, /class="caos-plot"[^>]*data-lane="replay"[^>]*data-provenance="synthetic"/);
});

test('DocSection ends in its own references, and a section without them must say why (ADR-0017 §4)', () => {
  const cites = [{ id: 'basel2005', label: 'BCBS 2005', citation: 'BCBS (2005)', url: 'https://www.bis.org/publ/bcbs_wp14.htm' }];
  const out = html(
    <CitationsProvider items={cites}>
      <DocPage title="Methodology" lede="What it is">
        <DocSection title="Calibration" refs={['basel2005']}>
          text
        </DocSection>
        <DocSection title="Notation">symbols</DocSection>
      </DocPage>
    </CitationsProvider>,
  );
  assert.match(out, /class="page-body prose caos-doc"/);
  assert.match(out, /class="th-refs"/);
  assert.match(out, /data-no-refs-reason="missing"/);
});

test('ShellConfig.contain makes every route the viewport', () => {
  const out = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/methodology']}>
      <AppShell config={{ product: { name: 'P' }, links: { github: 'https://github.com/x/y' }, version: '0.07.000', license: 'MIT', visibility: 'public', contain: true }}>
        <div />
      </AppShell>
    </MemoryRouter>,
  );
  assert.match(out, /class="app-shell fixed contain"/);
});

test('STANDARD_ROUTES are the six product routes in order', async () => {
  const { STANDARD_ROUTES } = await import('../src/shell/routes.ts');
  assert.deepEqual(
    STANDARD_ROUTES.map((r) => r.path),
    ['/', '/introduction', '/methodology', '/implementation', '/experiments', '/benchmark'],
  );
});

test('THEME_BOOT_SCRIPT is a self-contained expression that sets the theme and the language', async () => {
  const { THEME_BOOT_SCRIPT } = await import('../src/lib/theme.ts');
  assert.match(THEME_BOOT_SCRIPT, /dataset\.theme/);
  assert.match(THEME_BOOT_SCRIPT, /documentElement\.lang/);
  assert.doesNotThrow(() => new Function(THEME_BOOT_SCRIPT));
});
