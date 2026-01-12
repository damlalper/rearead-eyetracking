// ReaRead Analytics Dashboard - Simplified Professional Version
console.log('[Dashboard] Initializing...');

let allSessions = [];
let focusChart = null;
let speedChart = null;

// Initialize dashboard
async function initializeDashboard() {
  try {
    // Load analytics data
    await loadAnalyticsData();

    // Render dashboard components
    renderStats();
    renderCharts();
    renderSessionsTable();

    console.log('[Dashboard] Initialization complete');
  } catch (error) {
    console.error('[Dashboard] Initialization failed:', error);
  }
}

// Load analytics data from storage
async function loadAnalyticsData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['analyticsData'], (result) => {
      const analyticsData = result.analyticsData || { sessions: [] };
      allSessions = analyticsData.sessions || [];
      console.log(`[Dashboard] Loaded ${allSessions.length} sessions from storage`);
      console.log('[Dashboard] Sample session structure:', allSessions[0]);
      resolve();
    });
  });
}

// Render summary statistics
function renderStats() {
  const totalSessions = allSessions.length;
  const totalTime = allSessions.reduce((sum, s) => sum + ((s.endTime - s.startTime) / 1000 / 60), 0);
  const avgFocus = calculateAverageFocus();
  const avgSpeed = calculateAverageSpeed();

  document.getElementById('sessions-value').textContent = totalSessions;
  document.getElementById('time-value').textContent = `${Math.round(totalTime)} min`;
  document.getElementById('focus-value').textContent = `${Math.round(avgFocus)}%`;
  document.getElementById('speed-value').textContent = avgSpeed > 0 ? `${Math.round(avgSpeed)} WPM` : 'N/A';
}

// Calculate average focus percentage
function calculateAverageFocus() {
  if (allSessions.length === 0) return 0;

  const focusPercentages = allSessions
    .map(session => session.avgFocusScore || 0)
    .filter(score => score > 0);

  if (focusPercentages.length === 0) return 0;

  const sum = focusPercentages.reduce((a, b) => a + b, 0);
  return sum / focusPercentages.length;
}

// Calculate average reading speed
function calculateAverageSpeed() {
  if (allSessions.length === 0) return 0;

  const speeds = allSessions.map(session => {
    const paragraphs = Object.values(session.paragraphMetrics || {});
    if (paragraphs.length === 0) return 0;

    // Estimate words: average paragraph has ~100 words
    const estimatedWords = paragraphs.length * 100;
    const totalTime = paragraphs.reduce((sum, p) => sum + (p.dwellTime || 0), 0) / 1000 / 60; // minutes

    if (totalTime === 0) return 0;
    return estimatedWords / totalTime;
  }).filter(s => s > 0);

  if (speeds.length === 0) return 0;
  return speeds.reduce((a, b) => a + b, 0) / speeds.length;
}

// Render charts
function renderCharts() {
  renderFocusChart();
  renderSpeedChart();
}

// Render focus over time chart
function renderFocusChart() {
  const ctx = document.getElementById('focus-chart');
  if (!ctx) return;

  // Prepare data: last 7 sessions
  const recentSessions = allSessions.slice(-7);
  const labels = recentSessions.map((s, i) => `Session ${i + 1}`);
  const focusData = recentSessions.map(session => {
    return (session.avgFocusScore || 0).toFixed(1);
  });

  if (focusChart) {
    focusChart.destroy();
  }

  focusChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Focus %',
        data: focusData,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            },
            color: '#a0a0a0'
          },
          grid: {
            color: '#2a2a2a'
          }
        },
        x: {
          ticks: {
            color: '#a0a0a0'
          },
          grid: {
            color: '#2a2a2a'
          }
        }
      }
    }
  });
}

// Render reading speed chart
function renderSpeedChart() {
  const ctx = document.getElementById('speed-chart');
  if (!ctx) return;

  // Prepare data: last 7 sessions
  const recentSessions = allSessions.slice(-7);
  const labels = recentSessions.map((s, i) => `Session ${i + 1}`);
  const speedData = recentSessions.map(session => {
    const paragraphs = Object.values(session.paragraphMetrics || {});
    if (paragraphs.length === 0) return 0;

    // Estimate words: average paragraph has ~100 words
    const estimatedWords = paragraphs.length * 100;
    const totalTime = paragraphs.reduce((sum, p) => sum + (p.dwellTime || 0), 0) / 1000 / 60; // minutes

    if (totalTime === 0) return 0;
    return Math.round(estimatedWords / totalTime);
  });

  if (speedChart) {
    speedChart.destroy();
  }

  speedChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'WPM',
        data: speedData,
        backgroundColor: '#FF9B45',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#a0a0a0'
          },
          grid: {
            color: '#2a2a2a'
          }
        },
        x: {
          ticks: {
            color: '#a0a0a0'
          },
          grid: {
            color: '#2a2a2a'
          }
        }
      }
    }
  });
}

// Render sessions table
function renderSessionsTable() {
  const tbody = document.getElementById('sessions-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (allSessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #a0a0a0;">No sessions recorded yet</td></tr>';
    return;
  }

  // Show last 10 sessions
  const recentSessions = allSessions.slice(-10).reverse();

  recentSessions.forEach(session => {
    const row = document.createElement('tr');

    const date = new Date(session.startTime);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const duration = Math.round((session.endTime - session.startTime) / 1000 / 60);
    const focusPercent = Math.round(session.avgFocusScore || 0);
    const paragraphCount = session.paragraphsRead || Object.keys(session.paragraphMetrics || {}).length;

    // Truncate URL
    let url = session.url || 'Unknown';
    try {
      const urlObj = new URL(url);
      url = urlObj.hostname + urlObj.pathname;
      if (url.length > 50) {
        url = url.substring(0, 47) + '...';
      }
    } catch (e) {
      if (url.length > 50) {
        url = url.substring(0, 47) + '...';
      }
    }

    row.innerHTML = `
      <td>${dateStr}</td>
      <td>${url}</td>
      <td>${duration} min</td>
      <td>${focusPercent}%</td>
      <td>${paragraphCount}</td>
    `;

    tbody.appendChild(row);
  });
}

// Export data handler
document.getElementById('export-btn')?.addEventListener('click', () => {
  const dataStr = JSON.stringify(allSessions, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `rearead-analytics-${Date.now()}.json`;
  link.click();

  URL.revokeObjectURL(url);
  console.log('[Dashboard] Data exported');
});

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
  initializeDashboard();
}
