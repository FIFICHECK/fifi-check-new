#!/usr/bin/env python3
"""
FIFI CHECK Proxy Server
- Receives messages from FIFI CHECK Browser (HTTP POST)
- Forwards to Discord via Relay Bot (using Bot Token, NOT Webhook)
- Receives Hermes responses from Relay Bot (via callback)
- Pushes responses back to Browser (SSE)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import threading
import json
import logging
from datetime import datetime
import os

# === CONFIGURATION ===
PROXY_PORT = int(os.environ.get("PROXY_PORT", "5000"))
RELAY_TOKEN = os.environ.get("RELAY_TOKEN", "")
RELAY_BOT_ID = os.environ.get("RELAY_BOT_ID", "1518533967333294130")
CHANNEL_ID = os.environ.get("CHANNEL_ID", "1517041036793221140")
DISCORD_API = "https://discord.com/api/v10"

# Validate required tokens
if not RELAY_TOKEN:
    raise ValueError("RELAY_TOKEN environment variable is required")

# === FLASK APP ===
app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ProxyServer")

# Store pending requests (correlation_id -> event + data)
pending_events = {}


def get_discord_headers():
    return {
        "Authorization": f"Bot {RELAY_TOKEN}",
        "Content-Type": "application/json"
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "relay_bot_id": RELAY_BOT_ID,
        "channel_id": CHANNEL_ID
    })


@app.route("/callback", methods=["POST"])
def callback():
    """
    Called by Relay Bot when Hermes responds.
    Stores the response for the waiting browser client.
    """
    data = request.json
    correlation_id = data.get("correlation_id", "unknown")
    
    logger.info(f"📬 Callback received:")
    logger.info(f"   correlation_id: {correlation_id}")
    logger.info(f"   content: {data.get('content', '')[:80]}...")

    # Store data for polling browser
    if correlation_id:
        pending_events[correlation_id] = data
        logger.info(f"✅ Stored response for correlation_id: {correlation_id}")

    return jsonify({"status": "received"})


@app.route("/poll/<correlation_id>", methods=["GET"])
def poll_response(correlation_id):
    """
    Browser polls this endpoint to check if Hermes responded.
    Returns the response if available, else 202 Accepted with no content.
    """
    if correlation_id in pending_events:
        data = pending_events.pop(correlation_id)
        logger.info(f"📤 Poll fulfilled for: {correlation_id}")
        return jsonify({
            "status": "fulfilled",
            "data": data
        })
    else:
        return jsonify({"status": "pending"}), 202


@app.route("/send", methods=["POST"])
def send_to_discord():
    """
    Called by FIFI CHECK Browser to send message to Discord.
    Uses Relay Bot Token + Channel ID to send message via Discord REST API.
    """
    data = request.json
    message = data.get("message", "")
    correlation_id = data.get("correlation_id", "")

    if not message:
        return jsonify({"error": "message is required"}), 400

    # Build message with correlation_id
    if correlation_id:
        full_message = f"{message}\n\n[correlation_id:{correlation_id}]"
    else:
        full_message = message

    # Send via Discord REST API using Relay Bot
    payload = {
        "content": full_message,
        "tts": False
    }

    try:
        response = requests.post(
            f"{DISCORD_API}/channels/{CHANNEL_ID}/messages",
            headers=get_discord_headers(),
            json=payload
        )

        if response.status_code == 200:
            msg_data = response.json()
            logger.info(f"✅ Message sent to Discord - ID: {msg_data.get('id')}")
            return jsonify({
                "status": "sent",
                "message_id": msg_data.get("id"),
                "correlation_id": correlation_id
            })
        else:
            logger.error(f"Discord API error: {response.status_code} - {response.text}")
            return jsonify({
                "error": "Failed to send to Discord",
                "details": response.text
            }), 500

    except Exception as e:
        logger.error(f"Failed to send to Discord: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/events/<client_id>", methods=["GET"])
def sse_events(client_id):
    """
    SSE endpoint for browser to receive push notifications.
    Browser connects here and waits for Hermes responses.
    """
    from flask import Response

    def generate():
        logger.info(f"📱 Browser SSE connected: {client_id}")
        yield f"data: {json.dumps({'type': 'connected', 'client_id': client_id})}\n\n"

        last_check = None
        while True:
            # Check for new events
            current_pending = list(pending_events.keys())
            if current_pending and current_pending != [last_check]:
                for corr_id in current_pending:
                    data = pending_events.pop(corr_id)
                    yield f"data: {json.dumps({'type': 'hermes_response', 'data': data})}\n\n"
                    logger.info(f"📤 SSE pushed for: {corr_id}")
                last_check = None

            import time
            time.sleep(0.5)

    return Response(generate(), mimetype="text/event-stream")


def run_proxy():
    """Run the proxy server"""
    logger.info(f"🚀 Proxy Server starting on port {PROXY_PORT}")
    logger.info(f"   Relay Bot: {RELAY_BOT_ID}")
    logger.info(f"   Channel: {CHANNEL_ID}")
    app.run(host="0.0.0.0", port=PROXY_PORT, debug=False, threaded=True)


if __name__ == "__main__":
    run_proxy()
