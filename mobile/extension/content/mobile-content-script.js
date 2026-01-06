// ReaRead Mobile - Content Script
// Entry point for Firefox Mobile extension

console.log('[REAREAD MOBILE] Content script loaded');

// Import platform detector
// (In manifest.json, include platform-detector.js before this file)

// Global state
let platformDetector = null;
let gazeTracker = null;
let behaviorTracker = null;
let isFocusModeActive = false;
let focusPromptDismissed = false;

// Initialize on page load
async function initialize() {
  console.log('[REAREAD MOBILE] Initializing...');

  // 1. Detect platform
  platformDetector = new PlatformDetector();
  platformDetector.logInfo();

  // 2. Check compatibility
  const compatibility = platformDetector.isCompatible();

  if (!compatibility.compatible) {
    console.error('[REAREAD MOBILE] Platform not compatible:', compatibility.reason);
    showCompatibilityError(compatibility.reason);
    return;
  }

  // 3. Check if user previously dismissed prompt today
  const dismissed = await checkPromptDismissed();

  if (dismissed) {
    console.log('[REAREAD MOBILE] Focus prompt already dismissed today');
    return;
  }

  // 4. Show Focus Mode prompt
  showFocusModePrompt();

  console.log('[REAREAD MOBILE] Initialization complete');
}

// Check if user dismissed prompt today
async function checkPromptDismissed() {
  try {
    const result = await chrome.storage.local.get(['focusPromptDismissedDate']);
    const dismissedDate = result.focusPromptDismissedDate;
    const today = new Date().toDateString();

    return dismissedDate === today;
  } catch (error) {
    console.error('[REAREAD MOBILE] Failed to check prompt dismissed:', error);
    return false;
  }
}

// Mark prompt as dismissed for today
async function markPromptDismissed() {
  try {
    const today = new Date().toDateString();
    await chrome.storage.local.set({ focusPromptDismissedDate: today });
    console.log('[REAREAD MOBILE] Prompt dismissed for today');
  } catch (error) {
    console.error('[REAREAD MOBILE] Failed to mark prompt dismissed:', error);
  }
}

// Show Focus Mode entry prompt
function showFocusModePrompt() {
  const prompt = document.createElement('div');
  prompt.id = 'rearead-focus-prompt';
  prompt.innerHTML = `
    <div class="icon">📖</div>
    <div class="text">
      <strong>ReaRead Focus Mode</strong>
      <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
        Tap to start eye tracking
      </div>
    </div>
    <div class="dismiss">×</div>
  `;

  document.body.appendChild(prompt);

  // Handle start
  prompt.addEventListener('click', async (e) => {
    if (e.target.classList.contains('dismiss')) {
      // Dismiss button clicked
      await markPromptDismissed();
      prompt.remove();
      focusPromptDismissed = true;
    } else {
      // Start Focus Mode
      prompt.remove();
      await startFocusMode();
    }
  });

  console.log('[REAREAD MOBILE] Focus prompt shown');
}

// Start Focus Mode
async function startFocusMode() {
  if (isFocusModeActive) {
    console.warn('[REAREAD MOBILE] Focus mode already active');
    return;
  }

  console.log('[REAREAD MOBILE] Starting Focus Mode...');

  // Show loading indicator
  showLoadingIndicator('Initializing eye tracking...');

  try {
    // 1. Initialize gaze tracker
    gazeTracker = new MobileGazeTracker();
    const initSuccess = await gazeTracker.init();

    if (!initSuccess) {
      throw new Error('Failed to initialize gaze tracker');
    }

    // 2. Request camera permission and start
    const startSuccess = await gazeTracker.start();

    if (!startSuccess) {
      throw new Error('Failed to start camera');
    }

    // 3. Set up gaze data callback
    gazeTracker.onGazeData = handleGazeData;

    // 4. Show camera preview (for demo/presentation)
    showCameraPreview(gazeTracker.getVideoElement());

    // 5. Import and start existing desktop features
    // (Copy from desktop content-script.js: gaze cursor, paragraph tracking, etc.)
    await initializeDesktopFeatures();

    isFocusModeActive = true;

    hideLoadingIndicator();
    showSuccessNotification('Eye tracking started! 👁️');

    console.log('[REAREAD MOBILE] Focus Mode started successfully');

  } catch (error) {
    console.error('[REAREAD MOBILE] Failed to start Focus Mode:', error);

    hideLoadingIndicator();

    // Check if user denied camera permission
    if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
      showCameraPermissionDenied();
    } else {
      showError('Failed to start eye tracking: ' + error.message);
    }
  }
}

