import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Known defect 44 (shell 0.19.4): the lane badge is `nowrap`, so the Spanish replay label of 0.19.3 ("Reproduce el
 * resultado precalculado") is wider than the 248px workbench rail and spills out of it. In the rail the badge wraps
 * inside the rail; outside the rail it keeps `nowrap` (SHW-044).
 */
const CSS = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function bodyOf(selector: string): string | undefined {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    if (m[1].split(',').some((s) => s.trim() === selector)) return m[2];
  }
  return undefined;
}

test('a lane badge in the workbench rail wraps inside the rail (known defect 44)', () => {
  const badge = bodyOf('.caos-wb-rail .badge');
  assert.ok(badge, 'a rule for ".caos-wb-rail .badge" exists');
  assert.match(badge, /white-space:\s*normal/);
  assert.match(badge, /max-width:\s*100%/);
  const group = bodyOf('.caos-wb-rail .caos-badges');
  assert.ok(group, 'a rule for ".caos-wb-rail .caos-badges" exists');
  assert.match(group, /max-width:\s*100%/);
});

test('a badge outside the rail keeps nowrap', () => {
  assert.match(bodyOf('.badge') ?? '', /white-space:\s*nowrap/);
  const rails = [...CSS.matchAll(/([^{}]+)\{([^{}]*white-space:\s*normal[^{}]*)\}/g)].map((m) => m[1].trim());
  for (const sel of rails) if (/\.badge/.test(sel)) assert.match(sel, /\.caos-wb-rail|\.cs-modified/, `"${sel}" unwraps a badge outside the rail`);
});
