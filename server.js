const WebSocket = require('ws');

const PORT = parseInt(process.argv[2], 10) || 3456;
const wss = new WebSocket.Server({ port: PORT });

const players = new Map();
let nextId = 1;

wss.on('connection', (ws) => {
  const id = nextId++;
  players.set(id, { ws, data: null });

  ws.send(JSON.stringify({ type: 'id', id }));

  for (const [pid, p] of players) {
    if (pid !== id && p.data) {
      ws.send(JSON.stringify({ type: 'player', id: pid, data: p.data }));
    }
  }

  const joinMsg = JSON.stringify({ type: 'join', id });
  for (const [pid, p] of players) {
    if (pid !== id && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(joinMsg);
    }
  }

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    if (data.type !== 'state') return;
    players.get(id).data = data;
    const broadcast = JSON.stringify({ type: 'player', id, data });
    for (const [pid, p] of players) {
      if (pid !== id && p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(broadcast);
      }
    }
  });

  ws.on('close', () => {
    players.delete(id);
    const msg = JSON.stringify({ type: 'leave', id });
    for (const [pid, p] of players) {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(msg);
      }
    }
    console.log('Игрок #' + id + ' отключился. Онлайн: ' + players.size);
  });

  console.log('Игрок #' + id + ' подключился. Онлайн: ' + players.size);
});

console.log('Арбузилла — мультиплеер сервер запущен на порту ' + PORT);
console.log('Игроки подключаются по адресу: ws://YOUR_IP:' + PORT);
