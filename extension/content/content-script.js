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
  isEnabled: true
};

const FOCUS_CONFIG = {
  OUT_OF_BOUNDS_THRESHOLD: 120, // 120 frames (~2 dakika @ 60fps)
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

  if (!gazeCursor || !isVisualizationEnabled) return;
  try {
    const viewportCoords = coordinateMapper.screenToViewport(gazeData.x, gazeData.y);

    // Debug every 30 frames
    if (debugCounter++ % 30 === 0) {
      console.log(`[GAZE DEBUG] Screen: (${gazeData.x}, ${gazeData.y}) | Window: (${window.screenX}, ${window.screenY}) | Viewport: (${viewportCoords.x.toFixed(0)}, ${viewportCoords.y.toFixed(0)}) | Size: ${window.innerWidth}x${window.innerHeight} | DPR: ${window.devicePixelRatio}`);
    }

    // FOCUS MODE: Track in-bounds vs out-of-bounds gaze
    if (focusTracking.isEnabled) {
      focusTracking.totalGazeCount++;

      const isInBounds = viewportCoords.x >= 0 && viewportCoords.x <= window.innerWidth &&
                         viewportCoords.y >= 0 && viewportCoords.y <= window.innerHeight;

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

      const prevKey = currentParagraphKey;
      requestAnimationFrame(() => updateParagraphHighlight(prevKey));
    }

    currentParagraphKey = key;
    paragraphStartTime = now;

    // NEW: Extract lines when switching to new paragraph
    currentParagraphLines = extractLinesFromParagraph(finalParaData.el);
    currentLineIndex = -1;

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

function initialize() {
  // PROFILE-ADAPTIVE: Detect site structure and configure behavior
  const siteProfile = detectSiteProfile();
  configureReadingProfile(siteProfile);

  initializeGazeVisualization();
  // Debug panel will be created when first gaze data arrives
  // Auto-start PX Assist (always-on reading assistance)
  startPxAssist();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

console.log('ReaRead content script initialized');

// CLEANUP: Remove all visual artifacts when extension is disabled/unloaded
window.addEventListener('beforeunload', cleanupAll);
window.addEventListener('pagehide', cleanupAll);

// Listen for extension being disabled/uninstalled
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'EXTENSION_DISABLED') {
    cleanupAll();
  }
});

function cleanupAll() {
  console.log('[CLEANUP] Removing all ReaRead artifacts...');

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

// FOCUS MODE: Check if user is distracted
function checkFocusLevel() {
  // Only check every 60 frames (~1 second)
  if (focusTracking.totalGazeCount % 60 !== 0) return;

  const now = Date.now();
  const distractionRatio = focusTracking.outOfBoundsCount / focusTracking.totalGazeCount;

  // If out-of-bounds count exceeds threshold
  if (focusTracking.outOfBoundsCount >= FOCUS_CONFIG.OUT_OF_BOUNDS_THRESHOLD) {
    // Check cooldown - don't spam alerts
    if (now - focusTracking.lastFocusAlertTime >= FOCUS_CONFIG.ALERT_COOLDOWN_MS) {
      showFocusAlert(distractionRatio);
      focusTracking.lastFocusAlertTime = now;
    }
    // Reset counters after alert
    focusTracking.outOfBoundsCount = 0;
    focusTracking.totalGazeCount = 0;
  }

  // Also check session duration for Pomodoro
  const sessionDuration = now - focusTracking.sessionStartTime;
  if (sessionDuration >= FOCUS_CONFIG.POMODORO_WORK_MS) {
    showPomodoroBreakAlert();
    // Reset session
    focusTracking.sessionStartTime = now;
    focusTracking.outOfBoundsCount = 0;
    focusTracking.totalGazeCount = 0;
  }
}

// FOCUS MODE: Show distraction alert
function showFocusAlert(distractionRatio) {
  const percentage = (distractionRatio * 100).toFixed(0);

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
    <div style="font-size: 16px; color: #e0e0e0; margin-bottom: 24px;">
      Son 2 dakikada dikkatinin %${percentage}'i sayfa dışındaydı
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
