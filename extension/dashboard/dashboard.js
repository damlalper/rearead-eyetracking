// ReaRead Analytics Dashboard
// Main JavaScript file

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});

async function initializeDashboard() {
    console.log('[Dashboard] Initializing...');

    // Load analytics data from storage
    const data = await loadAnalyticsData();

    // Check if there's any data
    if (!data.sessions || data.sessions.length === 0) {
        showEmptyState();
        return;
    }

    // Render all sections
    renderHeroStats(data);
    renderActivityHeatmap(data);
    renderFocusChart(data);
    renderSpeedChart(data);
    renderLLMChart(data);
    renderDifficultyCloud(data);
    renderGamification(data);
    renderInsights(data);

    // Setup event listeners
    setupEventListeners();

    console.log('[Dashboard] Initialization complete');
}

// Show empty state when no data exists
function showEmptyState() {
    const container = document.querySelector('.dashboard-container');
    container.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            text-align: center;
            padding: 48px 24px;
        ">
            <div style="font-size: 80px; margin-bottom: 24px; filter: drop-shadow(0 4px 8px rgba(255, 155, 69, 0.3));">
                📊
            </div>
            <h2 style="
                font-size: 32px;
                font-weight: 700;
                color: #ffffff;
                margin-bottom: 16px;
                background: linear-gradient(135deg, #ffffff, #FF9B45);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            ">
                No Reading Data Yet
            </h2>
            <p style="
                font-size: 18px;
                color: #a0a0a0;
                max-width: 500px;
                line-height: 1.6;
                margin-bottom: 32px;
            ">
                Start reading with ReaRead's eye-tracking features to see your analytics here. Your reading sessions, focus metrics, and progress will be tracked automatically.
            </p>
            <div style="
                display: flex;
                gap: 16px;
                align-items: center;
                padding: 20px 32px;
                background: rgba(255, 155, 69, 0.1);
                border: 1px solid rgba(255, 155, 69, 0.3);
                border-radius: 12px;
            ">
                <span style="font-size: 24px;">💡</span>
                <div style="text-align: left;">
                    <div style="font-weight: 600; color: #FF9B45; margin-bottom: 4px;">
                        How to get started:
                    </div>
                    <div style="color: #e0e0e0; font-size: 14px;">
                        1. Visit any article or document<br>
                        2. Enable eye-tracking from the extension popup<br>
                        3. Read naturally - your progress will be tracked!
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Load analytics data from Chrome storage
async function loadAnalyticsData() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['analyticsData'], (result) => {
            const defaultData = {
                profile: {
                    userId: 'default',
                    createdAt: new Date().toISOString()
                },
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

            resolve(result.analyticsData || defaultData);
        });
    });
}

// Render Hero Stats (Streak, Pages, Focus, WPM)
function renderHeroStats(data) {
    const stats = calculateHeroStats(data);

    document.getElementById('streak-value').textContent = stats.streak;
    document.getElementById('pages-value').textContent = stats.pagesRead;
    document.getElementById('focus-value').textContent = `${stats.avgFocus}%`;
    document.getElementById('speed-value').textContent = stats.avgWPM;
}

function calculateHeroStats(data) {
    const sessions = data.sessions || [];

    // Calculate current streak
    let streak = data.gamification?.currentStreak || 0;

    // Calculate pages read this month
    const thisMonth = new Date().toISOString().slice(0, 7);
    const pagesThisMonth = Object.entries(data.dailyStats || {})
        .filter(([date]) => date.startsWith(thisMonth))
        .reduce((sum, [, stats]) => sum + (stats.pagesRead || 0), 0);

    // Calculate average focus score (last 7 days)
    const last7Days = Object.entries(data.dailyStats || {})
        .slice(-7)
        .reduce((sum, [, stats]) => sum + (stats.avgFocusScore || 0), 0);
    const avgFocus = Math.round(last7Days / 7) || 0;

    // Calculate average WPM (last 30 sessions)
    const recentSessions = sessions.slice(-30);
    const avgWPM = recentSessions.length > 0
        ? Math.round(recentSessions.reduce((sum, s) => sum + (s.readingMetrics?.wordsPerMinute || 0), 0) / recentSessions.length)
        : 0;

    return {
        streak,
        pagesRead: pagesThisMonth,
        avgFocus,
        avgWPM
    };
}

