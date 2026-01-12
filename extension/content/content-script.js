// ReaRead Content Script
console.log('ReaRead content script loaded');

const DEBUG_PARAGRAPH = false;
const DEBUG_DWELL = false;
const DEBUG_DIFFICULTY = true;

const READING_PARAGRAPH_SELECTOR = 'p';

// Gaze cursor element
let gazeCursor = null;
let isVisualizationEnabled = true;

// PX Assist is always active (no mode toggle)
let pxLineRects = [];
let scrollTimeout = null;

// LINE-LEVEL DETECTION (debug only, no UX changes)
let currentLineIndex = -1;
let currentParagraphLines = [];
let debugPanel = null;
const SHOW_DEBUG_PANEL = false; // Set to true for development debugging

// PX ASSIST: Stable IDs (NodeList indices change on scroll/DOM mutations)
const pxIdMap = new WeakMap();
function getPxIdForElement(el) {
  if (!pxIdMap.has(el)) {
    pxIdMap.set(el, crypto.randomUUID());
  }
  const id = pxIdMap.get(el);
  if (!el.hasAttribute('data-rearead-id')) {
    el.setAttribute('data-rearead-id', id);
  }
  return id;
}

// Paragraph tracking (Keys: "p:uuid" using stable IDs)
let currentParagraphKey = null;
let currentReadingKey = null; // UX stable key
let helpButtonShownFor = new Set(); // One-time help guard
let paragraphStartTime = null;
let paragraphDwellTimes = {};
let paragraphDifficultyLogged = {};

// ANALYTICS: Session tracking for dashboard
let analyticsSession = {
  sessionId: null,
  startTime: null,
  url: null,
  title: null,
  gazePoints: [], // { timestamp, x, y, isInBounds }
  paragraphMetrics: {}, // { [paragraphKey]: { dwellTime, difficultyRatio, revisits, llmUsed } }
  llmUsage: [], // { timestamp, mode, paragraphKey }
  focusEvents: [] // { timestamp, type, data }
};

// AUTO READ MODE: Göz takibiyle otomatik paragraf okuma
let autoReadMode = {
  enabled: false,
  language: 'auto',
  currentAudio: null,
  lastReadParagraph: null,
  readQueue: [],
  isReading: false,
  dwellThreshold: 2000, // 2 saniye paragrafa bakınca oku
  pendingReadTimeout: null, // Bekleyen okuma timeout'u
  nextParagraph: null // Sırada bekleyen paragraf { key, element }
};

// GESTURE CONTROL: Get Help butonu için çift kırpma tespiti (HANDS-FREE)
let gestureState = {
  lastDoubleBlink: 0,
  doubleBlinkCooldown: 600 // OPTIMIZED: 600ms for faster hands-free trigger (was 1000ms)
};

// LLM HELPER MENU STATE: Pause tracking when menu is open
let llmHelperOpen = false;

// Fast/slow loops
let lastViewportGaze = { x: 0, y: 0 };
let analysisIntervalId = null;
let cleanupIntervalId = null;
const ANALYSIS_INTERVAL_MS = 250;
let smoothedOpacity = 0.6;

// GAZE STALE GUARD: Track last valid gaze timestamp
let lastGazeTimestamp = 0;
const MAX_GAZE_AGE_MS = 400;

// REGION-BASED SOFT FALLBACK: Non-blocking confirmation signal
let regionHitCounts = {}; // { [key]: count }

// PROFILE-ADAPTIVE: Site-based behavior tuning
let adaptiveConfig = {
  regionPadY: 10, // Default padding for region-based fallback
  lineDetectionEnabled: true // Whether to extract line-level data
};

// FOCUS MODE: Distraction detection
let focusTracking = {
  outOfBoundsCount: 0,
  totalGazeCount: 0,
  sessionStartTime: Date.now(),
  lastFocusAlertTime: 0,
  isEnabled: true,
  // Akıllı kombinasyon için ek tracking
  gazeHistory: [], // { timestamp, isOutOfBounds }
  consecutiveOutOfBoundsMs: 0,
  lastGazeState: null, // 'in' veya 'out'
  consecutiveOutStartTime: null
};

const FOCUS_CONFIG = {
  // AKILLI KOMBİNASYON - Demo için optimize edildi
  // Kriter 1: Son 5 dakikada %60'tan fazla dışarıda (daha toleranslı)
  HISTORY_WINDOW_MS: 300000, // 5 dakika
  DISTRACTION_THRESHOLD_PERCENT: 60, // %60 (40'tan 60'a çıkarıldı - daha az false positive)

  // Kriter 2: Üst üste 45 saniye dışarıda (daha toleranslı)
  CONSECUTIVE_OUT_THRESHOLD_MS: 45000, // 45 saniye (30'dan 45'e çıkarıldı)

  ALERT_COOLDOWN_MS: 300000 // 5 dakika (300000ms)
};

function initializeGazeVisualization() {
  gazeCursor = document.createElement('div');
  gazeCursor.id = 'rearead-gaze-cursor';
  gazeCursor.style.cssText = `
    position: fixed; width: 20px; height: 20px; border-radius: 50%;
    background-color: rgba(255, 0, 0, 0.5); border: 2px solid rgba(255, 255, 255, 0.8);
    pointer-events: none; z-index: 999999; display: none; top: 0; left: 0;
    transform: translate3d(-10px, -10px, 0); will-change: transform;
  `;
  document.body.appendChild(gazeCursor);
  console.log('Gaze cursor initialized');
}

