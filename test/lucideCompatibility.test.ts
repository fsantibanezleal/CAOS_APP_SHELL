import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

test('the public shell entry bundles against the installed current Lucide ESM exports', async () => {
  // Library builds externalize peer dependencies. A consumer bundle must resolve
  // them: this catches removed named icons that a tsup ESM build can leave behind.
  const result = await build({
    absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
    entryPoints: ['src/index.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    logLevel: 'silent',
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react-router', 'katex', 'zustand'],
  });
  assert.equal(result.errors.length, 0);
  assert.equal(result.outputFiles.length, 1);
  assert.ok(result.outputFiles[0].text.length > 0);
});