// Camera permission denied - offer fallback
function showCameraPermissionDenied() {
  const modal = createModal({
    title: '📷 Camera Permission Required',
    message: 'ReaRead needs camera access for eye tracking.',
    buttons: [
      {
        text: 'Use Scroll Tracking Instead',
        primary: true,
        onClick: () => {
          modal.remove();
          startFallbackMode();
        }
      },
      {
        text: 'Try Again',
        onClick: () => {
          modal.remove();
          startFocusMode();
        }
      }
    ]
  });

  document.body.appendChild(modal);
}

// Start fallback mode (scroll/touch tracking)
async function startFallbackMode() {
  console.log('[REAREAD MOBILE] Starting fallback mode (behavior tracking)...');

  showLoadingIndicator('Initializing scroll tracking...');

  try {
    // 1. Initialize behavior tracker
    behaviorTracker = new BehaviorTracker();
    behaviorTracker.onGazeData = handleGazeData;
    behaviorTracker.start();

    // 2. Initialize desktop features (without camera)
    await initializeDesktopFeatures();

    isFocusModeActive = true;

    hideLoadingIndicator();
    showSuccessNotification('Scroll tracking started! 📜');

    console.log('[REAREAD MOBILE] Fallback mode started');

  } catch (error) {
    console.error('[REAREAD MOBILE] Fallback mode failed:', error);
    hideLoadingIndicator();
    showError('Failed to start tracking: ' + error.message);
  }
}

// Handle gaze data (from either tracker)
function handleGazeData(gazeData) {
  // Forward to desktop content script logic
  // This will handle:
  // - Gaze cursor rendering
  // - Paragraph tracking
  // - Get Help button
  // - Focus mode alerts
  // - Analytics

  // Send to background script (if needed)
  chrome.runtime.sendMessage({
    type: 'MOBILE_GAZE_DATA',
    data: gazeData
  });

  // Handle locally (call desktop handleGazeData if available)
  if (typeof window.desktopHandleGazeData === 'function') {
    window.desktopHandleGazeData(gazeData);
  }
}

// Initialize desktop features (paragraph tracking, Get Help, etc.)
async function initializeDesktopFeatures() {
  // Import desktop content-script.js functions
  // This script should be included in manifest.json before mobile-content-script.js

  console.log('[REAREAD MOBILE] Initializing desktop features...');

  // Desktop features are already initialized by content-script.js
  // We just need to connect gaze data flow

  // Create mobile-specific UI elements
  createMobileGazeCursor();
  createMobileHelpButton();

  console.log('[REAREAD MOBILE] Desktop features initialized');
}

// Create mobile-optimized gaze cursor
function createMobileGazeCursor() {
  let cursor = document.getElementById('rearead-gaze-cursor');

  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'rearead-gaze-cursor-mobile';
    document.body.appendChild(cursor);
  }

  // Override desktop cursor with mobile version
  cursor.id = 'rearead-gaze-cursor-mobile';
}

// Create mobile-optimized Get Help button
function createMobileHelpButton() {
  // Mobile Get Help button will be positioned at bottom-right
  // (Handled by mobile-styles.css)
}

// Show camera preview
function showCameraPreview(videoElement) {
  if (!videoElement) return;

  // Clone video element for preview
  const preview = document.createElement('video');
  preview.id = 'rearead-camera-preview-mobile';
  preview.srcObject = videoElement.srcObject;
  preview.autoplay = true;
  preview.playsInline = true;
  preview.muted = true;

  document.body.appendChild(preview);

  console.log('[REAREAD MOBILE] Camera preview shown');
}

// Show compatibility error
function showCompatibilityError(reason) {
  const modal = createModal({
    title: '⚠️ Not Compatible',
    message: reason,
    buttons: [
      {
        text: 'OK',
        primary: true,
        onClick: (modal) => modal.remove()
      }
    ]
  });

  document.body.appendChild(modal);
}