function initializeDebugPanel() {
  if (!SHOW_DEBUG_PANEL) return; // Skip if debug panel disabled

  debugPanel = document.createElement('div');
  debugPanel.id = 'rearead-debug-panel';
  debugPanel.style.cssText = `
    position: fixed; top: 10px; right: 10px; width: 320px; padding: 12px;
    background: rgba(0, 0, 0, 0.85); color: #fff; font-family: monospace;
    font-size: 12px; line-height: 1.5; border-radius: 6px; z-index: 999998;
    pointer-events: none; box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  `;
  debugPanel.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: #4CAF50;">ReaRead Debug</div>
    <div id="debug-paragraph">Paragraph: -</div>
    <div id="debug-line">Line: - / -</div>
    <div id="debug-text" style="color: #aaa; margin-top: 4px; word-wrap: break-word;">Text: -</div>
  `;
  document.body.appendChild(debugPanel);
  console.log('Debug panel initialized');
}

// CAMERA PREVIEW: Disabled on desktop (companion app uses camera)
// Only used on mobile. See mobile-content-script.js
let cameraPreview = null;
let cameraStream = null;

// CAMERA PREVIEW: Initialize camera preview for demo/presentation
async function initializeCameraPreview() {
  try {
    console.log('[CAMERA] ===== INITIALIZING CAMERA PREVIEW =====');
    console.log('[CAMERA] Current state:', {
      cameraPreview: !!cameraPreview,
      cameraStream: !!cameraStream,
      documentBody: !!document.body
    });

    // FIX: Don't try to access camera if Python companion is already using it
    // Just skip camera preview - gaze tracking works via WebSocket from Python
    console.log('[CAMERA] Skipping camera preview - Python companion handles camera');
    return;

    // Create video element for preview
    cameraPreview = document.createElement('video');
    cameraPreview.id = 'rearead-camera-preview';
    cameraPreview.autoplay = true;
    cameraPreview.playsInline = true;
    cameraPreview.muted = true;
    cameraPreview.srcObject = cameraStream;
    console.log('[CAMERA] Video element created');

    cameraPreview.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 240px;
      height: 180px;
      border-radius: 12px;
      border: 2px solid #4CAF50;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      z-index: 999997;
      object-fit: cover;
      transform: scaleX(-1);
    `;

    // Add label
    const label = document.createElement('div');
    label.style.cssText = `
      position: fixed;
      bottom: 210px;
      left: 20px;
      background: rgba(76, 175, 80, 0.9);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      font-weight: 600;
      z-index: 999997;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    label.textContent = '👁️ Eye Tracking Active';
    label.id = 'rearead-camera-label';

    console.log('[CAMERA] Appending video element to body...');
    document.body.appendChild(cameraPreview);
    document.body.appendChild(label);

    console.log('[CAMERA] ===== CAMERA PREVIEW INITIALIZED SUCCESSFULLY =====');
    console.log('[CAMERA] Video element in DOM:', document.body.contains(cameraPreview));
    console.log('[CAMERA] Video dimensions:', cameraPreview.videoWidth, 'x', cameraPreview.videoHeight);
  } catch (error) {
    console.error('[CAMERA] Failed to access camera:', error);
    // Show error notification
    showCameraError(error.message);
  }
}

function showCameraError(message) {
  const errorNotif = document.createElement('div');
  errorNotif.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(244, 67, 54, 0.95);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 999997;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    max-width: 300px;
  `;
  errorNotif.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">📷 Camera Access Required</div>
    <div style="font-size: 12px; opacity: 0.9;">${message}</div>
  `;

  document.body.appendChild(errorNotif);

  setTimeout(() => {
    errorNotif.style.transition = 'opacity 0.3s';
    errorNotif.style.opacity = '0';
    setTimeout(() => errorNotif.remove(), 300);
  }, 5000);
}

// Show camera info notification (camera in use by companion)
function showCameraInfo() {
  const infoNotif = document.createElement('div');
  infoNotif.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(33, 150, 243, 0.95);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 999997;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    max-width: 300px;
  `;
  infoNotif.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">📷 Camera Device</div>
    <div style="font-size: 12px; opacity: 0.9;">Camera in use by Python companion</div>
  `;

  document.body.appendChild(infoNotif);

  setTimeout(() => {
    infoNotif.style.transition = 'opacity 0.3s';
    infoNotif.style.opacity = '0';
    setTimeout(() => infoNotif.remove(), 300);
  }, 3000);
}

// Coordinate transformation: Screen → Viewport
class CoordinateMapper {
  screenToViewport(screenX, screenY) {
    const viewportX = screenX - window.screenX;
    const viewportY = screenY - window.screenY;
    const dpr = window.devicePixelRatio || 1;
    return { x: viewportX / dpr, y: viewportY / dpr };
  }
}

const coordinateMapper = new CoordinateMapper();

// FAST LOOP: Update cursor (60 FPS)
let debugCounter = 0;
function handleGazeData(gazeData) {
  // Debug panel initialization removed (disabled for demo)

  // Handle double blink gesture - trigger Get Help button (HANDS-FREE FEEDBACK)
  if (gazeData.gestures) {
    console.log('[GESTURE] Received gestures:', gazeData.gestures);

    if (gazeData.gestures.double_blink) {
      console.log('[GESTURE] Double blink detected!');
      const now = Date.now();
      if (now - gestureState.lastDoubleBlink > gestureState.doubleBlinkCooldown) {
        gestureState.lastDoubleBlink = now;
        console.log('[GESTURE] Triggering Get Help button...');
        // VISUAL FEEDBACK: Flash cursor green to confirm gesture
        showGestureFeedback('double_blink', '👁️👁️ Double Blink');
        handleDoubleBlink();
      } else {
        console.log('[GESTURE] Double blink cooldown active');
      }
    }

    // Show feedback for head gestures (if not in menu)
    if (!llmHelperOpen) {
      if (gazeData.gestures.head_left) {
        showGestureFeedback('head_left', '⬅️ Head Left');
      }
      if (gazeData.gestures.head_right) {
        showGestureFeedback('head_right', '➡️ Head Right');
      }
      if (gazeData.gestures.head_up) {
        showGestureFeedback('head_up', '⬆️ Head Up');
      }
      if (gazeData.gestures.head_down) {
        showGestureFeedback('head_down', '⬇️ Head Down');
      }
    }

    // Forward gestures to llm-helper for modal navigation (only if menu is open)
    // This reduces unnecessary message traffic
    if (llmHelperOpen) {
      console.log('[GESTURE] Forwarding gestures to llm-helper (menu is open)');
      window.postMessage({
        type: 'REAREAD_GESTURE',
        gesture: gazeData.gestures
      }, '*');
    }
  }

  if (!gazeCursor || !isVisualizationEnabled) return;
  try {
    const viewportCoords = coordinateMapper.screenToViewport(gazeData.x, gazeData.y);

    // Debug every 30 frames
    if (debugCounter++ % 30 === 0) {
      console.log(`[GAZE DEBUG] Screen: (${gazeData.x}, ${gazeData.y}) | Window: (${window.screenX}, ${window.screenY}) | Viewport: (${viewportCoords.x.toFixed(0)}, ${viewportCoords.y.toFixed(0)}) | Size: ${window.innerWidth}x${window.innerHeight} | DPR: ${window.devicePixelRatio}`);
    }

    // FOCUS MODE: Track in-bounds vs out-of-bounds gaze
    if (focusTracking.isEnabled) {
      const now = Date.now();
      const isInBounds = viewportCoords.x >= 0 && viewportCoords.x <= window.innerWidth &&
                         viewportCoords.y >= 0 && viewportCoords.y <= window.innerHeight;

      // ANALYTICS: Track gaze point (sample every 10 frames to reduce data)
      if (analyticsSession.sessionId && debugCounter % 10 === 0) {
        analyticsSession.gazePoints.push({
          timestamp: now,
          x: viewportCoords.x,
          y: viewportCoords.y,
          isInBounds: isInBounds
        });
      }

      // Gaze geçmişine ekle
      focusTracking.gazeHistory.push({
        timestamp: now,
        isOutOfBounds: !isInBounds
      });

      // Eski kayıtları temizle (5 dakikadan eski olanlar)
      focusTracking.gazeHistory = focusTracking.gazeHistory.filter(
        entry => now - entry.timestamp < FOCUS_CONFIG.HISTORY_WINDOW_MS
      );

      // Üst üste dışarıda kalma süresini takip et
      if (!isInBounds) {
        if (focusTracking.lastGazeState !== 'out') {
          // İlk defa dışarı çıktı
          focusTracking.consecutiveOutStartTime = now;
          focusTracking.lastGazeState = 'out';
        }
        // Consecutıve süreyi güncelle
        focusTracking.consecutiveOutOfBoundsMs = now - focusTracking.consecutiveOutStartTime;
      } else {
        if (focusTracking.lastGazeState !== 'in') {
          // İçeri girdi, consecutive süreyi sıfırla
          focusTracking.consecutiveOutOfBoundsMs = 0;
          focusTracking.consecutiveOutStartTime = null;
          focusTracking.lastGazeState = 'in';
        }
      }

      // Eski sistemi de koru (backward compatibility)
      focusTracking.totalGazeCount++;
      if (!isInBounds) {
        focusTracking.outOfBoundsCount++;
      }

      // Check if distraction threshold exceeded
      checkFocusLevel();
    }

    // Always show cursor for debugging
    gazeCursor.style.transform = `translate3d(${viewportCoords.x - 10}px, ${viewportCoords.y - 10}px, 0)`;
    gazeCursor.style.display = 'block';

    const targetOpacity = 0.3 + (gazeData.confidence * 0.5);
    smoothedOpacity = smoothedOpacity * 0.85 + targetOpacity * 0.15;
    gazeCursor.style.opacity = smoothedOpacity;

    // Cache viewport coordinates for paragraph analysis
    lastViewportGaze.x = viewportCoords.x;
    lastViewportGaze.y = viewportCoords.y;

    // GAZE STALE GUARD: Update timestamp
    lastGazeTimestamp = Date.now();
  } catch (error) {
    console.error('Error handling gaze data:', error);
  }
}

function calculateParagraphKey(viewportX, viewportY) {
  if (pxLineRects.length === 0) return null;

  const PAD_X = 20;
  const PAD_Y = 4;

  for (const rect of pxLineRects) {
    if (viewportX >= rect.left - PAD_X && viewportX <= rect.right + PAD_X &&
        viewportY >= rect.top - PAD_Y && viewportY < rect.bottom + PAD_Y) {
      return { key: rect.key, el: rect.el, readingKey: rect.readingKey, readingEl: rect.readingEl };
    }
  }
  return null;
}

// REGION-BASED SOFT FALLBACK: Generous box hit detection (confirmation signal only)
function getParagraphBoxHit(x, y) {
  if (pxLineRects.length === 0) return null;

  const PAD_X = 25; // More generous than point-based
  const PAD_Y = adaptiveConfig.regionPadY; // PROFILE-ADAPTIVE: Use dynamic padding

  for (const rect of pxLineRects) {
    if (x >= rect.left - PAD_X && x <= rect.right + PAD_X &&
        y >= rect.top - PAD_Y && y <= rect.bottom + PAD_Y) {
      return rect.readingKey;
    }
  }
  return null;
}

// LINE-LEVEL DETECTION: Extract visual lines with stable Y-bucketing
function extractLinesFromParagraph(paraElement) {
  const lines = [];
  const text = paraElement.textContent;
  if (!text || text.trim().length === 0) return lines;

  const range = document.createRange();
  range.selectNodeContents(paraElement);

  const rects = range.getClientRects();
  if (rects.length === 0) return lines;

  // Bucket rects by rounded Y position to avoid subpixel jitter
  const lineMap = new Map();

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const topKey = Math.round(rect.top);

    // Find existing line within +-1px tolerance
    let found = false;
    for (const [key, line] of lineMap) {
      if (Math.abs(key - topKey) <= 1) {
        line.rects.push(rect);
        line.top = Math.min(line.top, rect.top);
        line.bottom = Math.max(line.bottom, rect.bottom);
        found = true;
        break;
      }
    }

    if (!found) {
      lineMap.set(topKey, {
        top: rect.top,
        bottom: rect.bottom,
        rects: [rect]
      });
    }
  }

  // Convert map to sorted array of line objects
  const sortedLines = Array.from(lineMap.values()).sort((a, b) => a.top - b.top);

  for (const line of sortedLines) {
    lines.push({
      top: line.top,
      bottom: line.bottom,
      left: Math.min(...line.rects.map(r => r.left)),
      right: Math.max(...line.rects.map(r => r.right))
    });
  }

  return lines;
}

// Detect which line the gaze is on (Y-coordinate only, no X check)
function calculateLineIndex(lines, viewportY) {
  for (let i = 0; i < lines.length; i++) {
    if (viewportY >= lines[i].top && viewportY < lines[i].bottom) {
      return i;
    }
  }
  return -1;
}

// Extract text for a specific line using caret position API
function getLineText(paraElement, lineIndex, totalLines) {
  if (lineIndex < 0 || lineIndex >= totalLines || !currentParagraphLines[lineIndex]) return '';

  try {
    const line = currentParagraphLines[lineIndex];
    const midY = (line.top + line.bottom) / 2;
    const leftX = line.left + 5; // 5px from left edge

    // Use caret position API (browser-compatible)
    let range;
    if (document.caretRangeFromPoint) {
      // Chrome/Safari
      range = document.caretRangeFromPoint(leftX, midY);
    } else if (document.caretPositionFromPoint) {
      // Firefox
      const caretPos = document.caretPositionFromPoint(leftX, midY);
      if (caretPos) {
        range = document.createRange();
        range.setStart(caretPos.offsetNode, caretPos.offset);
      }
    }

    if (!range) return '';

    // Expand range to cover the whole line
    const startNode = range.startContainer;
    const startOffset = range.startOffset;

    // Find line start (move backward until Y changes significantly)
    range.setStart(startNode, 0);
    let lineStartOffset = 0;
    for (let i = 0; i <= startOffset; i++) {
      range.setStart(startNode, i);
      const rect = range.getBoundingClientRect();
      if (rect.top >= line.top - 2) {
        lineStartOffset = i;
        break;
      }
    }

    // Find line end (move forward until Y changes significantly)
    const textLength = startNode.textContent ? startNode.textContent.length : 0;
    let lineEndOffset = textLength;
    for (let i = startOffset; i < textLength; i++) {
      range.setEnd(startNode, i);
      const rect = range.getBoundingClientRect();
      if (rect.bottom > line.bottom + 2) {
        lineEndOffset = i - 1;
        break;
      }
    }

    // Extract text from the range
    range.setStart(startNode, lineStartOffset);
    range.setEnd(startNode, lineEndOffset);
    const lineText = range.toString().trim();

    return lineText.length > 80 ? lineText.substring(0, 77) + '...' : lineText;

  } catch (e) {
    // Fallback: return empty on error
    return '';
  }
}

// Update debug panel UI
function updateDebugPanel(paragraphKey, lineIndex, totalLines, lineText) {
  if (!debugPanel) return;

  const paraDiv = document.getElementById('debug-paragraph');
  const lineDiv = document.getElementById('debug-line');
  const textDiv = document.getElementById('debug-text');

  if (paraDiv) paraDiv.textContent = `Paragraph: ${paragraphKey || '-'}`;
  if (lineDiv) lineDiv.textContent = `Line: ${lineIndex >= 0 ? (lineIndex + 1) : '-'} / ${totalLines || '-'}`;
  if (textDiv) textDiv.textContent = `Text: "${lineText || '-'}"`;
}

// SLOW LOOP: Analyze reading (250ms)
function analyzeReadingBehavior() {
  // LLM HELPER MENU: Skip tracking when menu is open (user not reading)
  if (llmHelperOpen) {
    return;
  }

  // GAZE STALE GUARD: Skip analysis if gaze data is stale
  if (Date.now() - lastGazeTimestamp > MAX_GAZE_AGE_MS) {
    updateDebugPanel(null, -1, 0, '');
    return;
  }

  // PRIMARY DETECTION: Point-based paragraph detection (unchanged)
  const paraData = calculateParagraphKey(lastViewportGaze.x, lastViewportGaze.y);

  // REGION-BASED SOFT FALLBACK: Update hit counts (non-blocking)
  const regionKey = getParagraphBoxHit(lastViewportGaze.x, lastViewportGaze.y);
  if (regionKey) {
    regionHitCounts[regionKey] = (regionHitCounts[regionKey] || 0) + 1;
  }

  // FALLBACK LOGIC: Only use region if primary detection fails
  let finalParaData = paraData;
  if (!paraData || !paraData.key) {
    // Try region-based fallback if we have enough hits
    if (regionKey && regionHitCounts[regionKey] >= 2) {
      // Find the element for this key
      const id = regionKey.split(':')[1];
      const el = document.querySelector(`[data-rearead-id="${id}"]`);
      if (el) {
        // Construct fallback data - finding reading element dynamically here is fine for fallback
        const readingEl = el.closest(READING_PARAGRAPH_SELECTOR);
        let rKey = null;
        if (readingEl) {
             const rId = getPxIdForElement(readingEl);
             rKey = `p:${rId}`;
        }
        finalParaData = { key: regionKey, el: el, readingKey: rKey, readingEl: readingEl };
        if (DEBUG_PARAGRAPH) {
          console.log(`[REGION] Fallback paragraph hit: ${regionKey}`);
        }
      }
    }
  }

  if (!finalParaData || !finalParaData.key) {
    // No paragraph detected - reset debug panel
    updateDebugPanel(null, -1, 0, '');
    return;
  }

  const analyticsKey = finalParaData.key; // a:uuid for analytics
  const readingKey = finalParaData.readingKey; // p:uuid for UX
  const now = Date.now();

  // REGION-BASED SOFT FALLBACK: Decay counts on paragraph switch
  if (analyticsKey !== currentParagraphKey) {
    regionHitCounts = {}; // Reset on paragraph change
  }

  // Paragraph switching logic
  if (analyticsKey !== currentParagraphKey) {
    if (currentParagraphKey && paragraphStartTime) {
      const dwellTime = now - paragraphStartTime;
      paragraphDwellTimes[currentParagraphKey] =
        (paragraphDwellTimes[currentParagraphKey] || 0) + dwellTime;

      if (DEBUG_DWELL) {
        console.log(`[DWELL] ${currentParagraphKey}: ${paragraphDwellTimes[currentParagraphKey]}ms`);
      }

      // ANALYTICS: Update paragraph metrics (use analyticsKey for analytics)
      if (analyticsSession.sessionId) {
        if (!analyticsSession.paragraphMetrics[currentParagraphKey]) {
          analyticsSession.paragraphMetrics[currentParagraphKey] = {
            dwellTime: 0,
            difficultyRatio: 0,
            revisits: 0,
            llmUsed: false
          };
        }
        analyticsSession.paragraphMetrics[currentParagraphKey].dwellTime += dwellTime;
        analyticsSession.paragraphMetrics[currentParagraphKey].revisits++;
      }

      // Note: Highlight will be updated in the continuous update section below
    }

    // UX: Update currentReadingKey (Primary Reading Key)
    if (readingKey && readingKey !== currentReadingKey) {
        currentReadingKey = readingKey;
    } else if (!readingKey) {
        currentReadingKey = null;
    }

    // ANALYTICS: Keep currentParagraphKey for analytics tracking
    currentParagraphKey = analyticsKey;
    paragraphStartTime = now;

    // NEW: Extract lines when switching to new paragraph
    if (finalParaData.readingEl) {
      currentParagraphLines = extractLinesFromParagraph(finalParaData.readingEl);
    } else {
      currentParagraphLines = [];
    }
    currentLineIndex = -1;

    // AUTO READ: Check if we should auto-read this paragraph (use readingKey for UX)
    if (autoReadMode.enabled && readingKey && readingKey !== autoReadMode.lastReadParagraph) {
      checkAndReadParagraph(readingKey, finalParaData.readingEl || finalParaData.el);
    }

    if (DEBUG_PARAGRAPH) {
      console.log(`[READING] Switched to: ${readingKey || analyticsKey}, lines: ${currentParagraphLines.length}`);
    }
  }

  // CONTINUOUS UPDATE: Always update highlight based on current dwell time (not just on paragraph switch)
  // This ensures highlight and help button appear as user reads
  if (currentParagraphKey) {
    requestAnimationFrame(() => updateParagraphHighlight(currentParagraphKey));
  }

  // LINE DETECTION: Calculate current line index
  const lineIdx = calculateLineIndex(currentParagraphLines, lastViewportGaze.y);
  if (lineIdx !== currentLineIndex) {
    currentLineIndex = lineIdx;
  }

  // Update debug panel (use readingKey for display)
  const lineText = getLineText(finalParaData.readingEl || finalParaData.el, currentLineIndex, currentParagraphLines.length);
  updateDebugPanel(readingKey || analyticsKey, currentLineIndex, currentParagraphLines.length, lineText);
}

function updateParagraphHighlight(key) {
  if (!key) return;

  const id = key.split(':')[1];
  const para = document.querySelector(`[data-rearead-id="${id}"]`);

  if (!para) return;

  // UX STABILIZATION: Only act on Reading Paragraphs
  const readingElement = para.closest(READING_PARAGRAPH_SELECTOR);
  if (!readingElement) return;

  // ANALYTICS PRESERVATION: Calculate metrics on the specific element
  let expectedTimeSec = parseFloat(para.getAttribute('data-expected-time'));

  if (!expectedTimeSec || expectedTimeSec <= 0) {
    const text = readingElement.textContent.trim();
    if (text) {
      const wordCount = text.split(/\s+/).length;
      expectedTimeSec = wordCount / (200 / 60);
      para.setAttribute('data-expected-time', expectedTimeSec.toFixed(1));
    }
  }

  if (!expectedTimeSec || expectedTimeSec <= 0) return;

  const now = Date.now();
  const baseTime = paragraphDwellTimes[key] || 0;
  const currentSessionTime = (currentParagraphKey === key && paragraphStartTime) ? (now - paragraphStartTime) : 0;
  const totalDwell = baseTime + currentSessionTime;
  const actualTimeSec = totalDwell / 1000;
  const difficultyRatio = actualTimeSec / expectedTimeSec;

  let targetBg = '';
  let needsHelpButton = false;

  // ANALYTICS: Update difficulty ratio
  if (analyticsSession.sessionId && analyticsSession.paragraphMetrics[key]) {
    analyticsSession.paragraphMetrics[key].difficultyRatio = difficultyRatio;
  }

  if (difficultyRatio >= 1.6) {
    targetBg = 'rgba(255, 230, 150, 0.30)';
    
    // UX: Check if help already shown for this READING key (use p:uuid format)
    const readingKey = `p:${getPxIdForElement(readingElement)}`;
    if (!helpButtonShownFor.has(readingKey)) {
      needsHelpButton = true;
      helpButtonShownFor.add(readingKey);
    }

    if (DEBUG_DIFFICULTY && !paragraphDifficultyLogged[key]) {
      console.log(`[DIFFICULTY] ${key} ratio=${difficultyRatio.toFixed(2)}`);
      paragraphDifficultyLogged[key] = true;
    }
  } else if (difficultyRatio >= 1.3) {
    targetBg = 'rgba(255, 230, 150, 0.15)';
  }

  // UX: Apply highlight to READING element (Stable)
  if (readingElement.style.backgroundColor !== targetBg) {
    readingElement.style.backgroundColor = targetBg;
    readingElement.style.transition = 'background-color 0.5s ease';
  }

  // UX: Show help button on READING element
  if (needsHelpButton) {
    const readingKey = `p:${getPxIdForElement(readingElement)}`;
    addHelpButton(readingElement, readingKey);
  }
}

function addHelpButton(para, key) {
  // CLEANUP: Prevent flickering - check if button for this specific paragraph already exists (paragraph-aware singleton)
  const existingBtn = document.querySelector(`.rearead-help-btn[data-key="${key}"]`);
  if (existingBtn) return;

  const helpBtn = document.createElement('button');
  helpBtn.className = 'rearead-help-btn';
  helpBtn.setAttribute('data-key', key);
  helpBtn.innerHTML = '💡 Get Help';

  const paraRect = para.getBoundingClientRect();
  let leftPos = paraRect.right + 10;
  const maxLeft = window.innerWidth - 150;
  if (leftPos > maxLeft) {
    leftPos = paraRect.left - 150;
    if (leftPos < 0) leftPos = 10;
  }

  helpBtn.style.cssText = `
    position: fixed; left: ${leftPos}px; top: ${paraRect.top}px; padding: 8px 16px;
    background: #FF9B45; color: #0d0d0d; border: none; border-radius: 8px; cursor: pointer;
    font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(255, 155, 69, 0.25); z-index: 1000;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  `;

  helpBtn.onmouseover = () => {
    helpBtn.style.background = '#ffaa5e';
    helpBtn.style.transform = 'translateY(-2px)';
    helpBtn.style.boxShadow = '0 6px 20px rgba(255, 155, 69, 0.35)';
  };
  helpBtn.onmouseout = () => {
    helpBtn.style.background = '#FF9B45';
    helpBtn.style.transform = 'translateY(0)';
    helpBtn.style.boxShadow = '0 4px 12px rgba(255, 155, 69, 0.25)';
  };
  helpBtn.onclick = () => requestLLMHelp(key);
  document.body.appendChild(helpBtn);
}

function updateHelpButtonPositions() {
  const helpButtons = document.querySelectorAll('.rearead-help-btn');

  helpButtons.forEach(btn => {
    const key = btn.getAttribute('data-key');
    if (!key) return;

    const id = key.split(':')[1];
    const para = document.querySelector(`[data-rearead-id="${id}"]`);

    if (para) {
      const paraRect = para.getBoundingClientRect();
      let leftPos = paraRect.right + 10;
      const maxLeft = window.innerWidth - 150;
      if (leftPos > maxLeft) {
        leftPos = paraRect.left - 150;
        if (leftPos < 0) leftPos = 10;
      }
      btn.style.left = `${leftPos}px`;
      btn.style.top = `${paraRect.top}px`;
    }
  });
}

function requestLLMHelp(key) {
  console.log(`[LLM] Requesting help for ${key}`);

  // Extract ID from p:uuid format
  const id = key.split(':')[1];
  if (!id) {
    console.error('[LLM] Invalid key format:', key);
    return;
  }

  // Find element by data-rearead-id
  const el = document.querySelector(`[data-rearead-id="${id}"]`);
  if (!el) {
    console.error(`[LLM] Element not found for ID: ${id}`);
    return;
  }

  // Ensure we get the reading paragraph element (not a child span/li)
  const readingEl = el.closest(READING_PARAGRAPH_SELECTOR) || el;
  const text = readingEl.textContent.trim();

  if (!text || text.length < 10) {
    console.warn('[LLM] Text too short:', text);
    return;
  }

  // Import LLM helper module (use chrome.runtime.getURL for extension resources)
  const helperUrl = chrome.runtime.getURL('content/llm-helper.js');
  import(helperUrl)
    .then(module => module.requestHelp({ key, text }))
    .catch(error => {
      console.error('[LLM] Failed to load helper:', error);
    });
}


function cleanupHelpKeys() {
  // Check if elements tracked for help buttons still exist (keys are in p:uuid format)
  const newSet = new Set();
  helpButtonShownFor.forEach(key => {
    // Extract ID from p:uuid format
    const id = key.split(':')[1];
    const el = document.querySelector(`[data-rearead-id="${id}"]`);
    if (el && el.isConnected) {
      newSet.add(key);
    }
  });
  helpButtonShownFor = newSet;
}

function measurePxPositions() {
  pxLineRects = [];
  // Target semantic text blocks. Exclude 'span' or generic 'div' unless they look like paragraphs.
  // Using a more specific selector to avoid noise.
  const candidates = document.querySelectorAll('p, article, li, h1, h2, h3, h4, h5, h6, blockquote');

  candidates.forEach((el) => {
    // 1. Visible check
    if (el.offsetParent === null) return;

    // 2. Text Content check
    const text = el.textContent.trim();
    // Increase threshold: meaningful reading usually implies at least a sentence (~30-40 chars)
    if (!text || text.length < 30) return; 

    // 3. Geometry check
    const rect = el.getBoundingClientRect();
    // Must be substantial: at least 20px high and 100px wide
    if (rect.height < 20 || rect.width < 100) return;

    // 4. Density check (optional but good): Avoid huge layout divs that just contain other elements
    // For now, relying on tag names (p, article, etc.) is safer than generic divs.

    // SEPARATE KEYS: Analytics (fine-grain) vs UX (stable paragraph)
    const readingEl = el.closest(READING_PARAGRAPH_SELECTOR);
    if (!readingEl) return;

    const analyticsId = getPxIdForElement(el);
    const analyticsKey = `a:${analyticsId}`; // a = analytics

    const readingId = getPxIdForElement(readingEl);
    const readingKey = `p:${readingId}`;

    pxLineRects.push({
      key: analyticsKey,
      readingKey: readingKey,
      el: el,
      readingEl: readingEl,
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      height: rect.height
    });
  });

  if (DEBUG_PARAGRAPH) {
    console.log(`[PX] Measured ${pxLineRects.length} semantic reading blocks`);
  }
}

function startPxAssist() {
  measurePxPositions();
  window.addEventListener('scroll', handlePxModeScroll);
  // FIX: Update help button positions on scroll/resize and cleanup keys
  window.addEventListener('resize', updateHelpButtonPositions);
  window.addEventListener('scroll', cleanupHelpKeys, { passive: true });

  currentParagraphKey = null;
  paragraphStartTime = null;
  regionHitCounts = {}; // Reset region counts

  // Reset focus tracking
  focusTracking.outOfBoundsCount = 0;
  focusTracking.totalGazeCount = 0;
  focusTracking.sessionStartTime = Date.now();
  focusTracking.lastFocusAlertTime = 0;
  focusTracking.gazeHistory = [];
  focusTracking.consecutiveOutOfBoundsMs = 0;
  focusTracking.lastGazeState = null;
  focusTracking.consecutiveOutStartTime = null;

  if (analysisIntervalId) clearInterval(analysisIntervalId);
  analysisIntervalId = setInterval(analyzeReadingBehavior, ANALYSIS_INTERVAL_MS);
  
  if (cleanupIntervalId) clearInterval(cleanupIntervalId);
  cleanupIntervalId = setInterval(cleanupHelpKeys, 5000);

  console.log('[PX ASSIST] Started (with region-based soft fallback + focus mode)');
}

function stopPxAssist() {
  window.removeEventListener('scroll', handlePxModeScroll);
  window.removeEventListener('scroll', updateHelpButtonPositions);
  window.removeEventListener('resize', updateHelpButtonPositions);
  window.removeEventListener('scroll', cleanupHelpKeys);

  document.querySelectorAll('[data-rearead-id]').forEach(para => {
    para.style.backgroundColor = '';
  });

  document.querySelectorAll('.rearead-help-btn').forEach(btn => btn.remove());

  if (analysisIntervalId) {
    clearInterval(analysisIntervalId);
    analysisIntervalId = null;
  }
  
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }

  if (DEBUG_DWELL) {
    console.log('[PX] Dwell times:', paragraphDwellTimes);
  }

  console.log('[PX ASSIST] Stopped');
}

// Scroll tracking for optimization
let lastScrollY = 0;

function handlePxModeScroll() {
  updateHelpButtonPositions();

  if (scrollTimeout) clearTimeout(scrollTimeout);
  
  // OPTIMIZATION: Only re-measure if scroll delta is significant (> 80px)
  // This prevents resetting analytics/hits on micro-scrolls
  scrollTimeout = setTimeout(() => {
    const delta = Math.abs(window.scrollY - lastScrollY);
    
    // ⛔ micro-scroll → do nothing
    if (delta <= 80) return;

    measurePxPositions();
    lastScrollY = window.scrollY;

    // Refresh line positions for active paragraph after scroll
    if (currentParagraphKey) {
      const id = currentParagraphKey.split(':')[1];
      const para = document.querySelector(`[data-rearead-id="${id}"]`);
      if (para) {
        // FIX: ensure we target the paragraph, not a span (re-using safe extraction logic)
        const readingEl = para.closest(READING_PARAGRAPH_SELECTOR);
        if (readingEl) {
            currentParagraphLines = extractLinesFromParagraph(readingEl);
        }
      }
    }

    if (DEBUG_PARAGRAPH) {
      console.log('[PX SCROLL] Re-measured (threshold passed)');
    }
  }, 150);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GAZE_DATA':
      handleGazeData(message.data);

      // CAMERA PREVIEW: Don't open camera - Python companion is using it
      // Just show a message that camera is in use by companion app
      if (!cameraPreview) {
        console.log('[CAMERA] Camera device in use by Python companion app');
        showCameraInfo();
        cameraPreview = 'placeholder'; // Mark as initialized to prevent repeated calls
      }
      break;

    case 'TOGGLE_VISUALIZATION':
      isVisualizationEnabled = !isVisualizationEnabled;
      if (gazeCursor) {
        gazeCursor.style.display = isVisualizationEnabled ? 'block' : 'none';
      }
      sendResponse({ enabled: isVisualizationEnabled });
      break;

    case 'TOGGLE_PX_ASSIST_MODE':
      if (message.enabled) {
        startPxAssist();
      } else {
        stopPxAssist();
      }
      sendResponse({ success: true, enabled: message.enabled, mode: 'px_assist' });
      break;

    case 'GET_PAGE_INFO':
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

    case 'STOP_AUDIO':
      if (autoReadMode.isReading || window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        autoReadMode.isReading = false;
        autoReadMode.currentAudio = null;
        console.log('[AUDIO] Stopped by user request');
      }
      sendResponse({ success: true });
      break;
  }
  return true;
});

// ANALYTICS: Initialize session tracking
function initializeAnalyticsSession() {
  analyticsSession.sessionId = crypto.randomUUID();
  analyticsSession.startTime = Date.now();
  analyticsSession.url = window.location.href;
  analyticsSession.title = document.title;
  analyticsSession.gazePoints = [];
  analyticsSession.paragraphMetrics = {};
  analyticsSession.llmUsage = [];
  analyticsSession.focusEvents = [];

  console.log(`[ANALYTICS] Session started: ${analyticsSession.sessionId}`);
}

// ANALYTICS: Save session data to chrome.storage.local
async function saveAnalyticsSession() {
  if (!analyticsSession.sessionId) return;

  const endTime = Date.now();
  const duration = endTime - analyticsSession.startTime;
  const dateStr = new Date(analyticsSession.startTime).toISOString().split('T')[0]; // "2026-01-05"

  // Calculate session statistics
  const totalGazePoints = analyticsSession.gazePoints.length;
  const inBoundsPoints = analyticsSession.gazePoints.filter(p => p.isInBounds).length;
  const avgFocusScore = totalGazePoints > 0 ? (inBoundsPoints / totalGazePoints) * 100 : 0;

  const sessionData = {
    sessionId: analyticsSession.sessionId,
    date: dateStr,
    startTime: analyticsSession.startTime,
    endTime: endTime,
    duration: duration,
    url: analyticsSession.url,
    title: analyticsSession.title,
    avgFocusScore: avgFocusScore,
    totalGazePoints: totalGazePoints,
    inBoundsPoints: inBoundsPoints,
    outOfBoundsPoints: totalGazePoints - inBoundsPoints,
    paragraphMetrics: analyticsSession.paragraphMetrics,
    llmUsage: analyticsSession.llmUsage,
    focusEvents: analyticsSession.focusEvents,
    // Calculate additional metrics
    paragraphsRead: Object.keys(analyticsSession.paragraphMetrics).length,
    difficultParagraphs: Object.values(analyticsSession.paragraphMetrics).filter(p => p.difficultyRatio >= 1.6).length,
    llmAssistanceUsed: analyticsSession.llmUsage.length > 0
  };

  try {
    // Load existing analytics data
    const result = await chrome.storage.local.get(['analyticsData']);
    const analyticsData = result.analyticsData || {
      profile: { userId: 'default', createdAt: new Date().toISOString() },
      sessions: [],
      dailyStats: {},
      weeklyStats: {},
      gamification: {
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        level: 1,
        badges: [],
        goals: {
          daily: { target: 1800000, current: 0, achieved: false },
          weekly: { target: 10800000, current: 0, achieved: false }
        }
      },
      topics: {}
    };

    // Update or add session to sessions array
    const existingSessionIndex = analyticsData.sessions.findIndex(s => s.sessionId === sessionData.sessionId);
    if (existingSessionIndex >= 0) {
      // Update existing session
      const oldSession = analyticsData.sessions[existingSessionIndex];
      analyticsData.sessions[existingSessionIndex] = sessionData;

      // Adjust daily stats (remove old contributions, add new ones)
      const oldDateStr = new Date(oldSession.startTime).toISOString().split('T')[0];
      if (analyticsData.dailyStats[oldDateStr]) {
        const oldDayStats = analyticsData.dailyStats[oldDateStr];
        oldDayStats.totalDuration -= oldSession.duration;
        oldDayStats.sessions--;
        oldDayStats.paragraphsRead -= oldSession.paragraphsRead || 0;
        oldDayStats.difficultParagraphs -= oldSession.difficultParagraphs || 0;
        oldDayStats.llmUsageCount -= (oldSession.llmUsage || []).length;
        oldDayStats.distractionAlerts -= (oldSession.focusEvents || []).filter(e => e.type === 'distraction_alert').length;
      }
    } else {
      // Add new session
      analyticsData.sessions.push(sessionData);
    }

    // Update daily stats
    if (!analyticsData.dailyStats[dateStr]) {
      analyticsData.dailyStats[dateStr] = {
        date: dateStr,
        totalDuration: 0,
        sessions: 0,
        avgFocusScore: 0,
        paragraphsRead: 0,
        difficultParagraphs: 0,
        llmUsageCount: 0,
        distractionAlerts: 0
      };
    }

    const dayStats = analyticsData.dailyStats[dateStr];
    dayStats.totalDuration += duration;

    // Only increment session count if this is a new session
    if (existingSessionIndex < 0) {
      dayStats.sessions++;
    }

    dayStats.avgFocusScore = ((dayStats.avgFocusScore * (dayStats.sessions - 1)) + avgFocusScore) / dayStats.sessions;
    dayStats.paragraphsRead += sessionData.paragraphsRead;
    dayStats.difficultParagraphs += sessionData.difficultParagraphs;
    dayStats.llmUsageCount += analyticsSession.llmUsage.length;
    dayStats.distractionAlerts += analyticsSession.focusEvents.filter(e => e.type === 'distraction_alert').length;

    // Update gamification points
    const pointsEarned = Math.floor(duration / 60000); // 1 point per minute
    analyticsData.gamification.totalPoints += pointsEarned;
    analyticsData.gamification.goals.daily.current += duration;
    analyticsData.gamification.goals.weekly.current += duration;

    // Calculate level
    const levels = [
      { level: 1, minPoints: 0 },
      { level: 2, minPoints: 100 },
      { level: 3, minPoints: 300 },
      { level: 4, minPoints: 600 },
      { level: 5, minPoints: 1000 },
      { level: 6, minPoints: 1500 },
      { level: 7, minPoints: 2500 },
      { level: 8, minPoints: 4000 },
      { level: 9, minPoints: 6000 },
      { level: 10, minPoints: 10000 }
    ];
    const currentLevel = levels.filter(l => analyticsData.gamification.totalPoints >= l.minPoints).pop();
    analyticsData.gamification.level = currentLevel.level;

    // Save updated analytics data
    await chrome.storage.local.set({ analyticsData });

    console.log(`[ANALYTICS] Session saved: ${duration}ms, ${sessionData.paragraphsRead} paragraphs, ${avgFocusScore.toFixed(1)}% focus`);
  } catch (error) {
    console.error('[ANALYTICS] Failed to save session:', error);
  }
}

function initialize() {
  // PROFILE-ADAPTIVE: Detect site structure and configure behavior
  const siteProfile = detectSiteProfile();
  configureReadingProfile(siteProfile);

  initializeGazeVisualization();
  // Debug panel will be created when first gaze data arrives
  // Auto-start PX Assist (always-on reading assistance)
  startPxAssist();

  // ANALYTICS: Initialize session tracking
  initializeAnalyticsSession();

  // ANALYTICS: Save session data periodically (every 30 seconds)
  setInterval(() => {
    if (analyticsSession.sessionId) {
      saveAnalyticsSession();
      console.log('[ANALYTICS] Periodic save completed');
    }
  }, 30000); // 30 seconds
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

console.log('ReaRead content script initialized');

// CLEANUP: Remove all visual artifacts when extension is disabled/unloaded
window.addEventListener('beforeunload', () => {
  saveAnalyticsSession();
  cleanupAll();
});
window.addEventListener('pagehide', () => {
  saveAnalyticsSession();
  cleanupAll();
});

// Listen for extension being disabled/uninstalled
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'EXTENSION_DISABLED') {
    cleanupAll();
  }
});

// AUTO READ MODE: Check if paragraph should be read and trigger TTS
function checkAndReadParagraph(paragraphKey, paragraphElement) {
  // Cancel any pending read for previous paragraph
  if (autoReadMode.pendingReadTimeout) {
    clearTimeout(autoReadMode.pendingReadTimeout);
  }

  // Wait for dwell threshold before reading
  autoReadMode.pendingReadTimeout = setTimeout(() => {
    // Check if still on same paragraph after threshold (use currentReadingKey for UX)
    if (currentReadingKey === paragraphKey && autoReadMode.enabled) {
      // Only start reading if NOT already reading
      if (!autoReadMode.isReading) {
        // FIX: Ensure we use the reading paragraph element, not a span/li child
        const readingEl = paragraphElement.closest(READING_PARAGRAPH_SELECTOR);
        const text = (readingEl || paragraphElement).textContent.trim();
        if (text && text.length > 10) {
          readParagraphAloud(text, paragraphKey);
        }
      } else {
        // Already reading, queue this paragraph for after current one finishes
        autoReadMode.nextParagraph = { key: paragraphKey, element: paragraphElement };
        console.log('[AUTO READ] Queued next paragraph, will read after current finishes');
      }
    }
  }, autoReadMode.dwellThreshold);
}

// AUTO READ MODE: Read paragraph using Web Speech API or TTS
async function readParagraphAloud(text, paragraphKey) {
  // Skip if already reading
  if (autoReadMode.isReading) {
    console.log('[AUTO READ] Already reading, skipping...');
    return;
  }

  autoReadMode.isReading = true;
  autoReadMode.lastReadParagraph = paragraphKey;

  console.log(`[AUTO READ] Reading paragraph: ${paragraphKey.substring(0, 20)}...`);

  try {
    // Detect original language
    const originalLanguage = detectLanguageFromText(text);
    console.log(`[AUTO READ] Detected language: ${originalLanguage}`);
    console.log(`[AUTO READ] Selected language: ${autoReadMode.language}`);

    // Determine target language
    let targetLanguage = autoReadMode.language;
    if (targetLanguage === 'auto') {
      targetLanguage = originalLanguage;
    }

    console.log(`[AUTO READ] Target language: ${targetLanguage}`);

    // Translate if target language differs from original
    let textToSpeak = text;
    if (targetLanguage !== originalLanguage && autoReadMode.language !== 'auto') {
      console.log(`[AUTO READ] Translation needed: ${originalLanguage} → ${targetLanguage}`);
      console.log(`[AUTO READ] Text to translate: "${text.substring(0, 100)}..."`);

      textToSpeak = await translateText(text, originalLanguage, targetLanguage);

      if (!textToSpeak || textToSpeak.trim() === '') {
        console.error('[AUTO READ] Translation failed or empty, using original text');
        textToSpeak = text;
      } else {
        console.log(`[AUTO READ] Translation successful: "${textToSpeak.substring(0, 100)}..."`);
      }
    } else {
      console.log(`[AUTO READ] No translation needed (same language or auto mode)`);
    }

    // Use ElevenLabs TTS API for high-quality speech
    await speakWithElevenLabs(textToSpeak, targetLanguage);

  } catch (error) {
    console.error('[AUTO READ] Failed to read paragraph:', error);
    autoReadMode.isReading = false;
  }
}

// ElevenLabs TTS Integration
async function speakWithElevenLabs(text, language) {
  try {
    // Get API key from storage (user should configure it first)
    const apiKey = await getElevenLabsApiKey();

    if (!apiKey) {
      console.warn('[AUTO READ] ElevenLabs API key not found, falling back to browser TTS');
      await speakWithBrowserTTS(text, language);
      return;
    }

    // Language-specific voice IDs (ElevenLabs multilingual voices)
    const voiceIds = {
      'tr': '21m00Tcm4TlvDq8ikWAM', // Rachel (multilingual)
      'en': '21m00Tcm4TlvDq8ikWAM', // Rachel (English default)
      'de': '21m00Tcm4TlvDq8ikWAM', // Rachel (multilingual)
      'fr': '21m00Tcm4TlvDq8ikWAM', // Rachel (multilingual)
    };

    const voiceId = voiceIds[language] || voiceIds['en'];

    console.log(`[ELEVENLABS] Generating speech for ${text.length} characters in ${language}`);

    // Call ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    // Convert response to audio blob
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // Play audio
    const audio = new Audio(audioUrl);
    autoReadMode.currentAudio = audio;

    audio.onended = () => {
      autoReadMode.isReading = false;
      URL.revokeObjectURL(audioUrl);
      console.log('[ELEVENLABS] Finished playing');

      // Check if there's a queued next paragraph to read
      if (autoReadMode.nextParagraph && autoReadMode.enabled) {
        const { key, element } = autoReadMode.nextParagraph;
        autoReadMode.nextParagraph = null;
        console.log('[AUTO READ] Reading queued next paragraph');

        const readingEl = element.closest(READING_PARAGRAPH_SELECTOR);
        const text = (readingEl || element).textContent.trim();
        if (text && text.length > 10) {
          readParagraphAloud(text, key);
        }
      }
    };

    audio.onerror = (error) => {
      console.error('[ELEVENLABS] Audio playback error:', error);
      autoReadMode.isReading = false;
      URL.revokeObjectURL(audioUrl);
    };

    await audio.play();
    console.log('[ELEVENLABS] Playing audio');

  } catch (error) {
    console.error('[ELEVENLABS] Failed:', error);
    console.log('[AUTO READ] Falling back to browser TTS');
    await speakWithBrowserTTS(text, language);
  }
}

// Fallback browser TTS
async function speakWithBrowserTTS(text, language) {
  const utterance = new SpeechSynthesisUtterance(text);

  const languageCodes = {
    'tr': 'tr-TR',
    'en': 'en-US',
    'de': 'de-DE',
    'fr': 'fr-FR',
  };
  utterance.lang = languageCodes[language] || 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onend = () => {
    autoReadMode.isReading = false;
    console.log('[BROWSER TTS] Finished reading');

    // Check if there's a queued next paragraph to read
    if (autoReadMode.nextParagraph && autoReadMode.enabled) {
      const { key, element } = autoReadMode.nextParagraph;
      autoReadMode.nextParagraph = null;
      console.log('[AUTO READ] Reading queued next paragraph');

      const readingEl = element.closest(READING_PARAGRAPH_SELECTOR);
      const text = (readingEl || element).textContent.trim();
      if (text && text.length > 10) {
        readParagraphAloud(text, key);
      }
    }
  };

  utterance.onerror = (error) => {
    console.error('[BROWSER TTS] Speech error:', error);
    autoReadMode.isReading = false;
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  autoReadMode.currentAudio = utterance;
}

// Get ElevenLabs API key from storage
async function getElevenLabsApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['elevenlabsApiKey'], (result) => {
      resolve(result.elevenlabsApiKey || null);
    });
  });
}

// Detect language from text (simple heuristic)
function detectLanguageFromText(text) {
  // Character-based detection for specific scripts
  const turkishChars = /[ğüşıöçĞÜŞİÖÇ]/;
  const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/; // Hiragana, Katakana, Kanji
  const chineseChars = /[\u4E00-\u9FFF]/; // Chinese Hanzi

  // Word-based detection for Latin script languages
  const turkishWords = /\b(ve|bir|bu|için|olan|ile|daha|çok|var|gibi|her|veya|ama|ancak|şey)\b/i;
  const germanWords = /\b(der|die|das|und|ist|nicht|ein|eine|mit|den|zu|auf|für|von|dem|des)\b/i;
  const frenchWords = /\b(le|la|les|de|un|une|dans|pour|est|sont|avec|cette|qui|mais|ou)\b/i;
  const spanishWords = /\b(el|la|los|las|de|un|una|en|para|es|son|con|esta|que|pero|o)\b/i;
  const italianWords = /\b(il|la|le|di|un|una|nel|per|è|sono|con|questa|che|ma|o)\b/i;

  // Check for Asian languages first (most distinctive)
  if (japaneseChars.test(text)) {
    return 'ja';
  }

  if (chineseChars.test(text)) {
    return 'zh';
  }

  // Check for Turkish (has unique characters)
  if (turkishChars.test(text) || turkishWords.test(text)) {
    return 'tr';
  }

  // Check for other European languages
  if (frenchWords.test(text)) {
    return 'fr';
  }

  if (spanishWords.test(text)) {
    return 'es';
  }

  if (italianWords.test(text)) {
    return 'it';
  }

  if (germanWords.test(text)) {
    return 'de';
  }

  return 'en'; // Default to English
}

// AUTO READ MODE: Translate text using free translation APIs (CLIENT-SIDE for reliability)
async function translateText(text, fromLang, toLang) {
  console.log(`[TRANSLATION] Starting translation: ${fromLang} → ${toLang}`);
  console.log(`[TRANSLATION] Text length: ${text.length} chars`);

  const languageNames = {
    'tr': 'Turkish',
    'en': 'English',
    'de': 'German',
    'fr': 'French',
    'es': 'Spanish',
    'it': 'Italian',
    'ja': 'Japanese',
    'zh': 'Chinese'
  };

  const langCodes = {
    'tr': 'tr',
    'en': 'en',
    'de': 'de',
    'fr': 'fr',
    'es': 'es',
    'it': 'it',
    'ja': 'ja',
    'zh': 'zh'
  };

  const fromCode = langCodes[fromLang] || 'en';
  const toCode = langCodes[toLang] || 'en';

  // CLIENT-SIDE TRANSLATION: More reliable than background script
  // Try multiple free APIs in sequence
  const apis = [
    { name: 'MyMemory', func: translateWithMyMemory },
    { name: 'LibreTranslate', func: translateWithLibreTranslate }
  ];

  for (const api of apis) {
    try {
      console.log(`[TRANSLATION] Trying ${api.name}...`);
      const translation = await api.func(text, fromCode, toCode);

      if (translation && translation.trim() && translation !== text) {
        console.log(`[TRANSLATION] ✅ ${api.name} SUCCESS: "${translation.substring(0, 50)}..."`);
        return translation;
      }
    } catch (error) {
      console.warn(`[TRANSLATION] ❌ ${api.name} failed:`, error.message);
    }
  }

  console.error('[TRANSLATION] ❌ All translation APIs failed - using original text');
  return null;
}

// MyMemory Translation API (Free, 500 char limit)
async function translateWithMyMemory(text, fromCode, toCode) {
  // Split long text into chunks
  const maxChunkSize = 450;
  if (text.length > maxChunkSize) {
    console.log(`[MyMemory] Text too long (${text.length}), splitting...`);
    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      let chunkEnd = maxChunkSize;
      if (remaining.length > maxChunkSize) {
        // Try to break at sentence boundary
        const lastPeriod = remaining.substring(0, maxChunkSize).lastIndexOf('. ');
        if (lastPeriod > maxChunkSize * 0.6) {
          chunkEnd = lastPeriod + 2;
        }
      } else {
        chunkEnd = remaining.length;
      }

      chunks.push(remaining.substring(0, chunkEnd));
      remaining = remaining.substring(chunkEnd);
    }

    console.log(`[MyMemory] Split into ${chunks.length} chunks`);
    const translations = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const encodedText = encodeURIComponent(chunk);
      const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${fromCode}|${toCode}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        translations.push(data.responseData.translatedText);
      } else {
        throw new Error(`Chunk ${i+1} failed`);
      }

      // Rate limiting: wait 200ms between requests
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return translations.join(' ');
  }

  // Single request for short text
  const encodedText = encodeURIComponent(text);
  const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${fromCode}|${toCode}`;

  console.log(`[MyMemory] URL: ${url.substring(0, 100)}...`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log('[MyMemory] Response:', data);

  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText.trim();
  }

  throw new Error('Invalid response format');
}

