// broker.js
'use strict';

const Aedes = require('aedes');
const http = require('http');
const ws = require('ws');
const { Duplex } = require('stream');

const aedes = Aedes();

// --- Simple in-memory users map (demo) ---
const users = new Map([
  ['alice', 'password123'],
  ['bob', 'secret']
]);

// Authentication
aedes.authenticate = function (client, username, password, callback) {
  const pw = password ? password.toString() : null;
  if (!username || !pw) {
    const err = new Error('Auth failed: missing username/password');
    err.returnCode = 4;
    return callback(err, false);
  }
  const expected = users.get(username);
  if (expected && pw === expected) {
    client.user = { name: username };
    return callback(null, true);
  }
  const err = new Error('Auth failed');
  err.returnCode = 4;
  return callback(err, false);
};

// Simple ACL examples
aedes.authorizePublish = (client, packet, cb) => {
  if (packet.topic && packet.topic.startsWith('$SYS')) {
    return cb(new Error('Publish to $SYS denied'));
  }
  if (client && client.user && client.user.name === 'bob' && !packet.topic.startsWith('bob/')) {
    return cb(new Error('bob can only publish to bob/#'));
  }
  cb(null);
};

aedes.authorizeSubscribe = (client, sub, cb) => {
  if (client && client.user && client.user.name === 'alice') {
    return cb(null, sub);
  }
  if (client && client.user && client.user.name === 'bob') {
    if (sub.topic.startsWith('bob/') || sub.topic.startsWith('common/')) {
      return cb(null, sub);
    }
    return cb(new Error('bob cannot subscribe to that topic'));
  }
  return cb(new Error('Subscribe not allowed'));
};

// Logging
aedes.on('clientReady', client => {
  console.log(`[${new Date().toISOString()}] client connected: id=${client.id} user=${client.user ? client.user.name : 'anonymous'}`);
});
aedes.on('clientDisconnect', client => {
  console.log(`[${new Date().toISOString()}] client disconnected: id=${client.id}`);
});
aedes.on('publish', (packet, client) => {
  const from = client ? `${client.id}` : 'BROKER';
  console.log(`[${new Date().toISOString()}] PUBLISH from=${from} topic=${packet.topic} payload=${packet.payload && packet.payload.toString()}`);
});

// --- Helper: convert ws socket to Duplex stream so aedes.handle can use it ---
function wsToStream(wsSocket) {
  const stream = new Duplex({
    read(size) {
      // reading is driven by incoming ws 'message' events below
    },
    write(chunk, encoding, callback) {
      if (wsSocket.readyState === wsSocket.OPEN) {
        // ws.send accepts Buffer directly
        wsSocket.send(chunk, callback);
      } else {
        callback(new Error('Socket not open'));
      }
    }
  });

  wsSocket.on('message', (msg) => {
    // msg is Buffer or string; push Buffer into stream
    if (typeof msg === 'string') {
      stream.push(Buffer.from(msg));
    } else {
      stream.push(msg);
    }
  });

  wsSocket.on('close', () => {
    stream.push(null); // EOF
  });

  wsSocket.on('error', (err) => {
    stream.destroy(err);
  });

  stream.on('finish', () => {
    try { wsSocket.close(); } catch (e) { /* ignore */ }
  });

  return stream;
}

// --- MQTT over TCP (traditional MQTT) ---
const net = require('net');
const MQTT_PORT = process.env.MQTT_PORT || 1883;

const tcpServer = net.createServer(aedes.handle);
tcpServer.listen(MQTT_PORT, '0.0.0.0', () => {
  console.log(`✅ MQTT over TCP listening on port ${MQTT_PORT}`);
});

// --- MQTT over WebSocket ---
const WS_PORT = process.env.WS_PORT || 8883;
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Aedes MQTT Broker\nTCP: 1883\nWebSocket: 8883\n');
});

// Create WebSocket server bound to the HTTP server
const wss = new ws.Server({ server: httpServer });

// On incoming WS connection, wrap and hand to aedes
wss.on('connection', (socket, req) => {
  // Optionally inspect req.headers for auth or origin checking
  const stream = wsToStream(socket);
  // Attach a simple id if you want
  // stream.id = req.headers['sec-websocket-key'] || `ws-${Date.now()}`;
  aedes.handle(stream);
});

// Start WebSocket server
httpServer.listen(WS_PORT, '0.0.0.0', () => {
  console.log(`✅ MQTT over WebSocket listening on port ${WS_PORT}`);
  console.log(`📡 Connect via: ws://<your-ip>:${WS_PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down broker...');
  wss.close();
  tcpServer.close();
  httpServer.close(() => {
    aedes.close(() => {
      console.log('Broker closed');
      process.exit(0);
    });
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
