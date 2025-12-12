const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);
const wsServer = require('http').createServer();
const ws = require('websocket-stream');

const MQTT_PORT = process.env.PORT || 1883;
const WS_PORT = process.env.WS_PORT || 8883;

// MQTT over TCP
server.listen(MQTT_PORT, '0.0.0.0', function () {
  console.log('✅ MQTT Broker running on port', MQTT_PORT);
  console.log('📡 ESP32 can connect to: <your-server-url>:' + MQTT_PORT);
});

// MQTT over WebSocket
ws.createServer({ server: wsServer }, aedes.handle);
wsServer.listen(WS_PORT, '0.0.0.0', function () {
  console.log('✅ MQTT WebSocket running on port', WS_PORT);
});

// Event: Client connected
aedes.on('client', function (client) {
  console.log('🔌 Client Connected:', client.id);
});

// Event: Client disconnected
aedes.on('clientDisconnect', function (client) {
  console.log('❌ Client Disconnected:', client.id);
});

// Event: Message published
aedes.on('publish', function (packet, client) {
  if (client) {
    console.log('📨 Message from', client.id);
    console.log('   Topic:', packet.topic);
    console.log('   Payload:', packet.payload.toString());
  }
});

// Event: Client subscribed
aedes.on('subscribe', function (subscriptions, client) {
  console.log('📬 Client', client.id, 'subscribed to:', subscriptions.map(s => s.topic).join(', '));
});
