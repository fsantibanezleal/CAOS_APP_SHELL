// The gate's fixture (G15): a small real product built on this shell's sources, clean by default. The self-test
// serves it as GitHub Pages would and runs the gate on it, once clean (every check must pass in the full matrix) and
// once per planted defect (the check that owns the defect must fail). `window.__PLANT__` names the plant.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import 'katex/dist/katex.min.css';
import '../../styles.css';
import '../../chart.css';
import {
  AppShell,
  BarChart,
  CaseWorkbench,
  ChipGroup,
  CitationsProvider,
  DocPage,
  Knob,
  PlotCard,
  Readout,
  Landing,
  SurfacePage,
  STANDARD_ROUTES,
  Stage,
  SubTabs,
  ViewsRow,
  pick,
  useShellLang,
  useThemeTokens,
  useWorkbenchState,
  type ShellConfig,
} from '../../src/index';
import { UPlotChart } from '../../src/chart';
import { fixtureDoc } from './docs';

declare global {
  interface Window {
    __PLANT__?: string;
  }
}
const PLANT = window.__PLANT__ ?? '';
/** The surface App (shell 0.16.0): the plant `surface` is its clean run, `surface-*` its defects; `/console` is its route. */
const SURFACE = PLANT === 'surface' || PLANT.startsWith('surface-');
/** The first consumer's shape (CAOS_Neuraxis): a headless surface (no title, lede or actions) that holds its view in `?mode=`. */
const HEADLESS = PLANT === 'surface-headless' || PLANT === 'surface-headless-head' || PLANT === 'surface-mode-url-dropped' || PLANT === 'surface-empty-head';
/** A surface whose focus configuration renames the parameter (`SurfaceFocusConfig.param`): clean, and with the parameter left after the return. */
const FPARAM = PLANT === 'surface-fparam' || PLANT === 'surface-fparam-left' ? 'f' : undefined;
/** A surface with one view that has a stage (the plant of Escape on the only focusable view). */
const ONE_STAGE = PLANT === 'surface-focus-escape-one-view';
/** Twenty lines of note for the stage-floor plant. */
const STAGE_FLOOR_NOTE = {
  en: Array.from({ length: 20 }, (_, i) => `Line ${i + 1} of a long note the requirements ask for.`).join('\n'),
  es: Array.from({ length: 20 }, (_, i) => `Línea ${i + 1} de una nota larga que piden los requisitos.`).join('\n'),
};

/**
 * Plants of shell 0.14.0 that damage the rendered page: `mutate` is idempotent and runs now and after every change of the
 * document (a sub-tab switch, a language switch), so the defect is there whenever the gate looks.
 */
