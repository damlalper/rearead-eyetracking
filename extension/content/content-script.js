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
function handleGazeData(gazeData) {
  // Lazy-init debug panel when first gaze data arrives
  if (!debugPanel) {
    initializeDebugPanel();
  }

  if (!gazeCursor || !isVisualizationEnabled) return;
  try {
    const viewportCoords = coordinateMapper.screenToViewport(gazeData.x, gazeData.y);

    if (viewportCoords.x >= 0 && viewportCoords.x <= window.innerWidth &&
        viewportCoords.y >= 0 && viewportCoords.y <= window.innerHeight) {
      gazeCursor.style.transform = `translate3d(${viewportCoords.x - 10}px, ${viewportCoords.y - 10}px, 0)`;
      gazeCursor.style.display = 'block';

      const targetOpacity = 0.3 + (gazeData.confidence * 0.5);
      smoothedOpacity = smoothedOpacity * 0.85 + targetOpacity * 0.15;
      gazeCursor.style.opacity = smoothedOpacity;

      // Cache viewport coordinates for paragraph analysis
      lastViewportGaze.x = viewportCoords.x;
      lastViewportGaze.y = viewportCoords.y;

      // GAZE STALE GUARD: Update timestamp only for valid viewport coordinates
      lastGazeTimestamp = Date.now();
    } else {
      gazeCursor.style.display = 'none';
    }
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

  const paraData = calculateParagraphKey(lastViewportGaze.x, lastViewportGaze.y);
  if (!paraData || !paraData.key) {
    // No paragraph detected - reset debug panel
    updateDebugPanel(null, -1, 0, '');
    return;
  }

  const key = paraData.key;
  const now = Date.now();

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
    currentParagraphLines = extractLinesFromParagraph(paraData.el);
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
  const lineText = getLineText(paraData.el, currentLineIndex, currentParagraphLines.length);
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
    background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer;
    font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 1000;
    transition: top 0.1s ease-out;
  `;

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

  if (analysisIntervalId) clearInterval(analysisIntervalId);
  analysisIntervalId = setInterval(analyzeReadingBehavior, ANALYSIS_INTERVAL_MS);

  console.log('[PX ASSIST] Started');
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

  console.log('[CLEANUP] Complete');
}
