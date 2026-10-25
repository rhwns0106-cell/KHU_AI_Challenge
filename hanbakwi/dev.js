// 로컬 실행: node dev.js → http://localhost:5174  (정적 파일 + /api/ai, 키는 ../.env)
const http = require('http'), fs = require('fs'), path = require('path');
for (const line of fs.readFileSync(path.join(__dirname, '../.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const ai = require('./api/ai.js');
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json'};
http.createServer((req, res) => {
  res.status = c => (res.statusCode = c, res);
  res.json = o => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(o)));
  if (req.url.startsWith('/api/ai')) {
    let b = ''; req.on('data', c => b += c);
    return req.on('end', () => { try { req.body = JSON.parse(b || '{}'); } catch (e) { req.body = {}; } ai(req, res); });
  }
  const f = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : path.normalize(decodeURIComponent(req.url.split('?')[0])));
  if (!f.startsWith(__dirname) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.status(404).end('not found');
  res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(5174, () => console.log('http://localhost:5174'));
