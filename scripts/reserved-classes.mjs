// Writes reserved-classes.json: every class the shell's stylesheets define. Products compose these and never redefine
// them (ADR-0078); the template's web-baseline guard reads this file from the installed package. Run before build.
import { readFileSync, writeFileSync } from 'node:fs';

const css = ['styles.css', 'chart.css'].map((f) => readFileSync(f, 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const classes = new Set();
for (const m of css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
  if (!/^(min|u-)/.test(m[1]) && !/^\d/.test(m[1])) classes.add(m[1]);
}
const list = [...classes].sort();
writeFileSync('reserved-classes.json', JSON.stringify({ generated_from: ['styles.css', 'chart.css'], classes: list }, null, 2) + '\n');
console.log(`reserved-classes.json: ${list.length} classes`);
