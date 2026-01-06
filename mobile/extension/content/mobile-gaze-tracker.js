// ReaRead Mobile - MediaPipe.js Gaze Tracker
// Calibration-free eye tracking using MediaPipe Face Mesh

class MobileGazeTracker {
  constructor() {
    this.faceMesh = null;
    this.camera = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.isRunning = false;
    this.lastGazePoint = { x: 0, y: 0 };
    this.smoothingBuffer = [];
    this.smoothingWindowSize = 5;

    // Gaze calculation parameters (fine-tunable)
    this.config = {
      GAZE_SCALE_X: 0.4,        // Horizontal sensitivity
      GAZE_SCALE_Y: 0.3,        // Vertical sensitivity
      HEAD_YAW_SCALE: 150,      // Head rotation influence
      HEAD_PITCH_SCALE: 100,    // Head tilt influence
      SMOOTHING_FACTOR: 0.3,    // Higher = smoother but slower
      MIN_DETECTION_CONFIDENCE: 0.5,
      MIN_TRACKING_CONFIDENCE: 0.5
    };

    // Performance settings
    this.targetFPS = 20;        // Mobile default
    this.lastFrameTime = 0;
    this.frameInterval = 1000 / this.targetFPS;

    // Battery management
    this.batteryLevel = 100;
    this.isCharging = false;

    // Callback for gaze data
    this.onGazeData = null;

    // MediaPipe landmarks indices
    this.LANDMARKS = {
      LEFT_EYE_INNER: 133,
      LEFT_EYE_OUTER: 33,
      LEFT_EYE_CENTER: 468,      // Left iris center
      RIGHT_EYE_INNER: 362,
      RIGHT_EYE_OUTER: 263,
      RIGHT_EYE_CENTER: 473,     // Right iris center
      NOSE_TIP: 1,
      FACE_CENTER: 168
    };
  }

  // Initialize MediaPipe Face Mesh
  async init() {
    try {
      console.log('[MOBILE GAZE] Initializing MediaPipe Face Mesh...');

      // Load MediaPipe Face Mesh
      // NOTE: In production, you need to include MediaPipe.js library:
      // <script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"></script>
      // <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>

      if (typeof FaceMesh === 'undefined') {
        throw new Error('MediaPipe Face Mesh library not loaded. Please include mediapipe scripts.');
      }

      this.faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,  // Enable iris tracking
        minDetectionConfidence: this.config.MIN_DETECTION_CONFIDENCE,
        minTrackingConfidence: this.config.MIN_TRACKING_CONFIDENCE
      });

      this.faceMesh.onResults((results) => this.onResults(results));

