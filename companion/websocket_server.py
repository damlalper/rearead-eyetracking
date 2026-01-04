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

        # Don't auto-start setup - wait for user to click "Start Calibration" button
        if self.gaze_streamer and self.gaze_streamer.needs_setup:
            logger.info("Setup required - waiting for user to start calibration from extension popup")

    async def unregister(self, websocket: WebSocketServerProtocol):
        """Unregister a client connection."""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.clients)}")

        # Cleanup model when last client disconnects
        if len(self.clients) == 0 and self.gaze_streamer:
            logger.info("All clients disconnected - cleaning up calibration model")
            self.gaze_streamer.cleanup_model()

    async def send_initial_status(self, websocket: WebSocketServerProtocol):
        """Send initial status with calibration info when client connects."""
        is_calibrated = False
        is_tuned = False
        if self.gaze_streamer:
            is_calibrated = self.gaze_streamer.is_calibrated
            is_tuned = self.gaze_streamer.is_tuned

        message = {
            "type": "status",
            "state": "connected",
            "calibrated": is_calibrated,
            "tuned": is_tuned,
            "timestamp": asyncio.get_event_loop().time()
        }

        try:
            await websocket.send(json.dumps(message))
            logger.debug(f"Sent initial status: calibrated={is_calibrated}, tuned={is_tuned}")
        except Exception as e:
            logger.error(f"Error sending initial status: {e}")

    async def send_status(self, websocket: WebSocketServerProtocol, status: str):
        """Send status message to a specific client."""
        # Include calibration status in every status update
        is_calibrated = False
        is_tuned = False
        if self.gaze_streamer:
            is_calibrated = self.gaze_streamer.is_calibrated
            is_tuned = self.gaze_streamer.is_tuned

        message = {
            "type": "status",
            "state": status,
            "calibrated": is_calibrated,
            "tuned": is_tuned,
            "timestamp": asyncio.get_event_loop().time()
        }
        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending status: {e}")

    async def trigger_setup_flow(self, websocket: WebSocketServerProtocol):
        """Automatically trigger setup flow when extension connects.

        Flow:
        - Model exists: Just tuning → ready
        - No model: Calibration → tuning → ready
        """
        logger.info("Starting automatic setup flow")
        await self.send_status(websocket, "setup_started")

        if self.gaze_streamer:
            try:
                # Run setup flow in separate thread (blocking operation)
                success = await asyncio.to_thread(self.gaze_streamer.run_setup_flow)

                if success:
                    await self.send_status(websocket, "setup_completed")
                    logger.info("Setup flow completed successfully - tracking ready")
                else:
                    await self.send_status(websocket, "setup_failed")
                    logger.error("Setup flow failed")
            except Exception as e:
                logger.error(f"Setup flow error: {e}", exc_info=True)
                await self.send_status(websocket, "setup_failed")
        else:
            logger.error("GazeStreamer not available for setup")

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
            logger.info("Calibration requested")
            await self.send_status(websocket, "calibration_started")

            # Run calibration in thread to avoid blocking asyncio loop
            if self.gaze_streamer:
                try:
                    # Run blocking calibration in separate thread
                    success = await asyncio.to_thread(self.gaze_streamer.calibrate)

                    if success:
                        await self.send_status(websocket, "calibration_completed")

                        # Enable tuning/smoother after calibration
                        await asyncio.to_thread(self.gaze_streamer.tune_kalman)
                        await self.send_status(websocket, "tuning_completed")

                        # Mark setup as complete
                        self.gaze_streamer.needs_setup = False
                        await self.send_status(websocket, "setup_completed")
                        logger.info("Setup flow completed - gaze streaming will start automatically")
                    else:
                        await self.send_status(websocket, "calibration_failed")
                        logger.error("Calibration returned False")
                except Exception as e:
                    logger.error(f"Calibration failed: {e}")
                    await self.send_status(websocket, "calibration_failed")
            else:
                logger.error("GazeStreamer not available for calibration")
        elif msg_type == "tuning_request":
            logger.info("Kalman tuning requested")
            await self.send_status(websocket, "tuning_started")

            # Run tuning in thread to avoid blocking asyncio loop
            if self.gaze_streamer:
                try:
                    # Run blocking tuning in separate thread
                    success = await asyncio.to_thread(self.gaze_streamer.tune_kalman)
                    if success:
                        await self.send_status(websocket, "tuning_completed")
                    else:
                        await self.send_status(websocket, "tuning_failed")
                except Exception as e:
                    logger.error(f"Kalman tuning error: {e}")
                    await self.send_status(websocket, "tuning_failed")
            else:
                logger.error("GazeStreamer not available for tuning")
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
