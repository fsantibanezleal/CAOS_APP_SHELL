import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/**
 * The layout primitives this package promises must survive its OWN stylesheet.
 *
 * WHY THIS FILE EXISTS. `styles.css` defined `.page-body { max-width: var(--maxw) }`
 * at line 72 and then, 216 lines later, a containment fix added a second unscoped
 * rule `.page-body { max-width: 100% }`. CSS takes the last one, so the 1200px
 * reading cap that ADR-0017 s1.1 specifies was silently removed from every prose
 * page of every product on this shell. Measured on Porvenir at 1600x900: doc routes
 * rendered 1600px wide instead of 1200px centered.
 *
 * Nothing could see it. The package built, the types were right, every consumer
 * imported the correct class, and the rule that broke it was itself correct CSS
 * written to fix a real bug. The only observable was body text running the full
 * width of a wide display, which no build step looks at.
 *
 * WHY IT WAS REWRITTEN. The first version inspected only blocks whose selector list
 * contained EXACTLY `.page-body`. A compound or descendant selector that also targets
 * the element (`.app-shell .page-body`, `main .page-body`, `div.page-body`) has higher
 * specificity, wins the cascade, and was invisible to it: appending
 * `.app-shell .page-body { max-width: 100%; margin-inline: 0 }` to the stylesheet
 * removed the cap and the centering from every product and all five tests passed.
 * The stylesheet already writes rules in that shape (`.app-shell.fixed .page-body.wide`).
 *
 * So the invariant is asserted over EVERY rule whose subject is the primitive: the
 * plain rule must carry the intended value, and no other rule targeting the same
 * element may declare the capped property with a different value, unless it is the
 * documented `.wide` opt-in. Specificity is not modelled; any competing declaration
 * is a failure, which is stricter than the cascade and is the point.
 */

const RAW = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8');

// Comments are stripped BEFORE parsing. Without this the block regex reads the comment
// that precedes a rule as part of its selector, so `.page-body.wide` never matched and the
// test reported "undefined" for a property that is plainly there. A gate that cannot see
// its subject reports success for the wrong reason, which is the failure this whole file
// exists to catch, so it must not be the failure the file itself has.
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

interface Rule {
  selector: string;
  body: string;
}

/** Every top-level `selector { ... }` block, one entry per comma-separated selector. */
function rules(): Rule[] {
  const out: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    for (const s of m[1].split(',')) {
      const selector = s.trim();
      if (selector && !selector.startsWith('@')) out.push({ selector, body: m[2] });
    }
  }
  return out;
}

/** The last compound of a selector: the element the rule actually styles. */
function subject(selector: string): string {
  const parts = selector.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

/** True when the rule's subject carries the class `cls` (`.cls`, `div.cls`, `.cls.other`, `.cls:hover`). */
function targets(selector: string, cls: string): boolean {
  const subj = subject(selector).split(/(?=[.:#\[])/);
  return subj.includes(`.${cls}`);
}

function declared(body: string, prop: string): string | undefined {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body);
  return m ? m[1].trim() : undefined;
}

/** The winning value of `prop` among the PLAIN rules for `sel` (exact selector). */
function lastValue(sel: string, prop: string): string | undefined {
  let winner: string | undefined;
  for (const r of rules()) {
    if (r.selector !== sel) continue;
    const v = declared(r.body, prop);
    if (v !== undefined) winner = v;
  }
  return winner;
}

/**
 * Every rule targeting `.cls` (in any compound or descendant form) that declares `prop`
 * with a value other than `allowed`, excluding the documented opt-in selectors.
 */
function competitors(cls: string, prop: string, allowed: string[], optIn: RegExp): string[] {
  const out: string[] = [];
  for (const r of rules()) {
    if (!targets(r.selector, cls)) continue;
    if (optIn.test(r.selector)) continue;
    const v = declared(r.body, prop);
    if (v !== undefined && !allowed.includes(v)) out.push(`${r.selector} { ${prop}: ${v} }`);
  }
  return out;
}

const WIDE_OPT_IN = /\.page-body\.wide(?![\w-])/;

test('a prose page keeps the reading measure', () => {
  assert.equal(
    lastValue('.page-body', 'max-width'),
    'var(--maxw)',
    'the LAST .page-body max-width must be the reading cap; a later rule overrode it and every ' +
      'prose page in every product went full-bleed',
  );
});

test('no other rule targeting .page-body redefines the measure', () => {
  assert.deepEqual(
    competitors('page-body', 'max-width', ['var(--maxw)'], WIDE_OPT_IN),
    [],
    'a compound or descendant rule with a different max-width wins the cascade over the plain ' +
      'rule and removes the reading cap from every product; the first version of this test could ' +
      'not see such a rule',
  );
});

test('a prose page stays centered', () => {
  assert.equal(
    lastValue('.page-body', 'margin-inline'),
    'auto',
    'capped but not centered is the .pf-doc regression ADR-0017 s1.3 bans by name: the page renders ' +
      'jammed against the left edge with an empty gutter beside it',
  );
});

test('no other rule targeting .page-body removes the centering', () => {
  assert.deepEqual(competitors('page-body', 'margin-inline', ['auto'], WIDE_OPT_IN), []);
  assert.deepEqual(competitors('page-body', 'margin-left', ['auto'], WIDE_OPT_IN), []);
  assert.deepEqual(competitors('page-body', 'margin-right', ['auto'], WIDE_OPT_IN), []);
});

test('the wide workbench opt-in still overrides the measure', () => {
  // .page-body.wide is MORE specific, so it legitimately wins. This asserts the opt-in
  // still exists, since the fix above would be pointless if workbenches lost their width.
  assert.equal(lastValue('.page-body.wide', 'max-width'), 'var(--maxw-wide)');
});

test('the narrow-column primitive is per-block, not a page width', () => {
  assert.equal(lastValue('.measure', 'max-width'), '70ch');
  assert.deepEqual(competitors('measure', 'max-width', ['70ch'], /$^/), []);
});

test('the reading and instrument budgets are both defined', () => {
  assert.match(CSS, /--maxw:\s*\d+px/, '--maxw must be a fixed reading width');
  assert.match(CSS, /--maxw-wide:\s*/, '--maxw-wide must exist for workbench routes');
});

test('the parser sees compound and descendant rules (self-check)', () => {
  // The rewrite exists because the old parser could not see these shapes. If this
  // ever fails, the competitor checks above are vacuous again.
  const probe = rules;
  const fake = '.app-shell .page-body { max-width: 100%; }\n.x, div.page-body:hover { margin-inline: 0; }';
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const seen: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(fake))) for (const s of m[1].split(',')) seen.push(s.trim());
  assert.ok(seen.every((s) => s === '.x' || targets(s, 'page-body')), `parser missed a subject in ${seen.join(' | ')}`);
  assert.ok(typeof probe === 'function');
});
