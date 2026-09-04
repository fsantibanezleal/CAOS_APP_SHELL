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
 * So the invariant is asserted on the stylesheet text: for each primitive, the LAST
 * declaration of the capped property must be the intended one. A future rule that
 * overrides a primitive fails here instead of shipping to thirty apps.
 */

const RAW = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8');

// Comments are stripped BEFORE parsing. Without this the block regex reads the comment
// that precedes a rule as part of its selector, so `.page-body.wide` never matched and the
// test reported "undefined" for a property that is plainly there. A gate that cannot see
// its subject reports success for the wrong reason, which is the failure this whole file
// exists to catch, so it must not be the failure the file itself has.
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every `selector { ... }` block whose selector list contains exactly `sel`. */
function blocksFor(sel: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    const selectors = m[1].split(',').map((s) => s.trim());
    if (selectors.includes(sel)) out.push(m[2]);
  }
  return out;
}

/** The winning value of `prop` for `sel`, ignoring specificity (all these are single-class). */
function lastValue(sel: string, prop: string): string | undefined {
  let winner: string | undefined;
  for (const body of blocksFor(sel)) {
    const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body);
    if (m) winner = m[1].trim();
  }
  return winner;
}

test('a prose page keeps the reading measure', () => {
  assert.equal(
    lastValue('.page-body', 'max-width'),
    'var(--maxw)',
    'the LAST .page-body max-width must be the reading cap; a later rule overrode it and every ' +
      'prose page in every product went full-bleed',
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

test('the wide workbench opt-in still overrides the measure', () => {
  // .page-body.wide is MORE specific, so it legitimately wins. This asserts the opt-in
  // still exists, since the fix above would be pointless if workbenches lost their width.
  assert.equal(lastValue('.page-body.wide', 'max-width'), 'var(--maxw-wide)');
});

test('the narrow-column primitive is per-block, not a page width', () => {
  assert.equal(lastValue('.measure', 'max-width'), '70ch');
});

test('the reading and instrument budgets are both defined', () => {
  assert.match(CSS, /--maxw:\s*\d+px/, '--maxw must be a fixed reading width');
  assert.match(CSS, /--maxw-wide:\s*/, '--maxw-wide must exist for workbench routes');
});
