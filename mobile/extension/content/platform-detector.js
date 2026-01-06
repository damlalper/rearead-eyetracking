// ReaRead Mobile - Platform Detection
// Detects mobile devices and capabilities

class PlatformDetector {
  constructor() {
    this.userAgent = navigator.userAgent;
    this.platform = this.detectPlatform();
    this.capabilities = this.detectCapabilities();
  }

  // Detect device platform
  detectPlatform() {
    const ua = this.userAgent;

    // Mobile detection
    const isAndroid = /Android/i.test(ua);
    const isiOS = /iPhone|iPad|iPod/i.test(ua);
    const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
    const isMobile = (isAndroid || isiOS) && !isTablet;

    // Browser detection
    const isFirefox = /Firefox/i.test(ua);
    const isChrome = /Chrome|CriOS/i.test(ua) && !/Edge/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua);
    const isKiwi = /Kiwi/i.test(ua);
    const isSamsungInternet = /SamsungBrowser/i.test(ua);

    return {
      // Device type
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet,

      // OS
      isAndroid,
      isiOS,

      // Browser
      isFirefox,
      isChrome,
      isSafari,
      isKiwi,
      isSamsungInternet,

      // Extension support
      supportsExtensions: isFirefox || isKiwi,

      // Screen info
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    };
  }

  // Detect device capabilities
  detectCapabilities() {
    return {
      // Camera
      hasCamera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,

      // Touch
      hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,

      // Battery
      hasBattery: 'getBattery' in navigator,

      // Vibration
      hasVibration: 'vibrate' in navigator,

      // Speech
      hasSpeechSynthesis: 'speechSynthesis' in window,

      // Notifications
      hasNotifications: 'Notification' in window,

      // Storage
      hasLocalStorage: typeof(Storage) !== 'undefined',

      // Service Worker (for PWA)
      hasServiceWorker: 'serviceWorker' in navigator,

      // WebWorker
      hasWebWorker: typeof(Worker) !== 'undefined',

      // WebAssembly (for MediaPipe)
      hasWasm: typeof(WebAssembly) !== 'undefined'
    };
  }

  // Check if platform is compatible with mobile gaze tracking
  isCompatible() {
    const { platform, capabilities } = this;

    // Must have camera
    if (!capabilities.hasCamera) {
      return {
        compatible: false,
        reason: 'Camera not available'
      };
    }

    // Must have WASM (for MediaPipe)
    if (!capabilities.hasWasm) {
      return {
        compatible: false,
        reason: 'WebAssembly not supported'
      };
    }

    // Must be mobile Firefox or Kiwi (or allow desktop for testing)
    if (platform.isMobile && !platform.supportsExtensions) {
      return {
        compatible: false,
        reason: 'Browser does not support extensions. Please use Firefox Mobile or Kiwi Browser.'
      };
    }

    return {
      compatible: true,
      reason: 'All checks passed'
    };
  }

  // Get battery level (async)
  async getBatteryLevel() {
    if (!this.capabilities.hasBattery) {
      return null;
    }

    try {
      const battery = await navigator.getBattery();
      return {
        level: Math.round(battery.level * 100), // 0-100
        charging: battery.charging
      };
    } catch (error) {
      console.warn('[PLATFORM] Battery API failed:', error);
      return null;
    }
  }

  // Log platform info (for debugging)
  logInfo() {
    console.log('[PLATFORM] Detection Results:');
    console.log('  Device:', this.platform.isMobile ? 'Mobile' : this.platform.isTablet ? 'Tablet' : 'Desktop');
    console.log('  OS:', this.platform.isAndroid ? 'Android' : this.platform.isiOS ? 'iOS' : 'Other');
    console.log('  Browser:', this.getBrowserName());
    console.log('  Screen:', `${this.platform.screenWidth}x${this.platform.screenHeight}`);
    console.log('  Orientation:', this.platform.orientation);
    console.log('  Extension Support:', this.platform.supportsExtensions ? 'Yes' : 'No');
    console.log('  Capabilities:', this.capabilities);

    const compatibility = this.isCompatible();
    console.log('  Compatible:', compatibility.compatible ? 'Yes' : `No (${compatibility.reason})`);
  }

  getBrowserName() {
    const { platform } = this;
    if (platform.isFirefox) return 'Firefox';
    if (platform.isKiwi) return 'Kiwi';
    if (platform.isSamsungInternet) return 'Samsung Internet';
    if (platform.isSafari) return 'Safari';
    if (platform.isChrome) return 'Chrome';
    return 'Unknown';
  }

  // Listen for orientation changes
  onOrientationChange(callback) {
    window.addEventListener('orientationchange', () => {
      this.platform.orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      callback(this.platform.orientation);
    });
  }
}

// Export for use in other modules
window.PlatformDetector = PlatformDetector;
