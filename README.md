# MQTT Broker với Aedes

MQTT Broker đơn giản sử dụng Aedes, hỗ trợ cả TCP và WebSocket, kèm giao diện web theo dõi.

## Tính năng

- ✅ MQTT over TCP (port 1883)
- ✅ MQTT over WebSocket (port 8883)
- 📊 Web Monitor Interface (port 3000)
- 📝 Logging tất cả events
- 🔄 Graceful shutdown

## Cài đặt

```bash
npm install
```

## Chạy

```bash
npm start
```

Broker sẽ chạy trên:
- **Port 1883**: MQTT over TCP
- **Port 8883**: MQTT over WebSocket
- **Port 3000**: Web Monitor Interface

## Web Monitor

Mở trình duyệt và truy cập: **http://localhost:3000**

Giao diện hiển thị real-time:
- 📊 Thống kê: Số clients, topics, messages
- 👥 Danh sách clients đang kết nối
- 📌 Các topics đang được theo dõi
- 📨 Messages với timestamp và payload

## Kết nối từ ESP32

### Qua WebSocket

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "your-wifi";
const char* password = "your-password";
const char* mqtt_server = "192.168.1.100"; // IP của máy chạy broker
const int mqtt_port = 8883;

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  client.setServer(mqtt_server, mqtt_port);
  
  while (!client.connected()) {
    if (client.connect("ESP32Client")) {
      Serial.println("Connected to MQTT");
      client.subscribe("test/topic");
    }
  }
}

void loop() {
  client.loop();
  client.publish("test/topic", "Hello from ESP32");
  delay(5000);
}
```

## Kiểm tra

Test bằng MQTT client:

```bash
# Subscribe
mqtt sub -t 'test/#' -h localhost -p 1883

# Publish  
mqtt pub -t 'test/topic' -m 'Hello MQTT' -h localhost -p 1883
```

## Docker

### Build và chạy

```bash
# Build image
docker build -t mqtt-broker .

# Chạy container
docker run -d \
  -p 1883:1883 \
  -p 8883:8883 \
  -p 3000:3000 \
  --name mqtt-broker \
  mqtt-broker
```

### Hoặc dùng Docker Compose

```bash
docker-compose up -d
```

## Deploy

### 🚀 Deploy lên Render.com

1. Push code lên GitHub
2. Tạo tài khoản trên [Render.com](https://render.com)
3. Tạo **New Web Service**
4. Kết nối với GitHub repository
5. Render sẽ tự động phát hiện `render.yaml`
6. Deploy! 

**Lưu ý:** Render cung cấp free tier với giới hạn 750 giờ/tháng.

### 🚂 Deploy lên Railway.app

1. Push code lên GitHub
2. Tạo tài khoản trên [Railway.app](https://railway.app)
3. Click **New Project** → **Deploy from GitHub**
4. Chọn repository
5. Railway tự động detect và deploy

**Lưu ý:** Railway cung cấp $5 credit mỗi tháng cho free tier.

### 🐳 Deploy lên VPS với Docker

```bash
# 1. Clone repo trên VPS
git clone <your-repo-url>
cd mqtt-broker

# 2. Build và chạy
docker-compose up -d

# 3. Kiểm tra logs
docker-compose logs -f

# 4. Stop
docker-compose down
```

### ☁️ Deploy lên AWS/DigitalOcean/Azure

1. Tạo VM/Droplet với Ubuntu
2. Cài Docker và Docker Compose
3. Clone repository
4. Chạy `docker-compose up -d`
5. Mở ports 1883, 8883, 3000 trong firewall

### 🌐 Deploy lên Fly.io

```bash
# 1. Cài Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Đăng nhập
flyctl auth login

# 3. Khởi tạo app
flyctl launch

# 4. Deploy
flyctl deploy
```

## Môi trường biến

Tạo file `.env` (xem `.env.example`):

```env
MQTT_PORT=1883
WS_PORT=8883
MONITOR_PORT=3000
```

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
