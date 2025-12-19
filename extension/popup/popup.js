// ReaRead Popup Script

document.addEventListener('DOMContentLoaded', () => {
  // UI elements
  const connectionStatus = document.getElementById('connection-status');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const btnReconnect = document.getElementById('btn-reconnect');
  const btnCalibrate = document.getElementById('btn-calibrate');
  const toggleVisualization = document.getElementById('toggle-visualization');

  // Get initial connection status
  updateConnectionStatus();

  // Auto-refresh status every 2 seconds
  setInterval(updateConnectionStatus, 2000);

  // Event listeners
  btnReconnect.addEventListener('click', handleReconnect);
  btnCalibrate.addEventListener('click', handleCalibrate);
  toggleVisualization.addEventListener('change', handleToggleVisualization);

  // Functions
  function updateConnectionStatus() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response && response.status) {
        updateUI(response.status);
      }
    });

    // Also check calibration status
    chrome.storage.local.get(['isCalibrated'], (result) => {
      const isCalibrated = result.isCalibrated;
      if (isCalibrated === false) {
        // Show warning if not calibrated
        statusText.textContent = '⚠️ Not calibrated - Please calibrate first!';
        statusText.style.color = '#ff9800';
      } else if (isCalibrated === true) {
        statusText.textContent = '✅ System ready for tracking';
        statusText.style.color = '#4caf50';
      }
    });
  }

  function updateUI(status) {
    // Update status text and styling
    connectionStatus.textContent = capitalizeFirst(status);
    connectionStatus.className = `status-value ${status}`;
    statusDot.className = `status-dot ${status}`;

    // Update status message
    switch (status) {
      case 'connected':
        statusText.textContent = 'Connected to companion app';
        btnCalibrate.disabled = false;
        break;
      case 'connecting':
        statusText.textContent = 'Connecting to companion app...';
        btnCalibrate.disabled = true;
        break;
      case 'disconnected':
        statusText.textContent = 'Companion app not running';
        btnCalibrate.disabled = true;
        break;
      default:
        statusText.textContent = 'Unknown status';
        btnCalibrate.disabled = true;
    }
  }

  function handleReconnect() {
    btnReconnect.disabled = true;
    btnReconnect.textContent = 'Reconnecting...';

    chrome.runtime.sendMessage({ type: 'RECONNECT' }, (response) => {
      setTimeout(() => {
        btnReconnect.disabled = false;
        btnReconnect.textContent = 'Reconnect';
        updateConnectionStatus();
      }, 1000);
    });
  }

  function handleCalibrate() {
    btnCalibrate.disabled = true;
    btnCalibrate.textContent = 'Starting...';

    chrome.runtime.sendMessage({ type: 'REQUEST_CALIBRATION' }, (response) => {
      if (response.success) {
        setTimeout(() => {
          btnCalibrate.disabled = false;
          btnCalibrate.textContent = 'Start Calibration';
        }, 2000);
      }
    });
  }

  function handleToggleVisualization() {
    const enabled = toggleVisualization.checked;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_VISUALIZATION'
        });
      }
    });
  }

  function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
});
