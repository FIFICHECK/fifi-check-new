# FIFI CHECK Relay Bot

WebSocket listener that monitors Hermes Bot responses in Discord and forwards them to the Proxy Server.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  客人瀏覽器 (Browser)                                           │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐ │
│  │ FIFI CHECK  │────▶│ Proxy Server │────▶│ Discord Channel  │ │
│  │   Browser   │◀────│  (Port 5000) │◀────│   #whatsapp     │ │
│  └──────────────┘     └──────────────┘     └──────────────────┘ │
│        │                    │                      ▲            │
│        │ Polling            │ HTTP POST            │            │
│        │◀──────────────────│                      │            │
│                             │                      │            │
│                    ┌────────┴────────┐             │            │
│                    │   Relay Bot     │◀────────────┘            │
│                    │ (WebSocket)    │  (listens for Hermes)   │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Install Dependencies

```bash
cd relay-bot
pip install -r requirements.txt
```

### 2. Set Environment Variables

```bash
export RELAY_TOKEN="MTIxODUzMzk2NzMzMzI5NDEzMA.Gxxxxx.xxxxx"  # Your Relay Bot Token
export GUILD_ID="1504655105314656356"
export CHANNEL_ID="1517041036793221140"
export HERMES_BOT_ID="1504653188014538864"
export CALLBACK_URL="http://localhost:5000/callback"
export PROXY_PORT="5000"
```

### 3. Run Proxy Server

```bash
python3 proxy_server.py
```

### 4. Run Relay Bot (in another terminal)

```bash
python3 relay_bot.py
```

### 5. Open Browser Interface

Open `index.html` in your browser, or serve it via HTTP:

```bash
python3 -m http.server 8080
# Then open http://localhost:8080
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `RELAY_TOKEN` | Discord Bot Token | ✅ Yes |
| `GUILD_ID` | Discord Guild/Server ID | No (default provided) |
| `CHANNEL_ID` | Discord Channel ID to monitor | No (default provided) |
| `HERMES_BOT_ID` | Hermes Bot ID to filter responses | No (default provided) |
| `CALLBACK_URL` | Proxy Server callback URL | No (default: http://localhost:5000/callback) |
| `PROXY_PORT` | Proxy Server port | No (default: 5000) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /callback` | POST | Relay Bot calls this when Hermes responds |
| `POST /send` | POST | Send message to Discord |
| `GET /poll/<correlation_id>` | GET | Browser polls for Hermes response |
| `GET /events/<client_id>` | SSE | Browser subscribes for Hermes responses (SSE) |
| `GET /health` | GET | Health check |

## Message Flow

1. **Browser → Proxy**: `POST /send` with `{message, correlation_id}`
2. **Proxy → Discord**: Via Relay Bot API, adds `[correlation_id:xxx]` to message
3. **Hermes Bot**: Receives in Discord, processes, responds
4. **Relay Bot**: Listens to channel via WebSocket, detects Hermes response
5. **Relay Bot → Proxy**: `POST /callback` with Hermes response
6. **Proxy → Browser**: Stores response, Browser polls `/poll/<correlation_id>`
