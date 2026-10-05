import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatNumber } from '../src/lib/format.ts';
import { SHELL_TOKENS } from '../src/lib/tokens.ts';
import { PanelBoundary } from '../src/lib/PanelBoundary.tsx';
import { Tabs } from '../src/content/Tabs.tsx';
import { TabGroups } from '../src/content/TabGroups.tsx';
import { ChipGroup, Knob } from '../src/workbench/Controls.tsx';
import { Stage } from '../src/workbench/Stage.tsx';
import { isStale, makeStateKey } from '../src/workbench/state.ts';
import { CaseWorkbench } from '../src/workbench/CaseWorkbench.tsx';
import { PlotCard } from '../src/workbench/Readouts.tsx';
import { UPlotChart } from '../src/chart/UPlotChart.tsx';

/** The 0.7.0 base requirements (S1 to S13, S17, S18 of the 2026-10-04 failure history), one test each. */

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);

function quiet<T>(fn: () => T): T {
  const original = console.error;
  console.error = () => undefined;
  try {
    return fn();
  } finally {
    console.error = original;
  }
}

test('S8: numbers follow the interface language, and absent values read as not available', () => {
  assert.equal(formatNumber(1234.5678, 'en', { decimals: 2 }), '1,234.57');
  assert.equal(formatNumber(1234.5678, 'es', { decimals: 2 }), '1.234,57');
  assert.equal(formatNumber(0.1234, 'es', { percent: true, decimals: 1 }), '12,3 %');
  assert.equal(formatNumber(Number.NaN, 'en'), 'not available');
  assert.equal(formatNumber(null, 'es'), 'no disponible');
});

test('S4: Tabs are controllable and render only the open panel; TabGroups show the open group only', () => {
  const tabs = [
    { id: 'a', label: 'A', content: 'PANEL-A' },
    { id: 'b', label: 'B', content: 'PANEL-B' },
  ];
  const controlled = html(<Tabs tabs={tabs} value="b" onChange={() => undefined} />);
  assert.match(controlled, /PANEL-B/);
  assert.doesNotMatch(controlled, /PANEL-A/);
  const grouped = html(
    <TabGroups
      groups={[
        { id: 'g1', label: 'Model', tabs: [{ id: 'x', label: 'X', content: 'X-VIEW' }, { id: 'y', label: 'Y', content: 'Y-VIEW' }] },
        { id: 'g2', label: 'Validation', tabs: [{ id: 'z', label: 'Z', content: 'Z-VIEW' }] },
      ]}
    />,
  );
  assert.match(grouped, /X-VIEW/);
  assert.doesNotMatch(grouped, /Z-VIEW|Y-VIEW/);
  const seen: string[] = [];
  const original = console.error;
  console.error = (m: unknown) => seen.push(String(m));
  html(<Tabs tabs={Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, label: `T${i}`, content: i }))} />);
  console.error = original;
  assert.match(seen.join('\n'), /7 peer tabs/);
});

test('S3: a failing view is contained by its boundary and named', () => {
  function Boom(): React.ReactElement {
    throw new Error('planted');
  }
  // React's server renderer does not run error boundaries, so the boundary's fallback is checked directly.
  const state = PanelBoundary.getDerivedStateFromError(new Error('planted'));
  assert.equal(state.error?.message, 'planted');
  const boundary = new PanelBoundary({ panel: 'roc', children: <Boom /> });
  boundary.state = state;
  const out = quiet(() => html(boundary.render()));
  assert.match(out, /data-panel-error="roc"/);
  assert.match(out, /This view failed/);
});

