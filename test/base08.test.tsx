import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatNumber, formatTicks, NBSP } from '../src/lib/format.ts';
import { BREAKPOINTS } from '../src/lib/breakpoints.ts';
import { SHELL_TOKENS } from '../src/lib/tokens.ts';
import { viewParamOf } from '../src/lib/urlView.ts';
import { CaseWorkbench } from '../src/workbench/CaseWorkbench.tsx';
import { Knob } from '../src/workbench/Controls.tsx';
import { Readout } from '../src/workbench/Readouts.tsx';
import { WorkbenchLayout } from '../src/workbench/WorkbenchLayout.tsx';
import { SurfacePage } from '../src/content/SurfacePage.tsx';
import { BarChart } from '../src/chart/BarChart.tsx';
import { fitLabel, niceStep, niceTicks, textWidth } from '../src/chart/text.ts';
import { drawMarks } from '../src/chart/UPlotChart.tsx';
import { AppShell } from '../src/shell/AppShell.tsx';

/** The 0.8.0 base (CAOS_APP_SHELL#59; CAOS_MANAGE plans/app-shell, BL-001 to BL-022), one test per promise. */

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);
const RAW = readFileSync(new URL('../styles.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/** Top-level rules (outside @media), one entry per comma-separated selector. */
function topRules(): { selector: string; body: string }[] {
  const flat = CSS.replace(/@media[^{]*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g, '');
  const out: { selector: string; body: string }[] = [];
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const s of m[1].split(/,(?![^(]*\))/)) {
      const selector = s.trim();
      if (selector && !selector.startsWith('@')) out.push({ selector, body: m[2] });
    }
  }
  return out;
}

function declared(selector: string, prop: string): string | undefined {
  let v: string | undefined;
  for (const r of topRules()) {
    if (r.selector !== selector) continue;
    const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(r.body);
    if (m) v = m[1].trim();
  }
  return v;
}

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
function palette(head: string): Record<string, string> {
  const i = RAW.indexOf(head);
  const block = RAW.slice(i, RAW.indexOf('}', i));
  return Object.fromEntries([...block.matchAll(/(--color-[a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
}

test('G13 at the source: every text colour of both themes reads at WCAG AA on every surface', () => {
  const texts = ['--color-fg', '--color-fg-subtle', '--color-fg-faint', '--color-accent', '--color-accent-2', '--color-magenta', '--color-good', '--color-warn', '--color-bad'];
  // the accent-soft highlight is a ground too: a selected row carries its tone text on it (0.9.1, Fragmenta's table)
  const grounds = ['--color-bg', '--color-surface', '--color-surface-2', '--color-accent-soft'];
  const low: string[] = [];
  for (const [name, p] of [['dark', palette(':root,\n[data-theme="dark"] {')], ['light', palette('[data-theme="light"] {')]] as const) {
    assert.ok(Object.keys(p).length >= 15, `the ${name} palette was not read`);
    for (const t of texts) for (const g of grounds) if (ratio(p[t], p[g]) < 4.5) low.push(`${name} ${t} on ${g}: ${ratio(p[t], p[g]).toFixed(2)}`);
    if (ratio(p['--color-accent'], p['--color-accent-soft']) < 4.5) low.push(`${name} accent on accent-soft`);
    if (ratio(p['--color-accent-fg'], p['--color-accent']) < 4.5) low.push(`${name} accent-fg on accent`);
  }
  assert.deepEqual(low, [], 'the faint text of 0.7 read 3.49:1 on the dark raised surface');
});

test('BL-001: one breakpoint set; the stylesheet changes layout only at 480, 760 and 900 px', () => {
  const widths = [...CSS.matchAll(/@media \(max-width: (\d+)px\)/g)].map((m) => Number(m[1]));
  assert.ok(widths.length > 5);
  const allowed = new Set([BREAKPOINTS.phone, BREAKPOINTS.compact, BREAKPOINTS.stack]);
  assert.deepEqual([...new Set(widths.filter((w) => !allowed.has(w)))], []);
  assert.equal(BREAKPOINTS.large, 1280);
});

test('BL-001: the layout, type, space, radius, icon and z-order values are tokens the token list names', () => {
  const defined = new Set([...RAW.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));
  for (const t of ['--rail-w', '--header-h', '--measure', '--measure-text', '--icon-lg', '--space-4', '--text-sm', '--radius-md', '--z-modal', '--fade']) {
    assert.ok(defined.has(t), `${t} is defined`);
    assert.ok((SHELL_TOKENS as readonly string[]).includes(t), `${t} is in SHELL_TOKENS`);
  }
  assert.equal(declared('.caos-wb', 'grid-template-columns'), 'var(--rail-w) minmax(0, 1fr)');
  assert.equal(declared('.header-inner', 'height'), 'var(--header-h)');
});

test('BL-002: a class has one plain rule (0.7 defined .tablist twice, the second overriding the first)', () => {
  // standalone rules only (`.x { ... }`); a selector list shares properties on purpose
  const flat = CSS.replace(/@media[^{]*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g, '');
  const plain = [...flat.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => /^\.[a-zA-Z][\w-]*$/.test(s));
  const twice = plain.filter((s, i) => plain.indexOf(s) !== i);
  assert.deepEqual([...new Set(twice)], []);
});

test('BL-004: a tab row never shrinks or wraps, in any flex column', () => {
  assert.equal(declared('.tablist', 'flex'), 'none');
  assert.equal(declared('.tablist', 'flex-wrap'), 'nowrap !important');
  assert.equal(declared('.subtablist', 'flex'), 'none');
  assert.equal(declared('.subtablist', 'flex-wrap'), 'nowrap');
  assert.equal(declared('.caos-wb-rail-sections', 'flex'), 'none');
});

test('BL-005 (defect 24, #55): the vertical sub-tab list is sticky', () => {
  assert.equal(declared('.subtabs-vertical > .subtablist', 'position'), 'sticky');
  assert.equal(declared('.app-shell.fixed.contain .subtabs-vertical > .subtablist', 'top'), 'var(--space-3)');
});

test('defect 26: the document clips sideways without making body a scroll container (sticky works)', () => {
  assert.match(CSS, /html, body \{ overflow-x: hidden; overflow-x: clip; \}/);
  // the release below 900 px names both forms of the contained page rule, or the :has() form keeps .page scrolling
  assert.match(CSS, /\.app-shell\.fixed\.contain > \.page, \.app-shell\.fixed\.contain > \.page:has\(> \.page-body:not\(\.caos-wb\):not\(\.caos-surface\)\) \{ display: block; overflow: visible; \}/);
});

test('BL-006 (defect 23, #54): a filling card in a views row takes an equal share', () => {
  assert.equal(declared('.caos-views-row > .caos-plot.fill', 'flex'), '1 1 0');
  assert.equal(declared('.caos-views-row > *', 'flex'), '1 1 0');
});

test('BL-007: the rail section row fades and holds the keyboard like a tab row', () => {
  const out = html(
    <WorkbenchLayout rail={[{ id: 'a', label: 'Alpha', content: 'A' }, { id: 'b', label: 'Beta', content: 'B' }]}>
      <p>instrument</p>
    </WorkbenchLayout>,
  );
  assert.match(out, /class="caos-wb-rail-sections" role="tablist"/);
  assert.match(out, /tabindex="0" class="chip on"/);
  assert.match(out, /tabindex="-1" class="chip"/);
  assert.match(CSS, /:is\([^)]*\.caos-wb-rail-sections[^)]*\)\[data-fade-end="1"\]/);
});

test('BL-008: text blocks in a document keep the reading line; figures and tables take the width', () => {
  assert.match(CSS, /\.prose :where\(p, li, blockquote, dd, \.callout\) \{ max-width: var\(--measure-text\); \}/);
  assert.equal(declared('.measure', 'max-width'), 'var(--measure)');
  assert.match(RAW, /--measure: 70ch;/);
  assert.match(RAW, /--measure-text: 78ch;/);
});

test('BL-009: lucide icons are sized by their context, never by the product', () => {
  assert.match(CSS, /\.icon-btn svg\.lucide, \.brand-mark svg\.lucide \{ width: var\(--icon-lg\); height: var\(--icon-lg\); \}/);
  assert.match(CSS, /:is\(\.tab, \.subtab, \.chip, \.btn[^)]*\) svg\.lucide \{ width: 1\.15em; height: 1\.15em; \}/);
});

test('BL-010: the frame has a skip link to main#main', () => {
  const out = html(
    <AppShell config={{ product: { name: 'P' }, links: { github: 'https://x' }, version: '0.01.000', license: 'MIT', visibility: 'public' }}>
      <p>body</p>
    </AppShell>,
  );
  assert.match(out, /^<div class="app-shell"><a class="skip-link" href="#main">Skip to the content<\/a>/);
  assert.match(out, /<main class="page" id="main" tabindex="-1">/);
});

test('BL-011: the workbench holds the open group in ?view=, and ignores a view it does not have', () => {
  assert.equal(viewParamOf(undefined), 'view');
  assert.equal(viewParamOf(true), 'view');
  assert.equal(viewParamOf('tab'), 'tab');
  assert.equal(viewParamOf(false), null);
  const render = (search: string) => {
    (globalThis as { window?: unknown }).window = { location: { search, pathname: '/', hash: '' }, history: { state: null, replaceState: () => undefined } };
    try {
      return html(
        <CaseWorkbench
          caseId="c1"
          groups={[
            { id: 'model', label: 'Model', content: 'MODEL-PANEL' },
            { id: 'validation', label: 'Validation', content: 'VALIDATION-PANEL' },
          ]}
          context={{ content: 'ctx' }}
          replayOnly
        />,
      );
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  };
  assert.match(render('?view=validation'), /VALIDATION-PANEL/);
  assert.doesNotMatch(render('?view=validation'), /MODEL-PANEL/);
  assert.match(render('?view=nothing'), /MODEL-PANEL/);
  assert.match(render('?case=c1'), /MODEL-PANEL/);
});

test('BL-003: the surface route fills the viewport with a head, a tab row and a scrolling panel', () => {
  const out = html(
    <SurfacePage title={{ en: 'Explorer', es: 'Explorador' }} lede="What it is." actions={<button type="button">Export</button>} tabs={[{ id: 'a', label: 'A', content: 'PANEL-A' }, { id: 'b', label: 'B', content: 'PANEL-B' }]} />,
  );
  assert.match(out, /class="page-body wide caos-surface" data-surface=""/);
  assert.match(out, /<h1 class="caos-surface-title">Explorer<\/h1>/);
  assert.match(out, /class="caos-surface-actions"><button/);
  assert.match(out, /class="caos-surface-body"><div class="tabs">/);
  assert.match(out, /PANEL-A/);
  assert.equal(declared('.caos-surface-body > .tabs > .tabpanel:not([hidden])', 'overflow'), 'auto');
  assert.match(CSS, /\.app-shell\.fixed\.contain > \.page:has\(> \.page-body:not\(\.caos-wb\):not\(\.caos-surface\)\)/);
  const plain = html(<SurfacePage instrument>BODY</SurfacePage>);
  assert.match(plain, /<div class="caos-surface-body" data-instrument="">BODY<\/div>/);
  assert.doesNotMatch(plain, /caos-surface-head/);
});

test('BL-012 (defect 22): a percent and a unit are joined to their number by a no-break space', () => {
  assert.equal(NBSP, ' ');
  assert.equal(formatNumber(0.1234, 'es', { percent: true, decimals: 1 }), '12,3 %');
  const knob = html(<Knob id="k" label="Rate" value={0.5} min={0} max={1} step={0.1} unit="1/d" onChange={() => undefined} />);
  assert.match(knob, /0\.5 1\/d/);
  const readout = html(<Readout lane="live" provenance="synthetic" items={[{ label: 'Peak', value: 3, unit: 'people' }]} />);
  assert.match(readout, /<span class="caos-readout-unit"> people<\/span>/);
});

test('BL-013 (defect 19): one tick notation per axis', () => {
  const mixed = formatTicks([0, 2.5e-5, 5e-5, 7.5e-5, 1e-4, 1.25e-4], 'en');
  assert.equal(mixed[0], '0');
  assert.ok(mixed.slice(1).every((t) => /E-\d+$/.test(t)), `every non-zero tick in scientific notation: ${mixed.join(' ')}`);
  assert.deepEqual(formatTicks([0, 0.5, 1], 'es'), ['0', '0,5', '1']);
  assert.deepEqual(formatTicks([1, null, 2], 'en', { decimals: 1 }), ['1.0', '', '2.0']);
  assert.equal(formatNumber(0.5, 'en', { notation: 'scientific', digits: 2 }), '5E-1');
});

test('defect 30 (#62): a year is written without a group separator when grouping is false', () => {
  for (const lang of ['en', 'es'] as const) {
    assert.equal(formatNumber(2021, lang, { decimals: 0, grouping: false }), '2021');
    assert.equal(formatNumber(2021, lang, { grouping: false }), '2021');
    assert.equal(formatNumber(2021.5, lang, { digits: 6, grouping: false }), lang === 'en' ? '2021.5' : '2021,5');
    assert.deepEqual(formatTicks([2000, 2010, 2020], lang, { decimals: 0, grouping: false }), ['2000', '2010', '2020']);
    assert.equal(formatNumber(0.1234, lang, { percent: true, decimals: 1, grouping: false }), lang === 'en' ? `12.3${NBSP}%` : `12,3${NBSP}%`);
  }
  // the default still groups: a count of people, an amount
  assert.equal(formatNumber(2021, 'en', { decimals: 0 }), '2,021');
  assert.equal(formatNumber(27345, 'es'), '27.345');
});

/** A canvas context that records what is drawn; text is 6 px a character. */
function fakePlot() {
  const calls: { op: string; text?: string; x?: number; y?: number; align?: string }[] = [];
  const ctx = {
    font: '',
    textAlign: 'right',
    textBaseline: 'middle',
    lineJoin: 'miter',
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    setLineDash: () => undefined,
    measureText: (t: string) => ({ width: t.length * 6 }),
    strokeText: (text: string, x: number, y: number) => calls.push({ op: 'halo', text, x, y }),
    fillText(text: string, x: number, y: number) {
      calls.push({ op: 'fill', text, x, y, align: this.textAlign });
    },
  };
  const u = { ctx, bbox: { left: 0, top: 0, width: 300, height: 200 }, valToPos: (x: number) => x };
  return { u, calls };
}

test('BL-013: a mark label is left-aligned, inside the plot, haloed, and never on another label', () => {
  const { u, calls } = fakePlot();
  drawMarks(u as never, [{ x: 290, label: 'near the edge' }, { x: 100, label: 'first' }, { x: 110, label: 'second' }, { x: 400, label: 'outside' }], { color: '#c80', halo: '#fff', family: 'sans-serif' });
  const fills = calls.filter((c) => c.op === 'fill');
  assert.equal(fills.length, 3, 'a mark outside the x range is not drawn');
  assert.ok(fills.every((f) => f.align === 'left'), 'every label has an explicit left alignment');
  for (const f of fills) assert.ok((f.x as number) >= 0 && (f.x as number) + (f.text as string).length * 6 <= 300, `${f.text} inside the plot`);
  const edge = fills.find((f) => f.text === 'near the edge');
  assert.ok(edge && (edge.x as number) < 290, 'a label that does not fit right of its line goes left of it');
  const first = fills.find((f) => f.text === 'first');
  const second = fills.find((f) => f.text === 'second');
  assert.ok(first && second && second.y !== first.y, 'two labels that would overlap take two rows');
  assert.equal(calls.filter((c) => c.op === 'halo').length, 3, 'every label has a halo');
});

test('BL-014 and BL-015: the text kit fits labels and rounds ticks; the bar chart declares itself for the gate', () => {
  assert.ok(textWidth('abc', 11) > 0);
  const f = fitLabel('Tamaño medio clásico, limitado al bloque in situ', 120, 11, 2);
  assert.equal(f.lines.length, 2);
  assert.ok(f.lines.every((l) => textWidth(l, 11) <= 120 + 0.5));
  assert.deepEqual(fitLabel('short', 200, 11).lines, ['short']);
  assert.equal(niceStep(0.37), 0.5);
  assert.equal(niceStep(7), 10);
  const t = niceTicks(0, 87, 400, 30);
  assert.equal(t[0], 0);
  assert.ok(t[t.length - 1] >= 87);
  assert.ok(t.length >= 3 && t.length <= 6);
  const neg = niceTicks(-0.3, 1.2, 300, 30);
  assert.ok(neg[0] <= -0.3 && neg[neg.length - 1] >= 1.2);
  const bars = html(<BarChart title="Peaks" axis={{ label: 'Peak', unit: 'people' }} data={[{ id: 'a', label: 'A', value: 3 }]} />);
  assert.match(bars, /class="caos-bars" data-drawn="0"/, 'nothing is drawn before the box has a width');
});

test('BL-016: the reserved list separates components from modifiers and reserves no stray word', () => {
  const r = JSON.parse(readFileSync(new URL('../reserved-classes.json', import.meta.url), 'utf8')) as { components: string[]; modifiers: string[]; classes: string[] };
  for (const c of ['chip', 'tablist', 'caos-plot', 'page-body', 'caos-surface', 'caos-bars', 'skip-link']) assert.ok(r.components.includes(c), `${c} is a component`);
  for (const m of ['on', 'active', 'fill', 'wide', 'compact', 'fixed', 'contain']) assert.ok(r.modifiers.includes(m), `${m} is a modifier`);
  assert.ok(!r.classes.includes('css') && !r.classes.includes('min'), 'no class read from an @import line');
  assert.deepEqual(r.classes, [...new Set([...r.components, ...r.modifiers])].sort());
});
