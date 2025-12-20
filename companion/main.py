import asyncio
import json
import logging
import signal
import sys
from pathlib import Path

from websocket_server import WebSocketServer
from gaze_streamer import GazeStreamer


# Setup logging (will be configured after loading config)
logger = logging.getLogger(__name__)


class CompanionApp:
    """Main companion application for ReaRead eye-tracking system."""

    def __init__(self, config_path: str = "config.json"):
        self.config = self.load_config(config_path)
        self.ws_server = None
        self.gaze_streamer = None
        self.is_running = False

    def load_config(self, config_path: str) -> dict:
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)

                # Configure logging: Only INFO and above to console, DEBUG to file
                log_config = config.get('logging', {})

                # Root logger
                root_logger = logging.getLogger()
                root_logger.setLevel(logging.DEBUG)

                # Console handler - only INFO and above
                console = logging.StreamHandler()
                console.setLevel(logging.INFO)
                console.setFormatter(logging.Formatter('%(levelname)s: %(message)s'))

                # File handler - everything including DEBUG
                file_handler = logging.FileHandler('logs/companion.log', mode='w', encoding='utf-8')
                file_handler.setLevel(logging.DEBUG)
                file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))

                # Clear existing handlers and add new ones
                root_logger.handlers.clear()
                root_logger.addHandler(console)
                root_logger.addHandler(file_handler)

                # Silence noisy third-party libraries
                logging.getLogger('websockets').setLevel(logging.WARNING)
                logging.getLogger('asyncio').setLevel(logging.WARNING)

                logger.info(f"Configuration loaded from {config_path}")
                return config
        except FileNotFoundError:
            logger.error(f"Config file not found: {config_path}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in config file: {e}")
            sys.exit(1)

    async def initialize(self):
        """Initialize all components."""
        logger.info("Initializing ReaRead Companion App...")

        # Initialize WebSocket server
        ws_config = self.config.get('websocket', {})
        self.ws_server = WebSocketServer(
            host=ws_config.get('host', 'localhost'),
            port=ws_config.get('port', 8765)
        )

        # Initialize gaze streamer
        eyetrax_config = self.config.get('eyetrax', {})
        self.gaze_streamer = GazeStreamer(
            camera_id=eyetrax_config.get('camera_id', 0),
            confidence_threshold=eyetrax_config.get('confidence_threshold', 0.7),
            stream_frequency=eyetrax_config.get('stream_frequency', 30)
        )

        # Initialize EyeTrax
        if not self.gaze_streamer.initialize_eyetrax():
            logger.error("Failed to initialize EyeTrax. Exiting...")
            sys.exit(1)

        # Link gaze_streamer to WebSocket server for calibration
        self.ws_server.gaze_streamer = self.gaze_streamer

        logger.info("All components initialized successfully")

    async def start(self):
        """Start the companion app."""
        self.is_running = True
        logger.info("Starting ReaRead Companion App...")

        # Start WebSocket server
        await self.ws_server.start()

        # Start gaze streaming loop
        streaming_task = asyncio.create_task(
            self.gaze_streamer.stream_loop(self.ws_server)
        )

        logger.info("=" * 60)
        logger.info("ReaRead Companion App is running!")
        logger.info(f"WebSocket server: ws://{self.ws_server.host}:{self.ws_server.port}")
        logger.info("Waiting for browser extension to connect...")
        logger.info("Press Ctrl+C to stop")
        logger.info("=" * 60)

        # Keep running until interrupted
        try:
            await streaming_task
        except asyncio.CancelledError:
            logger.info("Streaming task cancelled")

    async def stop(self):
        """Stop the companion app gracefully."""
        if not self.is_running:
            return

        logger.info("Stopping ReaRead Companion App...")
        self.is_running = False

        # Stop gaze streaming
        if self.gaze_streamer:
            self.gaze_streamer.stop()
            self.gaze_streamer.cleanup()

        # Stop WebSocket server
        if self.ws_server:
            await self.ws_server.stop()

        logger.info("Companion App stopped successfully")

    async def run(self):
        """Main run method."""
        try:
            await self.initialize()
            await self.start()
        except KeyboardInterrupt:
            logger.info("\nKeyboard interrupt received")
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
        finally:
            await self.stop()


async def main():
    """Entry point for the companion app."""
    app = CompanionApp()

    # Handle graceful shutdown
    def signal_handler(sig, frame):
        logger.info("Shutdown signal received")
        asyncio.create_task(app.stop())

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    await app.run()


if __name__ == "__main__":
    print("""
    ================================================
    |  ReaRead - Eye-Tracking Companion App        |
    |  Version 0.1.0                               |
    ================================================
    """)

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutdown complete. Goodbye!")