// Render Activity Heatmap (GitHub-style)
function renderActivityHeatmap(data) {
    const container = document.getElementById('activity-heatmap');
    const heatmapGrid = document.createElement('div');
    heatmapGrid.className = 'heatmap-grid';

    // Generate last 90 days
    const days = 90;
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';

        // Get activity level for this day
        const dayStats = data.dailyStats?.[dateStr];
        const level = getActivityLevel(dayStats);
        cell.setAttribute('data-level', level);
        cell.setAttribute('data-date', dateStr);

        // Add tooltip on hover
        cell.addEventListener('mouseenter', (e) => showHeatmapTooltip(e, dateStr, dayStats));
        cell.addEventListener('mouseleave', hideHeatmapTooltip);

        heatmapGrid.appendChild(cell);
    }

    container.innerHTML = '';
    container.appendChild(heatmapGrid);
}

function getActivityLevel(dayStats) {
    if (!dayStats || !dayStats.totalReadingTime) return 0;

    const minutes = dayStats.totalReadingTime / 60000;
    if (minutes < 5) return 1;
    if (minutes < 15) return 2;
    if (minutes < 30) return 3;
    if (minutes < 60) return 4;
    return 5;
}

function showHeatmapTooltip(event, date, stats) {
    const tooltip = document.createElement('div');
    tooltip.className = 'heatmap-tooltip';
    tooltip.style.left = event.pageX + 'px';
    tooltip.style.top = (event.pageY - 40) + 'px';

    const minutes = stats ? Math.round(stats.totalReadingTime / 60000) : 0;
    tooltip.textContent = `${date}: ${minutes} min, ${stats?.pagesRead || 0} pages`;

    document.body.appendChild(tooltip);
}

function hideHeatmapTooltip() {
    const tooltip = document.querySelector('.heatmap-tooltip');
    if (tooltip) tooltip.remove();
}

// Render Focus Chart
function renderFocusChart(data) {
    const ctx = document.getElementById('focus-chart').getContext('2d');

    // Get last 7 days data
    const last7Days = Object.entries(data.dailyStats || {})
        .slice(-7)
        .map(([date, stats]) => ({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            focus: stats.avgFocusScore || 0
        }));

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days.map(d => d.date),
            datasets: [{
                label: 'Focus Score',
                data: last7Days.map(d => d.focus),
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#a0a0a0' },
                    grid: { color: '#2a2a2a' }
                },
                x: {
                    ticks: { color: '#a0a0a0' },
                    grid: { color: '#2a2a2a' }
                }
            }
        }
    });
}

// Render Speed Chart
function renderSpeedChart(data) {
    const ctx = document.getElementById('speed-chart').getContext('2d');

    const last7Days = Object.entries(data.dailyStats || {})
        .slice(-7)
        .map(([date, stats]) => ({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            wpm: stats.avgReadingSpeed || 0
        }));

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days.map(d => d.date),
            datasets: [{
                label: 'Reading Speed (WPM)',
                data: last7Days.map(d => d.wpm),
                borderColor: '#FF9B45',
                backgroundColor: 'rgba(255, 155, 69, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#a0a0a0' },
                    grid: { color: '#2a2a2a' }
                },
                x: {
                    ticks: { color: '#a0a0a0' },
                    grid: { color: '#2a2a2a' }
                }
            }
        }
    });
}

