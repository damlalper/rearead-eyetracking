// ReaRead Content Script
console.log('ReaRead content script loaded');

const DEBUG_PARAGRAPH = false;
const DEBUG_DWELL = false;
const DEBUG_DIFFICULTY = true;

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
const SHOW_DEBUG_PANEL = true; // Set to true for development debugging

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
  dwellThreshold: 2000 // 2 saniye paragrafa bakınca oku
};

// GESTURE CONTROL: Get Help butonu için çift kırpma tespiti
let gestureState = {
  lastDoubleBlink: 0,
  doubleBlinkCooldown: 1000 // 1 saniye cooldown
};

// LLM HELPER MENU STATE: Pause tracking when menu is open
let llmHelperOpen = false;

// Fast/slow loops
let lastViewportGaze = { x: 0, y: 0 };
let analysisIntervalId = null;
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
  // AKILLI KOMBİNASYON (Seçenek 3 - En İyi)
  // Kriter 1: Son 5 dakikada %40'tan fazla dışarıda
  HISTORY_WINDOW_MS: 300000, // 5 dakika
  DISTRACTION_THRESHOLD_PERCENT: 40, // %40

  // Kriter 2: Üst üste 30 saniye dışarıda
  CONSECUTIVE_OUT_THRESHOLD_MS: 30000, // 30 saniye

  ALERT_COOLDOWN_MS: 300000, // 5 dakika (300000ms)
  POMODORO_WORK_MS: 1500000, // 25 dakika
  POMODORO_BREAK_MS: 300000 // 5 dakika
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

// CAMERA PREVIEW: Initialize camera preview for demo/presentation
let cameraPreview = null;
let cameraStream = null;

async function initializeCameraPreview() {
  try {
    // Request camera permission
    console.log('[CAMERA] Requesting camera access...');
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      }
    });

    // Create video element for preview
    cameraPreview = document.createElement('video');
    cameraPreview.id = 'rearead-camera-preview';
    cameraPreview.autoplay = true;
    cameraPreview.playsInline = true;
    cameraPreview.muted = true;
    cameraPreview.srcObject = cameraStream;

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

    document.body.appendChild(cameraPreview);
    document.body.appendChild(label);

    console.log('[CAMERA] Camera preview initialized');
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
  // Lazy-init debug panel when first gaze data arrives
  if (!debugPanel) {
    initializeDebugPanel();
  }

  // Handle double blink gesture - trigger Get Help button
  if (gazeData.gestures && gazeData.gestures.double_blink) {
    const now = Date.now();
    if (now - gestureState.lastDoubleBlink > gestureState.doubleBlinkCooldown) {
      gestureState.lastDoubleBlink = now;
      handleDoubleBlink();
    }
  }

  // Forward gestures to llm-helper for modal navigation
  if (gazeData.gestures) {
    window.postMessage({
      type: 'REAREAD_GESTURE',
      gesture: gazeData.gestures
    }, '*');
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
      return { key: rect.key, el: rect.el };
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
      return rect.key;
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
        finalParaData = { key: regionKey, el: el };
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

  const key = finalParaData.key;
  const now = Date.now();

  // REGION-BASED SOFT FALLBACK: Decay counts on paragraph switch
  if (key !== currentParagraphKey) {
    regionHitCounts = {}; // Reset on paragraph change
  }

  // Paragraph switching logic (unchanged)
  if (key !== currentParagraphKey) {
    if (currentParagraphKey && paragraphStartTime) {
      const dwellTime = now - paragraphStartTime;
      paragraphDwellTimes[currentParagraphKey] =
        (paragraphDwellTimes[currentParagraphKey] || 0) + dwellTime;

      if (DEBUG_DWELL) {
        console.log(`[DWELL] ${currentParagraphKey}: ${paragraphDwellTimes[currentParagraphKey]}ms`);
      }

      // ANALYTICS: Update paragraph metrics
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

      const prevKey = currentParagraphKey;
      requestAnimationFrame(() => updateParagraphHighlight(prevKey));
    }

    currentParagraphKey = key;
    paragraphStartTime = now;

    // NEW: Extract lines when switching to new paragraph
    currentParagraphLines = extractLinesFromParagraph(finalParaData.el);
    currentLineIndex = -1;

    // AUTO READ: Check if we should auto-read this paragraph
    if (autoReadMode.enabled && key !== autoReadMode.lastReadParagraph) {
      checkAndReadParagraph(key, finalParaData.el);
    }

    if (DEBUG_PARAGRAPH) {
      console.log(`[READING] Switched to: ${key}, lines: ${currentParagraphLines.length}`);
    }
  } else {
    requestAnimationFrame(() => updateParagraphHighlight(currentParagraphKey));
  }

  // LINE DETECTION: Calculate current line index
  const lineIdx = calculateLineIndex(currentParagraphLines, lastViewportGaze.y);
  if (lineIdx !== currentLineIndex) {
    currentLineIndex = lineIdx;
  }

  // Update debug panel
  const lineText = getLineText(finalParaData.el, currentLineIndex, currentParagraphLines.length);
  updateDebugPanel(key, currentLineIndex, currentParagraphLines.length, lineText);
}

