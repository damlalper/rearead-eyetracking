import asyncio
import time
import logging
import os
import cv2
import numpy as np
from collections import deque
from typing import Optional, Dict
from eyetrax import GazeEstimator
from eyetrax.calibration import run_9_point_calibration
from eyetrax.utils.screen import get_screen_size

logger = logging.getLogger(__name__)


class GazeStreamer:
    """Streams gaze data from EyeTrax to WebSocket server."""

    def __init__(self, camera_id: int = 0, confidence_threshold: float = 0.7, stream_frequency: int = 30,
                 debug_mode: bool = False, smoothing_factor: float = 0.3):
        self.camera_id = camera_id
        self.confidence_threshold = confidence_threshold
        self.stream_frequency = stream_frequency
        self.is_running = False
        self.estimator = None
        self.camera = None
        self.is_calibrated = False
        self.screen_width, self.screen_height = get_screen_size()
        self.model_path = "users/default_model.pkl"

        # Debug visualization
        self.debug_mode = debug_mode
        self.debug_window_name = "ReaRead - Gaze Debug"

        # Smoothing filter (Exponential Moving Average)
        self.smoothing_factor = smoothing_factor  # 0.0 = max smoothing, 1.0 = no smoothing
        self.smoothed_x = None
        self.smoothed_y = None

        # Statistics tracking
        self.gaze_history = deque(maxlen=100)  # Son 100 gaze point
        self.fps_counter = deque(maxlen=30)
        self.last_frame_time = time.time()

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

            # Temporarily release camera for calibration to avoid conflicts
            if self.camera and self.camera.isOpened():
                logger.info("Releasing camera for calibration...")
                self.camera.release()
                # Close debug window during calibration if it exists
                if self.debug_mode:
                    try:
                        cv2.destroyWindow(self.debug_window_name)
                    except:
                        pass

            # Run EyeTrax calibration (this opens a fullscreen window with its own camera)
            run_9_point_calibration(self.estimator, camera_index=self.camera_id)

            # Reopen camera after calibration
            logger.info("Reopening camera after calibration...")
            self.camera = cv2.VideoCapture(self.camera_id)
            if not self.camera.isOpened():
                raise Exception(f"Failed to reopen camera {self.camera_id}")

            # Recreate debug window if debug mode is enabled
            if self.debug_mode:
                cv2.namedWindow(self.debug_window_name, cv2.WINDOW_NORMAL)
                cv2.resizeWindow(self.debug_window_name, 800, 600)
                logger.info("Debug window recreated")

            # Save the trained model
            self.estimator.save_model(self.model_path)
            self.is_calibrated = True

            # Reset smoothing filter for fresh start
            self.smoothed_x = None
            self.smoothed_y = None

            logger.info(f"Calibration complete! Model saved: {self.model_path}")
            return True

        except Exception as e:
            logger.error(f"Calibration failed: {e}", exc_info=True)
            # Try to reopen camera even if calibration failed
            if not self.camera or not self.camera.isOpened():
                logger.info("Attempting to reopen camera after error...")
                try:
                    self.camera = cv2.VideoCapture(self.camera_id)
                except Exception as cam_error:
                    logger.error(f"Failed to reopen camera: {cam_error}")
            return False

    def get_gaze_point(self, return_frame: bool = False) -> Optional[Dict]:
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
                if self.debug_mode and return_frame:
                    debug_frame = self._draw_debug_info(frame, None, None, blink, "No face" if features is None else "Blinking")
                    return {"frame": debug_frame}
                return None

            # Predict gaze coordinates
            gaze_coords = self.estimator.predict([features])
            if gaze_coords is None or len(gaze_coords) < 1:
                if self.debug_mode and return_frame:
                    debug_frame = self._draw_debug_info(frame, None, None, blink, "Prediction failed")
                    return {"frame": debug_frame}
                return None

            # Extract x, y coordinates (raw prediction)
            raw_x, raw_y = gaze_coords[0]

            # Apply exponential moving average smoothing
            if self.smoothed_x is None or self.smoothed_y is None:
                # First point - initialize smoothed values
                self.smoothed_x = raw_x
                self.smoothed_y = raw_y
            else:
                # Apply EMA: smoothed = alpha * raw + (1 - alpha) * previous_smoothed
                self.smoothed_x = self.smoothing_factor * raw_x + (1 - self.smoothing_factor) * self.smoothed_x
                self.smoothed_y = self.smoothing_factor * raw_y + (1 - self.smoothing_factor) * self.smoothed_y

            # Use smoothed coordinates for output
            x, y = self.smoothed_x, self.smoothed_y

            # Add to history for statistics
            self.gaze_history.append((x, y))

            # Calculate FPS
            current_time = time.time()
            fps = 1.0 / (current_time - self.last_frame_time) if current_time != self.last_frame_time else 0
            self.fps_counter.append(fps)
            self.last_frame_time = current_time

            # Calculate average FPS for stats
            avg_fps = np.mean(self.fps_counter) if len(self.fps_counter) > 0 else 0

            # Prepare gaze data packet with debug info
            gaze_data = {
                "type": "gaze",
                "x": int(x),
                "y": int(y),
                "raw_x": int(raw_x),  # Raw unsmoothed coordinates
                "raw_y": int(raw_y),
                "confidence": 0.9,  # High confidence since model is trained
                "timestamp": int(time.time() * 1000),
                "screen_width": self.screen_width,
                "screen_height": self.screen_height,
                # Debug statistics
                "fps": round(avg_fps, 1),
                "blink": bool(blink),  # Convert numpy bool_ to Python bool
                "smoothing": self.smoothing_factor
            }

            # Debug visualization
            if self.debug_mode and return_frame:
                debug_frame = self._draw_debug_info(frame, x, y, blink, "Tracking")
                gaze_data["frame"] = debug_frame

            # DEBUG: Print gaze data
            logger.debug(f"Gaze: ({gaze_data['x']}, {gaze_data['y']})")

            return gaze_data

        except Exception as e:
            logger.error(f"Error getting gaze point: {e}")
            return None

    def _draw_debug_info(self, frame, gaze_x, gaze_y, blink, status):
        """Draw debug information on frame."""
        # Calculate stats
        avg_fps = np.mean(self.fps_counter) if len(self.fps_counter) > 0 else 0

        # Make a copy to avoid modifying original
        display_frame = frame.copy()
        h, w = display_frame.shape[:2]

        # Draw gaze point on screen minimap
        minimap_scale = 0.25
        minimap_w = int(self.screen_width * minimap_scale)
        minimap_h = int(self.screen_height * minimap_scale)

        # Position minimap in top-right
        minimap_x = w - minimap_w - 20
        minimap_y = 20

        # Draw minimap background
        cv2.rectangle(display_frame, (minimap_x, minimap_y),
                     (minimap_x + minimap_w, minimap_y + minimap_h),
                     (50, 50, 50), -1)
        cv2.rectangle(display_frame, (minimap_x, minimap_y),
                     (minimap_x + minimap_w, minimap_y + minimap_h),
                     (255, 255, 255), 2)

        # Draw gaze point on minimap
        if gaze_x is not None and gaze_y is not None:
            gaze_minimap_x = int(minimap_x + (gaze_x / self.screen_width) * minimap_w)
            gaze_minimap_y = int(minimap_y + (gaze_y / self.screen_height) * minimap_h)
            cv2.circle(display_frame, (gaze_minimap_x, gaze_minimap_y), 5, (0, 0, 255), -1)

            # Draw trail of last positions
            if len(self.gaze_history) > 1:
                points = []
                for hist_x, hist_y in list(self.gaze_history)[-20:]:
                    pt_x = int(minimap_x + (hist_x / self.screen_width) * minimap_w)
                    pt_y = int(minimap_y + (hist_y / self.screen_height) * minimap_h)
                    points.append((pt_x, pt_y))

                for i in range(1, len(points)):
                    alpha = i / len(points)
                    color = (0, int(255 * alpha), 0)
                    cv2.line(display_frame, points[i-1], points[i], color, 1)

        # Draw text info
        y_offset = 30
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.6
        thickness = 2

        # Background for text
        cv2.rectangle(display_frame, (10, 10), (350, 180), (0, 0, 0), -1)
        cv2.rectangle(display_frame, (10, 10), (350, 180), (255, 255, 255), 2)

        # Status
        status_color = (0, 255, 0) if status == "Tracking" else (0, 165, 255)
        cv2.putText(display_frame, f"Status: {status}", (20, y_offset), font, font_scale, status_color, thickness)
        y_offset += 30

        # Gaze coordinates
        if gaze_x is not None and gaze_y is not None:
            cv2.putText(display_frame, f"Gaze: ({int(gaze_x)}, {int(gaze_y)}) px",
                       (20, y_offset), font, font_scale, (255, 255, 255), thickness)
        else:
            cv2.putText(display_frame, "Gaze: N/A", (20, y_offset), font, font_scale, (128, 128, 128), thickness)
        y_offset += 30

        # Screen size
        cv2.putText(display_frame, f"Screen: {self.screen_width}x{self.screen_height}",
                   (20, y_offset), font, font_scale, (200, 200, 200), thickness)
        y_offset += 30

        # FPS
        cv2.putText(display_frame, f"FPS: {avg_fps:.1f}",
                   (20, y_offset), font, font_scale, (255, 200, 0), thickness)
        y_offset += 30

        # Blink status
        blink_text = "BLINK" if blink else "Eyes Open"
        blink_color = (0, 0, 255) if blink else (0, 255, 0)
        cv2.putText(display_frame, blink_text, (20, y_offset), font, font_scale, blink_color, thickness)

        return display_frame

    async def stream_loop(self, websocket_server):
        """Main streaming loop that continuously sends gaze data."""
        self.is_running = True
        frame_delay = 1.0 / self.stream_frequency

        if not self.is_calibrated:
            logger.warning("Starting stream loop but NOT CALIBRATED - no gaze data will be sent")
            logger.warning("Please trigger calibration from the extension")
        else:
            logger.info(f"Starting gaze streaming at {self.stream_frequency} Hz")

        # Create debug window if in debug mode
        if self.debug_mode:
            cv2.namedWindow(self.debug_window_name, cv2.WINDOW_NORMAL)
            cv2.resizeWindow(self.debug_window_name, 800, 600)
            logger.info("Debug visualization window opened")

        while self.is_running:
            loop_start = time.time()

            # Get gaze with debug frame
            if self.is_calibrated:
                gaze_data = self.get_gaze_point(return_frame=self.debug_mode)

                # Show debug window
                if self.debug_mode and gaze_data and "frame" in gaze_data:
                    cv2.imshow(self.debug_window_name, gaze_data["frame"])
                    # Handle window close and key presses
                    key = cv2.waitKey(1) & 0xFF
                    if key == ord('q') or cv2.getWindowProperty(self.debug_window_name, cv2.WND_PROP_VISIBLE) < 1:
                        logger.info("Debug window closed by user")
                        self.debug_mode = False
                        cv2.destroyWindow(self.debug_window_name)
                    elif key == ord('d'):
                        # Toggle debug mode
                        self.debug_mode = not self.debug_mode
                        logger.info(f"Debug mode: {'ON' if self.debug_mode else 'OFF'}")

                # Broadcast to all connected clients (remove frame from data)
                if gaze_data and websocket_server.is_connected():
                    # Remove frame before sending to WebSocket
                    clean_data = {k: v for k, v in gaze_data.items() if k != "frame"}
                    await websocket_server.broadcast_gaze(clean_data)

            # Maintain target frequency
            elapsed = time.time() - loop_start
            sleep_time = max(0, frame_delay - elapsed)
            await asyncio.sleep(sleep_time)

        # Cleanup debug window
        if self.debug_mode:
            cv2.destroyWindow(self.debug_window_name)

    def stop(self):
        """Stop the gaze streaming loop."""
        self.is_running = False
        logger.info("Gaze streaming stopped")

    def test_calibration_accuracy(self, duration_seconds: int = 10):
        """
        Test calibration accuracy by showing target points on screen.
        User looks at each point, system measures error distance.

        Args:
            duration_seconds: How long to run the test
        """
        if not self.is_calibrated:
            logger.error("Cannot test accuracy - model not calibrated")
            return None

        logger.info("Starting calibration accuracy test...")
        logger.info("Look at the RED target points shown on screen")

        # Test points (9-point grid like calibration)
        test_points = [
            (int(self.screen_width * 0.1), int(self.screen_height * 0.1)),   # Top-left
            (int(self.screen_width * 0.5), int(self.screen_height * 0.1)),   # Top-center
            (int(self.screen_width * 0.9), int(self.screen_height * 0.1)),   # Top-right
            (int(self.screen_width * 0.1), int(self.screen_height * 0.5)),   # Mid-left
            (int(self.screen_width * 0.5), int(self.screen_height * 0.5)),   # Center
            (int(self.screen_width * 0.9), int(self.screen_height * 0.5)),   # Mid-right
            (int(self.screen_width * 0.1), int(self.screen_height * 0.9)),   # Bottom-left
            (int(self.screen_width * 0.5), int(self.screen_height * 0.9)),   # Bottom-center
            (int(self.screen_width * 0.9), int(self.screen_height * 0.9)),   # Bottom-right
        ]

        errors = []
        test_window = "Calibration Accuracy Test"
        cv2.namedWindow(test_window, cv2.WINDOW_NORMAL)
        cv2.setWindowProperty(test_window, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

        point_duration = duration_seconds / len(test_points)

        for idx, (target_x, target_y) in enumerate(test_points):
            logger.info(f"Testing point {idx + 1}/{len(test_points)}: ({target_x}, {target_y})")

            point_errors = []
            start_time = time.time()

            while time.time() - start_time < point_duration:
                # Create blank screen
                screen = np.zeros((self.screen_height, self.screen_width, 3), dtype=np.uint8)

                # Draw target point
                cv2.circle(screen, (target_x, target_y), 30, (0, 0, 255), -1)
                cv2.circle(screen, (target_x, target_y), 35, (255, 255, 255), 2)

                # Get gaze prediction
                gaze_data = self.get_gaze_point()

                if gaze_data:
                    pred_x, pred_y = gaze_data['x'], gaze_data['y']

                    # Draw predicted point
                    cv2.circle(screen, (pred_x, pred_y), 15, (0, 255, 0), -1)

                    # Draw line between target and prediction
                    cv2.line(screen, (target_x, target_y), (pred_x, pred_y), (255, 255, 0), 2)

                    # Calculate error
                    error_px = np.sqrt((pred_x - target_x)**2 + (pred_y - target_y)**2)
                    point_errors.append(error_px)

                    # Show error on screen
                    cv2.putText(screen, f"Error: {error_px:.1f} px",
                               (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 3)
                    cv2.putText(screen, f"Point {idx + 1}/{len(test_points)}",
                               (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (200, 200, 200), 2)

                cv2.imshow(test_window, screen)
                if cv2.waitKey(30) & 0xFF == ord('q'):
                    break

            if point_errors:
                avg_error = np.mean(point_errors)
                errors.append(avg_error)
                logger.info(f"  Average error: {avg_error:.1f} px")

        cv2.destroyWindow(test_window)

        if errors:
            overall_avg = np.mean(errors)
            overall_std = np.std(errors)
            max_error = np.max(errors)
            min_error = np.min(errors)

            logger.info("=" * 50)
            logger.info("CALIBRATION ACCURACY TEST RESULTS")
            logger.info("=" * 50)
            logger.info(f"Average Error:    {overall_avg:.1f} px")
            logger.info(f"Std Deviation:    {overall_std:.1f} px")
            logger.info(f"Min Error:        {min_error:.1f} px")
            logger.info(f"Max Error:        {max_error:.1f} px")
            logger.info("=" * 50)

            # Quality assessment
            if overall_avg < 50:
                logger.info("✓ EXCELLENT calibration quality")
            elif overall_avg < 100:
                logger.info("○ GOOD calibration quality")
            elif overall_avg < 150:
                logger.info("△ FAIR calibration quality - consider re-calibrating")
            else:
                logger.info("✗ POOR calibration quality - re-calibration recommended")

            return {
                "average_error_px": overall_avg,
                "std_dev_px": overall_std,
                "min_error_px": min_error,
                "max_error_px": max_error,
                "point_errors": errors
            }

        return None

    def cleanup(self):
        """Release camera and cleanup resources."""
        if self.camera:
            try:
                self.camera.release()
                logger.info("Camera released")
            except Exception as e:
                logger.error(f"Error releasing camera: {e}")

        # Close any open CV windows
        cv2.destroyAllWindows()
