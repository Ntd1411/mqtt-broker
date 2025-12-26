const aedes = require('aedes')();
const net = require('net');

// Cấu hình port
const PORT = 1883;

// ===== MQTT over TCP =====
const server = net.createServer(aedes.handle);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MQTT Broker started on port ${PORT}`);
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
  server.close();
  aedes.close(() => {
    console.log('Broker stopped');
    process.exit(0);
  });
}
