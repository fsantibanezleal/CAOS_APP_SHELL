// A static server that answers the way GitHub Pages does, so a local gate run sees what the deployed site will:
// an existing file is 200; a directory without a trailing slash is a 301 to the slash; a directory with one serves its
// index.html; `/name` falls back to `name.html`; anything else is 404 with the site's 404.html. There is no SPA
// fallback, which is the point: a route that was not materialised, or an artifact missing from the build, fails here
// exactly as it would on Pages (failure classes 2 and 22: deep links that 404, artifacts answered with HTML).

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
};

/**
 * @param {string} dir the built site
 * @param {string} basePath the site's base path ('/' for a custom domain, '/Repo/' for a project page)
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export function servePages(dir, basePath = '/') {
  const root = resolve(dir);
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const notFound = join(root, '404.html');
  const server = createServer((req, res) => {
    const send = (status, file, headers = {}) => {
      res.writeHead(status, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store', ...headers });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
    };
    const missing = () => {
      if (existsSync(notFound)) send(404, notFound);
      else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404');
      }
    };
    let path;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    } catch {
      return missing();
    }
    if (`${path}/` === base) {
      res.writeHead(301, { Location: base });
      return res.end();
    }
    if (!path.startsWith(base)) return missing();
    const rel = path.slice(base.length);
    const file = normalize(join(root, rel));
    if (file !== root && !file.startsWith(root + sep)) return missing();
    if (existsSync(file)) {
      const st = statSync(file);
      if (st.isFile()) return send(200, file);
      if (st.isDirectory()) {
        const index = join(file, 'index.html');
        if (!existsSync(index)) return missing();
        if (!path.endsWith('/')) {
          res.writeHead(301, { Location: `${path}/` });
          return res.end();
        }
        return send(200, index);
      }
    }
    if (!path.endsWith('/') && existsSync(`${file}.html`)) return send(200, `${file}.html`);
    return missing();
  });
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      ok({
        url: `http://127.0.0.1:${port}${base}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
