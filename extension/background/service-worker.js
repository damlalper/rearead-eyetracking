// ReaRead Background Service Worker
// Handles WebSocket connection to companion app

let websocket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const WS_URL = 'ws://localhost:8765';

// Connection status
let connectionStatus = 'disconnected'; // 'connecting', 'connected', 'disconnected'

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('ReaRead extension installed');

  // Load API keys from config.js (demo mode)
  try {
    const response = await fetch(chrome.runtime.getURL('config.js'));
    const configText = await response.text();

    // Extract API keys using regex (simple parsing)
    const elevenlabsMatch = configText.match(/ELEVENLABS_API_KEY:\s*["']([^"']+)["']/);
    const groqMatch = configText.match(/GROQ_API_KEY:\s*["']([^"']+)["']/);

    chrome.storage.local.set({
      elevenlabsApiKey: elevenlabsMatch ? elevenlabsMatch[1] : '',
      groqApiKey: groqMatch ? groqMatch[1] : ''
    });

    console.log('[API KEYS] API keys loaded from config.js for demo');
  } catch (error) {
    console.error('[API KEYS] Failed to load config.js:', error);
  }

  connectToCompanion();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('ReaRead extension started');
  connectToCompanion();
});

// IMPORTANT: Also try to connect immediately when service worker loads
// This ensures connection even if extension is already installed
console.log('ReaRead background service worker loaded - attempting connection...');
connectToCompanion();

function connectToCompanion() {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    console.log('Already connected to companion app');
    return;
  }

  console.log(`Connecting to companion app at ${WS_URL}...`);
  updateConnectionStatus('connecting');

  try {
    websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      console.log('Connected to ReaRead companion app');
      updateConnectionStatus('connected');
      reconnectAttempts = 0;

      // Start heartbeat
      startHeartbeat();
    };

    websocket.onmessage = (event) => {
      handleMessage(event.data);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('Disconnected from companion app');
      updateConnectionStatus('disconnected');
      stopHeartbeat();

      // Attempt reconnection
      attemptReconnect();
    };

  } catch (error) {
    console.error('Failed to create WebSocket connection:', error);
    updateConnectionStatus('disconnected');
    attemptReconnect();
  }
}

function handleMessage(data) {
  try {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'gaze':
        // Forward gaze data to content script
        broadcastToContentScripts({
          type: 'GAZE_DATA',
          data: message
        });
        break;

      case 'status':
        console.log('Status update:', message.state, 'calibrated:', message.calibrated, 'tuned:', message.tuned);

        // Store calibration status
        chrome.storage.local.set({
          isCalibrated: message.calibrated,
          isTuned: message.tuned,
          setupState: message.state
        });

        // Handle different setup states
        switch (message.state) {
          case 'setup_started':
            console.log('🔧 Setup flow started - calibration window will open...');
            break;
          case 'setup_completed':
            console.log('✅ Setup completed - system ready for tracking!');
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: 'ReaRead - Setup Complete',
              message: 'Eye tracking is now active and ready!'
            }).catch(() => {});
            break;
          case 'setup_failed':
            console.error('❌ Setup failed');
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: 'ReaRead - Setup Failed',
              message: 'Setup failed. Please try calibration manually from the popup.'
            }).catch(() => {});
            break;
          case 'calibration_started':
            console.log('📷 Calibration started...');
            break;
          case 'calibration_completed':
            console.log('✅ Calibration completed');
            break;
          case 'tuning_started':
            console.log('⚙️ Tuning KDE smoother...');
            break;
          case 'tuning_completed':
            console.log('✅ Tuning completed');
            break;
        }
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
}

function broadcastToContentScripts(message) {
  // Send to all tabs (not just active tab, since popup might be focused)
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs without content script
        });
      }
    });
  });
}

let heartbeatInterval = null;

function startHeartbeat() {
  // Send ping every 30 seconds
  heartbeatInterval = setInterval(() => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'ping',
        timestamp: Date.now()
      });
    }
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached. Please restart the companion app.');
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s

  console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

  setTimeout(() => {
    connectToCompanion();
  }, delay);
}

function sendMessage(message) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify(message));
  } else {
    console.warn('WebSocket not connected. Cannot send message.');
  }
}

function updateConnectionStatus(status) {
  connectionStatus = status;

  // Update extension icon based on status
  const iconPath = status === 'connected'
    ? 'icons/icon128.png'
    : 'icons/icon128-inactive.png';

  chrome.action.setIcon({ path: iconPath }).catch(() => {
    // Icon file might not exist yet
  });

  // Store status for popup
  chrome.storage.local.set({ connectionStatus: status });
}

// AUTO READ MODE: Translate text using free translation APIs (no API key needed)
async function handleTranslation({ text, fromLanguage, toLanguage }) {
  // Try multiple free translation services in order
  const services = [
    { name: 'MyMemory', func: translateWithMyMemory },
    { name: 'LibreTranslate', func: translateWithLibreTranslate },
    { name: 'Lingva', func: translateWithLingva },
    { name: 'GoogleTranslateProxy', func: translateWithGoogleProxy }
  ];

  for (const service of services) {
    try {
      console.log(`[TRANSLATION] Trying ${service.name}...`);
      const translation = await service.func(text, fromLanguage, toLanguage);

      if (translation && translation.trim()) {
        console.log(`[TRANSLATION] ${service.name} success: ${fromLanguage} → ${toLanguage}`);
        return translation;
      }
    } catch (error) {
      console.warn(`[TRANSLATION] ${service.name} failed:`, error.message);
    }
  }

  throw new Error('All translation services failed');
}

