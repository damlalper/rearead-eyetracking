// ReaRead Mobile - Background Service Worker
// Minimal background script for Firefox Mobile

console.log('[REAREAD MOBILE BG] Service worker loaded');

// Handle extension installation
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[REAREAD MOBILE BG] Extension installed');

    // Show welcome notification
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon48.png'),
      title: 'ReaRead Mobile Installed!',
      message: 'Open any webpage to start eye tracking.'
    });

    // Open help page
    browser.tabs.create({
      url: browser.runtime.getURL('docs/welcome.html')
    });
  }
});

// Handle messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'MOBILE_GAZE_DATA':
      // Log gaze data (could be sent to analytics)
      // console.log('[REAREAD MOBILE BG] Gaze data:', message.data);
      sendResponse({ success: true });
      break;

    case 'LOG_EVENT':
      // Log analytics event
      console.log('[REAREAD MOBILE BG] Event:', message.event, message.data);
      sendResponse({ success: true });
      break;

    default:
      console.warn('[REAREAD MOBILE BG] Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep channel open for async response
});

// Handle browser action click (when user clicks extension icon)
browser.browserAction.onClicked.addListener(async (tab) => {
  console.log('[REAREAD MOBILE BG] Browser action clicked');

  // Open popup (Firefox Mobile automatically shows popup)
});

console.log('[REAREAD MOBILE BG] Service worker initialized');
