const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleAiExplainRequest } = require('./server/ai-explain-http-adapter');
const { createConfiguredAiProvider } = require('./server/ai-provider-runtime');

const root = __dirname;
const host = '127.0.0.1';
const port = 5500;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function createAirCalcServer(options = {}) {
  const serverHost = options.host || host;
  const serverPort = options.port || port;
  const aiProvider = Object.prototype.hasOwnProperty.call(options, 'provider')
    ? options.provider
    : createConfiguredAiProvider();

  return http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (urlPath === '/api/ai/explain') {
    handleAiExplainRequest(req, res, {
      provider: aiProvider,
      allowedOrigins: [
        `http://${serverHost}:${serverPort}`,
        'http://localhost:5500',
        'http://127.0.0.1:5500'
      ]
    }).catch((err) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, reason: 'local_ai_adapter_error', detail: err && err.message }));
    });
    return;
  }

  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(root, relative));

  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  let finalPath = filePath;
  try {
    const stat = fs.existsSync(finalPath) ? fs.statSync(finalPath) : null;
    if (stat && stat.isDirectory()) finalPath = path.join(finalPath, 'index.html');
  } catch (_) {}

  fs.readFile(finalPath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    res.setHeader('Content-Type', mime[path.extname(finalPath).toLowerCase()] || 'application/octet-stream');
    res.end(data);
  });
  });
}

if (require.main === module) {
  createAirCalcServer({ host, port }).listen(port, host, () => {
    console.log(`AirCalc local server running at http://${host}:${port}/app/index.html`);
  });
}

module.exports = {
  createAirCalcServer
};
