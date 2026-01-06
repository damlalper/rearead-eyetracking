// ReaRead Mobile - Behavior-Based Fallback Tracker
// Scroll and touch tracking when camera is not available

class BehaviorTracker {
  constructor() {
    this.isRunning = false;
    this.lastScrollY = 0;
    this.lastTouchY = 0;
    this.dwellStartTime = null;
    this.currentParagraph = null;
    this.onGazeData = null;

    // Configuration
    this.config = {
      DWELL_THRESHOLD_MS: 1000,      // 1 second dwell before "gaze"
      SCROLL_STOP_THRESHOLD_MS: 150, // Scroll stop detection
      SAMPLE_INTERVAL_MS: 100        // Sampling rate
    };

    // State
    this.scrollTimeout = null;
    this.isScrolling = false;
    this.samplingInterval = null;
  }

  // Start tracking
  start() {
    if (this.isRunning) {
      console.warn('[BEHAVIOR] Already running');
      return;
    }

    console.log('[BEHAVIOR] Starting behavior tracking (fallback mode)...');

    // Listen for scroll events
    window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });

    // Listen for touch events
    window.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    window.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
    window.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });

    // Start sampling loop
    this.samplingInterval = setInterval(() => {
      this.sample();
    }, this.config.SAMPLE_INTERVAL_MS);

    this.isRunning = true;
    console.log('[BEHAVIOR] Tracking started');
  }

  // Stop tracking
  stop() {
    if (!this.isRunning) return;

    window.removeEventListener('scroll', this.handleScroll.bind(this));
    window.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    window.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    window.removeEventListener('touchend', this.handleTouchEnd.bind(this));

    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = null;
    }

    this.isRunning = false;
    console.log('[BEHAVIOR] Tracking stopped');
  }

  // Handle scroll event
  handleScroll() {
    this.isScrolling = true;

    // Clear existing timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Detect scroll stop
    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false;
      this.onScrollStop();
    }, this.config.SCROLL_STOP_THRESHOLD_MS);

    this.lastScrollY = window.scrollY;
  }

  // When scroll stops, detect which paragraph is visible
  onScrollStop() {
    const paragraph = this.getVisibleParagraph();

    if (paragraph !== this.currentParagraph) {
      // Switched paragraph
      this.currentParagraph = paragraph;
      this.dwellStartTime = Date.now();
    }
  }

  // Get paragraph in center of viewport
  getVisibleParagraph() {
    const centerY = window.innerHeight / 2 + window.scrollY;

    const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');

    for (const para of paragraphs) {
      const rect = para.getBoundingClientRect();
      const paraTop = rect.top + window.scrollY;
      const paraBottom = paraTop + rect.height;

      if (centerY >= paraTop && centerY <= paraBottom) {
        return para;
      }
    }

    return null;
  }

  // Handle touch start
  handleTouchStart(event) {
    if (event.touches.length > 0) {
      this.lastTouchY = event.touches[0].clientY;
    }
  }

  // Handle touch move
  handleTouchMove(event) {
    if (event.touches.length > 0) {
      const touchY = event.touches[0].clientY;
      const paragraph = this.getParagraphAtPoint(event.touches[0].clientX, touchY);

      if (paragraph && paragraph !== this.currentParagraph) {
        this.currentParagraph = paragraph;
        this.dwellStartTime = Date.now();
      }

      this.lastTouchY = touchY;
    }
  }

  // Handle touch end
  handleTouchEnd() {
    // Detect paragraph at last touch position
    setTimeout(() => {
      const paragraph = this.getVisibleParagraph();

      if (paragraph !== this.currentParagraph) {
        this.currentParagraph = paragraph;
        this.dwellStartTime = Date.now();
      }
    }, 100);
  }

  // Get paragraph at specific screen point
  getParagraphAtPoint(x, y) {
    const element = document.elementFromPoint(x, y);

    if (!element) return null;

    // Find closest paragraph parent
    let current = element;
    while (current && current !== document.body) {
      if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(current.tagName)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  // Sample current state
  sample() {
    if (!this.currentParagraph) {
      // No paragraph detected - send center screen as fallback
      this.sendGazeData(null);
      return;
    }

    // Calculate dwell time
    const now = Date.now();
    const dwellTime = this.dwellStartTime ? (now - this.dwellStartTime) : 0;

    // Only send gaze data if dwelling for threshold duration
    if (dwellTime >= this.config.DWELL_THRESHOLD_MS) {
      // Calculate paragraph center position
      const rect = this.currentParagraph.getBoundingClientRect();
      const paragraphCenterX = rect.left + rect.width / 2;
      const paragraphCenterY = rect.top + rect.height / 2;

      this.sendGazeData({
        x: paragraphCenterX,
        y: paragraphCenterY,
        element: this.currentParagraph,
        dwellTime: dwellTime
      });
    } else {
      // Still dwelling, send low confidence
      this.sendGazeData(null);
    }
  }

  // Send gaze data to callback
  sendGazeData(data) {
    if (!this.onGazeData) return;

    let gazeData;

    if (data) {
      // High confidence (dwelling)
      gazeData = {
        type: 'gaze',
        x: Math.round(data.x),
        y: Math.round(data.y),
        confidence: 0.6, // Lower than camera tracking
        timestamp: Date.now(),
        isMobile: true,
        isFallback: true,
        dwellTime: data.dwellTime
      };
    } else {
      // Low confidence (no dwell or no paragraph)
      gazeData = {
        type: 'gaze',
        x: Math.round(window.innerWidth / 2),
        y: Math.round(window.innerHeight / 2),
        confidence: 0.1,
        timestamp: Date.now(),
        isMobile: true,
        isFallback: true
      };
    }

    this.onGazeData(gazeData);
  }

  // Update configuration
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('[BEHAVIOR] Config updated:', this.config);
  }
}

// Export for use in content script
window.BehaviorTracker = BehaviorTracker;
