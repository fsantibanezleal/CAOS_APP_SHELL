// Writes reserved-classes.json: the classes the shell's stylesheets define, in two kinds (ADR-0078, S17).
//   components  a class the shell styles on its own (`.chip`, `.tablist`, `.caos-plot`): a product never restyles it;
//   modifiers   a state or variant the shell uses only joined to another class (`.on` in `.chip.on`, `.wide` in
//               `.page-body.wide`): a product may join it to ITS OWN class (`.my-row.on`), never use it alone.
// `classes` lists both, for readers of the 0.7 format. The template's web-baseline guard reads this file from the
// installed package and judges each product rule by the classes of its subject (the last compound).
// Until 0.8.0 the list was one set of words: it reserved `on`, `active`, `fill`, `wide` outright, so the guard refused
// `.my-row.on`, and it reserved `css`, read from the `@import "katex.min.css"` line.
import { readFileSync, writeFileSync } from 'node:fs';

const css = ['styles.css', 'chart.css']
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*@import[^;]*;/gm, '');

const alone = new Set();
const joined = new Set();
for (const m of css.matchAll(/([^{}@]+)\{[^{}]*\}/g)) {
  for (const selector of m[1].split(',')) {
    // compounds: split on combinators and whitespace, outside of :is()/:not() arguments
    const flat = selector.replace(/\([^()]*\)/g, (inner) => inner.replace(/[\s>+~]/g, ''));
    for (const compound of flat.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean)) {
      const own = compound.replace(/\([^()]*\)/g, '');
      const classes = [...own.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((c) => c[1]).filter((c) => !/^(u-|\d)/.test(c));
      // `a.active` and `svg.lucide` join a class to an element: the class is a state there, as in `.chip.on`
      if (classes.length === 1 && !/^[a-zA-Z]/.test(own)) alone.add(classes[0]);
      else for (const c of classes) joined.add(c);
      // classes inside :is(...) / :not(...) arguments are named on their own
      for (const arg of compound.matchAll(/\(([^()]*)\)/g)) {
        for (const c of arg[1].matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) if (!/^(u-|\d)/.test(c[1])) alone.add(c[1]);
      }
    }
  }
}
const components = [...alone].sort();
const modifiers = [...joined].filter((c) => !alone.has(c)).sort();
const classes = [...new Set([...components, ...modifiers])].sort();
writeFileSync(
  'reserved-classes.json',
  JSON.stringify({ generated_from: ['styles.css', 'chart.css'], components, modifiers, classes }, null, 2) + '\n',
);
console.log(`reserved-classes.json: ${components.length} components, ${modifiers.length} modifiers`);
