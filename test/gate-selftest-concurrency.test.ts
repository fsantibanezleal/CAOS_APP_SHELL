// SHG-088: resource scheduling must never disable cases or relax their measurements.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('self-test worker limits reject invalid configuration before creating fixtures', { timeout: 20000 }, () => {
  const directory = mkdtempSync(join(tmpdir(), 'gate-workers-'));
  try {
    const childEnvironment = { ...process.env };
    delete childEnvironment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', "await import('./test/selftest-workers.mjs')"], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...childEnvironment, CI: 'true', CAOS_TEMP_ROOT: directory, TEMP: directory, TMP: directory,
        CAOS_GATE_TEST_CONCURRENCY: '0' },
      stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 15000,
    });
    assert.equal(result.error, undefined, String(result.error));
    assert.doesNotMatch(result.stdout + result.stderr, /being called recursively/);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /CAOS_GATE_TEST_CONCURRENCY/);
    assert.equal(existsSync(join(directory, '.gate-selftest')), false);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    assert.ok(basename(directory).startsWith('gate-workers-'));
    rmSync(directory, { recursive: true });
  }
});

test('self-test worker limits preserve defaults and bound both suites', async () => {
  const { selfTestWorkers } = await import('./selftest-workers.mjs');
  assert.deepEqual(selfTestWorkers(undefined), { plants: 4, legitimate: 3 });
  for (const value of ['1', '2', '3', '4']) {
    const result = selfTestWorkers(value);
    assert.equal(result.plants, Number(value));
    assert.equal(result.legitimate, Math.min(3, Number(value)));
  }
  for (const value of ['', '0', '5', '-1', '1.0', '1.5', ' 1', '2x']) {
    assert.throws(() => selfTestWorkers(value), /CAOS_GATE_TEST_CONCURRENCY/);
  }
});
