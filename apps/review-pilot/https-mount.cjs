// Mounted before the shared host's JSON parser. No DNS/tunnel/auth-policy changes.
// Only /sylar is forwarded; every other shared-host route remains untouched.
const http = require('node:http');
module.exports = function sylarMount(req, res) {
  const headers = {};
  for (const key of ['content-type', 'content-length', 'origin', 'x-pilot-csrf', 'authorization']) {
    if (req.headers[key]) headers[key] = req.headers[key];
  }
  const pilotCookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('pilot='));
  if (pilotCookie) headers.cookie = pilotCookie;
  const upstream = http.request({hostname:'127.0.0.1', port:18794, method:req.method,
    path:req.originalUrl, headers, timeout:35000}, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end('{"error":"temporarily_unavailable"}'); });
  upstream.on('timeout', () => upstream.destroy());
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
  req.pipe(upstream);
};