// Show loading indicator
function showLoadingIndicator(message) {
  const loading = document.createElement('div');
  loading.id = 'rearead-loading';
  loading.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 24px 32px;
    border-radius: 16px;
    z-index: 9999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-align: center;
  `;

  loading.innerHTML = `
    <div style="font-size: 32px; margin-bottom: 12px;">⏳</div>
    <div style="font-size: 14px;">${message}</div>
  `;

  document.body.appendChild(loading);
}

function hideLoadingIndicator() {
  const loading = document.getElementById('rearead-loading');
  if (loading) loading.remove();
}

// Show success notification
function showSuccessNotification(message) {
  const notif = document.createElement('div');
  notif.className = 'rearead-focus-alert-mobile';
  notif.style.background = '#4CAF50';
  notif.innerHTML = `
    <div style="font-size: 18px; font-weight: 600;">${message}</div>
  `;

  document.body.appendChild(notif);

  // Vibrate if available
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }

  setTimeout(() => {
    notif.style.transition = 'opacity 0.3s';
    notif.style.opacity = '0';
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// Show error notification
function showError(message) {
  const notif = document.createElement('div');
  notif.className = 'rearead-focus-alert-mobile';
  notif.style.background = '#f44336';
  notif.innerHTML = `
    <div style="font-size: 14px; font-weight: 600;">⚠️ Error</div>
    <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">${message}</div>
  `;

  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.transition = 'opacity 0.3s';
    notif.style.opacity = '0';
    setTimeout(() => notif.remove(), 300);
  }, 5000);
}

// Create modal utility
function createModal({ title, message, buttons }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    z-index: 9999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #1e1e1e;
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    width: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  modal.innerHTML = `
    <div style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: white;">
      ${title}
    </div>
    <div style="font-size: 14px; color: #ddd; margin-bottom: 24px; line-height: 1.6;">
      ${message}
    </div>
    <div id="modal-buttons" style="display: flex; gap: 12px; flex-direction: column;">
    </div>
  `;

  const buttonsContainer = modal.querySelector('#modal-buttons');

  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.textContent = btn.text;
    button.style.cssText = `
      padding: 14px 20px;
      background: ${btn.primary ? '#FF9B45' : 'transparent'};
      color: ${btn.primary ? '#0d0d0d' : 'white'};
      border: ${btn.primary ? 'none' : '1px solid #2a2a2a'};
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      min-height: 48px;
    `;

    button.onclick = () => btn.onClick(overlay);

    buttonsContainer.appendChild(button);
  });

  overlay.appendChild(modal);

  return overlay;
}

// Stop Focus Mode
function stopFocusMode() {
  if (!isFocusModeActive) return;

  console.log('[REAREAD MOBILE] Stopping Focus Mode...');

  if (gazeTracker) {
    gazeTracker.stop();
    gazeTracker = null;
  }

  if (behaviorTracker) {
    behaviorTracker.stop();
    behaviorTracker = null;
  }

  // Remove camera preview
  const preview = document.getElementById('rearead-camera-preview-mobile');
  if (preview) preview.remove();

  // Remove mobile cursor
  const cursor = document.getElementById('rearead-gaze-cursor-mobile');
  if (cursor) cursor.remove();

  isFocusModeActive = false;

  console.log('[REAREAD MOBILE] Focus Mode stopped');
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'STOP_FOCUS_MODE':
      stopFocusMode();
      sendResponse({ success: true });
      break;

    case 'GET_FOCUS_STATUS':
      sendResponse({
        active: isFocusModeActive,
        usingCamera: gazeTracker !== null,
        usingFallback: behaviorTracker !== null
      });
      break;
  }

  return true;
});

// Handle page visibility (stop tracking when page hidden)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isFocusModeActive) {
    console.log('[REAREAD MOBILE] Page hidden, pausing tracking...');

    if (gazeTracker) {
      gazeTracker.stop();
    }
  } else if (!document.hidden && isFocusModeActive && gazeTracker) {
    console.log('[REAREAD MOBILE] Page visible, resuming tracking...');
    gazeTracker.start();
  }
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  stopFocusMode();
});

// Initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

console.log('[REAREAD MOBILE] Mobile content script initialized');
