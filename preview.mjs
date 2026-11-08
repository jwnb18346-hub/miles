// 本地预览：npm run preview，默认 http://127.0.0.1:4326/（PORT 环境变量可改）
import {createServer} from 'node:http';
import {createReadStream, statSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const PORT = Number(process.env.PORT || 4326);
const HOST = '127.0.0.1';
const root = path.dirname(fileURLToPath(import.meta.url));
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'};

createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname); } catch { res.writeHead(400).end(); return; }
  let file = path.join(root, pathname);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404, {'content-type': TYPES['.html']}); createReadStream(path.join(root, '404.html')).pipe(res); return; }
  const size = statSync(file).size, type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, {'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1});
    createReadStream(file, {start, end}).pipe(res); return;
  }
  res.writeHead(200, {'content-type': type, 'accept-ranges': 'bytes', 'content-length': size, 'cache-control': 'no-cache'});
  createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => console.log(`MILES preview: http://${HOST}:${PORT}/`));
