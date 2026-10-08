const http = require('node:http');
const { readFileSync } = require('node:fs');
const { resolve, extname, sep } = require('node:path');

function createServer({ root = resolve(__dirname, '..'), basePath = '/', transform = (_, body) => body } = {}) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  return http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith(basePath)) { res.writeHead(404).end(); return; }
      const relative = pathname.slice(basePath.length) || 'index.html';
      const file = resolve(root, relative);
      if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const body = transform(relative, readFileSync(file));
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (_) { res.writeHead(404).end(); }
  });
}

module.exports = { createServer };
