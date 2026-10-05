#!/usr/bin/env node
// caos-shell-gate: the measured web baseline of a CAOS product (ADR-0071, ADR-0017, ADR-0016, ADR-0078).
// The checks and the traps each one embeds are listed in gate/run.mjs; the self-test (npm run test:gate in the
// shell repository) plants one defect per check and requires each to fail.
//
// Usage:
//   npx caos-shell-gate --serve dist --expect-brand "Contraste"            a Pages-faithful server over the build
//   npx caos-shell-gate --url https://contraste.fasl-work.com --expect-brand "Contraste"     the deployed origin
// Options:
//   --base-path /Repo/           the site's base path with --serve (a project page); default /
//   --routes /,/methodology      the routes; default: read from the header navigation
//   --workbench /                the routes that carry the case workbench; default /
//   --sizes 390x844,...,2560x1440  --themes light,dark  --langs en,es
//   --case-sample id1,id2        cases walked outside the primary mode; default the first and the last
//   --single-case                the workbench has one case and no case control
//   --idle-ms 3000  --settle-ms 15000  --text-floor 400  --instrument-min 0.5  --stage-fill-min 0.3
//   --out gate-output            report (gate-report.json) and screenshots (shots/)
// Needs `playwright` in the consuming project (optional peer dependency). Exit 1 on any failure, 2 on misuse.

import { runGate } from '../gate/run.mjs';

const FLAGS = new Set(['single-case']);
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const key = a.slice(2);
  if (FLAGS.has(key)) args[key] = true;
  else args[key] = argv[i + 1];
  if (!FLAGS.has(key)) i += 1;
}
const num = (k) => (args[k] === undefined ? undefined : Number(args[k]));
const options = {
  url: args.url,
  serve: args.serve,
  basePath: args['base-path'],
  expectBrand: args['expect-brand'],
  routes: args.routes,
  workbench: args.workbench,
  sizes: args.sizes,
  themes: args.themes,
  langs: args.langs,
  caseSample: args['case-sample'],
  singleCase: args['single-case'] === true,
  idleMs: num('idle-ms'),
  settleMs: num('settle-ms'),
  textFloor: num('text-floor'),
  instrumentMin: num('instrument-min'),
  stageFillMin: num('stage-fill-min'),
  out: args.out,
};
for (const k of Object.keys(options)) if (options[k] === undefined) delete options[k];

let report;
try {
  report = await runGate(options);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
const shown = report.failures.slice(0, 80);
for (const f of shown) console.log(`FAIL [${f.check}] ${f.route} ${f.mode}${f.trail ? ` (${f.trail})` : ''}: ${f.message}`);
if (report.failures.length > shown.length) console.log(`... and ${report.failures.length - shown.length} more in ${options.out ?? 'gate-output'}/gate-report.json`);
const counts = Object.entries(report.checks).map(([k, n]) => `${k} ${n}`).join(', ');
console.log(report.ok ? `caos-shell-gate: OK, ${report.states} measured states` : `caos-shell-gate: ${report.failures.length} failure(s) in ${report.states} measured states (${counts})`);
process.exit(report.ok ? 0 : 1);
