# MQTT Broker Deployment Guide

## Quick Start Options

### 1. Docker (Recommended for local/VPS)
```bash
docker-compose up -d
```

### 2. Render.com (Free tier available)
- Push to GitHub
- Connect to Render
- Auto-deploys from `render.yaml`

### 3. Railway.app (Free $5/month credit)
- Push to GitHub
- Connect to Railway
- Auto-deploys from `railway.json`

### 4. Fly.io (Global edge deployment)
```bash
flyctl launch
flyctl deploy
```

## URLs After Deploy

- **Web Monitor**: http://your-domain:3000
- **MQTT TCP**: mqtt://your-domain:1883
- **MQTT WebSocket**: ws://your-domain:8883

## Environment Variables

All platforms need these ports open:
- `1883` - MQTT TCP
- `8883` - MQTT WebSocket
- `3000` - Web Monitor

## Testing After Deploy

```bash
# Test MQTT connection
mqtt pub -h your-domain.com -p 1883 -t test/topic -m "Hello"

# Check web monitor
curl http://your-domain.com:3000
```
