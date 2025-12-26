const aedes = require('aedes')();
const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Cấu hình ports
const MQTT_PORT = 1883;
const WEB_PORT = process.env.PORT || 3000;

// ===== MQTT over TCP =====
const mqttServer = net.createServer(aedes.handle);

mqttServer.listen(MQTT_PORT, '0.0.0.0', () => {
  console.log(`✅ MQTT Broker started on port ${MQTT_PORT}`);
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

webServer.listen(WEB_PORT, '0.0.0.0', () => {
  console.log(`✅ Web Client started on port ${WEB_PORT}`);
});

// ===== Event logging =====
aedes.on('client', (client) => {
  console.log(`[CLIENT CONNECTED] ${client.id}`);
});

aedes.on('clientDisconnect', (client) => {
  console.log(`[CLIENT DISCONNECTED] ${client.id}`);
});

aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`[PUBLISH] ${client.id} -> ${packet.topic}: ${packet.payload.toString()}`);
  }
});

aedes.on('subscribe', (subscriptions, client) => {
  const topics = subscriptions.map(s => s.topic);
  console.log(`[SUBSCRIBE] ${client.id} -> ${topics.join(', ')}`);
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