// LibreTranslate API (Free, open-source)
async function translateWithLibreTranslate(text, fromCode, toCode) {
  const url = 'https://libretranslate.com/translate';

  console.log(`[LibreTranslate] Translating ${fromCode} → ${toCode}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: text,
      source: fromCode,
      target: toCode,
      format: 'text'
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log('[LibreTranslate] Response:', data);

  if (data.translatedText) {
    return data.translatedText.trim();
  }

  throw new Error('Invalid response format');
}

// HANDS-FREE VISUAL FEEDBACK: Show gesture confirmation
function showGestureFeedback(gestureType, message) {
  // Create feedback element
  const feedback = document.createElement('div');
  feedback.className = 'rearead-gesture-feedback';
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-20px);
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
    padding: 12px 24px;
    border-radius: 24px;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
    font-size: 16px;
    font-weight: 600;
    z-index: 999999;
    box-shadow: 0 4px 20px rgba(76, 175, 80, 0.5);
    opacity: 0;
    animation: gestureFeedbackSlideIn 0.3s ease-out forwards;
    pointer-events: none;
  `;
  feedback.textContent = message;

  // Add animation styles if not already present
  if (!document.getElementById('rearead-gesture-feedback-styles')) {
    const style = document.createElement('style');
    style.id = 'rearead-gesture-feedback-styles';
    style.textContent = `
      @keyframes gestureFeedbackSlideIn {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        100% { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes gestureFeedbackSlideOut {
        0% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(feedback);

  // Auto-remove after 1.5 seconds
  setTimeout(() => {
    feedback.style.animation = 'gestureFeedbackSlideOut 0.3s ease-out forwards';
    setTimeout(() => feedback.remove(), 300);
  }, 1500);

  console.log(`[GESTURE FEEDBACK] ${message}`);
}

// GESTURE: Handle double blink - click visible Get Help button
function handleDoubleBlink() {
  console.log('[GESTURE] Double blink detected - looking for Get Help button');

  // Priority 1: Button for current active reading paragraph
  if (currentReadingKey) {
    const helpBtn = document.querySelector(`.rearead-help-btn[data-key="${currentReadingKey}"]`);
    if (helpBtn) {
      console.log('[GESTURE] Clicking Get Help button for current reading paragraph');
      helpBtn.click();
      return;
    }
  }

  // Priority 2: ANY visible help button (since we enforce singleton now)
  const anyBtn = document.querySelector('.rearead-help-btn');
  if (anyBtn) {
     console.log('[GESTURE] Clicking global Get Help button');
     anyBtn.click();
  } else {
      console.log('[GESTURE] No Get Help button found to click');
  }
}

function cleanupAll() {
  console.log('[CLEANUP] Removing all ReaRead artifacts...');

  // Stop auto-read mode
  if (autoReadMode.enabled && autoReadMode.currentAudio) {
    window.speechSynthesis.cancel();
    autoReadMode.currentAudio = null;
    autoReadMode.isReading = false;
  }

  // Stop camera stream (only if it exists)
  if (cameraStream && typeof cameraStream === 'object') {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  // Remove camera preview (only if it's a DOM element, not placeholder string)
  if (cameraPreview && typeof cameraPreview === 'object' && cameraPreview.parentNode) {
    cameraPreview.parentNode.removeChild(cameraPreview);
    cameraPreview = null;
  }

  // Remove camera label
  const cameraLabel = document.getElementById('rearead-camera-label');
  if (cameraLabel && cameraLabel.parentNode) {
    cameraLabel.parentNode.removeChild(cameraLabel);
  }

  // Remove gaze cursor
  if (gazeCursor && gazeCursor.parentNode) {
    gazeCursor.parentNode.removeChild(gazeCursor);
  }

  // Remove debug panel
  if (debugPanel && debugPanel.parentNode) {
    debugPanel.parentNode.removeChild(debugPanel);
  }

  // Stop PX Assist
  stopPxAssist();

  // Remove all data attributes and highlights
  document.querySelectorAll('[data-rearead-id]').forEach(para => {
    para.removeAttribute('data-rearead-id');
    para.removeAttribute('data-expected-time');
    para.style.backgroundColor = '';
    para.style.transition = '';
  });

  // Remove all help buttons
  document.querySelectorAll('.rearead-help-btn').forEach(btn => btn.remove());

  // Remove focus mode alerts and overlays
  const focusAlert = document.getElementById('rearead-focus-alert');
  if (focusAlert) focusAlert.remove();

  const focusAnimations = document.getElementById('rearead-focus-animations');
  if (focusAnimations) focusAnimations.remove();

  console.log('[CLEANUP] Complete');
}

// PROFILE-ADAPTIVE: Detect site structure once on load
function detectSiteProfile() {
  const paragraphs = document.querySelectorAll('p');
  const articles = document.querySelectorAll('article');
  const spans = document.querySelectorAll('span');

  // Simple heuristic: article-heavy sites vs span-heavy sites
  const hasArticleStructure = articles.length > 0;
  const spanToParagraphRatio = paragraphs.length > 0 ? spans.length / paragraphs.length : 0;

  // Static article sites: Clean markup, few spans per paragraph
  if (hasArticleStructure && spanToParagraphRatio < 3) {
    return "STATIC_ARTICLE";
  }

  // Dynamic publisher sites: Heavy DOM, many nested spans
  return "DYNAMIC_PUBLISHER";
}

// PROFILE-ADAPTIVE: Configure behavior based on site profile
function configureReadingProfile(profile) {
  switch (profile) {
    case "STATIC_ARTICLE":
      // Tight padding for clean layouts (test pages, blogs)
      adaptiveConfig.regionPadY = 15;
      adaptiveConfig.lineDetectionEnabled = true;
      console.log('[PROFILE] Static article mode: tight padding (15px), line detection ON');
      break;

    case "DYNAMIC_PUBLISHER":
      // Generous padding for complex layouts (news sites, dynamic content)
      adaptiveConfig.regionPadY = 25;
      adaptiveConfig.lineDetectionEnabled = true;
      console.log('[PROFILE] Dynamic publisher mode: generous padding (25px), line detection ON');
      break;

    default:
      console.warn('[PROFILE] Unknown profile, using defaults');
  }
}

// FOCUS MODE: Check if user is distracted (AKILLI KOMBİNASYON)
function checkFocusLevel() {
  // Only check every 60 frames (~1 second)
  if (focusTracking.totalGazeCount % 60 !== 0) return;

  const now = Date.now();
  let shouldAlert = false;
  let alertReason = '';
  let distractionRatio = 0;

  // MİNİMUM VERİ GEREKSİNİMİ: En az 5 dakika veri olmalı (300 saniye * 4 gaze/saniye = ~1200 nokta)
  const MIN_DATA_POINTS = 1200;
  if (focusTracking.gazeHistory.length < MIN_DATA_POINTS) {
    // DEBUG: Her 10 saniyede bir log
    if (focusTracking.totalGazeCount % 600 === 0) {
      const secondsElapsed = (now - focusTracking.sessionStartTime) / 1000;
      console.log(`[FOCUS] Veri toplama: ${focusTracking.gazeHistory.length}/${MIN_DATA_POINTS} nokta (${secondsElapsed.toFixed(0)}s geçti, 300s gerekli)`);
    }
    return; // Henüz yeterli veri yok, alert gösterme
  }

  // KRITER 1: Son 5 dakikada %60'tan fazla dışarıda mı?
  const outOfBoundsCount = focusTracking.gazeHistory.filter(entry => entry.isOutOfBounds).length;
  const totalCount = focusTracking.gazeHistory.length;
  distractionRatio = outOfBoundsCount / totalCount;

  // DETAYLI LOG: Her kontrolde durumu göster
  const sessionDurationMin = (now - focusTracking.sessionStartTime) / 1000 / 60;
  console.log(`[FOCUS CHECK] ${sessionDurationMin.toFixed(1)}dk | Dışarıda: ${outOfBoundsCount}/${totalCount} (%${(distractionRatio * 100).toFixed(1)}) | Consecutive: ${(focusTracking.consecutiveOutOfBoundsMs / 1000).toFixed(0)}s`);

  if (distractionRatio >= FOCUS_CONFIG.DISTRACTION_THRESHOLD_PERCENT / 100) {
    shouldAlert = true;
    alertReason = `Son 5 dakikada %${(distractionRatio * 100).toFixed(0)} dışarıda`;
    console.log(`[FOCUS ALERT] Kriter 1 tetiklendi: ${alertReason}`);
  }

  // KRITER 2: Üst üste 45 saniye dışarıda mı?
  if (!shouldAlert && focusTracking.consecutiveOutOfBoundsMs >= FOCUS_CONFIG.CONSECUTIVE_OUT_THRESHOLD_MS) {
    shouldAlert = true;
    alertReason = `Üst üste ${(focusTracking.consecutiveOutOfBoundsMs / 1000).toFixed(0)} saniye dışarıda`;
    console.log(`[FOCUS ALERT] Kriter 2 tetiklendi: ${alertReason}`);
  }

  // Alert göster (cooldown kontrolü ile)
  if (shouldAlert) {
    if (now - focusTracking.lastFocusAlertTime >= FOCUS_CONFIG.ALERT_COOLDOWN_MS) {
      showFocusAlert(distractionRatio, alertReason);
      focusTracking.lastFocusAlertTime = now;

      // Reset counters after alert
      focusTracking.outOfBoundsCount = 0;
      focusTracking.totalGazeCount = 0;
      focusTracking.gazeHistory = [];
      focusTracking.consecutiveOutOfBoundsMs = 0;
      focusTracking.consecutiveOutStartTime = null;
      focusTracking.lastGazeState = null;
    }
  }

}

// FOCUS MODE: Show distraction alert
// ANALYTICS & AUTO READ: Listen for messages from llm-helper.js
window.addEventListener('message', (event) => {
  // Verify origin for security
  if (event.origin !== window.location.origin) return;

  if (event.data.type === 'REAREAD_LLM_USAGE') {
    const { mode, paragraphKey, timestamp } = event.data.data;

    // Track LLM usage
    if (analyticsSession.sessionId) {
      analyticsSession.llmUsage.push({ timestamp, mode, paragraphKey });

      // Mark paragraph as using LLM
      if (analyticsSession.paragraphMetrics[paragraphKey]) {
        analyticsSession.paragraphMetrics[paragraphKey].llmUsed = true;
      }
    }

    console.log(`[ANALYTICS] LLM used: ${mode} on ${paragraphKey}`);
  }

  if (event.data.type === 'REAREAD_AUTO_READ_MODE') {
    const { enabled, language } = event.data.data;
    autoReadMode.enabled = enabled;
    autoReadMode.language = language;

    console.log(`[AUTO READ] Mode ${enabled ? 'enabled' : 'disabled'}, language: ${language}`);

    // Stop current audio if disabling
    if (!enabled && autoReadMode.currentAudio) {
      if (autoReadMode.currentAudio instanceof Audio) {
        autoReadMode.currentAudio.pause();
      } else {
        window.speechSynthesis.cancel();
      }
      autoReadMode.currentAudio = null;
      autoReadMode.isReading = false;
    }
  }

  if (event.data.type === 'REAREAD_STOP_AUDIO') {
    // Stop any current audio playback
    if (autoReadMode.currentAudio) {
      if (autoReadMode.currentAudio instanceof Audio) {
        autoReadMode.currentAudio.pause();
      } else {
        window.speechSynthesis.cancel();
      }
      autoReadMode.currentAudio = null;
      autoReadMode.isReading = false;
      console.log('[AUTO READ] Audio stopped by user');
    }
  }

  if (event.data.type === 'REAREAD_MENU_STATE') {
    const { open } = event.data.data;
    llmHelperOpen = open;
    console.log(`[LLM HELPER] Menu ${open ? 'opened' : 'closed'} - tracking ${open ? 'paused' : 'resumed'}`);
  }
});

function showFocusAlert(distractionRatio, alertReason = '') {
  const percentage = (distractionRatio * 100).toFixed(0);

  // ANALYTICS: Track focus alert event
  if (analyticsSession.sessionId) {
    analyticsSession.focusEvents.push({
      timestamp: Date.now(),
      type: 'distraction_alert',
      data: { distractionRatio, alertReason }
    });
  }

  const alert = document.createElement('div');
  alert.id = 'rearead-focus-alert';
  alert.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #181818;
    border: 1px solid #2a2a2a;
    color: #ffffff;
    padding: 32px 48px;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
    text-align: center;
    animation: slideIn 0.3s ease-out;
  `;

  alert.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px; filter: drop-shadow(0 2px 8px rgba(255, 155, 69, 0.3));">🧠</div>
    <div style="
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff, #FF9B45);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    ">
      Dikkat Dağınıklığı Tespit Edildi
    </div>
    <div style="font-size: 16px; color: #e0e0e0; margin-bottom: 8px;">
      ${alertReason || `Dikkatinin %${percentage}'i sayfa dışındaydı`}
    </div>
    <div style="font-size: 13px; color: #888; margin-bottom: 24px;">
      (Toplam dikkat dışı oran: %${percentage})
    </div>
    <div style="font-size: 14px; color: #a0a0a0; margin-bottom: 24px;">
      💡 5 dakika mola vermek ister misin?
    </div>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="focus-alert-break" style="
        padding: 12px 24px;
        background: #FF9B45;
        color: #0d0d0d;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      ">5 Dakika Mola</button>
      <button id="focus-alert-continue" style="
        padding: 12px 24px;
        background: transparent;
        color: #ffffff;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      ">Devam Et</button>
    </div>
  `;

  // Add animation keyframes
  if (!document.getElementById('rearead-focus-animations')) {
    const style = document.createElement('style');
    style.id = 'rearead-focus-animations';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translate(-50%, -60%); opacity: 0; }
        to { transform: translate(-50%, -50%); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translate(-50%, -50%); opacity: 1; }
        to { transform: translate(-50%, -40%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(alert);

  // Button handlers with hover effects
  const breakBtn = document.getElementById('focus-alert-break');
  const continueBtn = document.getElementById('focus-alert-continue');

  breakBtn.onmouseover = () => {
    breakBtn.style.background = '#ffaa5e';
    breakBtn.style.transform = 'translateY(-2px)';
    breakBtn.style.boxShadow = '0 6px 20px rgba(255, 155, 69, 0.35)';
  };
  breakBtn.onmouseout = () => {
    breakBtn.style.background = '#FF9B45';
    breakBtn.style.transform = 'translateY(0)';
    breakBtn.style.boxShadow = 'none';
  };
  breakBtn.onclick = () => {
    startBreakTimer();
    removeFocusAlert(alert);
  };

  continueBtn.onmouseover = () => {
    continueBtn.style.borderColor = '#FF9B45';
    continueBtn.style.background = 'rgba(255, 155, 69, 0.08)';
  };
  continueBtn.onmouseout = () => {
    continueBtn.style.borderColor = '#2a2a2a';
    continueBtn.style.background = 'transparent';
  };
  continueBtn.onclick = () => {
    removeFocusAlert(alert);
  };

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (alert.parentNode) removeFocusAlert(alert);
  }, 10000);

  console.log(`[FOCUS] Distraction alert shown - ${percentage}% out of bounds`);
}


// FOCUS MODE: Remove alert with animation
function removeFocusAlert(alert) {
  alert.style.animation = 'slideOut 0.3s ease-out';
  setTimeout(() => {
    if (alert.parentNode) alert.remove();
  }, 300);
}
