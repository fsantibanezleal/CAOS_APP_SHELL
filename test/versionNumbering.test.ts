import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/**
 * One release, two spellings (docs/09_versions.md, ADR-0068). Until 0.19.007 the npm page showed only the semver form
 * (0.19.6) while the tags, VERSION and the CHANGELOG showed the display form (0.19.006), and nothing published said
 * they were the same release; the package shipped neither VERSION nor the CHANGELOG.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json')) as { version: string; files: string[] };
const display = read('VERSION').trim();

/** `0.19.007` is `0.19.7`: the display form with its zeros dropped. */
function semverOf(d: string): string {
  const m = /^(\d+)\.(\d{2})\.(\d{3})$/.exec(d);
  assert.ok(m, `${d} is X.XX.XXX`);
  return [m[1], m[2], m[3]].map((x) => String(Number(x))).join('.');
}

/** `0.19.7` is `v0.19.007`. */
function tagOf(semver: string): string {
  const [a, b, c] = semver.split('.').map(Number);
  return `v${a}.${String(b).padStart(2, '0')}.${String(c).padStart(3, '0')}`;
}

test('SHR-001: the npm package carries VERSION and the CHANGELOG, so the npm page shows the display form', () => {
  assert.ok(pkg.files.includes('VERSION'), 'package.json files lists VERSION');
  assert.ok(pkg.files.includes('CHANGELOG.md'), 'package.json files lists CHANGELOG.md');
});

test('SHR-002: package.json holds the semver form of VERSION and the CHANGELOG opens on VERSION', () => {
  assert.equal(pkg.version, semverOf(display));
  const top = /^## \[([^\]]+)\]/m.exec(read('CHANGELOG.md'));
  assert.ok(top, 'the CHANGELOG has a release heading');
  assert.equal(top[1], display);
});

test('SHR-003: the README names both spellings, with an npm badge beside the tag badge, and links the version map', () => {
  const readme = read('README.md');
  assert.match(readme, /img\.shields\.io\/npm\/v\/@fasl-work\/caos-app-shell/);
  assert.match(readme, /img\.shields\.io\/github\/v\/tag\/fsantibanezleal\/CAOS_APP_SHELL/);
  assert.match(readme, /docs\/09_versions\.md/);
});

test('SHR-004: every single-version row of the version map names the tag of its npm version, except the one documented', () => {
  const rows = read('docs/09_versions.md')
    .split(/\r?\n/)
    .filter((l) => /^\| \d+\.\d+\.\d+ \|/.test(l))
    .map((l) => l.split('|').map((c) => c.trim()));
  assert.ok(rows.length >= 10, 'the map lists the published versions');
  for (const [, npm, disp, tag] of rows) {
    assert.equal(disp, tagOf(npm).slice(1), `${npm} reads ${disp}`);
    if (tag === 'none') continue;
    const named = /`(v[\d.]+)`/.exec(tag)?.[1];
    if (npm === '0.2.0') {
      assert.equal(named, 'v0.2.0', 'the one unpadded tag, kept as published');
      continue;
    }
    assert.equal(named, tagOf(npm), `${npm} is tagged ${tagOf(npm)}`);
  }
});