      console.log('[MOBILE GAZE] MediaPipe initialized successfully');
      return true;
    } catch (error) {
      console.error('[MOBILE GAZE] Failed to initialize MediaPipe:', error);
      return false;
    }
  }

  // Start camera and tracking
  async start() {
    try {
      console.log('[MOBILE GAZE] Starting camera...');

      // Create video element (hidden)
      this.videoElement = document.createElement('video');
      this.videoElement.style.display = 'none';
      document.body.appendChild(this.videoElement);

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'  // Front camera
        }
      });

      this.videoElement.srcObject = stream;
      this.camera = stream;

      // Wait for video to be ready
      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play();
          resolve();
        };
      });

      // Start MediaPipe camera processing
      if (typeof Camera !== 'undefined') {
        const camera = new Camera(this.videoElement, {
          onFrame: async () => {
            if (this.isRunning) {
              await this.faceMesh.send({ image: this.videoElement });
            }
          },
          width: 640,
          height: 480
        });
        await camera.start();
      } else {
        // Fallback: Manual frame processing
        this.startManualFrameProcessing();
      }

      this.isRunning = true;
      console.log('[MOBILE GAZE] Tracking started');

      // Start battery monitoring
      this.startBatteryMonitoring();

      return true;
    } catch (error) {
      console.error('[MOBILE GAZE] Failed to start camera:', error);
      return false;
    }
  }

  // Manual frame processing (fallback if Camera util not available)
  startManualFrameProcessing() {
    const processFrame = async () => {
      if (!this.isRunning) return;

      const now = Date.now();
      const elapsed = now - this.lastFrameTime;

      if (elapsed >= this.frameInterval) {
        this.lastFrameTime = now;
        await this.faceMesh.send({ image: this.videoElement });
      }

      requestAnimationFrame(processFrame);
    };

    processFrame();
  }

  // Process MediaPipe results
  onResults(results) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      // No face detected
      this.sendGazeData(null, 0);
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    // Calculate gaze point
    const gazePoint = this.calculateGazePoint(landmarks);

    if (gazePoint) {
      // Smooth the gaze point
      const smoothedGaze = this.smoothGaze(gazePoint);

      // Send gaze data to content script
      this.sendGazeData(smoothedGaze, 0.8); // 0.8 confidence for mobile
    }
  }

  // Calculate gaze point (CALIBRATION-FREE ALGORITHM)
  calculateGazePoint(landmarks) {
    try {
      // Get iris centers (MediaPipe provides these with refineLandmarks: true)
      const leftIris = landmarks[this.LANDMARKS.LEFT_EYE_CENTER];
      const rightIris = landmarks[this.LANDMARKS.RIGHT_EYE_CENTER];

      if (!leftIris || !rightIris) {
        console.warn('[MOBILE GAZE] Iris landmarks not found');
        return null;
      }

      // Get eye corners for normalization
      const leftEyeInner = landmarks[this.LANDMARKS.LEFT_EYE_INNER];
      const leftEyeOuter = landmarks[this.LANDMARKS.LEFT_EYE_OUTER];
      const rightEyeInner = landmarks[this.LANDMARKS.RIGHT_EYE_INNER];
      const rightEyeOuter = landmarks[this.LANDMARKS.RIGHT_EYE_OUTER];

      // Calculate eye centers
      const leftEyeCenter = {
        x: (leftEyeInner.x + leftEyeOuter.x) / 2,
        y: (leftEyeInner.y + leftEyeOuter.y) / 2
      };
      const rightEyeCenter = {
        x: (rightEyeInner.x + rightEyeOuter.x) / 2,
        y: (rightEyeInner.y + rightEyeOuter.y) / 2
      };

      // Calculate eye widths for normalization
      const leftEyeWidth = Math.abs(leftEyeOuter.x - leftEyeInner.x);
      const rightEyeWidth = Math.abs(rightEyeOuter.x - rightEyeInner.x);

      // Calculate iris offset from eye center (normalized)
      const leftIrisOffsetX = (leftIris.x - leftEyeCenter.x) / (leftEyeWidth / 2);
      const leftIrisOffsetY = (leftIris.y - leftEyeCenter.y) / (leftEyeWidth / 2);
      const rightIrisOffsetX = (rightIris.x - rightEyeCenter.x) / (rightEyeWidth / 2);
      const rightIrisOffsetY = (rightIris.y - rightEyeCenter.y) / (rightEyeWidth / 2);

      // Average both eyes
      const irisOffsetX = (leftIrisOffsetX + rightIrisOffsetX) / 2;
      const irisOffsetY = (leftIrisOffsetY + rightIrisOffsetY) / 2;

      // Get head pose (yaw and pitch)
      const noseTip = landmarks[this.LANDMARKS.NOSE_TIP];
      const faceCenter = landmarks[this.LANDMARKS.FACE_CENTER];

      const headYaw = (noseTip.x - faceCenter.x) * 2;    // Horizontal head rotation
      const headPitch = (noseTip.y - faceCenter.y) * 2;  // Vertical head tilt

      // Map to screen coordinates (HEURISTIC MAPPING)
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;

      const gazeX = screenCenterX +
                    (irisOffsetX * window.innerWidth * this.config.GAZE_SCALE_X) +
                    (headYaw * this.config.HEAD_YAW_SCALE);

      const gazeY = screenCenterY +
                    (irisOffsetY * window.innerHeight * this.config.GAZE_SCALE_Y) +
                    (headPitch * this.config.HEAD_PITCH_SCALE);

      return { x: gazeX, y: gazeY };

    } catch (error) {
      console.error('[MOBILE GAZE] Error calculating gaze point:', error);
      return null;
    }
  }

  // Smooth gaze point using moving average
  smoothGaze(gazePoint) {
    this.smoothingBuffer.push(gazePoint);

    if (this.smoothingBuffer.length > this.smoothingWindowSize) {
      this.smoothingBuffer.shift();
    }

    const avgX = this.smoothingBuffer.reduce((sum, p) => sum + p.x, 0) / this.smoothingBuffer.length;
    const avgY = this.smoothingBuffer.reduce((sum, p) => sum + p.y, 0) / this.smoothingBuffer.length;

    // Additional exponential smoothing
    const smoothedX = this.lastGazePoint.x * (1 - this.config.SMOOTHING_FACTOR) + avgX * this.config.SMOOTHING_FACTOR;
    const smoothedY = this.lastGazePoint.y * (1 - this.config.SMOOTHING_FACTOR) + avgY * this.config.SMOOTHING_FACTOR;

    this.lastGazePoint = { x: smoothedX, y: smoothedY };

    return { x: smoothedX, y: smoothedY };
  }

  // Send gaze data to callback
  sendGazeData(gazePoint, confidence) {
    if (this.onGazeData) {
      const data = {
        type: 'gaze',
        x: gazePoint ? Math.round(gazePoint.x) : window.innerWidth / 2,
        y: gazePoint ? Math.round(gazePoint.y) : window.innerHeight / 2,
        confidence: confidence,
        timestamp: Date.now(),
        isMobile: true,
        batteryLevel: this.batteryLevel,
        fps: this.targetFPS
      };

      this.onGazeData(data);
    }
  }

  // Battery monitoring for adaptive FPS
  async startBatteryMonitoring() {
    if (!('getBattery' in navigator)) {
      console.warn('[MOBILE GAZE] Battery API not available');
      return;
    }

    try {
      const battery = await navigator.getBattery();

      const updateBattery = () => {
        this.batteryLevel = Math.round(battery.level * 100);
        this.isCharging = battery.charging;

        // Adaptive FPS based on battery
        if (this.isCharging) {
          this.targetFPS = 20; // Full speed when charging
        } else if (this.batteryLevel > 50) {
          this.targetFPS = 20; // High battery
        } else if (this.batteryLevel > 20) {
          this.targetFPS = 15; // Medium battery
        } else {
          this.targetFPS = 10; // Low battery
        }

        this.frameInterval = 1000 / this.targetFPS;

        console.log(`[MOBILE GAZE] Battery: ${this.batteryLevel}%, Charging: ${this.isCharging}, FPS: ${this.targetFPS}`);
      };

      // Initial update
      updateBattery();

      // Listen for battery changes
      battery.addEventListener('levelchange', updateBattery);
      battery.addEventListener('chargingchange', updateBattery);

    } catch (error) {
      console.error('[MOBILE GAZE] Battery monitoring failed:', error);
    }
  }

  // Stop tracking
  stop() {
    this.isRunning = false;

    if (this.camera) {
      this.camera.getTracks().forEach(track => track.stop());
      this.camera = null;
    }

    if (this.videoElement && this.videoElement.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
      this.videoElement = null;
    }

    console.log('[MOBILE GAZE] Tracking stopped');
  }

  // Update configuration (for fine-tuning)
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('[MOBILE GAZE] Config updated:', this.config);
  }

  // Get video element for preview
  getVideoElement() {
    return this.videoElement;
  }
}

// Export for use in content script
window.MobileGazeTracker = MobileGazeTracker;
