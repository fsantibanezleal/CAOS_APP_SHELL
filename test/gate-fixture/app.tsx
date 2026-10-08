// The gate's fixture (G15): a small real product built on this shell's sources, clean by default. The self-test
// serves it as GitHub Pages would and runs the gate on it, once clean (every check must pass in the full matrix) and
// once per planted defect (the check that owns the defect must fail). `window.__PLANT__` names the plant.
import { useEffect, useMemo, useRef, useState } from 'react';
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
  DocSection,
  Equation,
  Knob,
  PlotCard,
  Readout,
  STANDARD_ROUTES,
  Stage,
  SubTabs,
  Tabs,
  ViewsRow,
  pick,
  useShellLang,
  useThemeTokens,
  useWorkbenchState,
  type ShellConfig,
} from '../../src/index';
import { UPlotChart } from '../../src/chart';

declare global {
  interface Window {
    __PLANT__?: string;
  }
}
const PLANT = window.__PLANT__ ?? '';

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
      <PlotCard fill title={{ en: 'Epidemic curves', es: 'Curvas epidémicas' }} lane="live" provenance="synthetic" dataKey={key}>
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
        ) : (
          <UPlotChart
            height="fill"
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

function ValidationView({ sim }: { sim: Sim }) {
  const lang = useShellLang();
  const { stateKey } = useWorkbenchState();
  const rows = [10, 30, 60, 90, 120].filter((d) => d < sim.t.length);
  return (
    <SubTabs
      ariaLabel={pick({ en: 'Validation views', es: 'Vistas de validación' }, lang)}
      tabs={[
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
              <PlotCard fill title={{ en: 'Recovered on a log time axis', es: 'Recuperados en un eje de tiempo logarítmico' }} lane="live" provenance="synthetic" dataKey={stateKey}>
                <UPlotChart
                  height="fill"
                  x={{ values: sim.t.slice(1), label: { en: 'Day', es: 'Día' }, unit: 'd', log: true }}
                  y={{ label: { en: 'People', es: 'Personas' }, format: { decimals: 0 } }}
                  series={[{ label: { en: 'Recovered', es: 'Recuperados' }, values: sim.R.slice(1) }]}
                />
              </PlotCard>
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
      ]}
    />
  );
}

function CompareView({ peaks }: { peaks: { id: string; label: string; peak: number }[] }) {
  return (
    <PlotCard fill title={{ en: 'Peak infected by variant', es: 'Pico de infectados por variante' }} lane="live" provenance="synthetic" dataKey={useWorkbenchState().stateKey}>
      <BarChart
        title={{ en: 'Peak infected by variant', es: 'Pico de infectados por variante' }}
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
  // The case list arrives asynchronously, as a product's index does: the deep link must survive that (G9).
  const [caseList, setCaseList] = useState<typeof CASES>([]);
  useEffect(() => {
    const t = setTimeout(() => setCaseList(CASES), 60);
    return () => clearTimeout(t);
  }, []);
  const idx = Math.max(0, CASES.findIndex((c) => c.id === caseId));
  const beta = CASES[idx].beta * scale * (variant === 'stress' ? 1.3 : 1);
  const sim = useMemo(() => simulate(beta, Number(horizon)), [beta, horizon]);
  const peaks = useMemo(
    () => VARIANTS.map((v) => ({ id: v.id, label: pick(v.label, lang), peak: simulate(CASES[idx].beta * scale * (v.id === 'stress' ? 1.3 : 1), Number(horizon)).peak })),
    [idx, scale, horizon, lang],
  );
  const controls = PLANT === 'dead-knob' ? { horizon } : { scale, horizon };
  const shownCase = PLANT === 'wrong-case' ? CASES[(idx + 1) % CASES.length].id : caseId;

  useEffect(() => {
    if (PLANT === 'case-only' && caseId === 'c-high') console.error('planted: the high-contact case fails');
  }, [caseId]);
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
        {PLANT === 'mutation-loop' && <span>{tick}</span>}
        <LiveValues sim={sim} />
      </>
    );

  return (
      <CaseWorkbench
        caseId={shownCase}
        cases={{ cases: caseList, selectedId: caseId, onSelect: setCaseId, layout: 'select', deepLink: true }}
        controls={controls}
        variants={PLANT === 'no-controls' ? undefined : { variants: VARIANTS, activeId: variant, onSelect: setVariant, lane: 'live' }}
        rail={rail}
        groups={[
          { id: 'model', label: { en: 'Model', es: 'Modelo' }, content: <ModelView sim={sim} /> },
          { id: 'validation', label: { en: 'Validation', es: 'Validación' }, content: <ValidationView sim={sim} /> },
        ]}
        compare={{ content: <CompareView peaks={peaks} /> }}
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

// ------------------------------------------------------------------------------------------- the documentation
const CITATIONS = [
  { id: 'km1927', label: { en: 'Kermack and McKendrick 1927', es: 'Kermack y McKendrick 1927' }, citation: 'Kermack, W. O., McKendrick, A. G. (1927). A contribution to the mathematical theory of epidemics. Proc. R. Soc. Lond. A 115, 700-721.', doi: '10.1098/rspa.1927.0118' },
  { id: 'hethcote2000', label: 'Hethcote 2000', citation: 'Hethcote, H. W. (2000). The mathematics of infectious diseases. SIAM Review 42(4), 599-653.', doi: '10.1137/S0036144500371907' },
];

const PARAGRAPH = {
  en: 'The model divides the population into those who can be infected, those who are infected, and those who have recovered. Each day, contacts between the first two groups produce new infections in proportion to the contact rate, and a fixed share of the infected recover. The epidemic grows while the effective reproduction number stays above one, peaks when the susceptible share falls to the inverse of the basic reproduction number, and ends with part of the population never infected.',
  es: 'El modelo divide la población entre quienes pueden contagiarse, quienes están contagiados y quienes se recuperaron. Cada día, los contactos entre los dos primeros grupos producen contagios nuevos en proporción a la tasa de contacto, y una fracción fija de los contagiados se recupera. La epidemia crece mientras el número reproductivo efectivo es mayor que uno, alcanza su pico cuando la fracción susceptible cae al inverso del número reproductivo básico, y termina con parte de la población sin contagiarse.',
};

function Doc({ id }: { id: string }) {
  const lang = useShellLang();
  const [artifact, setArtifact] = useState<{ cases: number } | null>(null);
  useEffect(() => {
    if (PLANT === 'console' && id === 'methodology') console.error('planted: the methodology page fails');
    if (id !== 'benchmark') return;
    fetch('/data/artifact.json')
      .then((r) => r.json())
      .then((j) => setArtifact(j))
      .catch(() => setArtifact({ cases: -1 }));
    if (PLANT === 'http404') fetch('/data/missing.json').catch(() => undefined);
  }, [id]);
  const route = STANDARD_ROUTES.find((r) => r.path === `/${id}`) ?? STANDARD_ROUTES[1];
  const title = { en: route.en, es: route.es };
  if (PLANT === 'thin-doc' && id === 'experiments') {
    return (
      <DocPage title={title} lede="">
        <span />
      </DocPage>
    );
  }
  const sections = [1, 2, 3, 4, 5].map((k) => (
    <DocSection key={k} title={{ en: `Part ${k}`, es: `Parte ${k}` }} refs={k === 5 ? undefined : ['km1927', 'hethcote2000']} noRefsReason={k === 5 ? { en: 'A summary of the parts above.', es: 'Un resumen de las partes anteriores.' } : undefined}>
      <p>{pick(PARAGRAPH, lang)}</p>
      {k === 1 && <Equation tex="\frac{dI}{dt} = \beta \frac{S I}{N} - \gamma I" caption={pick({ en: 'Rate of change of the infected.', es: 'Tasa de cambio de los contagiados.' }, lang)} />}
    </DocSection>
  ));
  return (
    <DocPage wide={id === 'implementation'} title={title} lede={pick({ en: 'How the fixture product is built and checked.', es: 'Cómo se construye y verifica el producto de prueba.' }, lang)}>
      {id === 'introduction' && (
        <p style={{ maxWidth: 220 }}>
          {pick({ en: 'See', es: 'Vea' }, lang)} <a href="#wrapped">{pick({ en: 'a deliberately long link that wraps onto a second line', es: 'un enlace deliberadamente largo que pasa a una segunda línea' }, lang)}</a>.
        </p>
      )}
      {PLANT === 'hoverflow' && id === 'introduction' && <div style={{ width: 3000, height: 12 }}>planted wide block</div>}
      {PLANT === 'decimal-point' && id === 'introduction' && <p>{pick({ en: 'Integration step: 0.25 days; worst difference 2.7e-08.', es: 'Paso de integración: 0.25 días; peor diferencia 2.7e-08.' }, lang)}</p>}
      {PLANT === 'low-contrast' && id === 'introduction' && <p style={{ color: '#9a9a9a' }}>{pick({ en: 'A planted pale line.', es: 'Una línea pálida plantada.' }, lang)}</p>}
      {PLANT === 'label-wide' && id === 'introduction' && <NarrowFontLabel />}
      {PLANT === 'mobile-only' && id === 'introduction' && <div className="fixture-mobile-only">planted narrow-screen block</div>}
      {id === 'implementation' ? (
        <SubTabs
          orientation="vertical"
          ariaLabel={pick({ en: 'Implementation parts', es: 'Partes de la implementación' }, lang)}
          tabs={[
            { id: 'all', label: pick({ en: 'Every part, a long section', es: 'Todas las partes, una sección larga' }, lang), content: sections },
            { id: 'first', label: pick({ en: 'The first part', es: 'La primera parte' }, lang), content: sections.slice(0, 1) },
          ]}
        />
      ) : id === 'methodology' ? (
        <Tabs
          ariaLabel={pick({ en: 'Methodology parts', es: 'Partes de la metodología' }, lang)}
          tabs={[
            { id: 'theory', label: pick({ en: 'Theory', es: 'Teoría' }, lang), content: sections },
            { id: 'numerics', label: pick({ en: 'Numerics', es: 'Numérica' }, lang), content: sections.slice(0, 2) },
            {
              // taller than the page's scroll box and shorter than the window: reachable (known shell defect 18)
              id: 'notes',
              label: pick({ en: 'Notes', es: 'Notas' }, lang),
              content: (
                <div style={{ height: 'calc(100vh - 40px)' }}>
                  <p>{pick(PARAGRAPH, lang)}</p>
                </div>
              ),
            },
            {
              // a focusable block below the fold, a few pixels shorter than the page's scroll box (712px at 1280x800):
              // bringing its end into view with a margin must not push its start out (known shell defect 25)
              id: 'margins',
              label: pick({ en: 'Margins', es: 'Márgenes' }, lang),
              content: (
                <div>
                  <div style={{ height: 400 }}>
                    <p>{pick(PARAGRAPH, lang)}</p>
                  </div>
                  <div role="region" aria-label={pick({ en: 'Nearly as tall as the page', es: 'Casi tan alto como la página' }, lang)} tabIndex={0} style={{ height: 'calc(100vh - 91px)' }}>
                    <p>{pick(PARAGRAPH, lang)}</p>
                  </div>
                </div>
              ),
            },
          ]}
        />
      ) : (
        sections
      )}
      {id === 'experiments' && (
        <figure className="figure">
          <svg className="fig-svg" viewBox="0 0 320 120" role="img" aria-label="A figure below the fold">
            <rect x="10" y="20" width="300" height="80" rx="6" fill="var(--color-surface-2)" stroke="var(--color-border)" />
            <text x="24" y="52" fontSize="13" fill="var(--color-fg)">{pick({ en: 'A figure below the fold', es: 'Una figura bajo el pliegue' }, lang)}</text>
            <text x="24" y="78" fontSize="11" fill="var(--color-fg-subtle)">{pick({ en: 'its labels stay inside it', es: 'sus rótulos quedan dentro' }, lang)}</text>
          </svg>
          <figcaption className="figure-caption">{pick({ en: 'A documentation figure after five sections.', es: 'Una figura de documentación tras cinco secciones.' }, lang)}</figcaption>
        </figure>
      )}
      {id === 'benchmark' && (
        <p data-state={artifact && PLANT !== 'never-ready' ? 'ready' : 'loading'}>
          {artifact ? `${pick({ en: 'Cases in the artifact', es: 'Casos en el artefacto' }, lang)}: ${artifact.cases}` : '...'}
        </p>
      )}
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

// ---------------------------------------------------------------------------------------------------- the app
const ARCH_SVG = '<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="192" height="72" rx="8" fill="var(--color-surface)" stroke="var(--color-border)"/><text x="100" y="46" text-anchor="middle" fill="var(--color-fg)" font-size="14">fixture</text></svg>';
const config: ShellConfig = {
  product: { name: PLANT === 'brand' ? 'Impostor' : 'GateFixture' },
  routes: STANDARD_ROUTES,
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
          <Route path="/" element={<Workbench />} />
          {['introduction', 'methodology', 'implementation', 'experiments', 'benchmark'].map((id) => (
            <Route key={id} path={`/${id}`} element={<Doc id={id} />} />
          ))}
        </Routes>
      </AppShell>
    </CitationsProvider>
  );
}

if (PLANT === 'clip') {
  const style = document.createElement('style');
  style.textContent = '.app-shell.fixed.contain > .page { overflow: hidden !important; }';
  document.head.appendChild(style);
}
if (PLANT === 'shrunk-tabs') {
  const style = document.createElement('style');
  style.textContent = '.caos-cw-panel > .subtabs > .subtablist, .caos-cw > .tabs > .tablist { flex: 0 1 auto !important; }';
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