function plantDom(mutate: () => void): () => void {
  mutate();
  const observer = new MutationObserver(() => {
    observer.disconnect();
    mutate();
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true });
  return () => observer.disconnect();
}
const WORDS = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty';
function flipPlant(plant: string): (() => void) | undefined {
  // shell 0.19.0 (G20): a chart that loses a part of Tier A after the shell drew it (a product script, a stylesheet): its tab stop, its name, its data
  // table, or a keyboard handler of the product that takes the zoom key
  if (plant === 'chart-not-focusable' || plant === 'chart-no-name' || plant === 'chart-no-table' || plant === 'chart-no-reset') {
    return plantDom(() => {
      for (const stop of document.querySelectorAll<HTMLElement>('[data-chart-focus]')) {
        if (plant === 'chart-not-focusable') stop.removeAttribute('tabindex');
        if (plant === 'chart-no-name') stop.removeAttribute('aria-label');
        if (plant === 'chart-no-table') stop.setAttribute('aria-describedby', (stop.getAttribute('aria-describedby') ?? '').split(' ')[0]);
        if (plant === 'chart-no-reset' && !stop.dataset.swallow) {
          stop.dataset.swallow = '1';
          stop.addEventListener('keydown', (e) => e.stopPropagation(), true);
        }
      }
    });
  }
  // shell 0.17.0 round 3: a product stylesheet that clamps the case select's text to two lines (the name is three lines; `select-focus-rail` clamps
  // only the Focus rail's), and a display that shows another name than the one the native select holds
  if (plant === 'select-cut' || plant === 'select-cut-token' || plant === 'select-focus-rail') {
    const scope = plant === 'select-focus-rail' ? '[data-focus-shell] ' : '';
    const style = document.createElement('style');
    style.textContent = `${scope}.cs-select-text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }`;
    document.head.append(style);
    return () => style.remove();
  }
  // a product stylesheet that clamps the display's box (not its text) to one line's height on a three-line name
  if (plant === 'select-cut-display') {
    const style = document.createElement('style');
    style.textContent = '.cs-select-display { height: 30px !important; min-height: 0 !important; overflow: hidden; }';
    document.head.append(style);
    return () => style.remove();
  }
  if (plant === 'select-display-stale') {
    return plantDom(() => {
      for (const t of document.querySelectorAll('.cs-select-text')) if (t.textContent !== 'A planted stale display name') t.textContent = 'A planted stale display name';
    });
  }
  // review of 0.17.0 (M1): a select of the product's own (a plain select, without the shell's display) whose text fits its content box by 2px
  // but ends under the native arrow
  if (plant === 'select-arrow') {
    return plantDom(() => {
      for (const sel of document.querySelectorAll<HTMLSelectElement>('[data-rail] select[data-plant-select]')) {
        const cs = getComputedStyle(sel);
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const text = (sel.selectedOptions[0]?.textContent ?? '').trim();
        const box = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
        sel.style.maxWidth = 'none';
        sel.style.width = `${ctx.measureText(text).width + box + 2}px`;
      }
    });
  }
  if (plant === 'flip-back-long') {
    // a back far over the limit of forty words
    return plantDom(() => {
      for (const c of document.querySelectorAll('[data-flip-content]')) {
        if (!c.querySelector('[data-plant]')) {
          const x = document.createElement('p');
          x.setAttribute('data-plant', '');
          x.textContent = `${WORDS} ${WORDS} ${WORDS}`;
          c.append(x);
        }
      }
    });
  }
  if (plant === 'flip-title-long') {
    return plantDom(() => {
      for (const t of document.querySelectorAll('[data-flip-title]')) {
        if (!t.querySelector('[data-plant]')) {
          const x = document.createElement('span');
          x.setAttribute('data-plant', '');
          x.textContent = ` ${WORDS}`;
          t.append(x);
        }
      }
    });
  }
  if (plant === 'flip-no-keyboard') {
    // the face is a div that looks like the button and takes no focus and no key
    return plantDom(() => {
      for (const b of document.querySelectorAll('button[data-flip-toggle="front"]')) {
        const d = document.createElement('div');
        d.className = b.className;
        d.setAttribute('data-flip-toggle', 'front');
        d.setAttribute('aria-expanded', 'false');
        d.innerHTML = b.innerHTML;
        d.addEventListener('click', () => undefined);
        b.replaceWith(d);
      }
    });
  }
  if (plant === 'flip-hidden-face') {
    // the closed back stays in sight, in the tab order and in the accessibility tree
    const style = document.createElement('style');
    style.textContent = '[data-flip-back], [data-flip-front], .caos-flip-back { visibility: visible !important; }';
    document.head.append(style);
    const stop = plantDom(() => {
      for (const b of document.querySelectorAll('[data-flip-back]')) {
        b.removeAttribute('aria-hidden');
        b.removeAttribute('inert');
      }
    });
    return () => {
      stop();
      style.remove();
    };
  }
  if (plant === 'carousel-sideways') {
    // the cards stay side by side at a width of their own: the carousel pushes past its box and the page
    const style = document.createElement('style');
    style.textContent =
      '[data-card-deck] > [data-deck-track] { display: flex !important; width: max-content !important; }' +
      '[data-card-deck] [data-deck-card], [data-card-deck] [data-deck-card][hidden] { display: flex !important; flex: none; width: 420px; }';
    document.head.append(style);
    return () => style.remove();
  }
  if (plant === 'flip-content-never-shows') {
    // the back turns and shows nothing
    const style = document.createElement('style');
    style.textContent = '.caos-flip-content { display: none !important; }';
    document.head.append(style);
    return () => style.remove();
  }
  if (plant === 'flip-hidden-focusable') {
    // the closed back keeps aria-hidden but is neither inert nor hidden: a keyboard still lands on its button
    const style = document.createElement('style');
    style.textContent = '[data-flip-back] { visibility: visible !important; }';
    document.head.append(style);
    const stop = plantDom(() => {
      for (const b of document.querySelectorAll('[data-flip-back][inert]')) b.removeAttribute('inert');
    });
    return () => {
      stop();
      style.remove();
    };
  }
  if (plant === 'carousel-no-controls') {
    // the carousel hides card 5 and draws no controls
    const style = document.createElement('style');
    style.textContent = '.caos-deck-bar { display: none !important; }';
    document.head.append(style);
    return () => style.remove();
  }
  if (plant === 'anim-img-no-block') {
    // a documentation figure drawn by an img of an animated SVG with no reduced-motion block
    return plantDom(() => {
      const host = document.querySelector('main .page-body');
      if (host && !host.querySelector('[data-plant-figure]')) {
        const f = document.createElement('figure');
        f.setAttribute('data-plant-figure', '');
        f.innerHTML = '<img src="/animated-figure.svg" alt="An animated figure" width="200" height="100"><figcaption>An animated figure with no reduced-motion block.</figcaption>';
        host.append(f);
      }
    });
  }
  if (plant === 'focus-not-isolated') {
    // the App behind Focus mode stays in the tab order
    return plantDom(() => {
      for (const e of document.querySelectorAll('[inert]')) if (!e.closest('[data-focus-shell]') && !e.closest('[data-flip-card]')) e.removeAttribute('inert');
    });
  }
  if (plant === 'focus-enter-inside') {
    // the Focus control shows inside the Focus frame's rail
    return plantDom(() => {
      const rail = document.querySelector('[data-focus-shell] .caos-focus-rail-body');
      if (rail && !rail.querySelector('[data-focus-enter]')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn caos-focus-enter';
        b.setAttribute('data-focus-enter', '');
        b.textContent = 'Focus';
        rail.prepend(b);
      }
    });
  }
  if (plant === 'focus-nested-main') {
    return plantDom(() => {
      const shell = document.querySelector('[data-focus-shell]');
      if (shell && !shell.querySelector('[data-plant-main]')) {
        const m = document.createElement('main');
        m.setAttribute('data-plant-main', '');
        shell.append(m);
      }
    });
  }
  if (plant === 'carousel-stuck') {
    // the next button does nothing
    return plantDom(() => {
      for (const b of document.querySelectorAll('[data-deck-next]')) {
        if (!b.hasAttribute('data-plant')) {
          b.setAttribute('data-plant', '');
          b.addEventListener('click', (e) => e.stopPropagation(), true);
        }
      }
    });
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------- the model (SIR)
interface Sim {
  t: number[];
  S: number[];
  I: number[];
  R: number[];
  peak: number;
  peakDay: number;
}
function simulate(beta: number, days: number, gamma = 0.1, n = 1000): Sim {
  let s = n - 1;
  let i = 1;
  let r = 0;
  const out: Sim = { t: [], S: [], I: [], R: [], peak: 0, peakDay: 0 };
  const dt = 0.25;
  for (let d = 0; d <= days; d += 1) {
    out.t.push(d);
    out.S.push(s);
    out.I.push(i);
    out.R.push(r);
    if (i > out.peak) {
      out.peak = i;
      out.peakDay = d;
    }
    for (let k = 0; k < 1 / dt; k += 1) {
      const inf = (beta * s * i) / n;
      const rec = gamma * i;
      s -= inf * dt;
      i += (inf - rec) * dt;
      r += rec * dt;
    }
  }
  return out;
}

const CASES = [
  { id: 'c-low', name: 'Low contact', category: 'Outbreaks', beta: 0.22 },
  { id: 'c-mid', name: 'Medium contact', category: 'Outbreaks', beta: 0.35 },
  { id: 'c-high', name: 'High contact', category: 'Outbreaks', beta: 0.55 },
];
const VARIANTS = [
  { id: 'base', label: { en: 'Baseline', es: 'Base' }, note: { en: 'Contact rate as published.', es: 'Tasa de contacto publicada.' } },
  { id: 'stress', label: { en: 'Stress', es: 'Estrés' }, note: { en: 'Contact rate 30% higher.', es: 'Tasa de contacto 30% mayor.' } },
];

// -------------------------------------------------------------------------------------------------- the views
function LiveValues({ sim }: { sim: Sim }) {
  const { stateKey } = useWorkbenchState();
  return (
    <Readout
      title={{ en: 'Live values', es: 'Valores en vivo' }}
      lane="live"
      provenance="synthetic"
      dataKey={stateKey}
      items={[
        { label: { en: 'Peak infected', es: 'Pico de infectados' }, value: sim.peak, unit: 'people', format: { decimals: 0 } },
        { label: { en: 'Peak day', es: 'Día del pico' }, value: sim.peakDay, unit: 'd', format: { decimals: 0 } },
        { label: { en: 'Recovered at the end', es: 'Recuperados al final' }, value: sim.R[sim.R.length - 1], unit: 'people', format: { decimals: 0 } },
      ]}
    />
  );
}

function ModelView({ sim }: { sim: Sim }) {
  const { stateKey } = useWorkbenchState();
  const frozen = useRef(stateKey);
  const key = PLANT === 'stuck-view' ? frozen.current : stateKey;
  return (
    <>
      <PlotCard
        fill
        title={{ en: 'Epidemic curves', es: 'Curvas epidémicas' }}
        lane="live"
        provenance="synthetic"
        dataKey={key}
        note={PLANT === 'stage-floor' ? STAGE_FLOOR_NOTE : undefined}
      >
        {PLANT === 'small' ? (
          <SmallCanvas />
        ) : PLANT === 'blank' ? (
          <Stage label="Curves">{(sz) => <canvas width={sz.width} height={sz.height} style={{ display: 'block' }} />}</Stage>
        ) : PLANT === 'repeat-ticks' ? (
          // a short integer axis formatted by one significant digit: uPlot ticks every quarter, and 1.5 reads "2"
          <UPlotChart
            height="fill"
            x={{ values: [1, 2, 3, 4], label: { en: 'Grade', es: 'Grado' }, format: { digits: 1 } }}
            y={{ label: { en: 'Share', es: 'Fracción' } }}
            series={[{ label: { en: 'Planted', es: 'Plantada' }, values: [0.1, 0.2, 0.4, 0.8], color: '--color-accent' }]}
          />
        ) : PLANT === 'bar-repeat-ticks' ? (
          // shell 0.19.0: a bar chart whose value axis is formatted by one significant digit: the tick at 1.5 reads "2" beside the tick at 2,
          // and the bar chart declares its repeated labels for G6 as the line chart does
          <BarChart
            title={{ en: 'Planted bars', es: 'Barras plantadas' }}
            height="fill"
            axis={{ label: { en: 'Share', es: 'Fracción' }, format: { digits: 1 } }}
            data={[0.5, 1, 1.5, 2].map((value, i) => ({ id: `b${i}`, label: `Bar ${i + 1}`, value }))}
          />
        ) : (
          <UPlotChart
            height="fill"
            zoomOff={PLANT === 'zoom-off-unexplained' ? 'no' : undefined}
            x={{ values: sim.t, label: { en: 'Day', es: 'Día' }, unit: 'd' }}
            y={{ label: { en: 'People', es: 'Personas' } }}
            series={[
              { label: { en: 'Susceptible', es: 'Susceptibles' }, values: sim.S, color: '--color-accent' },
              { label: { en: 'Infected', es: 'Infectados' }, values: sim.I, color: '--color-bad' },
              { label: { en: 'Recovered', es: 'Recuperados' }, values: sim.R, color: '--color-good' },
            ]}
            marks={[{ x: sim.peakDay, label: { en: 'peak', es: 'pico' } }]}
          />
        )}
      </PlotCard>
    </>
  );
}

function SmallCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#c33';
    ctx.fillRect(0, 0, 160, 120);
  }, []);
  return <canvas ref={ref} width={160} height={120} />;
}