// 1. MyMemory API (free, 500 char limit per request, reliable)
async function translateWithMyMemory(text, fromLanguage, toLanguage) {
  const langMap = {
    'Turkish': 'tr', 'English': 'en', 'German': 'de',
    'French': 'fr', 'Spanish': 'es', 'Italian': 'it',
    'Japanese': 'ja', 'Chinese': 'zh'
  };

  const fromLang = langMap[fromLanguage] || 'en';
  const toLang = langMap[toLanguage] || 'en';

  // Split text if longer than 500 chars
  if (text.length > 500) {
    const chunks = text.match(/.{1,450}/g) || [];
    const translations = [];

    for (const chunk of chunks) {
      const encodedText = encodeURIComponent(chunk);
      const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${fromLang}|${toLang}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        translations.push(data.responseData.translatedText);
      }
    }

    return translations.join(' ');
  }

  const encodedText = encodeURIComponent(text);
  const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${fromLang}|${toLang}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText.trim();
  }

  throw new Error('Invalid response');
}

// 2. LibreTranslate (free, open-source, public instance)
async function translateWithLibreTranslate(text, fromLanguage, toLanguage) {
  const langMap = {
    'Turkish': 'tr', 'English': 'en', 'German': 'de',
    'French': 'fr', 'Spanish': 'es', 'Italian': 'it',
    'Japanese': 'ja', 'Chinese': 'zh'
  };

  const fromLang = langMap[fromLanguage] || 'en';
  const toLang = langMap[toLanguage] || 'en';

  const response = await fetch('https://libretranslate.com/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: text,
      source: fromLang,
      target: toLang,
      format: 'text'
    })
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  if (data.translatedText) {
    return data.translatedText.trim();
  }

  throw new Error('Invalid response');
}

// 3. Lingva Translate (Google Translate proxy, free)
async function translateWithLingva(text, fromLanguage, toLanguage) {
  const langMap = {
    'Turkish': 'tr', 'English': 'en', 'German': 'de',
    'French': 'fr', 'Spanish': 'es', 'Italian': 'it',
    'Japanese': 'ja', 'Chinese': 'zh'
  };

  const fromLang = langMap[fromLanguage] || 'en';
  const toLang = langMap[toLanguage] || 'en';

  const encodedText = encodeURIComponent(text);
  const url = `https://lingva.ml/api/v1/${fromLang}/${toLang}/${encodedText}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  if (data.translation) {
    return data.translation.trim();
  }

  throw new Error('Invalid response');
}

// 4. Google Translate Simple Proxy (free, simple)
async function translateWithGoogleProxy(text, fromLanguage, toLanguage) {
  const langMap = {
    'Turkish': 'tr', 'English': 'en', 'German': 'de',
    'French': 'fr', 'Spanish': 'es', 'Italian': 'it',
    'Japanese': 'ja', 'Chinese': 'zh'
  };

  const fromLang = langMap[fromLanguage] || 'en';
  const toLang = langMap[toLanguage] || 'en';

  const encodedText = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodedText}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  if (data && data[0] && Array.isArray(data[0])) {
    const translation = data[0].map(item => item[0]).join('');
    return translation.trim();
  }

  throw new Error('Invalid response');
}

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATUS':
      sendResponse({ status: connectionStatus });
      break;

    case 'RECONNECT':
      reconnectAttempts = 0;
      connectToCompanion();
      sendResponse({ success: true });
      break;

    case 'DISCONNECT':
      console.log('[DISCONNECT] User requested disconnect');
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
      updateConnectionStatus('disconnected');
      chrome.storage.local.set({ isCalibrated: false }); // Clear calibration
      broadcastToContentScripts({ type: 'EXTENSION_DISABLED' });
      sendResponse({ success: true });
      break;

    case 'REQUEST_CALIBRATION':
      sendMessage({
        type: 'calibration_request',
        calibration_type: '9point'
      });
      sendResponse({ success: true });
      break;

    case 'CONTROL':
      sendMessage({
        type: 'control',
        action: message.action
      });
      sendResponse({ success: true });
      break;

    case 'TRANSLATE_TEXT':
      // Handle translation request using Gemini API
      handleTranslation(message.data)
        .then(translation => {
          sendResponse({ success: true, translation });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep message channel open for async response
});

// Cleanup on extension unload/disable
chrome.runtime.onSuspend.addListener(() => {
  console.log('[SERVICE WORKER] Extension suspending - cleaning up...');

  // Send cleanup signal to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'EXTENSION_DISABLED' }).catch(() => {
          // Ignore errors for tabs without content script
        });
      }
    });
  });

  if (websocket) {
    websocket.close();
  }
  stopHeartbeat();
});
