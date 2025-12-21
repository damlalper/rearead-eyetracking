// ReaRead Content Script
// Handles gaze visualization and coordinate transformation

console.log('ReaRead content script loaded');

// Gaze cursor element
let gazeCursor = null;
let debugPanel = null;
let isVisualizationEnabled = true;
let isDebugPanelEnabled = true;

// Initialize gaze visualization
function initializeGazeVisualization() {
  // Create gaze cursor element
  gazeCursor = document.createElement('div');
  gazeCursor.id = 'rearead-gaze-cursor';
  gazeCursor.style.cssText = `
    position: fixed;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: rgba(255, 0, 0, 0.5);
    border: 2px solid rgba(255, 255, 255, 0.8);
    pointer-events: none;
    z-index: 999999;
    display: none;
    transform: translate(-50%, -50%);
    transition: all 0.1s ease-out;
  `;

  document.body.appendChild(gazeCursor);
  console.log('Gaze cursor initialized');

  // Create debug panel
  debugPanel = document.createElement('div');
  debugPanel.id = 'rearead-debug-panel';
  debugPanel.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.85);
    color: #00ff00;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    padding: 12px 15px;
    border-radius: 8px;
    border: 2px solid rgba(0, 255, 0, 0.3);
    z-index: 999998;
    min-width: 280px;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  `;
  debugPanel.innerHTML = `
    <div style="margin-bottom: 8px; font-weight: bold; color: #00ffff; border-bottom: 1px solid rgba(0, 255, 0, 0.3); padding-bottom: 5px;">
      ReaRead - Debug Info
    </div>
    <div id="rearead-debug-content">Waiting for data...</div>
  `;

  document.body.appendChild(debugPanel);

  // Hide debug panel initially - will be shown when connection is established
  debugPanel.style.display = 'none';

  console.log('Debug panel initialized');
}

// Coordinate transformation: Screen → Viewport → Page
class CoordinateMapper {
  constructor() {
    this.browserChromeHeight = window.outerHeight - window.innerHeight;
    this.browserChromeWidth = window.outerWidth - window.innerWidth;
  }

  screenToViewport(screenX, screenY) {
    // Convert screen coordinates to browser viewport
    // Account for window position
    const viewportX = screenX - window.screenX;
    const viewportY = screenY - window.screenY - this.browserChromeHeight;

    // Account for device pixel ratio (high-DPI displays)
    const dpr = window.devicePixelRatio || 1;

    return {
      x: viewportX / dpr,
      y: viewportY / dpr
    };
  }

  viewportToPage(viewportX, viewportY) {
    // Convert viewport coordinates to page coordinates (accounting for scroll)
    return {
      x: viewportX,
      y: viewportY
    };
  }

  screenToPage(screenX, screenY) {
    // Direct conversion from screen to page coordinates
    const viewport = this.screenToViewport(screenX, screenY);
    return this.viewportToPage(viewport.x, viewport.y);
  }

  getElementAtGaze(pageX, pageY) {
    // Get DOM element at gaze position
    return document.elementFromPoint(pageX, pageY);
  }
}

const coordinateMapper = new CoordinateMapper();

// Handle gaze data from background script
function handleGazeData(gazeData) {
  if (!gazeCursor) return;

  try {
    // Transform screen coordinates to page coordinates
    const pageCoords = coordinateMapper.screenToPage(gazeData.x, gazeData.y);

    // Update debug panel with current gaze data
    if (debugPanel && isDebugPanelEnabled) {
      // Show debug panel when data arrives
      debugPanel.style.display = 'block';

      const debugContent = document.getElementById('rearead-debug-content');
      if (debugContent) {
        const blinkStatus = gazeData.blink ? '<span style="color: #ff4444;">BLINK</span>' : '<span style="color: #44ff44;">Eyes Open</span>';
        debugContent.innerHTML = `
          <div style="line-height: 1.6;">
            <div><span style="color: #ffff00;">Screen:</span> ${gazeData.screen_width}x${gazeData.screen_height}</div>
            <div><span style="color: #ffff00;">Smoothed:</span> (${gazeData.x}, ${gazeData.y}) px</div>
            <div><span style="color: #ffff00;">Raw:</span> (${gazeData.raw_x}, ${gazeData.raw_y}) px</div>
            <div><span style="color: #ffff00;">FPS:</span> ${gazeData.fps || 0}</div>
            <div><span style="color: #ffff00;">Status:</span> ${blinkStatus}</div>
            <div><span style="color: #ffff00;">Smoothing:</span> ${(gazeData.smoothing * 100).toFixed(0)}%</div>
            <div><span style="color: #ffff00;">Confidence:</span> ${(gazeData.confidence * 100).toFixed(0)}%</div>
          </div>
        `;
      }
    }

    // Update gaze cursor
    if (isVisualizationEnabled) {
      // Check if coordinates are within viewport
      if (
        pageCoords.x >= 0 &&
        pageCoords.x <= window.innerWidth &&
        pageCoords.y >= 0 &&
        pageCoords.y <= window.innerHeight
      ) {
        // Update cursor position (fixed positioning already accounts for scroll)
        gazeCursor.style.left = `${pageCoords.x}px`;
        gazeCursor.style.top = `${pageCoords.y}px`;
        gazeCursor.style.display = 'block';

        // Adjust opacity based on confidence
        const opacity = 0.3 + (gazeData.confidence * 0.5);
        gazeCursor.style.opacity = opacity;

        // Get element under gaze (for future analysis)
        const elementAtGaze = coordinateMapper.getElementAtGaze(pageCoords.x, pageCoords.y);

        // Log for debugging (can be removed in production)
        if (elementAtGaze && elementAtGaze.tagName) {
          // console.log(`Gaze at: ${elementAtGaze.tagName}`, pageCoords);
        }
      } else {
        // Gaze is outside current window
        gazeCursor.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error handling gaze data:', error);
  }
}

// Cleanup function to remove all elements
function cleanup() {
  if (gazeCursor && gazeCursor.parentNode) {
    gazeCursor.parentNode.removeChild(gazeCursor);
    gazeCursor = null;
  }
  if (debugPanel && debugPanel.parentNode) {
    debugPanel.parentNode.removeChild(debugPanel);
    debugPanel = null;
  }
  console.log('ReaRead elements cleaned up');
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GAZE_DATA':
      handleGazeData(message.data);
      break;

    case 'TOGGLE_VISUALIZATION':
      isVisualizationEnabled = !isVisualizationEnabled;
      if (gazeCursor) {
        gazeCursor.style.display = isVisualizationEnabled ? 'block' : 'none';
      }
      sendResponse({ enabled: isVisualizationEnabled });
      break;

    case 'CLEANUP':
      cleanup();
      sendResponse({ success: true });
      break;

    case 'GET_PAGE_INFO':
      // Return current page information
      sendResponse({
        url: window.location.href,
        title: document.title,
        windowSize: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight
        },
        screenPosition: {
          screenX: window.screenX,
          screenY: window.screenY
        },
        scrollPosition: {
          scrollX: window.scrollX,
          scrollY: window.scrollY
        },
        devicePixelRatio: window.devicePixelRatio
      });
      break;
  }

  return true;
});

// Update browser chrome dimensions on window resize
window.addEventListener('resize', () => {
  coordinateMapper.browserChromeHeight = window.outerHeight - window.innerHeight;
  coordinateMapper.browserChromeWidth = window.outerWidth - window.innerWidth;
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGazeVisualization);
} else {
  initializeGazeVisualization();
}

console.log('ReaRead content script initialized');
