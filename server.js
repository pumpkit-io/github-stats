import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchActivity } from './src/github.js';

const files = {'/': ['index.html','text/html; charset=utf-8'], '/app.js':['app.js','text/javascript; charset=utf-8'], '/style.css':['style.css','text/css; charset=utf-8']};
export function createApp({fetch: fetcher = globalThis.fetch, org = process.env.GITHUB_ORG, token = process.env.GITHUB_TOKEN} = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!/^(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$/i.test(req.headers.host || '')) { res.writeHead(403).end(); return; }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    let path;
    try { path = new URL(req.url, 'http://localhost').pathname; }
    catch { res.writeHead(400).end(); return; }
    if (path === '/api/activity') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      try {
        if (!org || !token) throw new Error('Set GITHUB_ORG and GITHUB_TOKEN, then restart the server.');
        const result = await fetchActivity({fetcher, org, token});
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(502).end(JSON.stringify({error: error.message || 'GitHub data could not be loaded. Try again.'}));
      }
      return;
    }
    if (!files[path]) { res.writeHead(404).end(); return; }
    try { const [name, type] = files[path]; res.setHeader('Content-Type', type); res.end(await readFile(new URL(`./public/${name}`, import.meta.url))); }
    catch { res.writeHead(500).end(); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '127.0.0.1', () => console.log(`Dashboard: http://127.0.0.1:${port}`));
}
