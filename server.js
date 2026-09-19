import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const PORT = Number.parseInt(process.env.PORT ?? process.argv[2] ?? '3456', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const MAX_MESSAGE_BYTES = 16 * 1024;

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.woff2', 'font/woff2'],
]);

const ROUTE_ALIASES = new Map([
  ['/', '/index.html'],
  ['/game', '/index3d.html'],
  ['/game/', '/index3d.html'],
  ['/arcade', '/arcade.html'],
  ['/arcade/', '/arcade.html'],
  ['/projection-hall', '/projection-hall/index.html'],
  ['/projection-hall/', '/projection-hall/index.html'],
]);

const BLOCKED_PREFIXES = [
  '/.git',
  '/node_modules',
  '/tests',
  '/test-bot',
  '/server.js',
  '/package.json',
  '/package-lock.json',
];

function applySecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: https://cdn.jsdelivr.net",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  );
}

function sendText(response, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  applySecurityHeaders(response);
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

function safeRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://localhost').pathname);
  } catch {
    return null;
  }

  pathname = ROUTE_ALIASES.get(pathname) ?? pathname;
  if (pathname.includes('\0') || BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  const resolved = path.resolve(ROOT, `.${pathname}`);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) return null;
  return resolved;
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Method Not Allowed');
    return;
  }

  let filePath = safeRequestPath(request.url);
  if (!filePath) {
    sendText(response, 404, 'Not Found');
    return;
  }

  try {
    let fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fileStat = await stat(filePath);
    }
    if (!fileStat.isFile()) throw new Error('Not a file');

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME.get(extension) ?? 'application/octet-stream';
    const etag = `W/\"${fileStat.size}-${Math.trunc(fileStat.mtimeMs)}\"`;

    applySecurityHeaders(response);
    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', fileStat.size);
    response.setHeader('ETag', etag);
    response.setHeader(
      'Cache-Control',
      extension === '.html' ? 'no-cache' : 'public, max-age=3600, must-revalidate',
    );

    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304);
      response.end();
      return;
    }

    response.writeHead(200);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!response.headersSent) sendText(response, 500, 'Internal Server Error');
      else response.destroy();
    });
    stream.pipe(response);
  } catch {
    sendText(response, 404, 'Not Found');
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });
const players = new Map();
let nextId = 1;

function broadcast(message, exceptId = null) {
  const payload = JSON.stringify(message);
  for (const [id, client] of players) {
    if (id === exceptId || client.socket.readyState !== WebSocket.OPEN) continue;
    client.socket.send(payload);
  }
}

function sanitiseState(message) {
  const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);
  const position = message.position ?? message.pos ?? {};
  return {
    type: 'state',
    nickname: String(message.nickname ?? message.nick ?? 'Арбуз').trim().slice(0, 24) || 'Арбуз',
    position: {
      x: finite(position.x),
      y: finite(position.y),
      z: finite(position.z),
    },
    yaw: finite(message.yaw),
    hp: Math.max(0, finite(message.hp, 100)),
    level: Math.max(1, Math.trunc(finite(message.level, 1))),
    animation: String(message.animation ?? 'idle').slice(0, 24),
    sentAt: Date.now(),
  };
}

wss.on('connection', (socket) => {
  const id = nextId++;
  const client = { socket, state: null, alive: true };
  players.set(id, client);

  socket.on('pong', () => { client.alive = true; });
  socket.send(JSON.stringify({
    type: 'welcome',
    id,
    players: [...players]
      .filter(([playerId, entry]) => playerId !== id && entry.state)
      .map(([playerId, entry]) => ({ id: playerId, state: entry.state })),
  }));
  broadcast({ type: 'join', id }, id);

  socket.on('message', (raw, isBinary) => {
    if (isBinary || raw.byteLength > MAX_MESSAGE_BYTES) return;

    let message;
    try {
      message = JSON.parse(raw.toString('utf8'));
    } catch {
      return;
    }
    if (!message || message.type !== 'state') return;

    client.state = sanitiseState(message);
    broadcast({ type: 'player', id, state: client.state }, id);
  });

  socket.on('close', () => {
    players.delete(id);
    broadcast({ type: 'leave', id });
  });

  socket.on('error', () => {
    socket.close();
  });
});

const heartbeat = setInterval(() => {
  for (const [id, client] of players) {
    if (!client.alive) {
      client.socket.terminate();
      players.delete(id);
      broadcast({ type: 'leave', id });
      continue;
    }
    client.alive = false;
    client.socket.ping();
  }
}, 30_000);
heartbeat.unref();

function shutdown() {
  clearInterval(heartbeat);
  for (const { socket } of players.values()) socket.close(1001, 'Server shutting down');
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 2_000).unref();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

server.listen(PORT, HOST, () => {
  const localHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`🍉 Arbuz Souls запущен: http://${localHost}:${PORT}`);
  console.log(`🎮 Кампания: http://${localHost}:${PORT}/game`);
  console.log(`🌐 WebSocket relay: ws://${localHost}:${PORT}/ws`);
});
