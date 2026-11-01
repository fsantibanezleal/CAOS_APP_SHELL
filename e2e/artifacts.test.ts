import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { readJsonArtifact } from '../gate/artifacts.mjs';
let browser: Awaited<ReturnType<typeof chromium.launch>>;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test('JSON artifact verification survives navigation cancellation without excusing invalid resources', {timeout:20000}, async () => {
  for (const variant of ['valid', 'valid-cookie', 'html', 'malformed', 'missing', 'empty']) {
    const calls: Array<{url: string | undefined; probe: string | string[] | undefined; cookie: string | undefined}> = [];
    const server = createServer((req, res) => {
      if (!req.url?.startsWith('/artifact.json')) {
        res.setHeader('Content-Type', 'text/html');
        res.end(`<script>fetch('/artifact.json?v=retained-query', {headers:{'X-Audit-Probe':'kept'}})</script>`);return;
      }
      calls.push({url: req.url, probe: req.headers['x-audit-probe'], cookie: req.headers.cookie});
      if (calls.length === 1) {
        res.writeHead(200, {'Content-Type': 'application/json'});res.flushHeaders();
        const timer = setTimeout(() => res.end('{"unfinished":true}'), 5000);
        res.once('close', () => clearTimeout(timer));return;
      }
      if (variant === 'missing') res.statusCode = 404;
      if (variant === 'valid-cookie' && !req.headers.cookie?.includes('gate-session=kept')) res.statusCode = 401;
      res.setHeader('Content-Type', variant === 'html' ? 'text/html' : 'application/json');
      res.end((variant === 'valid' || variant === 'valid-cookie') ? '{"value":17}' : variant === 'html' ? '<html>fallback</html>' : variant === 'empty' ? '' : '{broken');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();assert.ok(address && typeof address !== 'string');
    const context = await browser.newContext();
    try {
      await context.addCookies([{ name: 'gate-session', value: 'kept', url: `http://127.0.0.1:${address.port}` }]);
      const page = await context.newPage();
      const responsePromise = page.waitForResponse(response => response.url().includes('/artifact.json'));
      await page.goto(`http://127.0.0.1:${address.port}/`, {waitUntil:'domcontentloaded'});
      const response = await responsePromise;
      await response.request().allHeaders(); // metadata available; the response body remains pending
      const reading = readJsonArtifact(response);
      await context.close();
      const result = await reading;
      assert.equal(result.ok, variant === 'valid' || variant === 'valid-cookie', variant);
      assert.equal(result.transportRetry, true, variant);
      assert.equal(calls.length, 2, 'one bounded retry only');
      assert.equal(calls[1].url, '/artifact.json?v=retained-query');
      assert.equal(calls[1].probe, 'kept');
      if (variant === 'valid-cookie') assert.ok(calls[1].cookie?.includes('gate-session=kept'));
    } finally {
      await context.close();server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }
});
