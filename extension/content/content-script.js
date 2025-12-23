// ReaRead Content Script
// Handles gaze visualization and coordinate transformation

console.log('ReaRead content script loaded');

// Gaze cursor element
let gazeCursor = null;
let isVisualizationEnabled = true;

// Reading Mode state
let readingModeActive = false;
let readingOverlay = null;
const FIXED_READING_WIDTH = 1280; // Fixed viewport width for stable gaze-text mapping

// DOM-based line mapping (measures actual line positions)
let lineRects = []; // Array of {index, top, bottom} for each line

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
  if (!gazeCursor || !isVisualizationEnabled) return;

  try {
    // Transform screen coordinates to page coordinates
    const pageCoords = coordinateMapper.screenToPage(gazeData.x, gazeData.y);

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

      // Calculate paragraph index if Reading Mode is active
      if (readingModeActive && readingOverlay) {
        const paraData = calculateLineIndex(pageCoords.x, pageCoords.y);
        if (paraData && paraData.lineIndex >= 0) {
          console.log(`[READING] Paragraph: ${paraData.lineIndex}`);
        }
      }

      // Get element under gaze (for future analysis)
      const elementAtGaze = coordinateMapper.getElementAtGaze(pageCoords.x, pageCoords.y);
    } else {
      // Gaze is outside current window
      gazeCursor.style.display = 'none';
    }
  } catch (error) {
    console.error('Error handling gaze data:', error);
  }
}

// Calculate line index from viewport coordinates (Reading Mode only)
// DOM-based approach: measures actual line positions instead of math
// ALL COORDINATES IN VIEWPORT SPACE (from getBoundingClientRect)
function calculateLineIndex(viewportX, viewportY) {
  if (!readingModeActive || !readingOverlay || lineRects.length === 0) {
    return null;
  }

  const contentContainer = readingOverlay.querySelector('#rearead-content-container');
  if (!contentContainer) {
    return null;
  }

  const containerRect = contentContainer.getBoundingClientRect();

  // Check if gaze is within content container (viewport space)
  if (viewportX < containerRect.left || viewportX > containerRect.right ||
      viewportY < containerRect.top || viewportY > containerRect.bottom) {
    return null;
  }

  // Find which paragraph the gaze falls into (VIEWPORT space comparison)
  for (const paraRect of lineRects) {
    if (viewportY >= paraRect.top && viewportY < paraRect.bottom) {
      return {
        overlayX: viewportX - containerRect.left,
        overlayY: viewportY - containerRect.top,
        lineIndex: paraRect.index
      };
    }
  }

  // Gaze is inside container but not on any paragraph (padding/margins)
  return {
    overlayX: viewportX - containerRect.left,
    overlayY: viewportY - containerRect.top,
    lineIndex: -1
  };
}

// Reading Mode functions
function createReadingOverlay() {
  // Create overlay container
  readingOverlay = document.createElement('div');
  readingOverlay.id = 'rearead-reading-overlay';
  readingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #f5f5f5;
    z-index: 999998;
    overflow-y: auto;
    display: none;
  `;

  // Create content container (fixed width)
  const contentContainer = document.createElement('div');
  contentContainer.id = 'rearead-content-container';
  contentContainer.style.cssText = `
    width: ${FIXED_READING_WIDTH}px;
    margin: 40px auto;
    padding: 60px 80px;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    font-family: Georgia, serif;
    font-size: 18px;
    line-height: 1.6;
    color: #333;
  `;

  // Extract main content
  const content = extractPageContent();
  contentContainer.innerHTML = content;

  // Wrap text nodes in line elements for DOM-based line tracking
  wrapTextIntoLines(contentContainer);

  // Measure actual line positions AFTER layout is calculated
  // Use requestAnimationFrame to ensure DOM is rendered
  requestAnimationFrame(() => {
    measureLinePositions(contentContainer);
  });

  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = '✕ Exit Reading Mode';
  closeButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px 20px;
    background: #333;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    z-index: 999999;
    font-size: 14px;
  `;
  closeButton.onclick = () => toggleReadingMode(false);

  readingOverlay.appendChild(contentContainer);
  readingOverlay.appendChild(closeButton);
  document.body.appendChild(readingOverlay);

  console.log('Reading overlay created');
}

function extractPageContent() {
  // Try to find main content using common selectors
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
    '.content'
  ];

  let contentElement = null;
  for (const selector of selectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) break;
  }

  // Fallback: use body
  if (!contentElement) {
    contentElement = document.body;
  }

  // Clone and clean content
  const clone = contentElement.cloneNode(true);

  // Remove scripts, styles, ads
  const unwanted = clone.querySelectorAll('script, style, iframe, .ad, .advertisement, nav, header, footer, aside');
  unwanted.forEach(el => el.remove());

  return clone.innerHTML;
}

// Simple paragraph detection - no wrapping needed
function wrapTextIntoLines(container) {
  // Just find paragraphs - don't modify DOM
  const paragraphs = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');

  console.log(`Found ${paragraphs.length} reading units (paragraphs/headings)`);

  // Add data attribute for tracking
  paragraphs.forEach((para, index) => {
    if (para.textContent.trim()) {
      para.setAttribute('data-paragraph-index', index);
    }
  });
}

// Measure paragraph positions directly
function measureLinePositions(container) {
  lineRects = [];

  const paragraphs = container.querySelectorAll('[data-paragraph-index]');

  paragraphs.forEach((para) => {
    const rect = para.getBoundingClientRect();
    const index = parseInt(para.getAttribute('data-paragraph-index'));

    // Skip very small elements (likely empty or formatting)
    if (rect.height < 10) {
      return;
    }

    lineRects.push({
      index: index,
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height
    });
  });

  console.log(`Measured ${lineRects.length} paragraphs for reading tracking`);

  // Debug: show first 3 paragraphs
  lineRects.slice(0, 3).forEach(para => {
    console.log(`Paragraph ${para.index}: top=${para.top.toFixed(1)}px, bottom=${para.bottom.toFixed(1)}px, height=${para.height.toFixed(1)}px`);
  });
}

function toggleReadingMode(enabled) {
  readingModeActive = enabled;

  if (enabled) {
    if (!readingOverlay) {
      createReadingOverlay();
    }
    readingOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scroll
    console.log('Reading Mode activated');
  } else {
    if (readingOverlay) {
      readingOverlay.style.display = 'none';
    }
    document.body.style.overflow = ''; // Restore scroll
    console.log('Reading Mode deactivated');
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

    case 'TOGGLE_READING_MODE':
      toggleReadingMode(message.enabled);
      sendResponse({ success: true, enabled: message.enabled });
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