test('S10: the state key is deterministic and a view on an older key is stale', () => {
  const k1 = makeStateKey({ caseId: 'c1', controls: { a: 1, b: 2 } });
  const k2 = makeStateKey({ controls: { b: 2, a: 1 }, caseId: 'c1' });
  const k3 = makeStateKey({ caseId: 'c1', controls: { a: 1, b: 3 } });
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
  assert.equal(isStale(k1, { stateKey: k3 }), true);
  assert.equal(isStale(k3, { stateKey: k3 }), false);
  assert.equal(isStale(undefined, { stateKey: k3 }), false);
  // The workbench keys the full selection: case, variant, source and controls.
  const current = makeStateKey({ caseId: 'c1', variantId: null, source: null, controls: { a: 1, b: 3 } });
  const out = html(
    <CaseWorkbench
      caseId="c1"
      controls={{ a: 1, b: 3 }}
      groups={[{ id: 'g', label: 'G', content: <PlotCard title="P" lane="live" provenance="real" dataKey={k1}>x</PlotCard> }]}
      context={{ content: 'ctx' }}
    />,
  );
  assert.match(out, new RegExp(`data-state-key="${current}"`));
  assert.match(out, /data-stale="1"/);
  assert.match(out, /Recomputing for the current selection/);
  assert.match(out, /data-case="c1"/);
});

test('S10: controls are registered for the reactivity gate', () => {
  const out = html(
    <>
      <Knob id="beta" label="Contact rate" value={0.5} min={0} max={2} step={0.01} unit="per day" onChange={() => undefined} />
      <ChipGroup id="policy" label="Policy" value="a" options={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} onChange={() => undefined} />
    </>,
  );
  assert.match(out, /data-control="beta"/);
  assert.match(out, /data-control="policy"/);
  assert.match(out, /0\.5/);
});

test('S13: a stage draws nothing until it has a size, and declares it', () => {
  const out = html(<Stage label="Phase plane">{() => <canvas data-x="drawn" />}</Stage>);
  assert.match(out, /data-drawn="0"/);
  assert.doesNotMatch(out, /data-x="drawn"/);
});

test('S12: the chart host declares its series, axis titles and drawing state', () => {
  const out = html(
    <UPlotChart x={{ values: [0, 1, 2], label: 'Day', unit: 'd' }} y={{ label: 'Infected', unit: 'people' }} series={[{ label: 'I', values: [1, 4, 2] }]} />,
  );
  assert.match(out, /data-series="1"/);
  assert.match(out, /data-axis-titles="Day\|Infected"/);
  assert.match(out, /data-drawn="0"/);
  assert.match(out, /Hover the chart to read the values/);
});

test('known defect 17: a chart of two or more series keys every series, always; one series needs no key', () => {
  const two = html(
    <UPlotChart
      x={{ values: [0, 1, 2], label: 'Day' }}
      y={{ label: 'People' }}
      series={[
        { label: 'Infected', values: [1, 4, 2], color: '--color-bad' },
        { label: { en: 'Recovered', es: 'Recuperados' }, values: [0, 1, 3], dash: [4, 4] },
        { label: 'Cases', values: [1, null, 2], mode: 'points' },
      ]}
    />,
  );
  assert.match(two, /<ul class="caos-chart-legend"/);
  assert.match(two, /--swatch:var\(--color-bad\)"[^>]*><\/span>Infected<\/li>/);
  assert.match(two, /data-dash="1"><span[^>]*><\/span>Recovered<\/li>/);
  assert.match(two, /data-mode="points"><span[^>]*><\/span>Cases<\/li>/);
  const one = html(<UPlotChart x={{ values: [0, 1], label: 'Day' }} y={{ label: 'People' }} series={[{ label: 'I', values: [1, 2] }]} />);
  assert.doesNotMatch(one, /caos-chart-legend/);
});

test('S11 and S17: the token list and the reserved-class list match the stylesheets', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const defined = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));
  assert.deepEqual([...SHELL_TOKENS].filter((t) => !defined.has(t)), []);
  const reserved = JSON.parse(readFileSync(new URL('../reserved-classes.json', import.meta.url), 'utf8')).classes as string[];
  for (const cls of ['chip', 'caos-wb', 'caos-plot', 'page-body', 'tablist', 'caos-stale-overlay']) {
    assert.ok(reserved.includes(cls), `${cls} is reserved`);
  }
});

