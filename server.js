require('dotenv').config();

const aedes = require('aedes')();
const net = require('net');
const http = require('http');
const ws = require('ws');
const fs = require('fs');
const path = require('path');

// WebSocket clients
const webSocketClients = new Set();

// ===== MQTT over TCP =====
const mqttServer = net.createServer(aedes.handle);

mqttServer.listen(process.env.MQTT_PORT, '0.0.0.0', () => {
  console.log(`---MQTT Broker started on port ${process.env.MQTT_PORT}`);
});

// ===== Web Client =====
const webServer = http.createServer((req, res) => {
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
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('MQTT Broker Web Interface\n');
  }
});

// WebSocket server
const webSocket = new ws.Server({ server: webServer });

webSocket.on('connection', (socket) => {
  webSocketClients.add(socket);
  console.log('Monitor client connected');

  socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if(data.type === "publish") {
        // Publish message to MQTT broker
        aedes.publish({
          topic: data.topic,
          payload: Buffer.from(data.payload),
          qos: 0,
          retain: false
        }, (err) => {
          if (err) {
            console.error('Publish error:', err);
          } else {
            console.log(`[WEB PUBLISH] ${data.topic}: ${data.payload}`);
          }
        });
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  })
  
  socket.on('close', () => {
    webSocketClients.delete(socket);
    console.log('Monitor client disconnected');
  });
});

webServer.listen(process.env.WEB_PORT, '0.0.0.0', () => {
  console.log(`---Web Client started on port ${process.env.WEB_PORT}`);
});

// Broadcast to clients
function broadcastToClients(data) {
  const message = JSON.stringify(data);
  webSocketClients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(message);
    }
  });
}

// ===== Event logging & monitoring =====
aedes.on('client', (client) => {
  console.log(`[CLIENT CONNECTED] ${client.id}`);
  broadcastToClients({
    type: 'client',
    clientId: client.id,
    timestamp: new Date().toISOString()
  });
});

aedes.on('clientDisconnect', (client) => {
  console.log(`[CLIENT DISCONNECTED] ${client.id}`);
  broadcastToClients({
    type: 'clientDisconnect',
    clientId: client.id,
    timestamp: new Date().toISOString()
  });
});

aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`[PUBLISH] ${client.id} -> ${packet.topic}: ${packet.payload.toString()}`);
    broadcastToClients({
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
  broadcastToClients({
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
  mqttServer.close();
  webServer.close();
  aedes.close(() => {
    console.log('Broker stopped');
    process.exit(0);
  });
}
