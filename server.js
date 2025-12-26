const aedes = require('aedes')();
const net = require('net');
const http = require('http');
const ws = require('ws');
const fs = require('fs');
const path = require('path');

// Cấu hình ports
const TCP_PORT = process.env.MQTT_PORT || 1883;
const WS_PORT = process.env.WS_PORT || 8883;
const MONITOR_PORT = 3000;

// WebSocket clients cho monitoring
const monitorClients = new Set();

// ===== MQTT over TCP =====
const tcpServer = net.createServer(aedes.handle);

tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
  console.log(`✅ MQTT over TCP started on port ${TCP_PORT}`);
});

// ===== MQTT over WebSocket =====
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Aedes MQTT Broker\n');
});

const wsServer = new ws.Server({ server: httpServer });

wsServer.on('connection', (socket) => {
  const stream = ws.createWebSocketStream(socket);
  aedes.handle(stream);
});

httpServer.listen(WS_PORT, '0.0.0.0', () => {
  console.log(`✅ MQTT over WebSocket started on port ${WS_PORT}`);
});

// ===== Web Monitor Interface =====
const monitorServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const monitorWs = new ws.Server({ server: monitorServer });

monitorWs.on('connection', (socket) => {
  monitorClients.add(socket);
  console.log('Monitor client connected');
  
  socket.on('close', () => {
    monitorClients.delete(socket);
    console.log('Monitor client disconnected');
  });
});

monitorServer.listen(MONITOR_PORT, '0.0.0.0', () => {
  console.log(`✅ Web Monitor started on http://localhost:${MONITOR_PORT}`);
});

// Broadcast to all monitor clients
function broadcastToMonitors(data) {
  const message = JSON.stringify(data);
  monitorClients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(message);
    }
  });
}

// ===== Event logging & monitoring =====
aedes.on('client', (client) => {
  console.log(`[CLIENT CONNECTED] ${client.id}`);
  broadcastToMonitors({
    type: 'client',
    clientId: client.id,
    timestamp: new Date().toISOString()
  });
});

aedes.on('clientDisconnect', (client) => {
  console.log(`[CLIENT DISCONNECTED] ${client.id}`);
  broadcastToMonitors({
    type: 'clientDisconnect',
    clientId: client.id,
    timestamp: new Date().toISOString()
  });
});

aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`[PUBLISH] ${client.id} -> ${packet.topic}: ${packet.payload.toString()}`);
    broadcastToMonitors({
      type: 'publish',
      clientId: client.id,
      topic: packet.topic,
      payload: packet.payload.toString(),
      timestamp: new Date().toISOString()
    });
  }
});

aedes.on('subscribe', (subscriptions, client) => {
  const topics = subscriptions.map(s => s.topic);
  console.log(`[SUBSCRIBE] ${client.id} -> ${topics.join(', ')}`);
  broadcastToMonitors({
    type: 'subscribe',
    clientId: client.id,
    topics: topics,
    timestamp: new Date().toISOString()
  });
});

// ===== Graceful shutdown =====
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  console.log('\nShutting down...');
  tcpServer.close();
  wsServer.close();
  httpServer.close();
  aedes.close(() => {
    console.log('Broker stopped');
    process.exit(0);
  });
}
