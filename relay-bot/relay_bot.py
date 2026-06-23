#!/usr/bin/env python3
"""
FIFI CHECK Relay Bot
- Listens to Discord channel for Hermes Bot responses
- Extracts correlation_id from messages
- POSTs to Proxy Server callback
"""

import asyncio
import json
import re
import websockets
import requests
import logging
from datetime import datetime
import os

# === CONFIGURATION ===
RELAY_TOKEN = os.environ.get("RELAY_TOKEN", "")  # Set via environment variable
GUILD_ID = os.environ.get("GUILD_ID", "1504655105314656356")
CHANNEL_ID = os.environ.get("CHANNEL_ID", "1517041036793221140")
HERMES_BOT_ID = os.environ.get("HERMES_BOT_ID", "1504653188014538864")
CALLBACK_URL = os.environ.get("CALLBACK_URL", "http://localhost:5000/callback")

# Discord Gateway URLs
GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json"

# Validate required tokens
if not RELAY_TOKEN:
    raise ValueError("RELAY_TOKEN environment variable is required")

# Intents: GUILD_MESSAGES + MESSAGE_CONTENT (to read message content)
INTENTS = 1 << 9 | 1 << 15  # GUILD_MESSAGES (512) + MESSAGE_CONTENT (1<<15 = 32768)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RelayBot")


class RelayBot:
    def __init__(self):
        self.ws = None
        self.sequence = None
        self.session_id = None
        self.heartbeat_interval = None

    async def connect(self):
        """Connect to Discord Gateway"""
        await self.websocket_handshake()

    async def websocket_handshake(self):
        """Perform WebSocket handshake with Discord"""
        async with websockets.connect(GATEWAY_URL) as ws:
            self.ws = ws
            logger.info("Connected to Discord Gateway")

            async for msg in ws:
                data = json.loads(msg)
                await self.handle_dispatch(data)

    async def handle_dispatch(self, data):
        """Handle incoming WebSocket messages"""
        op = data.get("op")
        dtype = data.get("t")
        payload = data.get("d")

        if op == 10:  # Hello
            self.heartbeat_interval = payload["heartbeat_interval"] / 1000
            asyncio.create_task(self.send_heartbeat())
            await self.identify()

        elif op == 0:  # Dispatch
            if dtype == "READY":
                self.session_id = payload["session_id"]
                logger.info(f"Session ID: {self.session_id}")

            elif dtype == "MESSAGE_CREATE":
                await self.on_message(payload)

        elif op == 11:  # Heartbeat ACK
            logger.debug("Heartbeat ACK received")

    async def send_heartbeat(self):
        """Send periodic heartbeats to Discord"""
        await asyncio.sleep(self.heartbeat_interval)
        while True:
            try:
                await self.ws.send(json.dumps({
                    "op": 1,
                    "d": self.sequence
                }))
                logger.debug(f"Heartbeat sent (seq: {self.sequence})")
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                break
            await asyncio.sleep(self.heartbeat_interval)

    async def identify(self):
        """Identify with Discord Gateway"""
        await self.ws.send(json.dumps({
            "op": 2,
            "d": {
                "token": RELAY_TOKEN,
                "intents": INTENTS,
                "properties": {
                    "os": "linux",
                    "browser": "fificheck_relay",
                    "device": "fificheck_relay"
                },
                "shard": [0, 1]
            }
        }))
        logger.info("Identity sent to Discord")

    async def on_message(self, payload):
        """Handle incoming messages"""
        # Extract message info
        message_id = payload.get("id")
        channel_id = payload.get("channel_id")
        author_id = payload.get("author", {}).get("id")
        content = payload.get("content", "")

        # Only process messages from Hermes Bot in our channel
        if author_id != HERMES_BOT_ID:
            logger.debug(f"Ignoring message from {author_id} (not Hermes)")
            return

        if channel_id != CHANNEL_ID:
            logger.debug(f"Ignoring message in {channel_id} (not our channel)")
            return

        if not content:
            logger.debug("Empty message, ignoring")
            return

        logger.info(f"📩 Hermes response detected:")
        logger.info(f"   Channel: {channel_id}")
        logger.info(f"   Message: {content[:100]}...")

        # Extract correlation_id from content (format: [correlation_id:xxx])
        correlation_id = self.extract_correlation_id(content)

        # Prepare callback payload
        callback_payload = {
            "source": "hermes",
            "hermes_message_id": message_id,
            "correlation_id": correlation_id,
            "content": content,
            "channel_id": channel_id,
            "guild_id": GUILD_ID,
            "timestamp": datetime.utcnow().isoformat()
        }

        # POST to Proxy Server
        await self.post_to_proxy(callback_payload)

    def extract_correlation_id(self, content: str) -> str:
        """Extract correlation_id from message content"""
        # Pattern: [correlation_id:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx]
        pattern = r'\[correlation_id:([a-f0-9\-]{36})\]'
        match = re.search(pattern, content)
        if match:
            return match.group(1)

        # Alternative: check for reply-to field or other markers
        pattern2 = r'correlation[_\s]?id[:\s]+([a-f0-9\-]+)'
        match2 = re.search(pattern2, content, re.IGNORECASE)
        if match2:
            return match2.group(1)

        return "unknown"

    async def post_to_proxy(self, payload: dict):
        """POST Hermes response to Proxy Server callback"""
        try:
            response = requests.post(
                CALLBACK_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            logger.info(f"✅ Callback posted: {response.status_code}")
            if response.status_code != 200:
                logger.warning(f"   Response: {response.text[:200]}")
        except requests.exceptions.ConnectionError:
            logger.error(f"❌ Cannot connect to Proxy Server: {CALLBACK_URL}")
        except Exception as e:
            logger.error(f"❌ Callback error: {e}")


async def main():
    logger.info("🚀 Starting FIFI CHECK Relay Bot...")
    logger.info(f"   Channel ID: {CHANNEL_ID}")
    logger.info(f"   Hermes Bot ID: {HERMES_BOT_ID}")
    logger.info(f"   Callback URL: {CALLBACK_URL}")
    bot = RelayBot()
    await bot.connect()


if __name__ == "__main__":
    asyncio.run(main())
