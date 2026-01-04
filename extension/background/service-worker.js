// ReaRead Background Service Worker
// Handles WebSocket connection to companion app

let websocket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const WS_URL = 'ws://localhost:8765';

// Connection status
let connectionStatus = 'disconnected'; // 'connecting', 'connected', 'disconnected'

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('ReaRead extension installed');
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