// Render LLM Usage Chart
function renderLLMChart(data) {
    const ctx = document.getElementById('llm-chart').getContext('2d');

    // Count LLM usage by type from all sessions
    const llmCounts = {
        summary: 0,
        vocabulary: 0,
        ask_question: 0,
        keypoints: 0,
        audio: 0
    };

    (data.sessions || []).forEach(session => {
        (session.llmUsage || []).forEach(usage => {
            if (llmCounts.hasOwnProperty(usage.type)) {
                llmCounts[usage.type]++;
            }
        });
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Summary', 'Vocabulary', 'Ask Question', 'Key Points', 'Audio'],
            datasets: [{
                label: 'Usage Count',
                data: Object.values(llmCounts),
                backgroundColor: [
                    'rgba(255, 155, 69, 0.8)',
                    'rgba(33, 150, 243, 0.8)',
                    'rgba(76, 175, 80, 0.8)',
                    'rgba(156, 39, 176, 0.8)',
                    'rgba(255, 193, 7, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#a0a0a0', stepSize: 1 },
                    grid: { color: '#2a2a2a' }
                },
                x: {
                    ticks: { color: '#a0a0a0' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Render Difficulty Cloud
function renderDifficultyCloud(data) {
    const container = document.getElementById('difficulty-cloud');
    container.innerHTML = '';

    const topics = data.topics || {};
    const topicArray = Object.entries(topics)
        .sort((a, b) => b[1].avgDifficulty - a[1].avgDifficulty)
        .slice(0, 10);

    if (topicArray.length === 0) {
        container.innerHTML = '<p style="color: #a0a0a0; text-align: center;">No topics tracked yet. Keep reading!</p>';
        return;
    }

    topicArray.forEach(([topic, stats]) => {
        const tag = document.createElement('div');
        tag.className = 'topic-tag';

        if (stats.avgDifficulty > 1.5) tag.classList.add('high-difficulty');
        else if (stats.avgDifficulty > 1.2) tag.classList.add('medium-difficulty');
        else tag.classList.add('low-difficulty');

        tag.textContent = `${topic} (${stats.sessionsCount})`;
        container.appendChild(tag);
    });
}

// Render Gamification
function renderGamification(data) {
    const gamification = data.gamification || {};

    // Update level display
    const levelInfo = getLevelInfo(gamification.totalPoints || 0);
    document.getElementById('level-badge').textContent = `Level ${levelInfo.level}`;
    document.getElementById('level-title').textContent = levelInfo.title;

    const progress = ((gamification.totalPoints - levelInfo.minPoints) / (levelInfo.maxPoints - levelInfo.minPoints)) * 100;
    document.getElementById('xp-progress').style.width = `${progress}%`;
    document.getElementById('xp-text').textContent = `${gamification.totalPoints} / ${levelInfo.maxPoints} XP`;

    // Render badges
    renderBadges(gamification.badges || []);
}

function getLevelInfo(points) {
    const levels = [
        { level: 1, title: 'Novice Reader', minPoints: 0, maxPoints: 100 },
        { level: 2, title: 'Active Reader', minPoints: 100, maxPoints: 300 },
        { level: 3, title: 'Engaged Learner', minPoints: 300, maxPoints: 600 },
        { level: 4, title: 'Focused Scholar', minPoints: 600, maxPoints: 1000 },
        { level: 5, title: 'Speed Reader', minPoints: 1000, maxPoints: 1500 },
        { level: 6, title: 'Master Reader', minPoints: 1500, maxPoints: 2500 },
        { level: 7, title: 'Reading Guru', minPoints: 2500, maxPoints: 4000 },
        { level: 8, title: 'Knowledge Seeker', minPoints: 4000, maxPoints: 6000 },
        { level: 9, title: 'Wisdom Keeper', minPoints: 6000, maxPoints: 9000 },
        { level: 10, title: 'Reading Legend', minPoints: 9000, maxPoints: 999999 }
    ];

    return levels.find(l => points < l.maxPoints) || levels[levels.length - 1];
}

function renderBadges(earnedBadges) {
    const container = document.getElementById('badges-container');
    container.innerHTML = '';

    const allBadges = [
        { id: 'first_session', name: 'First Steps', description: 'Complete first reading session', icon: '🎯' },
        { id: 'week_warrior', name: 'Week Warrior', description: 'Read 7 days in a row', icon: '🔥' },
        { id: 'focused_reader', name: 'Focused Reader', description: 'Achieve 90%+ focus score', icon: '🧠' },
        { id: 'speed_demon', name: 'Speed Demon', description: 'Read 250+ WPM', icon: '⚡' },
        { id: 'bookworm', name: 'Bookworm', description: 'Read 10 articles', icon: '📚' },
        { id: 'curious_mind', name: 'Curious Mind', description: 'Ask 50 LLM questions', icon: '💬' }
    ];

    allBadges.forEach(badge => {
        const isEarned = earnedBadges.some(b => b.id === badge.id);

        const badgeEl = document.createElement('div');
        badgeEl.className = 'badge-item';
        if (!isEarned) badgeEl.classList.add('locked');

        badgeEl.innerHTML = `
            <div class="badge-icon">${badge.icon}</div>
            <div class="badge-name">${badge.name}</div>
            <div class="badge-description">${badge.description}</div>
        `;

        container.appendChild(badgeEl);
    });
}

// Render Insights
function renderInsights(data) {
    const container = document.getElementById('insights-container');
    const insights = generateInsights(data);

    container.innerHTML = '';

    if (insights.length === 0) {
        container.innerHTML = '<p style="color: #a0a0a0; text-align: center;">Keep reading to unlock personalized insights!</p>';
        return;
    }

    insights.forEach(insight => {
        const item = document.createElement('div');
        item.className = 'insight-item';
        item.innerHTML = `
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-text">${insight.text}</div>
        `;
        container.appendChild(item);
    });
}

function generateInsights(data) {
    const insights = [];
    const sessions = data.sessions || [];

    if (sessions.length === 0) return insights;

    // Insight 1: Best time to read
    const avgFocusByHour = {};
    sessions.forEach(s => {
        const hour = new Date(s.startTime).getHours();
        if (!avgFocusByHour[hour]) avgFocusByHour[hour] = [];
        avgFocusByHour[hour].push(s.readingMetrics?.focusScore || 0);
    });

    const bestHour = Object.entries(avgFocusByHour)
        .map(([hour, scores]) => ({
            hour: parseInt(hour),
            avgFocus: scores.reduce((a, b) => a + b, 0) / scores.length
        }))
        .sort((a, b) => b.avgFocus - a.avgFocus)[0];

    if (bestHour) {
        insights.push({
            icon: '⏰',
            text: `You read best around ${bestHour.hour}:00 with ${Math.round(bestHour.avgFocus)}% focus`
        });
    }

    // Insight 2: Reading improvement
    const recentAvgWPM = sessions.slice(-10).reduce((sum, s) => sum + (s.readingMetrics?.wordsPerMinute || 0), 0) / 10;
    const olderAvgWPM = sessions.slice(-20, -10).reduce((sum, s) => sum + (s.readingMetrics?.wordsPerMinute || 0), 0) / 10;

    if (recentAvgWPM > olderAvgWPM) {
        const improvement = Math.round(((recentAvgWPM - olderAvgWPM) / olderAvgWPM) * 100);
        insights.push({
            icon: '📈',
            text: `Your reading speed improved ${improvement}% recently!`
        });
    }

    // Insight 3: Streak encouragement
    const streak = data.gamification?.currentStreak || 0;
    if (streak >= 3) {
        insights.push({
            icon: '🔥',
            text: `Amazing! You're on a ${streak}-day streak. Keep it up!`
        });
    }

    return insights;
}

// Setup event listeners
function setupEventListeners() {
    // Time range selector
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            // TODO: Update heatmap with new range
        });
    });

    // Export button
    document.getElementById('export-btn').addEventListener('click', exportAnalytics);

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', openSettings);
}

function exportAnalytics() {
    chrome.storage.local.get(['analyticsData'], (result) => {
        const data = result.analyticsData;
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `rearead-analytics-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
    });
}

function openSettings() {
    // TODO: Open settings modal
    alert('Settings coming soon!');
}