test('S1 and S2: the stylesheet lets the document scroll, always hides [hidden], and declares color-scheme', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(css, /html, body, #root \{ height: auto; min-height: 100%; \}/);
  assert.doesNotMatch(css, /html, body, #root \{ height: 100%; \}/);
  assert.match(css, /\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /color-scheme: dark;/);
  assert.match(css, /color-scheme: light;/);
  assert.match(css, /\.main-nav \{[^}]*min-width: 0;[^}]*overflow-x: auto;/);
});

test('the App route: the rail carries the case picker, the variants and the live values, under the same state key', async () => {
  const { Readout } = await import('../src/workbench/Readouts.tsx');
  const { useWorkbenchState } = await import('../src/workbench/state.ts');
  function RailValue() {
    const { stateKey } = useWorkbenchState();
    return <Readout lane="live" provenance="synthetic" dataKey={stateKey} items={[{ label: 'Peak', value: 3, unit: 'people' }]} />;
  }
  const out = html(
    <CaseWorkbench
      caseId="c2"
      cases={{ cases: [{ id: 'c1', name: 'First' }, { id: 'c2', name: 'Second' }], selectedId: 'c2', onSelect: () => undefined, layout: 'select' }}
      variants={{ variants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], activeId: 'a', onSelect: () => undefined }}
      controls={{ k: 1 }}
      rail={<RailValue />}
      groups={[{ id: 'g', label: 'G', content: <PlotCard fill title="P" lane="live" provenance="real">x</PlotCard> }]}
      context={{ content: 'ctx' }}
    />,
  );
  const rail = out.slice(out.indexOf('data-rail'), out.indexOf('data-instrument'));
  assert.match(rail, /data-control="case"/);
  assert.match(rail, /data-control="variant"/);
  assert.match(rail, /data-readout=""/);
  assert.match(rail, /data-stale="0"/, 'the rail readout reads the workbench state key');
  assert.doesNotMatch(out.slice(out.indexOf('data-instrument')), /data-control="case"/);
  assert.match(out, /class="caos-plot fill"/);
  assert.match(out, /data-case="c2"/);
});

test('S8: a magnitude below 1e-4 is written in scientific notation, never as a row of zeros (known defect 15)', () => {
  assert.equal(formatNumber(6.53e-13, 'en'), '6.53E-13');
  assert.equal(formatNumber(7.04563e-5, 'es', { digits: 3 }), '7,05E-5');
  assert.equal(formatNumber(3.9e-205, 'en', { digits: 3 }), '3.9E-205');
  assert.equal(formatNumber(-2.5e-6, 'en'), '-2.5E-6');
  assert.equal(formatNumber(1e-7, 'en', { percent: true }), '1E-5 %');
  assert.equal(formatNumber(0, 'en'), '0');
  assert.equal(formatNumber(0.00012, 'en'), '0.00012');
  assert.ok(formatNumber(1e-300, 'en').length < 12);
  // a fixed number of decimals is the caller's explicit choice
  assert.equal(formatNumber(6.53e-13, 'en', { decimals: 4 }), '0.0000');
});

test('known defect 16: the workbench tab rows never shrink under a tall panel', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.caos-cw > \.tabs > \.tablist, \.caos-cw-panel > \.subtabs > \.subtablist \{ flex: none; \}/);
});

test('S8: a count shows every integer digit; significant digits round only the fraction', () => {
  assert.equal(formatNumber(27345, 'en'), '27,345');
  assert.equal(formatNumber(27345, 'es'), '27.345');
  assert.equal(formatNumber(1234.5678, 'en'), '1,235');
  assert.equal(formatNumber(12.3456, 'en'), '12.35');
  assert.equal(formatNumber(0.012345, 'es'), '0,01235');
});
