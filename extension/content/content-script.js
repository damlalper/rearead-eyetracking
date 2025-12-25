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

function initializeGazeVisualization() {
  gazeCursor = document.createElement('div');
  gazeCursor.id = 'rearead-gaze-cursor';
  gazeCursor.style.cssText = `
    position: fixed; width: 30px; height: 30px; border-radius: 50%;
    background-color: rgba(255, 0, 0, 0.5); border: 2px solid rgba(255, 255, 255, 0.8);
    pointer-events: none; z-index: 999999; display: none; top: 0; left: 0;
    transform: translate3d(-15px, -15px, 0); will-change: transform;
  `;
  document.body.appendChild(gazeCursor);
  console.log('Gaze cursor initialized');
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
  if (!gazeCursor || !isVisualizationEnabled) return;
  try {
    const viewportCoords = coordinateMapper.screenToViewport(gazeData.x, gazeData.y);

    if (viewportCoords.x >= 0 && viewportCoords.x <= window.innerWidth &&
        viewportCoords.y >= 0 && viewportCoords.y <= window.innerHeight) {
      gazeCursor.style.transform = `translate3d(${viewportCoords.x - 15}px, ${viewportCoords.y - 15}px, 0)`;
      gazeCursor.style.display = 'block';

      const targetOpacity = 0.3 + (gazeData.confidence * 0.5);
      smoothedOpacity = smoothedOpacity * 0.85 + targetOpacity * 0.15;
      gazeCursor.style.opacity = smoothedOpacity;

      // Cache viewport coordinates for paragraph analysis
      lastViewportGaze.x = viewportCoords.x;
      lastViewportGaze.y = viewportCoords.y;
    } else {
      gazeCursor.style.display = 'none';
    }
  } catch (error) {
    console.error('Error handling gaze data:', error);
  }
}

function calculateParagraphKey(viewportY) {
  if (pxLineRects.length === 0) return null;

  for (const rect of pxLineRects) {
    if (viewportY >= rect.top && viewportY < rect.bottom) {
      return { key: rect.key, el: rect.el };
    }
  }
  return null;
}

// SLOW LOOP: Analyze reading (250ms)
function analyzeReadingBehavior() {
  const paraData = calculateParagraphKey(lastViewportGaze.y);
  if (!paraData || !paraData.key) return;

  const key = paraData.key;
  const now = Date.now();

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

    if (DEBUG_PARAGRAPH) {
      console.log(`[READING] Switched to: ${key}`);
    }
  } else {
    requestAnimationFrame(() => updateParagraphHighlight(currentParagraphKey));
  }
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
  alert(`Help requested for ${key}:\n\n"${text.substring(0, 100)}..."\n\n(LLM integration coming soon)`);
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
    if (DEBUG_PARAGRAPH) {
      console.log('[PX SCROLL] Re-measured (IDs stable)');
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
