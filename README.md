# Local MQTT Broker

MQTT Broker chạy local để ESP32 giao tiếp với nhau.

## Cài đặt

```bash
cd mqtt-broker
npm install
```

## Chạy

```bash
npm start
```

## Kết nối từ ESP32

```cpp
const char* mqtt_server = "localhost";  // Hoặc IP máy tính
const int mqtt_port = 1883;
```

## Topics

- `esp32/control/led` - Control gửi lệnh
- `esp32/phonghop/status` - Phonghop báo trạng thái
