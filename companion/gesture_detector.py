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

        # Blink detection state
        self.last_blink_time = 0
        self.blink_count = 0
        self.double_blink_window = 500  # ms - time window for double blink
        self.ear_threshold = 0.2  # Eye Aspect Ratio threshold for blink

        # Head movement state
        self.last_head_yaw = 0
        self.last_head_pitch = 0
        self.head_movement_threshold = 15  # degrees

        # Gesture cooldown to prevent multiple detections
        self.last_gesture_time = 0
        self.gesture_cooldown = 1000  # ms

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

        # Check cooldown
        if current_time - self.last_gesture_time < self.gesture_cooldown:
            return gestures

        # Convert frame to RGB for MediaPipe
        rgb_frame = frame[:, :, ::-1]  # BGR to RGB

        # Process frame
        results = self.face_mesh.process(rgb_frame)

        if not results.multi_face_landmarks:
            return gestures

        face_landmarks = results.multi_face_landmarks[0]
        h, w, _ = frame.shape

        # --- BLINK DETECTION ---
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

        # Detect blink
        if avg_ear < self.ear_threshold:
            # Blink detected
            if current_time - self.last_blink_time < self.double_blink_window:
                # Second blink within window = double blink!
                gestures['double_blink'] = True
                self.blink_count = 0
                self.last_gesture_time = current_time
                logger.info("👁️ Double blink detected!")
            else:
                # First blink
                self.blink_count = 1

            self.last_blink_time = current_time

        # --- HEAD MOVEMENT DETECTION ---
        yaw, pitch = self.get_head_pose(face_landmarks.landmark, w, h)

        # Detect horizontal head movement (left/right)
        yaw_delta = yaw - self.last_head_yaw
        if abs(yaw_delta) > self.head_movement_threshold:
            if yaw_delta > 0:
                gestures['head_right'] = True
                self.last_gesture_time = current_time
                logger.info("➡️ Head right detected!")
            else:
                gestures['head_left'] = True
                self.last_gesture_time = current_time
                logger.info("⬅️ Head left detected!")

        # Detect vertical head movement (up/down)
        pitch_delta = pitch - self.last_head_pitch
        if abs(pitch_delta) > self.head_movement_threshold:
            if pitch_delta > 0:
                gestures['head_down'] = True
                self.last_gesture_time = current_time
                logger.info("⬇️ Head down detected!")
            else:
                gestures['head_up'] = True
                self.last_gesture_time = current_time
                logger.info("⬆️ Head up detected!")

        # Update head pose
        self.last_head_yaw = yaw
        self.last_head_pitch = pitch

        return gestures

    def cleanup(self):
        """Clean up MediaPipe resources."""
        if self.face_mesh:
            self.face_mesh.close()
