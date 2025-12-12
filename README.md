# Local MQTT Broker over WebSocket

MQTT Broker chạy local qua WebSocket để ESP32 giao tiếp với nhau.

## Tính năng

- ✅ MQTT over WebSocket (không dùng websocket-stream)
- 🔐 Authentication với username/password
- 🛡️ Authorization (ACL) cho publish/subscribe
- 📝 Logging chi tiết tất cả events
- 🔄 Graceful shutdown

## Cài đặt

```bash
npm install
```

## Chạy

```bash
npm start
```

Server sẽ chạy trên 2 ports:
- **Port 1883**: MQTT over TCP (standard MQTT)
- **Port 8883**: MQTT over WebSocket

## Tài khoản mặc định

| Username | Password |
|----------|----------|
| alice | password123 |
| bob | secret |

## Phân quyền (ACL)

### User `alice`
- ✅ Publish: tất cả topics (trừ `$SYS/*`)
- ✅ Subscribe: tất cả topics

### User `bob`
- ✅ Publish: chỉ `bob/*`
- ✅ Subscribe: `bob/*` và `common/*`

## Kết nối từ ESP32

### Cài đặt thư viện

Trong PlatformIO, thêm vào `platformio.ini`:

```ini
lib_deps = 
    knolleary/PubSubClient @ ^2.8
    links2004/WebSockets @ ^2.4.1
```

### Code ESP32

```cpp
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <PubSubClient.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASSWORD";
const char* mqtt_server = "192.168.1.xxx";  // IP máy tính chạy broker
const int mqtt_port = 8883;  // WebSocket port

WebSocketsClient webSocket;
PubSubClient mqttClient;

// Wrapper để PubSubClient dùng WebSocket
class WebSocketStream : public Stream {
public:
  WebSocketsClient* ws;
  
  WebSocketStream(WebSocketsClient* _ws) : ws(_ws) {}
  
  int available() {
    // WebSocket không có available, return 1 nếu connected
    return 1;
  }
  
  int read() {
    // Implement nếu cần
    return -1;
  }
  
  size_t write(uint8_t c) {
    return write(&c, 1);
  }
  
  size_t write(const uint8_t *buf, size_t size) {
    ws->sendBIN(buf, size);
    return size;
  }
  
  int peek() { return -1; }
  void flush() {}
};

WebSocketStream wsStream(&webSocket);

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("📨 Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("❌ WebSocket Disconnected");
      break;
      
    case WStype_CONNECTED:
      Serial.println("✅ WebSocket Connected");
      // Kết nối MQTT sau khi WebSocket connected
      mqttClient.connect("ESP32_Client", "alice", "password123");
      break;
      
    case WStype_BIN:
      // MQTT messages arrive as binary
      // PubSubClient sẽ xử lý
      break;
  }
}

void setup() {
  Serial.begin(115200);
  
  // Kết nối WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  
  // Setup MQTT client
  mqttClient.setClient(wsStream);
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);
  
  // Kết nối WebSocket
  webSocket.begin(mqtt_server, mqtt_port, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
  
  if (!mqttClient.connected()) {
    // Reconnect MQTT nếu mất kết nối
    if (webSocket.isConnected()) {
      Serial.println("Reconnecting MQTT...");
      if (mqttClient.connect("ESP32_Client", "alice", "password123")) {
        Serial.println("✅ MQTT Connected");
        mqttClient.subscribe("common/test");
      }
    }
  } else {
    mqttClient.loop();
  }
}

// Publish message
void publishMessage(const char* topic, const char* message) {
  if (mqttClient.connected()) {
    mqttClient.publish(topic, message);
    Serial.printf("📤 Published to %s: %s\n", topic, message);
  }
}
```

## Topics phổ biến

- `common/*` - Topics chung cho tất cả users
- `bob/*` - Topics riêng của user bob
- `esp32/sensors/temperature` - Dữ liệu cảm biến
- `esp32/control/led` - Điều khiển LED
- `esp32/status` - Trạng thái thiết bị

## Kết nối qua MQTT TCP (dễ hơn)

### Code ESP32 - MQTT over TCP

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASSWORD";
const char* mqtt_server = "192.168.1.xxx";
const int mqtt_port = 1883;  // TCP port

WiFiClient espClient;
PubSubClient client(espClient);

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("📨 [");
  Serial.print(topic);
  Serial.print("] ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    if (client.connect("ESP32Client", "alice", "password123")) {
      Serial.println("✅ Connected");
      client.subscribe("common/#");
    } else {
      Serial.print("❌ Failed, rc=");
      Serial.println(client.state());
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected");
  
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}

// Publish
void publishTemp(float temp) {
  char msg[50];
  snprintf(msg, 50, "{\"temperature\":%.2f}", temp);
  client.publish("esp32/sensor/temp", msg);
}
```

## Test bằng MQTT Client

### Dùng mosquitto_sub/pub (TCP)

```bash
# Subscribe
mosquitto_sub -h localhost -p 1883 -t "common/#" -u alice -P password123

# Publish
mosquitto_pub -h localhost -p 1883 -t "common/test" -m "Hello MQTT" -u alice -P password123
```

### Dùng MQTT.js - TCP (Node.js)

```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883', {
  username: 'alice',
  password: 'password123'
});

client.on('connect', () => {
  console.log('✅ Connected');
  client.subscribe('common/#');
  client.publish('common/test', 'Hello from MQTT.js');
});

client.on('message', (topic, message) => {
  console.log(`📨 ${topic}: ${message.toString()}`);
});
```

### Dùng MQTT.js - WebSocket (Browser)

```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('ws://localhost:8883', {
  username: 'alice',
  password: 'password123'
});

client.on('connect', () => {
  console.log('✅ Connected via WebSocket');
  client.subscribe('common/#');
});
```

## Docker

```bash
# Build
docker build -t mqtt-broker .

# Run
docker run -p 1883:1883 -p 8883:8883 mqtt-broker
```

## Environment Variables

- `MQTT_PORT` - TCP port (mặc định: 1883)
- `WS_PORT` - WebSocket port (mặc định: 8883)

## Thêm users mới

Sửa trong [server.js](server.js):

```javascript
const users = new Map([
  ['alice', 'password123'],
  ['bob', 'secret'],
  ['esp32-device1', 'device123']  // Thêm user mới
]);
```