function updateParagraphHighlight(key) {
  if (!key) return;

  const id = key.split(':')[1];
  const para = document.querySelector(`[data-rearead-id="${id}"]`);

  if (!para) return;

  let expectedTimeSec = parseFloat(para.getAttribute('data-expected-time'));

  if (!expectedTimeSec || expectedTimeSec <= 0) {
    const text = para.textContent.trim();
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
    needsHelpButton = true;
    if (DEBUG_DIFFICULTY && !paragraphDifficultyLogged[key]) {
      console.log(`[DIFFICULTY] ${key} ratio=${difficultyRatio.toFixed(2)}`);
      paragraphDifficultyLogged[key] = true;
    }
  } else if (difficultyRatio >= 1.3) {
    targetBg = 'rgba(255, 230, 150, 0.15)';
  }

  if (para.style.backgroundColor !== targetBg) {
    para.style.backgroundColor = targetBg;
    para.style.transition = 'background-color 0.5s ease';
  }

  const existingBtn = document.querySelector(`.rearead-help-btn[data-key="${key}"]`);

  if (needsHelpButton && !existingBtn) {
    addHelpButton(para, key);
  }
}

function addHelpButton(para, key) {
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

  const id = key.split(':')[1];
  const para = document.querySelector(`[data-rearead-id="${id}"]`);

  if (!para) return;

  const text = para.textContent.trim();

  // Import LLM helper module (use chrome.runtime.getURL for extension resources)
  const helperUrl = chrome.runtime.getURL('content/llm-helper.js');
  import(helperUrl)
    .then(module => module.requestHelp({ key, text }))
    .catch(error => {
      console.error('[LLM] Failed to load helper:', error);
    });
}


function measurePxPositions() {
  pxLineRects = [];
  const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');

  paragraphs.forEach((para) => {
    const text = para.textContent.trim();
    if (!text || text.length < 3) return;

    const id = getPxIdForElement(para);
    const key = `p:${id}`;
    const rect = para.getBoundingClientRect();

    if (rect.height < 10) return;

    pxLineRects.push({
      key: key,
      el: para,
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      height: rect.height
    });
  });

  if (DEBUG_PARAGRAPH) {
    console.log(`[PX] Measured ${pxLineRects.length} paragraphs`);
  }
}

function startPxAssist() {
  measurePxPositions();
  window.addEventListener('scroll', handlePxModeScroll);

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

  console.log('[PX ASSIST] Started (with region-based soft fallback + focus mode)');
}

function stopPxAssist() {
  window.removeEventListener('scroll', handlePxModeScroll);

  document.querySelectorAll('[data-rearead-id]').forEach(para => {
    para.style.backgroundColor = '';
  });

  document.querySelectorAll('.rearead-help-btn').forEach(btn => btn.remove());

  if (analysisIntervalId) {
    clearInterval(analysisIntervalId);
    analysisIntervalId = null;
  }

  if (DEBUG_DWELL) {
    console.log('[PX] Dwell times:', paragraphDwellTimes);
  }

  console.log('[PX ASSIST] Stopped');
}

