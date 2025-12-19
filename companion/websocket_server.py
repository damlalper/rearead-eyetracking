import asyncio
import json
import logging
from typing import Set
import websockets
from websockets.server import WebSocketServerProtocol

logger = logging.getLogger(__name__)


class WebSocketServer:
    """WebSocket server for real-time gaze data streaming to browser extension."""

    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.clients: Set[WebSocketServerProtocol] = set()
        self.server = None
        self.gaze_streamer = None  # Reference to GazeStreamer for calibration

    async def register(self, websocket: WebSocketServerProtocol):
        """Register a new client connection."""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")

        # Send initial status with calibration info
        await self.send_initial_status(websocket)

    async def unregister(self, websocket: WebSocketServerProtocol):
        """Unregister a client connection."""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.clients)}")

    async def send_initial_status(self, websocket: WebSocketServerProtocol):
        """Send initial status with calibration info when client connects."""
        is_calibrated = False
        if self.gaze_streamer:
            is_calibrated = self.gaze_streamer.is_calibrated

        message = {
            "type": "status",
            "state": "connected",
            "calibrated": is_calibrated,
            "timestamp": asyncio.get_event_loop().time()
        }

        try:
            await websocket.send(json.dumps(message))
            logger.info(f"Sent initial status: calibrated={is_calibrated}")
        except Exception as e:
            logger.error(f"Error sending initial status: {e}")

    async def send_status(self, websocket: WebSocketServerProtocol, status: str):
        """Send status message to a specific client."""
        message = {
            "type": "status",
            "state": status,
            "timestamp": asyncio.get_event_loop().time()
        }
        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending status: {e}")

    async def broadcast_gaze(self, gaze_data: dict):
        """Broadcast gaze data to all connected clients."""
        if not self.clients:
            return

        message = json.dumps(gaze_data)
        disconnected_clients = set()

        for client in self.clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.add(client)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected_clients.add(client)

        # Clean up disconnected clients
        for client in disconnected_clients:
            await self.unregister(client)

    async def handle_client(self, websocket: WebSocketServerProtocol):
        """Handle individual client connection."""
        await self.register(websocket)

        try:
            async for message in websocket:
                # Handle incoming messages from extension
                try:
                    data = json.loads(message)
                    await self.handle_message(websocket, data)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON received: {message}")
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed")
        finally:
            await self.unregister(websocket)

    async def handle_message(self, websocket: WebSocketServerProtocol, data: dict):
        """Handle specific message types from extension."""
        msg_type = data.get("type")

        if msg_type == "ping":
            # Respond to heartbeat
            await websocket.send(json.dumps({"type": "pong", "timestamp": asyncio.get_event_loop().time()}))
        elif msg_type == "calibration_request":
            logger.info("Calibration requested by extension")
            await self.send_status(websocket, "calibration_started")

            # Run calibration in thread to avoid blocking asyncio loop
            if self.gaze_streamer:
                try:
                    logger.info("Starting calibration process...")
                    # Run blocking calibration in separate thread
                    await asyncio.to_thread(self.gaze_streamer.calibrate)
                    logger.info("Calibration completed successfully")
                    await self.send_status(websocket, "calibration_completed")
                except Exception as e:
                    logger.error(f"Calibration failed: {e}")
                    await self.send_status(websocket, "calibration_failed")
            else:
                logger.error("GazeStreamer not available for calibration")
        elif msg_type == "control":
            action = data.get("action")
            logger.info(f"Control action received: {action}")
            # TODO: Handle start/stop/pause actions

    async def start(self):
        """Start the WebSocket server."""
        logger.info(f"Starting WebSocket server on {self.host}:{self.port}")

        self.server = await websockets.serve(
            self.handle_client,
            self.host,
            self.port,
            ping_interval=20,
            ping_timeout=10
        )

        logger.info("WebSocket server started successfully")

    async def stop(self):
        """Stop the WebSocket server."""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("WebSocket server stopped")

    def is_connected(self) -> bool:
        """Check if any clients are connected."""
        return len(self.clients) > 0
