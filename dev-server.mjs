// Local dev server — runs api/check-link.js without Vercel login.
// Usage: node dev-server.mjs

import { createServer } from 'node:http';
import handler from './api/check-link.js';

const PORT = 3000;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

createServer(async (req, res) => {
  // Allow the Expo web preview (a different origin/port) to call this.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const body = req.method === 'POST' ? await readBody(req) : {};
  const vercelRes = {
    status(code) {
      res.statusCode = code;
      return vercelRes;
    },
    json(data) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return vercelRes;
    },
    setHeader(k, v) {
      res.setHeader(k, v);
    },
  };
  await handler({ method: req.method, body }, vercelRes);
}).listen(PORT, () => {
  console.log(`Local API running at http://localhost:${PORT}/api/check-link`);
});
