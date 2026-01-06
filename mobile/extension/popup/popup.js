// ReaRead Mobile - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const statusIcon = document.getElementById('status-icon');
  const statusValue = document.getElementById('status-value');
  const trackingMethod = document.getElementById('tracking-method');
  const batteryLevel = document.getElementById('battery-level');

  // Get current tab
  async function getCurrentTab() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  // Update UI based on focus status
  async function updateStatus() {
    try {
      const tab = await getCurrentTab();

      // Send message to content script
      const response = await browser.tabs.sendMessage(tab.id, {
        type: 'GET_FOCUS_STATUS'
      });

      if (response && response.active) {
        // Focus mode active
        statusIcon.classList.add(response.usingCamera ? 'active' : 'fallback');
        statusValue.textContent = 'Active';

        if (response.usingCamera) {
          trackingMethod.textContent = 'Camera (MediaPipe)';
        } else if (response.usingFallback) {
          trackingMethod.textContent = 'Scroll Tracking';
        }

        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
      } else {
        // Focus mode not active
        statusIcon.classList.remove('active', 'fallback');
        statusValue.textContent = 'Not Started';
        trackingMethod.textContent = '-';

        startBtn.style.display = 'block';
        startBtn.disabled = false;
        stopBtn.style.display = 'none';
      }
    } catch (error) {
      console.error('[POPUP] Failed to get status:', error);
      statusValue.textContent = 'Unknown';
      trackingMethod.textContent = '-';
      startBtn.disabled = false;
    }
  }

  // Update battery level
  async function updateBattery() {
    if (!('getBattery' in navigator)) {
      batteryLevel.textContent = 'Not supported';
      return;
    }

    try {
      const battery = await navigator.getBattery();
      const level = Math.round(battery.level * 100);
      const charging = battery.charging;

      batteryLevel.textContent = `${level}%${charging ? ' (Charging)' : ''}`;

      // Update on battery change
      battery.addEventListener('levelchange', () => {
        const newLevel = Math.round(battery.level * 100);
        batteryLevel.textContent = `${newLevel}%${battery.charging ? ' (Charging)' : ''}`;
      });

      battery.addEventListener('chargingchange', () => {
        const level = Math.round(battery.level * 100);
        batteryLevel.textContent = `${level}%${battery.charging ? ' (Charging)' : ''}`;
      });
    } catch (error) {
      console.error('[POPUP] Battery API failed:', error);
      batteryLevel.textContent = 'Unknown';
    }
  }

  // Start button click
  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Opening page...';

    try {
      const tab = await getCurrentTab();

      // Focus mode is started by the content script automatically
      // Just close popup and let user interact with the prompt
      window.close();

    } catch (error) {
      console.error('[POPUP] Failed to start:', error);
      alert('Failed to start Focus Mode: ' + error.message);
      startBtn.disabled = false;
      startBtn.textContent = 'Start Focus Mode';
    }
  });

  // Stop button click
  stopBtn.addEventListener('click', async () => {
    try {
      const tab = await getCurrentTab();

      await browser.tabs.sendMessage(tab.id, {
        type: 'STOP_FOCUS_MODE'
      });

      // Update UI
      await updateStatus();

    } catch (error) {
      console.error('[POPUP] Failed to stop:', error);
      alert('Failed to stop Focus Mode: ' + error.message);
    }
  });

  // Settings link
  document.getElementById('settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    // TODO: Open settings page
    alert('Settings coming soon!');
  });

  // Help link
  document.getElementById('help-link').addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({
      url: 'https://github.com/damlalper/rearead-eyetracking/blob/main/mobile/README.md'
    });
  });

  // Initial update
  await updateStatus();
  await updateBattery();

  // Refresh status every 2 seconds
  setInterval(updateStatus, 2000);
});
