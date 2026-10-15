import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

/**
 * The CI base-integrity guard step (`.github/workflows/ci.yml`), run as GitHub runs it on planted trees. Until 0.14.3 its .env test
 * let a real `.env` pass whenever a root `.env.example` was tracked, and failed a tree whose only example file is nested.
 */

const root = fileURLToPath(new URL('..', import.meta.url));

/** The `run: |` block of the guard step, dedented: the very script CI runs. */
function guardScript(): string {
  const lines = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8').split(/\r?\n/);
  const start = lines.findIndex((x) => x.trim().startsWith('- name: Base-integrity guards'));
  assert.ok(start >= 0, 'the guard step is in the workflow');
  assert.equal(lines[start + 1].trim(), 'run: |');
  const body: string[] = [];
  let indent = -1;
  for (const x of lines.slice(start + 2)) {
    if (!x.trim()) {
      body.push('');
      continue;
    }
    const lead = x.length - x.trimStart().length;
    if (indent < 0) indent = lead;
    if (lead < indent) break;
    body.push(x.slice(indent));
  }
  return `${body.join('\n')}\n`;
}

/** Git's bash on Windows (the `bash` on PATH there is often WSL's, which cannot read a Windows path), else the PATH's. */
function bash(): string | null {
  if (process.platform !== 'win32') return 'bash';
  try {
    const git = execFileSync('where', ['git'], { encoding: 'utf8' }).split(/\r?\n/)[0].trim();
    for (const cand of [join(dirname(dirname(git)), 'bin', 'bash.exe'), join(dirname(dirname(dirname(git))), 'bin', 'bash.exe')]) {
      if (existsSync(cand)) return cand;
    }
  } catch {
    // no git on PATH
  }
  return null;
}

// Inside the checkout's ignored work folder, never the system temp directory.
const work = fileURLToPath(new URL('../.gate-selftest/', import.meta.url));
mkdirSync(work, { recursive: true });
const made: string[] = [];
after(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function runGuard(files: string[]): { code: number | null; out: string } {
  const dir = mkdtempSync(join(work, 'ci-guard-'));
  made.push(dir);
  const tree = join(dir, 'tree');
  for (const f of files) {
    mkdirSync(dirname(join(tree, f)), { recursive: true });
    writeFileSync(join(tree, f), 'x\n');
  }
  execFileSync('git', ['init', '-q'], { cwd: tree });
  execFileSync('git', ['add', '-A'], { cwd: tree });
  const script = join(dir, 'guard.sh');
  writeFileSync(script, guardScript());
  // GitHub's default for a step without a shell: `bash -e {0}`
  const res = spawnSync(bash() as string, ['-e', script], { cwd: tree, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

const cases: Array<[string[], string | null]> = [
  [['.env.example', 'README.md'], null],
  [['frontend/.env.example', 'README.md'], null],
  [['.env', '.env.example', 'README.md'], 'a real .env is tracked'],
  [['web/.env.local', '.env.example'], 'a real .env is tracked'],
  [['README.md', 'dist/index.js'], 'dist/ is tracked'],
];

for (const [files, error] of cases) {
  test(`the CI guard step ${error ? `fails "${error}"` : 'passes'} on ${files.join(', ')}`, { skip: bash() === null && 'no bash found' }, () => {
    const r = runGuard(files);
    if (error === null) assert.ok(r.code === 0 && r.out.includes('guards: OK'), r.out);
    else assert.ok(r.code === 1 && r.out.includes(error), r.out);
  });
}
