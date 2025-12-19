import asyncio
import time
import logging
import os
import cv2
from typing import Optional, Dict
from eyetrax import GazeEstimator
from eyetrax.calibration import run_9_point_calibration
from eyetrax.utils.screen import get_screen_size

logger = logging.getLogger(__name__)


class GazeStreamer:
    """Streams gaze data from EyeTrax to WebSocket server."""

    def __init__(self, camera_id: int = 0, confidence_threshold: float = 0.7, stream_frequency: int = 30):
        self.camera_id = camera_id
        self.confidence_threshold = confidence_threshold
        self.stream_frequency = stream_frequency
        self.is_running = False
        self.estimator = None
        self.camera = None
        self.is_calibrated = False
        self.screen_width, self.screen_height = get_screen_size()
        self.model_path = "users/default_model.pkl"

        # Create users directory if it doesn't exist
        os.makedirs("users", exist_ok=True)

    def initialize_eyetrax(self):
        """Initialize EyeTrax gaze estimator and camera."""
        try:
            logger.info(f"Initializing EyeTrax")

            # Initialize EyeTrax GazeEstimator
            self.estimator = GazeEstimator(model_name="ridge")

            # Try to load existing model
            if os.path.isfile(self.model_path):
                logger.info(f"Loading existing model: {self.model_path}")
                self.estimator.load_model(self.model_path)
                self.is_calibrated = True
                logger.info("Model loaded successfully - ready for tracking")
            else:
                logger.warning("No model found - calibration required")
                self.is_calibrated = False

            # Initialize camera
            logger.info(f"Opening camera {self.camera_id}")
            self.camera = cv2.VideoCapture(self.camera_id)

            if not self.camera.isOpened():
                raise Exception(f"Failed to open camera {self.camera_id}")

            logger.info(f"EyeTrax initialized successfully (Screen: {self.screen_width}x{self.screen_height})")
            return True

        except ImportError as e:
            logger.error(f"EyeTrax import error: {e}")
            logger.error("If EyeTrax is installed, check dependencies")
            return False
        except Exception as e:
            logger.error(f"Failed to initialize EyeTrax: {e}", exc_info=True)
            return False

    def calibrate(self):
        """Run 9-point calibration using EyeTrax's built-in GUI."""
        try:
            logger.info("Starting 9-point calibration...")
            logger.info("A fullscreen calibration window will open. Follow the on-screen instructions.")

            # Run EyeTrax calibration (this opens a fullscreen window)
            run_9_point_calibration(self.estimator, camera_index=self.camera_id)

            # Save the trained model
            self.estimator.save_model(self.model_path)
            self.is_calibrated = True

            logger.info(f"Calibration complete! Model saved: {self.model_path}")
            return True

        except Exception as e:
            logger.error(f"Calibration failed: {e}")
            return False

    def get_gaze_point(self) -> Optional[Dict]:
        """Get current gaze point from EyeTrax using extract_features + predict."""
        if not self.estimator or not self.camera or not self.is_calibrated:
            return None

        try:
            # Read frame from camera
            ret, frame = self.camera.read()
            if not ret:
                return None

            # Extract features using EyeTrax
            features, blink = self.estimator.extract_features(frame)

            # Skip if no face detected or eyes are blinking
            if features is None or blink:
                return None

            # Predict gaze coordinates
            gaze_coords = self.estimator.predict([features])
            if gaze_coords is None or len(gaze_coords) < 1:
                return None

            # Extract x, y coordinates
            x, y = gaze_coords[0]

            # Prepare gaze data packet
            gaze_data = {
                "type": "gaze",
                "x": int(x),
                "y": int(y),
                "confidence": 0.9,  # High confidence since model is trained
                "timestamp": int(time.time() * 1000),
                "screen_width": self.screen_width,
                "screen_height": self.screen_height
            }

            # DEBUG: Print gaze data
            logger.debug(f"Gaze: ({gaze_data['x']}, {gaze_data['y']})")

            return gaze_data

        except Exception as e:
            logger.error(f"Error getting gaze point: {e}")
            return None

    async def stream_loop(self, websocket_server):
        """Main streaming loop that continuously sends gaze data."""
        self.is_running = True
        frame_delay = 1.0 / self.stream_frequency

        if not self.is_calibrated:
            logger.warning("Starting stream loop but NOT CALIBRATED - no gaze data will be sent")
            logger.warning("Please trigger calibration from the extension")
        else:
            logger.info(f"Starting gaze streaming at {self.stream_frequency} Hz")

        while self.is_running:
            loop_start = time.time()

            # Only get gaze if calibrated
            if self.is_calibrated:
                gaze_data = self.get_gaze_point()

                # Broadcast to all connected clients
                if gaze_data and websocket_server.is_connected():
                    await websocket_server.broadcast_gaze(gaze_data)

            # Maintain target frequency
            elapsed = time.time() - loop_start
            sleep_time = max(0, frame_delay - elapsed)
            await asyncio.sleep(sleep_time)

    def stop(self):
        """Stop the gaze streaming loop."""
        self.is_running = False
        logger.info("Gaze streaming stopped")

    def cleanup(self):
        """Release camera and cleanup resources."""
        if self.camera:
            try:
                self.camera.release()
                logger.info("Camera released")
            except Exception as e:
                logger.error(f"Error releasing camera: {e}")