function PhaseCanvas({ sim, width, height }: { sim: Sim; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const tok = useThemeTokens();
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = tok['--color-border'];
    ctx.strokeRect(24, 8, width - 32, height - 32);
    ctx.fillStyle = tok['--color-fg-subtle'];
    ctx.font = '11px sans-serif';
    ctx.fillText('S', width / 2, height - 6);
    ctx.fillText('I', 8, height / 2);
    const maxI = Math.max(...sim.I) || 1;
    ctx.strokeStyle = tok['--color-magenta'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    sim.S.forEach((s, k) => {
      const x = 24 + ((1000 - s) / 1000) * (width - 32);
      const y = 8 + (1 - sim.I[k] / maxI) * (height - 40);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [sim, width, height, tok]);
  return <canvas ref={ref} width={width} height={height} style={{ display: 'block' }} />;
}

function ValidationView({ sim, focusOn }: { sim: Sim; focusOn?: boolean }) {
  const lang = useShellLang();
  const { stateKey } = useWorkbenchState();
  const rows = [10, 30, 60, 90, 120].filter((d) => d < sim.t.length);
  return (
    <SubTabs
      ariaLabel={pick({ en: 'Validation views', es: 'Vistas de validación' }, lang)}
      tabs={[
        // the plant that loses the sub-view: in Focus the row has another first tab, so the view memory (keyed on the ids) finds no entry
        ...(PLANT === 'focus-drops-subview' && focusOn ? [{ id: 'planted', label: 'Planted', content: <p>planted first tab</p> }] : []),
        {
          id: 'phase',
          label: pick({ en: 'Phase plane', es: 'Plano de fase' }, lang),
          content: (
            <PlotCard fill title={{ en: 'Infected against susceptible', es: 'Infectados contra susceptibles' }} lane="live" provenance="synthetic" dataKey={stateKey}>
              <Stage label={{ en: 'Phase plane', es: 'Plano de fase' }}>{(sz) => <PhaseCanvas sim={sim} width={sz.width} height={sz.height} />}</Stage>
            </PlotCard>
          ),
        },
        {
          id: 'table',
          label: pick({ en: 'Checkpoints', es: 'Puntos de control' }, lang),
          content: (
            <>
              <PlotCard title={{ en: 'State at checkpoints', es: 'Estado en puntos de control' }} lane="live" provenance="synthetic" dataKey={stateKey}>
                <table className="caos-table">
                  <thead>
                    <tr>
                      <th>{pick({ en: 'Day', es: 'Día' }, lang)}</th>
                      <th>S</th>
                      <th>I</th>
                      <th>R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((d) => (
                      <tr key={d} style={d === 60 ? { background: 'var(--color-accent-soft)', color: 'var(--color-good)' } : undefined}>
                        <td>{d}</td>
                        <td>{sim.S[d].toFixed(0)}</td>
                        <td>{sim.I[d].toFixed(0)}</td>
                        <td>{sim.R[d].toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PlotCard>
              <PlotCard fill title={{ en: 'Infected at checkpoints', es: 'Infectados en puntos de control' }} lane="live" provenance="synthetic" dataKey={stateKey}>
                <Stage label={{ en: 'Checkpoint bars', es: 'Barras de control' }}>
                  {({ width, height }) => {
                    const max = Math.max(...rows.map((d) => sim.I[d])) || 1;
                    const bw = (width - 48) / rows.length;
                    return (
                      <svg width={width} height={height} role="img" aria-label="checkpoints">
                        <line x1={32} y1={height - 22} x2={width - 8} y2={height - 22} stroke="var(--color-border)" />
                        {PLANT === 'label-cut' && (
                          <text x={width - 24} y={16} fontSize={11} fill="var(--color-fg-subtle)">
                            planted label past the edge
                          </text>
                        )}
                        {PLANT === 'label-overlap' && (
                          <>
                            <text x={60} y={16} fontSize={11} fill="var(--color-fg-subtle)">
                              first planted label
                            </text>
                            <text x={70} y={18} fontSize={11} fill="var(--color-fg-subtle)">
                              second planted label
                            </text>
                          </>
                        )}
                        {rows.map((d, k) => {
                          const h = ((height - 44) * sim.I[d]) / max;
                          return (
                            <g key={d}>
                              <rect x={40 + k * bw} y={height - 22 - h} width={bw - 16} height={h} fill="var(--color-bad)" />
                              {h > 18 && (
                                <text x={40 + k * bw + (bw - 16) / 2} y={height - 22 - h + 13} textAnchor="middle" fontSize={10} fill="var(--color-bg)">
                                  {sim.I[d].toFixed(0)}
                                </text>
                              )}
                              <text x={40 + k * bw + (bw - 16) / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--color-fg-subtle)">
                                {d}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    );
                  }}
                </Stage>
              </PlotCard>
              {PLANT === 'deep-defect' && <div style={{ width: 3000, height: 12, flex: 'none' }}>planted wide block</div>}
            </>
          ),
        },
        {
          // a weighted row (ViewsRow, 0.9.0): a parity plot over x that is not sorted, with a reference line and a selected
          // point (0.10.0), beside a log-x curve
          id: 'fit',
          label: pick({ en: 'Fit', es: 'Ajuste' }, lang),
          content: (
            <ViewsRow shares={[3, 2]}>
              <PlotCard fill title={{ en: 'Infected, model against simulation', es: 'Infectados, modelo contra simulación' }} lane="live" provenance="synthetic" dataKey={stateKey}>
                <UPlotChart
                  parity
                  height="fill"
                  x={{ values: rows.map((d) => sim.I[d]), label: { en: 'Simulated', es: 'Simulado' }, unit: { en: 'people', es: 'personas' }, format: { decimals: 0 } }}
                  y={{ label: { en: 'Model', es: 'Modelo' }, unit: { en: 'people', es: 'personas' }, format: { decimals: 0 } }}
                  series={[
                    { label: { en: 'Checkpoints', es: 'Puntos de control' }, values: rows.map((d, k) => (k === 0 ? null : sim.I[d] * 1.04 + 2)), mode: 'points' },
                    { label: { en: 'The first checkpoint', es: 'El primer punto de control' }, values: rows.map((d, k) => (k === 0 ? sim.I[d] * 1.04 + 2 : null)), mode: 'points', size: 14, color: '--color-warn' },
                  ]}
                  yMarks={[{ y: rows.reduce((a, d) => a + sim.I[d], 0) / Math.max(1, rows.length), label: { en: 'mean', es: 'media' } }]}
                  onPick={() => undefined}
                />
              </PlotCard>
              <>
                <PlotCard fill title={{ en: 'Recovered on a log time axis', es: 'Recuperados en un eje de tiempo logarítmico' }} lane="live" provenance="synthetic" dataKey={stateKey}>
                  <UPlotChart
                    height="fill"
                    x={{ values: sim.t.slice(1), label: { en: 'Day', es: 'Día' }, unit: 'd', log: true }}
                    y={{ label: { en: 'People', es: 'Personas' }, format: { decimals: 0 } }}
                    series={[{ label: { en: 'Recovered', es: 'Recuperados' }, values: sim.R.slice(1) }]}
                    // reference lines in every tone (0.11.0), one above the data and one below it: the range takes them in
                    yMarks={[
                      { y: Math.max(...sim.R) * 1.2, label: { en: 'red level', es: 'nivel rojo' }, tone: 'bad' },
                      { y: Math.max(...sim.R) * 0.6, label: { en: 'target', es: 'meta' }, tone: 'good' },
                      { y: -Math.max(...sim.R) * 0.1, label: { en: 'no bias', es: 'sin sesgo' }, tone: 'neutral' },
                      { y: Math.max(...sim.R) * 0.3, label: { en: 'amber level', es: 'nivel ámbar' } },
                    ]}
                  />
                </PlotCard>
                <PlotCard
                  fill
                  title={{ en: 'Recovered at checkpoints, with a note', es: 'Recuperados en puntos de control, con una nota' }}
                  lane="live"
                  provenance="synthetic"
                  dataKey={stateKey}
                  note={{
                    en: 'Two filling cards share this short column: each keeps the stage floor, the note keeps at most a third of its card and scrolls beyond it, and the panel scrolls when the cards do not fit.',
                    es: 'Dos tarjetas que llenan comparten esta columna corta: cada una conserva el piso del escenario, la nota ocupa a lo más un tercio de su tarjeta y se desplaza más allá, y el panel se desplaza cuando las tarjetas no caben.',
                  }}
                >
                  <UPlotChart
                    height="fill"
                    x={{ values: rows.map((d) => d), label: { en: 'Day', es: 'Día' }, unit: 'd', format: { decimals: 0 } }}
                    y={{ label: { en: 'People', es: 'Personas' }, format: { decimals: 0 } }}
                    series={[{ label: { en: 'Recovered', es: 'Recuperados' }, values: rows.map((d) => sim.R[d]) }]}
                  />
                </PlotCard>
              </>
            </ViewsRow>
          ),
        },
        {
          // a panel taller than the instrument scrolls; the tab rows above it keep their height (known shell defect 16)
          id: 'daily',
          label: pick({ en: 'Every day', es: 'Cada día' }, lang),
          content: (
            <PlotCard title={{ en: 'State on every fifth day', es: 'Estado cada cinco días' }} lane="live" provenance="synthetic" dataKey={stateKey}>
              <table className="caos-table">
                <thead>
                  <tr>
                    <th>{pick({ en: 'Day', es: 'Día' }, lang)}</th>
                    <th>S</th>
                    <th>I</th>
                    <th>R</th>
                    <th>{pick({ en: 'Susceptible people', es: 'Personas susceptibles' }, lang)}</th>
                    <th>{pick({ en: 'Infected people', es: 'Personas contagiadas' }, lang)}</th>
                    <th>{pick({ en: 'Recovered people', es: 'Personas recuperadas' }, lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.t
                    .filter((d) => d % 5 === 0)
                    .map((d) => (
                      <tr key={d}>
                        <td>{d}</td>
                        <td>{sim.S[d].toFixed(0)}</td>
                        <td>{sim.I[d].toFixed(0)}</td>
                        <td>{sim.R[d].toFixed(0)}</td>
                        <td>{sim.S[d].toFixed(0)}</td>
                        <td>{sim.I[d].toFixed(0)}</td>
                        <td>{sim.R[d].toFixed(0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </PlotCard>
          ),
        },
        {
          // the chart forms of 0.17.0: decade labels on a log x axis, draggable lines, points on their own x
          id: 'forms',
          label: pick({ en: 'Forms', es: 'Formas' }, lang),
          content: <FormsView />,
        },
        {
          // the chart forms of 0.18.0: named x ticks over an x range, a key that solos a series, dots on a short line, a reference
          // line without a label
          id: 'categories',
          label: pick({ en: 'Categories', es: 'Categorías' }, lang),
          content: <CategoriesView />,
        },
      ]}
    />
  );
}

/** The forms of the chart added in 0.17.0 (CAOS_APP_SHELL#65): a log x axis labelled at its decades, a draggable reference
 * line, measured points on their own x, and marks that keep apart on a log axis. A synthetic size distribution (Rosin-Rammler). */
function FormsView() {
  const lang = useShellLang();
  const { stateKey } = useWorkbenchState();
  const [level, setLevel] = useState(50);
  const [limit, setLimit] = useState(80);
  const sizes = useMemo(() => [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10], []);
  const model = useMemo(() => sizes.map((d) => 100 * (1 - Math.exp(-((d / 0.4) ** 1.2)))), [sizes]);
  const measured = useMemo(() => ({ x: [0.015, 0.07, 0.3, 3], y: [3, 19, 51, 99] }), []);
  return (
    <ViewsRow shares={[3, 2]}>
      <PlotCard fill title={{ en: 'Passing against size, on a log axis', es: 'Pasante contra tamaño, en un eje logarítmico' }} lane="live" provenance="synthetic" dataKey={stateKey}>
        <UPlotChart
          height="fill"
          x={{ values: sizes, label: { en: 'Size', es: 'Tamaño' }, unit: 'm', log: true }}
          y={{ label: { en: 'Passing', es: 'Pasante' }, unit: '%', range: [0, 100], format: { decimals: 0 } }}
          series={[
            { label: { en: 'Model', es: 'Modelo' }, values: model },
            { label: { en: 'Measured', es: 'Medido' }, values: measured.y, x: measured.x, mode: 'points', color: '--color-bad' },
          ]}
          marks={[
            { x: 0.6, label: { en: 'target 60 cm', es: 'meta 60 cm' } },
            { x: 1, label: { en: 'limit 100 cm', es: 'límite 100 cm' } },
          ]}
          yMarks={[{ y: level, label: { en: `P${Math.round(level)}`, es: `P${Math.round(level)}` }, tone: 'neutral', drag: { min: 5, max: 95, step: 1 } }]}
          onYMarkChange={(_i, y) => setLevel(y)}
        />
      </PlotCard>
      <PlotCard fill title={{ en: 'A limit to move, on a log axis', es: 'Un límite que se mueve, en un eje logarítmico' }} lane="live" provenance="synthetic" dataKey={stateKey}>
        <UPlotChart
          height="fill"
          x={{ values: sizes, label: { en: 'Size', es: 'Tamaño' }, unit: 'm', log: true }}
          y={{ label: { en: 'Passing', es: 'Pasante' }, unit: '%', range: [0, 100], format: { decimals: 0 } }}
          series={[{ label: { en: 'Model', es: 'Modelo' }, values: model }]}
          yMarks={[{ y: limit, label: pick({ en: `limit ${Math.round(limit)} %`, es: `límite ${Math.round(limit)} %` }, lang), tone: 'bad', drag: { min: 50, max: 99, step: 1 } }]}
          onYMarkChange={(_i, y) => setLimit(y)}
        />
      </PlotCard>
    </ViewsRow>
  );
}

/** The forms of the chart added in 0.18.0 (CAOS_Fragmenta 0.09.000, BL-042): named x ticks with an x range and dots on three values,
 * a key that solos one of five crossing lines, and a zero line with no label beside a labelled level. The plant
 * `named-ticks-repeat` gives two neighbouring ticks the same name and `named-ticks-far` gives the first and the last the same name (A, B, A); the gate's repeated-label check (G6) fails both. */
function CategoriesView() {
  const { stateKey } = useWorkbenchState();
  const names = PLANT === 'named-ticks-repeat' ? ['random', 'deduplicated', 'deduplicated'] : PLANT === 'named-ticks-far' ? ['random', 'deduplicated', 'random'] : ['random', 'deduplicated', 'site held out'];
  const spanish = PLANT === 'named-ticks-repeat' ? ['aleatorio', 'deduplicado', 'deduplicado'] : PLANT === 'named-ticks-far' ? ['aleatorio', 'deduplicado', 'aleatorio'] : ['aleatorio', 'deduplicado', 'sitio retenido'];
  const protocols = [
    { value: 0, label: { en: names[0], es: spanish[0] } },
    { value: 1, label: { en: names[1], es: spanish[1] } },
    { value: 2, label: { en: names[2], es: spanish[2] } },
  ];
  const days = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8], []);
  const lines = useMemo(
    () => [
      { en: 'Alpha', es: 'Alfa', k: 0.6 },
      { en: 'Beta', es: 'Beta', k: 0.9 },
      { en: 'Gamma', es: 'Gama', k: 1.2 },
      { en: 'Delta', es: 'Delta', k: 1.5 },
      { en: 'Epsilon', es: 'Épsilon', k: 1.8 },
    ].map((l) => ({ label: { en: l.en, es: l.es }, values: days.map((d) => 10 + (d - 4) * (3 - l.k) * 2 + l.k * 3) })),
    [days],
  );
  return (
    <ViewsRow shares={[3, 2]}>
      <>
        <PlotCard fill title={{ en: 'Error by protocol, with named ticks', es: 'Error por protocolo, con marcas con nombre' }} lane="live" provenance="synthetic" dataKey={stateKey}>
          <UPlotChart
            height="fill"
            x={{ values: [0, 1, 2], label: { en: 'Protocol', es: 'Protocolo' }, ticks: protocols, range: [-0.5, 2.5] }}
            y={{ label: { en: 'Error', es: 'Error' }, unit: 'cm', range: [0, 40], format: { decimals: 0 } }}
            series={[
              { label: { en: 'Model', es: 'Modelo' }, values: [12, 24, 31], dots: true },
              { label: { en: 'Baseline', es: 'Línea base' }, values: [20, 25, 29], dots: true },
            ]}
          />
        </PlotCard>
        <PlotCard fill title={{ en: 'Five lines, one to follow', es: 'Cinco líneas, una para seguir' }} lane="live" provenance="synthetic" dataKey={stateKey}>
          <UPlotChart height="fill" solo x={{ values: days, label: { en: 'Day', es: 'Día' }, format: { decimals: 0 } }} y={{ label: { en: 'Level', es: 'Nivel' }, format: { decimals: 0 } }} series={lines} />
        </PlotCard>
      </>
      <PlotCard fill title={{ en: 'A zero line with no label', es: 'Una línea de cero sin etiqueta' }} lane="live" provenance="synthetic" dataKey={stateKey}>
        <UPlotChart
          height="fill"
          x={{ values: days, label: { en: 'Day', es: 'Día' }, format: { decimals: 0 } }}
          y={{ label: { en: 'Bias', es: 'Sesgo' }, range: [-4, 8], format: { decimals: 0 } }}
          series={[{ label: { en: 'Bias', es: 'Sesgo' }, values: [-2, -1, 0, 2, 3, 5, 4, 6], dots: true }]}
          yMarks={[{ y: 0.5, tone: 'neutral' }, { y: 5.5, label: { en: 'alert', es: 'alerta' }, tone: 'bad' }]}
        />
      </PlotCard>
    </ViewsRow>
  );
}

/** A view whose document is absent says so and draws nothing (ADR-0080 decision 3); the unavailable-* plants break it. */
function PendingView() {
  const lang = useShellLang();
  const reason = pick({ en: 'The trace for this case is not available yet: 1 of 5 artifacts are absent.', es: 'La traza de este caso aún no está disponible: falta 1 de 5 artefactos.' }, lang);
  const text = PLANT === 'unavailable-unexplained' ? '' : PLANT === 'unavailable-short' ? 'n/a' : PLANT === 'unavailable-punct' ? ' - . - . - . - . - . - ' : reason;
  // the note a reader cannot see, one way per plant (each used to pass the gate)
  const hide: Record<string, CSSProperties> = {
    'unavailable-hidden': { display: 'none' },
    'unavailable-opacity': { opacity: 0 },
    'unavailable-zero': { width: 0, height: 0, overflow: 'hidden', margin: 0, padding: 0 },
    'unavailable-offscreen': { position: 'absolute', left: -10000, top: 0, width: 400 },
    'unavailable-sronly': { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
    'unavailable-fontsize': { fontSize: 0 },
    // the box is in place and a reader cannot read the glyphs: cut away, painted far outside the box, or a 1 px font on a tall line
    'unavailable-clippath': { clipPath: 'inset(100%)' },
    'unavailable-textindent': { textIndent: -10000, whiteSpace: 'nowrap' },
    'unavailable-tinyfont': { fontSize: 1, lineHeight: '16px' },
  };
  return (
    <>
      <p className="caos-pending" data-state="unavailable" style={hide[PLANT]}>
        {PLANT === 'unavailable-hidden-text' ? (
          <>
            <span style={{ display: 'none' }}>{reason}</span>.
          </>
        ) : (
          text
        )}
      </p>
      {PLANT === 'unavailable-beside-blank' && (
        <Stage label="Pending curves">{(sz) => <canvas width={sz.width} height={sz.height} style={{ display: 'block' }} />}</Stage>
      )}
      {PLANT === 'unavailable-collapsed-chart' && <canvas width={600} height={300} style={{ display: 'block', width: '100%', height: 0 }} />}
      {PLANT === 'unavailable-invisible-chart' && <canvas width={600} height={300} style={{ display: 'block', visibility: 'hidden' }} />}
    </>
  );
}

function CompareView({ peaks }: { peaks: { id: string; label: string; peak: number }[] }) {
  return (
    <PlotCard fill title={{ en: 'Peak infected by variant', es: 'Pico de infectados por variante' }} lane="live" provenance="synthetic" dataKey={useWorkbenchState().stateKey}>
      <BarChart
        title={{ en: 'Peak infected by variant', es: 'Pico de infectados por variante' }}
        zoomOff={PLANT === 'zoom-off-unexplained' ? 'no' : undefined}
        height="fill"
        axis={{ label: { en: 'Peak infected', es: 'Pico de infectados' }, unit: { en: 'people', es: 'personas' }, format: { decimals: 0 } }}
        data={peaks.map((p, i) => ({ id: p.id, label: p.label, value: p.peak, highlight: i === 0 }))}
      />
    </PlotCard>
  );
}

// ----------------------------------------------------------------------------------------------- the App route
function Workbench() {
  const lang = useShellLang();
  const [caseId, setCaseId] = useState(CASES[0].id);
  const [variant, setVariant] = useState('base');
  const [scale, setScale] = useState(1);
  const [horizon, setHorizon] = useState('120');
  const [tick, setTick] = useState(0);
  const [focusOn, setFocusOn] = useState(false);
  // The case list arrives asynchronously, as a product's index does: the deep link must survive that (G9).
  const [caseList, setCaseList] = useState<typeof CASES>([]);
  useEffect(() => {
    const t = setTimeout(() => setCaseList(CASES), 60);
    return () => clearTimeout(t);
  }, []);
  // The names of the case select (shell 0.17.0 round 3: the display shows a name whole at any length). The consumer trial's names need three lines in the
  // rail: `select-cut` and `select-focus-rail` (only while Focus is open, so the App is clean) plant a product stylesheet that clamps them to two, `select-cut-token`
  // the same on a name with no space; `legit-select-two-lines` and `legit-select-three-lines` are names the display shows whole.
  const THREE_LINES = 'Lifetime PD, IFRS 9 staging and ECL on public small-business loans';
  const TOKEN_NAME = 'fragmenta_escondida_bench_blast_pattern_07_full_resolution_run';
  const shownCases = caseList.map((c, i) => {
    if (i !== 0 && !(i === 1 && PLANT === 'legit-select-three-lines')) return c;
    if (PLANT === 'select-cut' || PLANT === 'select-cut-display' || (PLANT === 'select-focus-rail' && focusOn)) return { ...c, name: THREE_LINES };
    if (PLANT === 'select-cut-token') return { ...c, name: TOKEN_NAME };
    if (PLANT === 'legit-select-two-lines') return { ...c, name: 'Corporate PD across 1 to 5 year horizons (planned)' };
    if (PLANT === 'legit-select-three-lines') return { ...c, name: i === 0 ? 'Granite mine, northeastern China: the extrapolation control' : THREE_LINES };
    return c;
  });
  const idx = Math.max(0, CASES.findIndex((c) => c.id === caseId));
  const beta = CASES[idx].beta * scale * (variant === 'stress' ? 1.3 : 1);
  const sim = useMemo(() => simulate(beta, Number(horizon)), [beta, horizon]);
  const peaks = useMemo(
    () => VARIANTS.map((v) => ({ id: v.id, label: pick(v.label, lang), peak: simulate(CASES[idx].beta * scale * (v.id === 'stress' ? 1.3 : 1), Number(horizon)).peak })),
    [idx, scale, horizon, lang],
  );
  const controls = PLANT === 'dead-knob' ? { horizon } : { scale, horizon };
  const shownCase = PLANT === 'wrong-case' ? CASES[(idx + 1) % CASES.length].id : caseId;

  useEffect(() => flipPlant(PLANT), []);
  useEffect(() => {
    if (PLANT === 'case-only' && caseId === 'c-high') console.error('planted: the high-contact case fails');
  }, [caseId]);
  useEffect(() => {
    if (PLANT === 'focus-page-scroll') {
      // Focus mode lets the document scroll behind the stage
      const t = setInterval(() => {
        const on = /[?&]focus=1/.test(window.location.search);
        const want = on ? '300vh' : '';
        if (document.body.style.minHeight !== want) document.body.style.minHeight = want;
      }, 50);
      return () => {
        clearInterval(t);
        document.body.style.minHeight = '';
      };
    }
    if (PLANT === 'focus-chrome-covers') {
      // the stage content starts under the Focus label, so the label covers the open group's sub-tab row
      const style = document.createElement('style');
      style.textContent = '.caos-focus-instrument > .caos-cw-focus { padding-top: 0.4rem !important; }';
      document.head.append(style);
      return () => style.remove();
    }
    if (PLANT === 'focus-no-exit') {
      const style = document.createElement('style');
      style.textContent = '[data-focus-exit] { display: none !important; }';
      document.head.append(style);
      return () => style.remove();
    }
    return undefined;
  }, []);
  useEffect(() => {
    if (PLANT !== 'raf-loop') return;
    let id = 0;
    const loop = () => {
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (PLANT !== 'mutation-loop') return;
    const t = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(t);
  }, []);

  const rail =
    PLANT === 'no-controls' ? (
      <LiveValues sim={sim} />
    ) : (
      <>
        <Knob
          id="scale"
          label={{ en: 'Contact scale', es: 'Escala de contacto' }}
          hint={{ en: 'Multiplies the case contact rate.', es: 'Multiplica la tasa de contacto del caso.' }}
          value={scale}
          min={0.5}
          max={2}
          step={0.1}
          unit="x"
          onChange={setScale}
        />
        {PLANT === 'covered' && <div style={{ position: 'relative', marginTop: -64, height: 64, zIndex: 5 }} aria-hidden="true" />}
        {/* after the covering plant, which must cover the contact scale, a control the probe reaches */}
        <Knob
          id="recovery"
          label={{ en: 'Recovery rate', es: 'Tasa de recuperación' }}
          hint={{ en: 'Fixed in this fixture: the control cannot act.', es: 'Fija en este producto de prueba: el control no puede actuar.' }}
          value={0.1}
          min={0.05}
          max={0.3}
          step={0.01}
          unit="1/d"
          format={{ decimals: 2 }}
          disabled
          onChange={() => undefined}
        />
        <ChipGroup
          id="horizon"
          label={{ en: 'Horizon', es: 'Horizonte' }}
          value={horizon}
          options={[
            { id: '120', label: { en: '120 days', es: '120 días' } },
            { id: '240', label: { en: '240 days', es: '240 días' } },
          ]}
          onChange={setHorizon}
        />
        {PLANT === 'rail-overflow' && <div style={{ width: 640, flex: 'none' }}>planted rail block</div>}
        {PLANT === 'truncated' && (
          <span style={{ display: 'block', width: 90, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>A planted label too long to read</span>
        )}
        {PLANT === 'select-arrow' && (
          <select className="select" data-plant-select="" aria-label="Planted select">
            <option>Low contact</option>
          </select>
        )}
        {PLANT === 'mutation-loop' && <span>{tick}</span>}
        <LiveValues sim={sim} />
      </>
    );

  return (
      <CaseWorkbench
        caseId={shownCase}
        cases={{ cases: shownCases, selectedId: caseId, onSelect: setCaseId, layout: 'select', deepLink: true }}
        controls={controls}
        variants={PLANT === 'no-controls' ? undefined : { variants: VARIANTS, activeId: variant, onSelect: setVariant, lane: 'live' }}
        rail={rail}
        groups={[
          { id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <ModelView sim={sim} /> },
          { id: 'validation', label: { en: 'Validation', es: 'Validación' }, content: <ValidationView sim={sim} focusOn={focusOn} /> },
          { id: 'pending', label: { en: 'Pending', es: 'Pendiente' }, content: <PendingView /> },
        ]}
        group={PLANT === 'focus-drops-group' && focusOn ? 'model' : undefined}
        compare={{ content: <CompareView peaks={peaks} /> }}
        focus={
          PLANT === 'focus-missing'
            ? undefined
            : {
                // a title that wraps to two lines in the label at 1280px (shell 0.14.3), so the clean gate run walks the wrapping path
                title: {
                  en: 'Epidemic peak under stress: a closed population, SIR fit and three contact scenarios',
                  es: 'Pico epidémico bajo estrés: una población cerrada, ajuste SIR y tres escenarios de contacto',
                },
                // the plant that loses the case: opening Focus puts the first case back
                onChange: (on) => {
                  setFocusOn(on);
                  if (PLANT === 'focus-loses-case' && on) {
                    setCaseId(CASES[0].id);
                    const q = new URLSearchParams(window.location.search);
                    q.set('case', CASES[0].id);
                    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q.toString()}`);
                  }
                },
              }
        }
        context={{
          content: (
            <>
              <h2>{pick({ en: 'The case', es: 'El caso' }, lang)}</h2>
              <p>
                {pick(
                  {
                    en: 'A closed population of one thousand people with one initial infection. The contact rate sets how fast the infection spreads; the recovery rate is fixed at one tenth per day.',
                    es: 'Una población cerrada de mil personas con un contagio inicial. La tasa de contacto fija la velocidad de propagación; la tasa de recuperación es fija en un décimo por día.',
                  },
                  lang,
                )}
              </p>
            </>
          ),
        }}
      />
  );
}

// ------------------------------------------------------------------------------------------ the surface App (0.16.0)
/**
 * A console: an App that is not one case's (`SurfacePage`). Three views: an overview with no stage, the engine (a stage with a
 * rail, a HUD and a sub-view row) and the runs (a stage with no rail and its own control in its body).
 */
function Console() {
  const lang = useShellLang();
  const [scale, setScale] = useState(1);
  const [view, setView] = useState('overview');
  const [focusOn, setFocusOn] = useState(false);
  const sim = useMemo(() => simulate(0.35 * scale, 120), [scale]);
  // the plants of Focus mode reuse those of the workbench (the same frame): `surface-focus-not-isolated` is `focus-not-isolated`
  useEffect(() => flipPlant(PLANT.replace(/^surface-/, '')), []);
  useEffect(() => {
    const styled = (css: string) => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.append(style);
      return () => style.remove();
    };
    if (PLANT === 'surface-focus-page-scroll') {
      const t = setInterval(() => {
        const want = /[?&]focus=1/.test(window.location.search) ? '300vh' : '';
        if (document.body.style.minHeight !== want) document.body.style.minHeight = want;
      }, 50);
      return () => {
        clearInterval(t);
        document.body.style.minHeight = '';
      };
    }
    if (PLANT === 'surface-focus-chrome-covers') return styled('.caos-focus-instrument > .caos-surface-focus { padding-top: 0.4rem !important; }');
    if (PLANT === 'surface-focus-no-exit') return styled('[data-focus-exit] { display: none !important; }');
    if (PLANT === 'surface-focus-stage-small') return styled('.caos-focus-shell { grid-template-columns: minmax(0, 1fr) 62vw !important; }');
    if (PLANT === 'surface-focus-tabs-wrap') return styled('.caos-focus-instrument .subtablist { flex-wrap: wrap !important; max-width: 90px !important; overflow: visible !important; }');
    if (PLANT === 'surface-headless-head') {
      // the Focus control in a head of its own (shell 0.16.0 before the fix round): a head row appears on a view with a stage
      return plantDom(() => {
        const surface = document.querySelector('[data-surface]');
        if (!surface) return;
        const open = surface.querySelector(':scope > .caos-surface-body [role="tabpanel"][data-panel]')?.getAttribute('data-panel') ?? '';
        const here = surface.querySelector(':scope > [data-plant-head]');
        if (['engine', 'runs'].includes(open) && !here) {
          const head = document.createElement('div');
          head.className = 'caos-surface-head';
          head.setAttribute('data-plant-head', '');
          head.innerHTML = '<div class="caos-surface-actions"><button type="button" class="btn">Focus</button></div>';
          surface.insertBefore(head, surface.firstChild);
        } else if (!['engine', 'runs'].includes(open) && here) here.remove();
      });
    }
    if (PLANT === 'surface-tall-control') return styled('.caos-focus-enter { min-height: 90px !important; }');
    if (PLANT === 'surface-empty-head') {
      // a head row with nothing in it, permanently, on a headless surface
      return plantDom(() => {
        const surface = document.querySelector('[data-surface]');
        if (surface && !surface.querySelector(':scope > .caos-surface-head')) {
          const head = document.createElement('div');
          head.className = 'caos-surface-head';
          head.style.minHeight = '20px';
          surface.insertBefore(head, surface.firstChild);
        }
      });
    }
    if (PLANT === 'surface-focus-escape-one-view') {
      // a product key handler takes Escape on its only view with a stage
      const stop = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && document.querySelector('[data-focus-shell]')) e.stopPropagation();
      };
      document.addEventListener('keydown', stop, true);
      return () => document.removeEventListener('keydown', stop, true);
    }
    if (PLANT === 'surface-focus-no-open') {
      // the control does nothing: the click never reaches the App's handlers
      const stop = (e: Event) => {
        if ((e.target as Element | null)?.closest('[data-focus-enter]')) e.stopPropagation();
      };
      document.addEventListener('click', stop, true);
      return () => document.removeEventListener('click', stop, true);
    }
    return undefined;
  }, []);
  // a controlled surface holds its view itself: the plants that lose the view need it
  const controlled = PLANT === 'surface-focus-loses-view' || PLANT === 'surface-focus-return-wrong-view';
  const onFocus = (on: boolean) => {
    setFocusOn(on);
    if (PLANT === 'surface-fparam-left' && !on) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${window.location.search ? '&' : '?'}f=1`);
    if (PLANT === 'surface-focus-loses-view' && on) setView('runs');
    if (PLANT === 'surface-focus-return-wrong-view' && !on) setView('overview');
    if (PLANT === 'surface-mode-url-dropped' && on) {
      const q = new URLSearchParams(window.location.search);
      q.delete('mode');
      window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q.toString()}`);
    }
    if (PLANT === 'surface-focus-url-no-view' && on) window.history.replaceState(window.history.state, '', `${window.location.pathname}?focus=1`);
    if (PLANT === 'surface-focus-url-stays' && !on) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${window.location.search ? '&' : '?'}focus=1`);
  };
  const scaleKnob = (
    <Knob
      id="scale"
      label={{ en: 'Contact scale', es: 'Escala de contacto' }}
      hint={{ en: 'Multiplies the contact rate of the run.', es: 'Multiplica la tasa de contacto de la corrida.' }}
      value={scale}
      min={0.5}
      max={2}
      step={0.1}
      unit="x"
      onChange={setScale}
    />
  );
  const rows = [10, 30, 60, 90, 120].filter((d) => d < sim.t.length);
  const curve = (
    <PlotCard fill title={{ en: 'Epidemic curves of the run', es: 'Curvas epidémicas de la corrida' }} lane="live" provenance="synthetic">
      <UPlotChart
        height="fill"
        x={{ values: sim.t, label: { en: 'Day', es: 'Día' }, unit: 'd' }}
        y={{ label: { en: 'People', es: 'Personas' } }}
        series={[
          { label: { en: 'Susceptible', es: 'Susceptibles' }, values: sim.S, color: '--color-accent' },
          { label: { en: 'Infected', es: 'Infectados' }, values: sim.I, color: '--color-bad' },
        ]}
        marks={[{ x: sim.peakDay, label: { en: 'peak', es: 'pico' } }]}
      />
    </PlotCard>
  );
  const tabs = [
    {
      id: 'overview',
      label: pick({ en: 'Overview', es: 'Resumen' }, lang),
      content: (
        <div className="prose">
          <p>
            {pick(
              {
                en: 'This console runs the engine of the fixture product over a closed population of one thousand people. The overview names what each view holds and where its controls are; it draws nothing, so it opens no focus mode.',
                es: 'Esta consola ejecuta el motor del producto de prueba sobre una población cerrada de mil personas. El resumen nombra lo que contiene cada vista y dónde están sus controles; no dibuja nada, así que no abre el modo enfoque.',
              },
              lang,
            )}
          </p>
          <p>
            {pick(
              {
                en: 'The engine view draws the epidemic curves and the checkpoints of one run, with the contact scale beside it. The runs view repeats the curve for a fresh run and keeps its own control in its body. Both open in focus mode, in the full viewport, and come back to the same view.',
                es: 'La vista del motor dibuja las curvas epidémicas y los puntos de control de una corrida, con la escala de contacto a su lado. La vista de corridas repite la curva de una corrida nueva y guarda su propio control en el cuerpo. Ambas abren en modo enfoque, en el viewport completo, y vuelven a la misma vista.',
              },
              lang,
            )}
          </p>
        </div>
      ),
    },
    {
      id: 'engine',
      label: pick({ en: 'Engine', es: 'Motor' }, lang),
      focus: {
        title: { en: 'Engine run: a closed population, one infection and a contact scale', es: 'Corrida del motor: una población cerrada, un contagio y una escala de contacto' },
        hud: [{ label: { en: 'Peak infected', es: 'Pico de infectados' }, value: sim.peak.toFixed(0) }],
        rail: (
          <>
            {scaleKnob}
            {PLANT === 'surface-focus-rail-scroll' && <div style={{ height: 1800, flex: 'none' }}>planted rail block</div>}
          </>
        ),
      },
      content: (
        <>
          {!focusOn && scaleKnob}
          <SubTabs
            ariaLabel={pick({ en: 'Engine views', es: 'Vistas del motor' }, lang)}
            tabs={[
              ...(PLANT === 'surface-focus-drops-subview' && focusOn ? [{ id: 'planted', label: 'Planted', content: <p>planted first tab</p> }] : []),
              { id: 'curves', label: pick({ en: 'Curves', es: 'Curvas' }, lang), content: curve },
              {
                id: 'table',
                label: pick({ en: 'Checkpoints', es: 'Puntos de control' }, lang),
                content: (
                  <PlotCard title={{ en: 'State at checkpoints', es: 'Estado en puntos de control' }} lane="live" provenance="synthetic">
                    <table className="caos-table">
                      <thead>
                        <tr>
                          <th>{pick({ en: 'Day', es: 'Día' }, lang)}</th>
                          <th>S</th>
                          <th>I</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((d) => (
                          <tr key={d}>
                            <td>{d}</td>
                            <td>{sim.S[d].toFixed(0)}</td>
                            <td>{sim.I[d].toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </PlotCard>
                ),
              },
            ]}
          />
        </>
      ),
    },
    {
      id: 'runs',
      label: pick({ en: 'Runs', es: 'Corridas' }, lang),
      focus: true,
      content: (
        <>
          <button type="button" className="btn" onClick={() => setScale((s) => (s >= 2 ? 0.5 : s + 0.5))}>
            {pick({ en: 'Run again', es: 'Correr de nuevo' }, lang)}
          </button>
          {curve}
        </>
      ),
    },
  ];
  return (
    <SurfacePage
      title={HEADLESS ? undefined : { en: 'Console', es: 'Consola' }}
      lede={HEADLESS ? undefined : pick({ en: 'The engine of the fixture, run in the browser.', es: 'El motor del producto de prueba, ejecutado en el navegador.' }, lang)}
      actions={
        HEADLESS ? undefined : (
          <button type="button" className="btn">
            {pick({ en: 'Export', es: 'Exportar' }, lang)}
          </button>
        )
      }
      deepLinkView={HEADLESS ? 'mode' : undefined}
      tabs={ONE_STAGE ? tabs.filter((tab) => tab.id !== 'runs') : tabs}
      value={controlled ? view : undefined}
      onChange={setView}
      instrument
      focus={PLANT === 'surface-focus-missing' ? undefined : { onChange: onFocus, param: FPARAM }}
    />
  );
}

// ------------------------------------------------------------------------------------------- the documentation
const CITATIONS = [
  { id: 'km1927', label: { en: 'Kermack and McKendrick 1927', es: 'Kermack y McKendrick 1927' }, citation: 'Kermack, W. O., McKendrick, A. G. (1927). A contribution to the mathematical theory of epidemics. Proc. R. Soc. Lond. A 115, 700-721.', doi: '10.1098/rspa.1927.0118' },
  { id: 'eneuro2020', label: 'Ramirez 2020', citation: 'Ramirez, A. (2020). A reference whose DOI carries a dotted number: Framework for Improving Critical Infrastructure, Version 3.4. eNeuro 7(6).', doi: '10.1523/ENEURO.0159-20.2020' },
  { id: 'hethcote2000', label: 'Hethcote 2000', citation: 'Hethcote, H. W. (2000). The mathematics of infectious diseases. SIAM Review 42(4), 599-653.', doi: '10.1137/S0036144500371907' },
];

function Doc({ id }: { id: string }) {
  const lang = useShellLang();
  const [artifact, setArtifact] = useState<{ cases: number } | null>(null);
  useEffect(() => {
    // ADR-0017 s4 plants: text after the references block, and a block that never shows (the sections still cite)
    if (PLANT === 'refs-mid' && id === 'introduction') {
      const p = document.createElement('p');
      p.textContent = 'planted: text after the references block';
      const t = window.setTimeout(() => document.querySelector('[data-doc-references]')?.after(p), 50);
      return () => {
        window.clearTimeout(t);
        p.remove();
      };
    }
    if (PLANT === 'refs-missing' && id === 'introduction') {
      const style = document.createElement('style');
      style.textContent = '[data-doc-references] { display: none; }';
      document.head.append(style);
      return () => style.remove();
    }
    return undefined;
  }, [id, lang]);
  useEffect(() => (id === 'introduction' ? flipPlant(PLANT) : undefined), [id]);
  useEffect(() => {
    if (PLANT === 'console' && id === 'methodology') console.error('planted: the methodology page fails');
    if (id !== 'benchmark') return;
    fetch('/data/artifact.json')
      .then((r) => r.json())
      .then((j) => setArtifact(j))
      .catch(() => setArtifact({ cases: -1 }));
    if (PLANT === 'http404') fetch('/data/missing.json').catch(() => undefined);
  }, [id]);
  const route = STANDARD_ROUTES.find((r) => r.path === `/${id}`) ?? STANDARD_ROUTES[0];
  const title = { en: route.en, es: route.es };
  if (PLANT === 'thin-doc' && id === 'experiments') {
    return (
      <DocPage title={title} lede="">
        <span />
      </DocPage>
    );
  }
  const status = (
    <p data-state={artifact && PLANT !== 'never-ready' ? 'ready' : 'loading'}>
      {artifact ? `${pick({ en: 'Cases in the artifact', es: 'Casos en el artefacto' }, lang)}: ${artifact.cases}` : '...'}
    </p>
  );
  const doc = fixtureDoc(id, lang, PLANT, status);
  return (
    <DocPage wide={id === 'implementation'} title={title} lede={doc.lede} floorWaivers={doc.waivers}>
      {id === 'introduction' && (
        <p style={{ maxWidth: 220 }}>
          {pick({ en: 'See', es: 'Vea' }, lang)} <a href="#wrapped">{pick({ en: 'a deliberately long link that wraps onto a second line', es: 'un enlace deliberadamente largo que pasa a una segunda línea' }, lang)}</a>.
        </p>
      )}
      {PLANT === 'hoverflow' && id === 'introduction' && <div style={{ width: 3000, height: 12 }}>planted wide block</div>}
      {PLANT === 'decimal-point-plain-34' && id === 'introduction' && <p>{pick({ en: 'See version 3.4 of the standard.', es: 'Véase la versión 3.4 de la norma.' }, lang)}</p>}
      {PLANT === 'decimal-point-plain-2020' && id === 'introduction' && <p>{pick({ en: 'See the item 20.2020 of the list.', es: 'Véase el ítem 20.2020 de la lista.' }, lang)}</p>}
      {PLANT === 'decimal-point' && id === 'introduction' && <p>{pick({ en: 'Integration step: 0.25 days; worst difference 2.7e-08.', es: 'Paso de integración: 0.25 días; peor diferencia 2.7e-08.' }, lang)}</p>}
      {PLANT === 'low-contrast' && id === 'introduction' && <p style={{ color: '#9a9a9a' }}>{pick({ en: 'A planted pale line.', es: 'Una línea pálida plantada.' }, lang)}</p>}
      {PLANT === 'label-wide' && id === 'introduction' && <NarrowFontLabel />}
      {PLANT === 'value-broken' && id === 'introduction' && <ShrinkingValueRow />}
      {PLANT === 'value-broken-range' && id === 'introduction' && <NarrowRange />}
      {PLANT === 'mobile-only' && id === 'introduction' && <div className="fixture-mobile-only">planted narrow-screen block</div>}
      {doc.body}
    </DocPage>
  );
}

/** The wide-font plant (G10): a label in a box sized for a narrow font, as a fixed width per character sizes it. At
 * 11px this label measures 168px in the Windows system font, 193px in Verdana and 191px in DejaVu Sans (Chromium,
 * 2026-10-07): a 5px-per-character box (180px) holds the first and cuts the fonts of the wide-font pass. */
function NarrowFontLabel() {
  const label = 'a label sized for a narrow font only';
  const width = Math.ceil(label.length * 5);
  return (
    <svg width={width} height={24} data-chart="" role="img" aria-label={label}>
      <text x={0} y={16} fontSize={11} fill="var(--color-fg)" style={{ fontFamily: 'var(--font-sans)' }}>
        {label}
      </text>
    </svg>
  );
}

/** The value-broken plant (G19), the defect of BL-065 before shell 0.14.2: a flex row whose label and value both shrink
 * (the value has min-width 0 and overflow-wrap anywhere), in a box narrower than the label, so "35%" is cut into "3", "5", "%". */
function ShrinkingValueRow() {
  const cell = { minWidth: 0, overflowWrap: 'anywhere' } as const;
  return (
    <div style={{ display: 'flex', gap: 4, width: 90, overflowWrap: 'anywhere' }}>
      <span style={{ ...cell, flex: '1 1 auto' }}>a cause with a long label that takes the room</span>
      <span style={{ ...cell, flex: '0 1 auto' }}>35%</span>
    </div>
  );
}

/** The value-broken-range plant (G19): a page range in a box of 2ch with `overflow-wrap: anywhere`, so the break falls inside
 * "653" and not only after the hyphen. A break right after the hyphen is natural and passes (the clean fixture's citation). */
function NarrowRange() {
  return <div style={{ width: '2ch', overflowWrap: 'anywhere' }}>599-653</div>;
}

// ---------------------------------------------------------------------------------------------------- the app
const ARCH_SVG = '<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="192" height="72" rx="8" fill="var(--color-surface)" stroke="var(--color-border)"/><text x="100" y="46" text-anchor="middle" fill="var(--color-fg)" font-size="14">fixture</text></svg>';
const config: ShellConfig = {
  product: { name: PLANT === 'brand' ? 'Impostor' : 'GateFixture' },
  routes: SURFACE ? [...STANDARD_ROUTES, { path: '/console', en: 'Console', es: 'Consola' }] : STANDARD_ROUTES,
  links: { github: 'https://github.com/fsantibanezleal/CAOS_APP_SHELL' },
  version: '0.07.000',
  build: 'fixture',
  license: { en: 'MIT licence', es: 'Licencia MIT' },
  visibility: 'public',
  contain: true,
  architecture: {
    tabs: ['data', 'engine', 'lanes', 'web', 'deploy'].map((id) => ({ id, en: id, es: id, body_en: 'Fixture tab.', body_es: 'Pestaña de prueba.', svg: ARCH_SVG })),
  },
};

function ModePlants() {
  useEffect(() => {
    if (PLANT !== 'mode-theme' && PLANT !== 'mode-lang') return;
    const t = setInterval(() => {
      if (PLANT === 'mode-theme') document.documentElement.dataset.theme = 'dark';
      if (PLANT === 'mode-lang') document.documentElement.lang = 'en';
    }, 30);
    return () => clearInterval(t);
  });
  return null;
}

function App() {
  return (
    <CitationsProvider items={CITATIONS}>
      <AppShell config={config}>
        <ModePlants />
        <Routes>
          <Route path="/" element={PLANT === 'landing-app' ? <Workbench /> : <Landing />} />
          <Route path="/app" element={<Workbench />} />
          <Route path="/console" element={<Console />} />
          {['introduction', 'methodology', 'implementation', 'experiments', 'benchmark'].map((id) => (
            <Route key={id} path={`/${id}`} element={<Doc id={id} />} />
          ))}
          <Route path="*" element={<Landing />} />
        </Routes>
      </AppShell>
    </CitationsProvider>
  );
}

if (PLANT === 'stage-floor') {
  // the shell's cap on a filling card's note (0.11.0) and the stage's own floor (0.11.2) removed, as they were before: a
  // twenty-line note takes the drawing's height
  const style = document.createElement('style');
  style.textContent = '.caos-plot.fill > .caos-plot-note { max-height: none !important; overflow: visible !important; white-space: pre-line; font-size: 1rem; } .caos-plot.fill > .caos-plot-body { min-height: 0 !important; }';
  document.head.appendChild(style);
}
if (PLANT === 'clip') {
  const style = document.createElement('style');
  style.textContent = '.app-shell.fixed.contain > .page { overflow: hidden !important; }';
  document.head.appendChild(style);
}
if (PLANT === 'shrunk-tabs') {
  const style = document.createElement('style');
  style.textContent = '.caos-cw-panel > .subtabs > .subtablist, .caos-cw > .tabs > .tablist { flex: 0 1 auto !important; } .caos-cw-panel > .subtabs > .subtablist, .caos-cw > .tabs > .tablist { max-height: 16px !important; }';
  document.head.appendChild(style);
}
if (PLANT === 'sticky-off') {
  const style = document.createElement('style');
  style.textContent = '.subtabs-vertical > .subtablist { position: static !important; }';
  document.head.appendChild(style);
}
if (PLANT === 'mobile-only') {
  const style = document.createElement('style');
  style.textContent = '@media (max-width: 420px) { .fixture-mobile-only { width: 700px; } }';
  document.head.appendChild(style);
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
