import asyncio
import time
import logging
import os
import cv2
from typing import Optional, Dict
from eyetrax import GazeEstimator
from eyetrax.calibration import run_9_point_calibration
from eyetrax.utils.screen import get_screen_size
from eyetrax.filters import KalmanSmoother, make_kalman, KDESmoother

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
        self.is_tuned = False
        self.needs_setup = False  # Flag to trigger setup flow on first connection
        self.screen_width, self.screen_height = get_screen_size()
        self.model_path = "users/default_model.pkl"
        self.smoother = None

        # Create users directory if it doesn't exist
        os.makedirs("users", exist_ok=True)

    def initialize_eyetrax(self):
        """Initialize EyeTrax gaze estimator and camera."""
        try:
            logger.debug(f"Initializing EyeTrax")

            # Initialize EyeTrax GazeEstimator
            self.estimator = GazeEstimator(model_name="ridge")

            # Try to load existing model
            if os.path.isfile(self.model_path):
                logger.debug(f"Loading existing model: {self.model_path}")
                self.estimator.load_model(self.model_path)
                self.is_calibrated = True
                self.needs_setup = True  # Need tuning for this session
                logger.info("Existing calibration model loaded - tuning required")
            else:
                logger.info("No calibration found - full setup required")
                self.is_calibrated = False
                self.needs_setup = True  # Need calibration + tuning

            # Initialize camera
            logger.debug(f"Opening camera {self.camera_id}")
            self.camera = cv2.VideoCapture(self.camera_id)

            if not self.camera.isOpened():
                raise Exception(f"Failed to open camera {self.camera_id}")

            # Initialize KDE smoother with ChatGPT-optimized settings
            # SMOOTHING TUNING: Increase values if cursor is jittery
            # time_window: 0.1-0.5 (kısa=hızlı, uzun=yumuşak)
            # confidence: 0.1-0.7 (düşük=az smoothing, yüksek=çok smoothing)
            self.smoother = KDESmoother(
                screen_w=self.screen_width,
                screen_h=self.screen_height,
                time_window=0.35,   # 350ms → mikro sakkadları yutar (was 0.2)
                confidence=0.55,    # orta seviye smoothing (was 0.3)
                grid=(320, 200)     # Default grid resolution
            )
            logger.debug("KDE smoother initialized (ChatGPT-optimized: time_window=0.35, confidence=0.55)")

            logger.info(f"EyeTrax ready (Screen: {self.screen_width}x{self.screen_height})")
            return True

        except ImportError as e:
            logger.error(f"EyeTrax import error: {e}")
            logger.error("If EyeTrax is installed, check dependencies")
            return False
        except Exception as e:
            logger.error(f"Failed to initialize EyeTrax: {e}", exc_info=True)
            return False

    def calibrate(self):
        """Run 9-point calibration only (tuning handled by setup_flow)."""
        try:
            logger.info("Starting 9-point calibration (follow on-screen instructions)")

            # Run EyeTrax calibration (this opens a fullscreen window)
            run_9_point_calibration(self.estimator, camera_index=self.camera_id)

            # Save the trained model
            self.estimator.save_model(self.model_path)
            self.is_calibrated = True
            logger.info("Calibration complete - model saved")

            return True

        except Exception as e:
            logger.error(f"Calibration failed: {e}")
            return False

    def tune_kalman(self):
        """Enable KDE smoother (no tuning needed for KDE)."""
        try:
            logger.info("KDE smoother ready (no tuning required)")

            if not self.smoother:
                logger.error("Smoother not initialized")
                return False

            if not self.is_calibrated:
                logger.error("Cannot enable smoother before calibration")
                return False

            # KDE doesn't require tuning - just enable it
            self.is_tuned = True
            logger.info("KDE smoother enabled - lightweight tracking active")
            return True

        except Exception as e:
            logger.error(f"Smoother setup failed: {e}")
            return False

    def run_setup_flow(self):
        """Smart setup flow: calibration (if needed) + tuning → ready for tracking.

        This matches EyeTrax demo behavior where setup runs automatically.

        Flow:
        - Model exists: Just run tuning → tracking ready
        - No model: Run calibration → tuning → tracking ready
        """
        try:
            logger.info("=" * 60)
            logger.info("Starting setup flow")
            logger.info("=" * 60)

            # Step 1: Calibration (if needed)
            if not self.is_calibrated:
                logger.info("Step 1/2: Running 9-point calibration")
                if not self.calibrate():
                    logger.error("Setup failed: Calibration error")
                    return False
            else:
                logger.info("Model already calibrated - skipping calibration")

            # Step 2: Enable KDE smoother (no tuning needed)
            logger.info("Step 2/2: Enabling KDE smoother (lightweight)")
            if not self.tune_kalman():
                logger.warning("Setup completed but smoother failed (non-critical)")
                # Don't fail setup if smoother fails
                self.is_tuned = False

            self.needs_setup = False
            logger.info("=" * 60)
            logger.info("Setup complete - Eye tracking ready!")
            logger.info("=" * 60)
            return True

        except Exception as e:
            logger.error(f"Setup flow failed: {e}", exc_info=True)
            return False

    def get_gaze_point(self) -> Optional[Dict]:
        """Get current gaze point from EyeTrax using extract_features + predict.

        Returns gaze data dict if successful, None if:
        - Face not detected
        - Eyes blinking
        - No valid features

        This matches EyeTrax demo behavior where None causes cursor fade-out.
        """
        if not self.estimator or not self.camera or not self.is_calibrated:
            return None

        try:
            # Read frame from camera
            ret, frame = self.camera.read()
            if not ret:
                return None

            # Extract features using EyeTrax
            features, blink_detected = self.estimator.extract_features(frame)

            # Return None if no face or blinking (like EyeTrax demo)
            # This triggers cursor fade-out in extension
            if features is None or blink_detected:
                return None

            # Predict gaze coordinates
            gaze_coords = self.estimator.predict([features])
            if gaze_coords is None or len(gaze_coords) < 1:
                return None

            # Extract x, y coordinates
            x, y = gaze_coords[0]

            # Apply lightweight KDE smoothing (less aggressive than Kalman)
            if self.smoother and self.is_tuned:
                x, y = self.smoother.step(int(x), int(y))

            # Clamp coordinates to screen boundaries (prevent out-of-screen values)
            x = max(0, min(int(x), self.screen_width - 1))
            y = max(0, min(int(y), self.screen_height - 1))

            # Prepare gaze data packet
            gaze_data = {
                "type": "gaze",
                "x": int(x),
                "y": int(y),
                "confidence": 0.9,  # High confidence - face detected, no blink
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
        was_ready = False  # Track when setup completes

        logger.info("Stream loop started")

        while self.is_running:
            loop_start = time.time()

            # Check if setup just completed
            if not self.needs_setup and self.is_calibrated and self.is_tuned and not was_ready:
                logger.info(f"Setup complete - gaze streaming started at {self.stream_frequency} Hz")
                was_ready = True

            # Only stream if setup is complete
            if not self.needs_setup and self.is_calibrated and self.is_tuned:
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
        logger.debug("Gaze streaming stopped")

    def cleanup(self):
        """Release camera and cleanup resources."""
        if self.camera:
            try:
                self.camera.release()
                logger.debug("Camera released")
            except Exception as e:
                logger.error(f"Error releasing camera: {e}")
