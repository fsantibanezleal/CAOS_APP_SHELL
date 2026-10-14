// Builds the gate fixture as a static site the way a product's Pages build does: one bundle, every route
// materialised as its own index.html (so a deep link answers 200 on a static host), a 404.html, and one artifact.
// A plant directory is a copy of the clean site with `window.__PLANT__` set and, for build-level plants, a file
// removed or replaced.
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEME_BOOT_SCRIPT } from '../../dist/keys.js';

const here = dirname(fileURLToPath(import.meta.url));
export const ROUTES = ['app', 'introduction', 'methodology', 'implementation', 'experiments', 'benchmark'];

function page(plant) {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GateFixture</title>
<link rel="icon" href="data:,">
<script>${THEME_BOOT_SCRIPT}</script>
<script>window.__PLANT__=${JSON.stringify(plant)};</script>
<link rel="stylesheet" href="/assets/app.css">
</head>
<body><div id="root"></div><script type="module" src="/assets/app.js"></script></body>
</html>
`;
}

export async function buildFixture(outDir) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'assets'), { recursive: true });
  await build({
    entryPoints: { app: join(here, 'app.tsx') },
    bundle: true,
    format: 'esm',
    outdir: join(outDir, 'assets'),
    jsx: 'automatic',
    minify: true,
    logLevel: 'error',
    loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  writeFileSync(join(outDir, 'index.html'), page(''));
  for (const r of ROUTES) {
    mkdirSync(join(outDir, r), { recursive: true });
    writeFileSync(join(outDir, r, 'index.html'), page(''));
  }
  writeFileSync(join(outDir, '404.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not found</title></head><body><p>Not found</p></body></html>\n');
  mkdirSync(join(outDir, 'data'), { recursive: true });
  writeFileSync(join(outDir, 'data', 'artifact.json'), JSON.stringify({ cases: 3 }));
  // the three illustrations of the executive view, as a product's site serves them
  mkdirSync(join(outDir, 'executive'), { recursive: true });
  for (const f of ['pain', 'situation', 'proposal']) cpSync(join(here, 'executive', `${f}.svg`), join(outDir, 'executive', `${f}.svg`));
}

export function makePlant(cleanDir, plantDir, plant) {
  rmSync(plantDir, { recursive: true, force: true });
  cpSync(cleanDir, plantDir, { recursive: true });
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) walk(f);
      else if (n === 'index.html') writeFileSync(f, readFileSync(f, 'utf8').replace('window.__PLANT__="";', `window.__PLANT__=${JSON.stringify(plant)};`));
    }
  };
  walk(plantDir);
  if (plant === 'deeplink') rmSync(join(plantDir, 'methodology'), { recursive: true, force: true });
  // the plants of the executive view that are defects of an illustration file
  const svg = (name, edit) => writeFileSync(join(plantDir, 'executive', `${name}.svg`), edit(readFileSync(join(plantDir, 'executive', `${name}.svg`), 'utf8')));
  if (plant === 'exec-illustration-missing') rmSync(join(plantDir, 'executive', 'proposal.svg'));
  // the plants of the animated illustration (shell 0.14.0): the file loses its reduced-motion block, keeps a block that stops
  // nothing, or plays for longer than the limit
  if (plant === 'anim-no-reduced') svg('pain', (x) => x.replace(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\}\s*\}/, ''));
  if (plant === 'anim-keeps-moving') svg('pain', (x) => x.replace('animation: none;', 'animation-play-state: running;'));
  if (plant === 'anim-too-long') svg('pain', (x) => x.replaceAll(' 4s ', ' 11s '));
  if (plant === 'exec-illustration-colour') svg('pain', (x) => x.replaceAll('var(--color-fg)', '#1f77b4'));
  if (plant === 'exec-illustration-chart') svg('situation', (x) => x.replace('<svg ', '<svg data-chart="true" '));
  if (plant === 'exec-illustration-label-outside') {
    const extra = (lang, text) => `  <text data-lang="${lang}" x="440" y="40" font-size="15" fill="var(--color-fg)">${text}</text>
`;
    svg('pain', (x) => x.replace('</svg>', `${extra('en', 'Past the edge of the drawing')}${extra('es', 'Fuera del borde del dibujo')}</svg>`));
  }
  if (plant === 'fallback-json') writeFileSync(join(plantDir, 'data', 'artifact.json'), readFileSync(join(plantDir, 'index.html')));
  return plantDir;
}
