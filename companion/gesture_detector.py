"""
Gesture Detection Module for ReaRead
Detects eye blinks, double blinks, and head movements
"""

import time
import logging
import mediapipe as mp
import numpy as np

logger = logging.getLogger(__name__)


class GestureDetector:
    """Detects gestures like blinks, double blinks, and head movements."""

    def __init__(self):
        # MediaPipe Face Mesh for head pose and blink detection
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        # OPTIMIZED BLINK DETECTION STATE (Hands-Free Accessibility)
        self.last_blink_time = 0
        self.blink_count = 0
        self.double_blink_window = 700  # ms - INCREASED for easier double blink (was 500)
        self.ear_threshold = 0.18  # DECREASED for more reliable blink detection (was 0.2)
        self.blink_state = 'open'  # Track eye state: 'open', 'closing', 'closed'
        self.eyes_closed_start = 0  # Timestamp when eyes closed
        self.min_blink_duration = 50  # ms - Minimum time eyes must be closed to count as blink
        self.max_blink_duration = 400  # ms - Maximum time, longer = intentional close not blink

        # OPTIMIZED HEAD MOVEMENT STATE (Smooth and Responsive)
        self.last_head_yaw = 0
        self.last_head_pitch = 0
        self.head_movement_threshold = 20  # degrees - INCREASED for more deliberate movements (was 15)
        self.head_yaw_history = []  # Track recent yaw values for smoothing
        self.head_pitch_history = []  # Track recent pitch values for smoothing
        self.history_window = 5  # Frames to average for smoothing

        # OPTIMIZED COOLDOWN (Fast Response for Hands-Free)
        self.last_gesture_time = 0
        self.gesture_cooldown = 600  # ms - DECREASED for faster response (was 1000)

        # SEPARATE COOLDOWNS for different gesture types (more natural interaction)
        self.last_blink_gesture = 0
        self.last_head_gesture = 0
        self.blink_cooldown = 500  # ms - Quick recovery for blinks
        self.head_cooldown = 700  # ms - Slightly longer for head movements

    def calculate_ear(self, eye_landmarks):
        """
        Calculate Eye Aspect Ratio (EAR) for blink detection.

        Args:
            eye_landmarks: List of (x, y) tuples for eye landmarks

        Returns:
            float: Eye Aspect Ratio value
        """
        # Vertical eye landmarks
        A = np.linalg.norm(np.array(eye_landmarks[1]) - np.array(eye_landmarks[5]))
        B = np.linalg.norm(np.array(eye_landmarks[2]) - np.array(eye_landmarks[4]))

        # Horizontal eye landmark
        C = np.linalg.norm(np.array(eye_landmarks[0]) - np.array(eye_landmarks[3]))

        # Eye Aspect Ratio
        ear = (A + B) / (2.0 * C)
        return ear

    def get_head_pose(self, landmarks, image_width, image_height):
        """
        Calculate head pose (yaw and pitch) from face landmarks.

        Args:
            landmarks: MediaPipe face landmarks
            image_width: Width of the image
            image_height: Height of the image

        Returns:
            tuple: (yaw, pitch) in degrees
        """
        # Key points for head pose estimation
        # Nose tip
        nose_tip = landmarks[1]

        # Face center points
        left_eye = landmarks[33]
        right_eye = landmarks[263]
        left_mouth = landmarks[61]
        right_mouth = landmarks[291]

        # Calculate yaw (left/right rotation)
        # Based on horizontal position of nose relative to eyes
        eye_center_x = (left_eye.x + right_eye.x) / 2
        yaw = (nose_tip.x - eye_center_x) * 100  # Scale for degrees

        # Calculate pitch (up/down rotation)
        # Based on vertical position of nose relative to mouth
        mouth_center_y = (left_mouth.y + right_mouth.y) / 2
        pitch = (nose_tip.y - mouth_center_y) * 100  # Scale for degrees

        return yaw, pitch

    def detect_gestures(self, frame):
        """
        Detect gestures from camera frame.

        Args:
            frame: Camera frame (numpy array)

        Returns:
            dict: Detected gestures with keys:
                - double_blink: bool
                - head_left: bool
                - head_right: bool
                - head_up: bool
                - head_down: bool
        """
        current_time = int(time.time() * 1000)
        gestures = {
            'double_blink': False,
            'head_left': False,
            'head_right': False,
            'head_up': False,
            'head_down': False
        }

        # NOTE: Removed global cooldown - using gesture-specific cooldowns for better UX
        # This allows blinks and head movements to work independently

        # Convert frame to RGB for MediaPipe
        rgb_frame = frame[:, :, ::-1]  # BGR to RGB

        # Process frame
        results = self.face_mesh.process(rgb_frame)

        if not results.multi_face_landmarks:
            return gestures

        face_landmarks = results.multi_face_landmarks[0]
        h, w, _ = frame.shape

        # --- IMPROVED BLINK DETECTION (State-Based for Reliability) ---
        # Left eye landmarks (indices for MediaPipe Face Mesh)
        left_eye_indices = [33, 160, 158, 133, 153, 144]
        left_eye = [(face_landmarks.landmark[i].x, face_landmarks.landmark[i].y)
                    for i in left_eye_indices]

        # Right eye landmarks
        right_eye_indices = [362, 385, 387, 263, 373, 380]
        right_eye = [(face_landmarks.landmark[i].x, face_landmarks.landmark[i].y)
                     for i in right_eye_indices]

        # Calculate EAR for both eyes
        left_ear = self.calculate_ear(left_eye)
        right_ear = self.calculate_ear(right_eye)
        avg_ear = (left_ear + right_ear) / 2.0

        # STATE-BASED BLINK DETECTION (More reliable than threshold-only)
        if avg_ear < self.ear_threshold:
            # Eyes are closed
            if self.blink_state == 'open':
                # Transition: open -> closing
                self.blink_state = 'closing'
                self.eyes_closed_start = current_time
            elif self.blink_state == 'closing':
                # Check if eyes have been closed long enough
                closed_duration = current_time - self.eyes_closed_start
                if closed_duration >= self.min_blink_duration:
                    # Transition: closing -> closed
                    self.blink_state = 'closed'
        else:
            # Eyes are open
            if self.blink_state in ['closing', 'closed']:
                # Blink completed! (eyes reopened)
                closed_duration = current_time - self.eyes_closed_start

                # Validate blink duration (filter out long eye closures)
                if self.min_blink_duration <= closed_duration <= self.max_blink_duration:
                    # Valid blink detected!
                    # Check for double blink
                    if current_time - self.last_blink_time < self.double_blink_window:
                        # Second blink within window = DOUBLE BLINK!
                        if current_time - self.last_blink_gesture >= self.blink_cooldown:
                            gestures['double_blink'] = True
                            self.last_blink_gesture = current_time
                            self.last_gesture_time = current_time
                            logger.info("👁️👁️ Double blink detected! (Hands-Free Trigger)")
                            self.blink_count = 0
                    else:
                        # First blink (start double blink window)
                        self.blink_count = 1
                        logger.debug(f"👁️ Single blink detected (duration: {closed_duration}ms)")

                    self.last_blink_time = current_time

                # Reset state
                self.blink_state = 'open'
                self.eyes_closed_start = 0

        # --- IMPROVED HEAD MOVEMENT DETECTION (Smoothed for Stability) ---
        yaw, pitch = self.get_head_pose(face_landmarks.landmark, w, h)

        # Add to history for smoothing
        self.head_yaw_history.append(yaw)
        self.head_pitch_history.append(pitch)

        # Keep only recent history
        if len(self.head_yaw_history) > self.history_window:
            self.head_yaw_history.pop(0)
        if len(self.head_pitch_history) > self.history_window:
            self.head_pitch_history.pop(0)

        # Calculate smoothed values (moving average)
        smoothed_yaw = sum(self.head_yaw_history) / len(self.head_yaw_history)
        smoothed_pitch = sum(self.head_pitch_history) / len(self.head_pitch_history)

        # Only detect gestures if we have enough history for stable readings
        if len(self.head_yaw_history) >= self.history_window:
            # Check head movement cooldown separately
            if current_time - self.last_head_gesture >= self.head_cooldown:
                # Detect HORIZONTAL head movement (left/right)
                yaw_delta = smoothed_yaw - self.last_head_yaw
                if abs(yaw_delta) > self.head_movement_threshold:
                    if yaw_delta > 0:
                        gestures['head_right'] = True
                        self.last_head_gesture = current_time
                        self.last_gesture_time = current_time
                        logger.info("➡️ Head RIGHT detected! (Hands-Free Navigation)")
                    else:
                        gestures['head_left'] = True
                        self.last_head_gesture = current_time
                        self.last_gesture_time = current_time
                        logger.info("⬅️ Head LEFT detected! (Hands-Free Navigation)")

                # Detect VERTICAL head movement (up/down)
                pitch_delta = smoothed_pitch - self.last_head_pitch
                if abs(pitch_delta) > self.head_movement_threshold:
                    if pitch_delta > 0:
                        gestures['head_down'] = True
                        self.last_head_gesture = current_time
                        self.last_gesture_time = current_time
                        logger.info("⬇️ Head DOWN detected! (Hands-Free Selection)")
                    else:
                        gestures['head_up'] = True
                        self.last_head_gesture = current_time
                        self.last_gesture_time = current_time
                        logger.info("⬆️ Head UP detected! (Hands-Free Close)")

        # Update head pose with smoothed values
        self.last_head_yaw = smoothed_yaw
        self.last_head_pitch = smoothed_pitch

        return gestures

    def cleanup(self):
        """Clean up MediaPipe resources."""
        if self.face_mesh:
            self.face_mesh.close()
