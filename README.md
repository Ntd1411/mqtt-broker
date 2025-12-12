# Local Socket.IO Server

Socket.IO Server chạy local để ESP32 giao tiếp với nhau.

## Cài đặt

```bash
npm install
```

## Chạy

```bash
npm start
```

Server sẽ chạy trên port 3000 (mặc định).

## Kết nối từ ESP32

### Cài đặt thư viện

Trong PlatformIO, thêm vào `platformio.ini`:

```ini
lib_deps = 
    links2004/WebSockets @ ^2.4.1
    bblanchon/ArduinoJson @ ^6.21.3
```

### Code ESP32

```cpp
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASSWORD";
const char* server_ip = "192.168.1.xxx";  // IP máy tính
const int server_port = 3000;

WebSocketsClient webSocket;

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("❌ Disconnected");
      break;
      
    case WStype_CONNECTED:
      Serial.println("✅ Connected");
      // Gửi message test
      webSocket.sendTXT("42[\"message\",\"Hello from ESP32\"]");
      break;
      
    case WStype_TEXT:
      Serial.printf("📨 Received: %s\n", payload);
      break;
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
  
  // Kết nối Socket.IO
  webSocket.begin(server_ip, server_port, "/socket.io/?EIO=4&transport=websocket");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
}

// Gửi message
void sendLEDControl(bool state) {
  String msg = "42[\"control:led\",{\"state\":" + String(state ? "true" : "false") + "}]";
  webSocket.sendTXT(msg);
}
```

## Events

- `control:led` - Điều khiển LED
- `status:update` - Cập nhật trạng thái
- `join:room` - Tham gia room
- `room:message` - Message trong room
- `message` - Message chung

## Test từ Browser

```html
<script src="https://cdn.socket.io/4.6.0/socket.io.min.js"></script>
<script>
  const socket = io('http://localhost:3000');
  
  socket.on('connect', () => console.log('Connected'));
  socket.on('control:led', (data) => console.log('LED:', data));
  
  // Gửi lệnh
  socket.emit('control:led', { state: true });
</script>
```