function handlePxModeScroll() {
  updateHelpButtonPositions();

  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    measurePxPositions();

    // Refresh line positions for active paragraph after scroll
    if (currentParagraphKey) {
      const id = currentParagraphKey.split(':')[1];
      const para = document.querySelector(`[data-rearead-id="${id}"]`);
      if (para) {
        currentParagraphLines = extractLinesFromParagraph(para);
      }
    }

    if (DEBUG_PARAGRAPH) {
      console.log('[PX SCROLL] Re-measured (IDs stable, lines refreshed)');
    }
  }, 150);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GAZE_DATA':
      handleGazeData(message.data);

      // CAMERA PREVIEW: Initialize camera preview after first gaze data (calibration must be done to get gaze data)
      if (!cameraPreview) {
        console.log('[CAMERA] First gaze data received, initializing camera preview...');
        initializeCameraPreview().catch(err => {
          console.error('[CAMERA] Failed to initialize preview:', err);
        });
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

    // Add session to sessions array
    analyticsData.sessions.push(sessionData);

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
    dayStats.sessions++;
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
  // Wait for dwell threshold before reading
  setTimeout(() => {
    // Check if still on same paragraph after threshold
    if (currentParagraphKey === paragraphKey && autoReadMode.enabled) {
      const text = paragraphElement.textContent.trim();
      if (text && text.length > 10) {
        readParagraphAloud(text, paragraphKey);
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

    // Determine target language
    let targetLanguage = autoReadMode.language;
    if (targetLanguage === 'auto') {
      targetLanguage = originalLanguage;
    }

    // Translate if target language differs from original
    let textToSpeak = text;
    if (targetLanguage !== originalLanguage && autoReadMode.language !== 'auto') {
      console.log(`[AUTO READ] Translating from ${originalLanguage} to ${targetLanguage}...`);
      textToSpeak = await translateText(text, originalLanguage, targetLanguage);
      if (!textToSpeak) {
        console.error('[AUTO READ] Translation failed, using original text');
        textToSpeak = text;
      }
    }

    // Use Web Speech API (works with Bluetooth automatically)
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Set language based on selection
    const languageCodes = {
      'tr': 'tr-TR',
      'en': 'en-US',
      'de': 'de-DE',
      'fr': 'fr-FR',
      'es': 'es-ES',
      'it': 'it-IT',
      'ja': 'ja-JP',
      'zh': 'zh-CN'
    };
    utterance.lang = languageCodes[targetLanguage] || 'en-US';

    // Set voice parameters
    utterance.rate = 1.0; // Normal speed
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Event handlers
    utterance.onend = () => {
      autoReadMode.isReading = false;
      console.log('[AUTO READ] Finished reading');
    };

    utterance.onerror = (error) => {
      console.error('[AUTO READ] Speech error:', error);
      autoReadMode.isReading = false;
    };

    // Cancel any ongoing speech and start new
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    // Store current utterance for potential cancellation
    autoReadMode.currentAudio = utterance;

  } catch (error) {
    console.error('[AUTO READ] Failed to read paragraph:', error);
    autoReadMode.isReading = false;
  }
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

// AUTO READ MODE: Translate text using Gemini API
async function translateText(text, fromLang, toLang) {
  try {
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

    const fromLanguage = languageNames[fromLang] || fromLang;
    const toLanguage = languageNames[toLang] || toLang;

    // Send message to background script to translate
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_TEXT',
      data: {
        text: text,
        fromLanguage: fromLanguage,
        toLanguage: toLanguage
      }
    });

    if (response && response.success && response.translation) {
      console.log(`[AUTO READ] Translation successful: ${response.translation.substring(0, 50)}...`);
      return response.translation;
    } else {
      console.error('[AUTO READ] Translation failed:', response?.error);
      return null;
    }
  } catch (error) {
    console.error('[AUTO READ] Translation error:', error);
    return null;
  }
}

// GESTURE: Handle double blink - click visible Get Help button
function handleDoubleBlink() {
  console.log('[GESTURE] Double blink detected - looking for Get Help button');

  // Find visible Get Help button for current paragraph
  if (currentParagraphKey) {
    const helpBtn = document.querySelector(`.rearead-help-btn[data-key="${currentParagraphKey}"]`);

    if (helpBtn) {
      console.log('[GESTURE] Clicking Get Help button');
      helpBtn.click();
    } else {
      console.log('[GESTURE] No Get Help button found for current paragraph');
    }
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

  // Stop camera stream
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  // Remove camera preview
  if (cameraPreview && cameraPreview.parentNode) {
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

  const pomodoroAlert = document.getElementById('rearead-pomodoro-alert');
  if (pomodoroAlert) pomodoroAlert.remove();

  const breakOverlay = document.getElementById('rearead-break-overlay');
  if (breakOverlay) breakOverlay.remove();

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

  // KRITER 1: Son 5 dakikada %40'tan fazla dışarıda mı?
  if (focusTracking.gazeHistory.length > 0) {
    const outOfBoundsCount = focusTracking.gazeHistory.filter(entry => entry.isOutOfBounds).length;
    const totalCount = focusTracking.gazeHistory.length;
    distractionRatio = outOfBoundsCount / totalCount;

    if (distractionRatio >= FOCUS_CONFIG.DISTRACTION_THRESHOLD_PERCENT / 100) {
      shouldAlert = true;
      alertReason = `Son 5 dakikada %${(distractionRatio * 100).toFixed(0)} dışarıda`;
      console.log(`[FOCUS] Kriter 1 tetiklendi: ${alertReason}`);
    }
  }

  // KRITER 2: Üst üste 30 saniye dışarıda mı?
  if (!shouldAlert && focusTracking.consecutiveOutOfBoundsMs >= FOCUS_CONFIG.CONSECUTIVE_OUT_THRESHOLD_MS) {
    shouldAlert = true;
    alertReason = `Üst üste ${(focusTracking.consecutiveOutOfBoundsMs / 1000).toFixed(0)} saniye dışarıda`;
    console.log(`[FOCUS] Kriter 2 tetiklendi: ${alertReason}`);

    // Geçmişe bakarak oran hesapla (alert için)
    if (focusTracking.gazeHistory.length > 0) {
      const outOfBoundsCount = focusTracking.gazeHistory.filter(entry => entry.isOutOfBounds).length;
      const totalCount = focusTracking.gazeHistory.length;
      distractionRatio = outOfBoundsCount / totalCount;
    }
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

  // Pomodoro kontrolü (değişmedi)
  const sessionDuration = now - focusTracking.sessionStartTime;
  if (sessionDuration >= FOCUS_CONFIG.POMODORO_WORK_MS) {
    showPomodoroBreakAlert();
    // Reset session
    focusTracking.sessionStartTime = now;
    focusTracking.outOfBoundsCount = 0;
    focusTracking.totalGazeCount = 0;
    focusTracking.gazeHistory = [];
    focusTracking.consecutiveOutOfBoundsMs = 0;
    focusTracking.consecutiveOutStartTime = null;
    focusTracking.lastGazeState = null;
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
      autoReadMode.currentAudio.pause();
      autoReadMode.currentAudio = null;
      autoReadMode.isReading = false;
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

// FOCUS MODE: Show Pomodoro break alert
function showPomodoroBreakAlert() {
  const alert = document.createElement('div');
  alert.id = 'rearead-pomodoro-alert';
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
    <div style="font-size: 48px; margin-bottom: 16px; filter: drop-shadow(0 2px 8px rgba(255, 155, 69, 0.3));">⏰</div>
    <div style="
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff, #FF9B45);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    ">
      Pomodoro Tamamlandı!
    </div>
    <div style="font-size: 16px; color: #e0e0e0; margin-bottom: 24px;">
      25 dakika verimli okuma yaptın 🎉
    </div>
    <div style="font-size: 14px; color: #a0a0a0; margin-bottom: 24px;">
      💡 5 dakika mola zamanı!
    </div>
    <button id="pomodoro-alert-ok" style="
      padding: 12px 32px;
      background: #FF9B45;
      color: #0d0d0d;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    ">Mola Ver</button>
  `;

  document.body.appendChild(alert);

  const okBtn = document.getElementById('pomodoro-alert-ok');
  okBtn.onmouseover = () => {
    okBtn.style.background = '#ffaa5e';
    okBtn.style.transform = 'translateY(-2px)';
    okBtn.style.boxShadow = '0 6px 20px rgba(255, 155, 69, 0.35)';
  };
  okBtn.onmouseout = () => {
    okBtn.style.background = '#FF9B45';
    okBtn.style.transform = 'translateY(0)';
    okBtn.style.boxShadow = 'none';
  };
  okBtn.onclick = () => {
    startBreakTimer();
    removeFocusAlert(alert);
  };

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (alert.parentNode) removeFocusAlert(alert);
  }, 10000);

  console.log('[FOCUS] Pomodoro session completed - 25 minutes');
}

// FOCUS MODE: Start break timer
function startBreakTimer() {
  const breakOverlay = document.createElement('div');
  breakOverlay.id = 'rearead-break-overlay';
  breakOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    z-index: 999998;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  const breakTimer = document.createElement('div');
  breakTimer.style.cssText = `
    text-align: center;
    color: #ffffff;
  `;

  breakTimer.innerHTML = `
    <div style="font-size: 64px; margin-bottom: 24px; filter: drop-shadow(0 2px 8px rgba(255, 155, 69, 0.3));">☕</div>
    <div style="
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #ffffff, #FF9B45);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    ">
      Mola Zamanı
    </div>
    <div id="break-countdown" style="
      font-size: 72px;
      font-weight: 700;
      font-family: 'SF Mono', 'Courier New', monospace;
      margin-bottom: 24px;
      color: #FF9B45;
    ">
      5:00
    </div>
    <div style="font-size: 18px; color: #a0a0a0; margin-bottom: 32px;">
      Gözlerini dinlendir, su iç, biraz yürü 🚶
    </div>
    <button id="break-skip" style="
      padding: 12px 32px;
      background: transparent;
      color: #ffffff;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    ">Molayı Bitir</button>
  `;

  breakOverlay.appendChild(breakTimer);
  document.body.appendChild(breakOverlay);

  // Countdown timer
  let timeLeft = FOCUS_CONFIG.POMODORO_BREAK_MS / 1000; // seconds
  const countdownEl = document.getElementById('break-countdown');

  const interval = setInterval(() => {
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(interval);
      endBreakTimer(breakOverlay);
    }
  }, 1000);

  // Skip button with hover effects
  const skipBtn = document.getElementById('break-skip');
  skipBtn.onmouseover = () => {
    skipBtn.style.borderColor = '#FF9B45';
    skipBtn.style.background = 'rgba(255, 155, 69, 0.08)';
  };
  skipBtn.onmouseout = () => {
    skipBtn.style.borderColor = '#2a2a2a';
    skipBtn.style.background = 'transparent';
  };
  skipBtn.onclick = () => {
    clearInterval(interval);
    endBreakTimer(breakOverlay);
  };

  console.log('[FOCUS] Break timer started - 5 minutes');
}

// FOCUS MODE: End break timer
function endBreakTimer(overlay) {
  overlay.style.animation = 'slideOut 0.3s ease-out';
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
  }, 300);

  // Reset focus tracking
  focusTracking.sessionStartTime = Date.now();
  focusTracking.outOfBoundsCount = 0;
  focusTracking.totalGazeCount = 0;

  console.log('[FOCUS] Break ended - new session started');
}

// FOCUS MODE: Remove alert with animation
function removeFocusAlert(alert) {
  alert.style.animation = 'slideOut 0.3s ease-out';
  setTimeout(() => {
    if (alert.parentNode) alert.remove();
  }, 300);
}
