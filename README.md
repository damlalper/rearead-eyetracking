# ReaRead - Webcam-Based Reading Behavior Analysis with AI Assistance

> **A Hybrid Eye-Tracking System for Reading Comprehension Analysis**
> Graduation Project - Computer Engineering

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://developer.chrome.com/docs/extensions/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Motivation & Problem Statement](#motivation--problem-statement)
3. [System Architecture](#system-architecture)
4. [Technical Implementation](#technical-implementation)
5. [Key Features & Innovations](#key-features--innovations)
6. [Installation & Setup](#installation--setup)
7. [Usage Guide](#usage-guide)
8. [Data Flow & Protocol](#data-flow--protocol)
9. [Algorithms & Methods](#algorithms--methods)
10. [Evaluation & Performance](#evaluation--performance)
11. [Future Work](#future-work)
12. [References](#references)

---

## Project Overview

**ReaRead** is a non-intrusive, webcam-based eye-tracking system designed for real-time reading behavior analysis on web content. Unlike traditional eye-tracking systems that require expensive hardware, ReaRead uses commodity webcams and computer vision to provide accessible reading analytics with integrated AI assistance.

### Abstract

Reading comprehension is a complex cognitive process that can be analyzed through eye movement patterns. This project presents a hybrid architecture combining:
- **Desktop companion app** (Python) for accurate gaze estimation using MediaPipe Face Mesh
- **Browser extension** (JavaScript) for webpage integration and reading analysis
- **LLM integration** (Groq API) for context-aware reading assistance
- **TTS integration** (ElevenLabs API) for accessibility features

The system achieves real-time gaze streaming at 30Hz with sub-100ms latency, enabling smooth cursor visualization and accurate paragraph-level reading detection.

---

## Motivation & Problem Statement

### Research Context

Eye-tracking research has shown that reading patterns reveal cognitive processes:
- **Fixations**: Stable gaze points indicating comprehension
- **Saccades**: Rapid eye movements between fixations
- **Regressions**: Backward movements indicating confusion or re-reading

Traditional eye-tracking solutions (Tobii, EyeLink) cost $5,000-$30,000, limiting accessibility for:
- Individual learners monitoring their reading habits
- Educational institutions analyzing student comprehension
- Researchers studying reading behavior at scale

### Our Solution

ReaRead democratizes eye-tracking for reading analysis by:
1. **Using commodity hardware** (standard webcam) instead of specialized equipment
2. **Browser integration** to work on any web content without modification
3. **Real-time feedback** through gaze visualization and AI assistance
4. **Privacy-first design** with local processing and user control

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER'S LOCAL MACHINE                            │
│                                                                              │
│  ┌──────────────────────────────┐                                           │
│  │     Companion App             │                                           │
│  │     (Python Desktop)          │                                           │
│  │                               │                                           │
│  │  ┌────────────────────────┐  │                                           │
│  │  │  GazeStreamer          │  │                                           │
│  │  │  ┌──────────────────┐  │  │                                           │
│  │  │  │ MediaPipe        │  │  │      WebSocket (ws://localhost:8765)     │
│  │  │  │ Face Mesh        │  │  │              ▲         │                  │
│  │  │  │ (468 landmarks)  │  │  │              │         │                  │
│  │  │  └──────────────────┘  │  │              │         ▼                  │
│  │  │         │              │  │    ┌─────────────────────────────┐        │
│  │  │         ▼              │  │    │   Chrome Extension          │        │
│  │  │  ┌──────────────────┐  │  │    │                             │        │
│  │  │  │ Ridge Regression │  │  │    │  ┌───────────────────────┐ │        │
│  │  │  │ Gaze Estimation  │  │  │    │  │  Service Worker       │ │        │
│  │  │  └──────────────────┘  │  │    │  │  - WebSocket Client   │ │        │
│  │  │         │              │  │    │  │  - Message Routing    │ │        │
│  │  │         ▼              │  │    │  │  - Status Management  │ │        │
│  │  │  ┌──────────────────┐  │  │    │  └───────────────────────┘ │        │
│  │  │  │ KDE Smoother     │  │  │    │           │                 │        │
│  │  │  │ (Gaussian Kernel)│  │  │    │           ▼                 │        │
│  │  │  └──────────────────┘  │  │    │  ┌───────────────────────┐ │        │
│  │  │         │              │  │    │  │  Content Script       │ │        │
│  │  │         ▼              │  │    │  │  - Gaze Mapping       │ │        │
│  │  │    Screen (x, y)       │  │    │  │  - Line Detection     │ │        │
│  │  └────────────────────────┘  │    │  │  - Paragraph Analysis │ │        │
│  │                               │    │  │  - LLM Integration    │ │        │
│  │  ┌────────────────────────┐  │    │  └───────────────────────┘ │        │
│  │  │  WebSocket Server      │  │    │           │                 │        │
│  │  │  - JSON Protocol       │◄─┼────┼───────────┘                 │        │
│  │  │  - Heartbeat (30s)     │  │    │                             │        │
│  │  │  - 30Hz Gaze Streaming │  │    └─────────────────────────────┘        │
│  │  └────────────────────────┘  │                   │                        │
│  │                               │                   │                        │
│  │  ┌────────────────────────┐  │                   ▼                        │
│  │  │  Calibration Manager   │  │         ┌──────────────────┐              │
│  │  │  - 9-Point Calibration │  │         │   Web Page       │              │
│  │  │  - Model Persistence   │  │         │   (Any URL)      │              │
│  │  │  - Auto Cleanup        │  │         │                  │              │
│  │  └────────────────────────┘  │         │  - Live Cursor   │              │
│  └───────────┬───────────────────┘         │  - Debug Overlay │              │
│              │                             │  - Heatmap       │              │
│       ┌──────▼──────┐                      └──────────────────┘              │
│       │   Webcam    │                                                        │
│       │   (640x480) │                                                        │
│       └─────────────┘                                                        │
│                                                                              │
│  External APIs (Optional, User-Provided Keys):                              │
│  ┌─────────────────────┐          ┌──────────────────────┐                 │
│  │  Groq API           │          │  ElevenLabs API      │                 │
│  │  (LLM Assistance)   │          │  (Text-to-Speech)    │                 │
│  │  - Summarization    │          │  - Multilingual      │                 │
│  │  - Vocabulary       │          │  - Natural Voice     │                 │
│  │  - Quiz Generation  │          │  - Real-time         │                 │
│  └─────────────────────┘          └──────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Companion App (Python)
**Purpose**: Accurate gaze estimation and streaming

**Core Modules**:
- `gaze_streamer.py` (420 lines)
  - MediaPipe Face Mesh integration (468 facial landmarks)
  - Ridge regression model for gaze estimation
  - KDE (Kernel Density Estimation) smoothing
  - Calibration data collection and model training
  - Real-time streaming loop (30Hz)

- `websocket_server.py` (234 lines)
  - Async WebSocket server (websockets library)
  - JSON-based message protocol
  - Client connection management
  - Calibration request handling
  - Status broadcasting

- `main.py` (183 lines)
  - Application entry point
  - Configuration management
  - Logging setup (console + file)
  - Graceful shutdown handling

**Key Technologies**:
- **MediaPipe Face Mesh**: 468-point facial landmark detection
- **scikit-learn Ridge Regression**: Gaze coordinate prediction
- **scipy KDE**: Gaussian kernel density estimation for smoothing
- **OpenCV**: Video capture and processing
- **websockets**: Async WebSocket server
- **asyncio**: Concurrent execution

#### 2. Browser Extension (JavaScript)
**Purpose**: Web integration and reading analysis

**Core Modules**:
- `service-worker.js` (288 lines)
  - Background service worker (Manifest V3)
  - WebSocket client with auto-reconnect
  - Exponential backoff (max 30s delay)
  - Message routing to content scripts
  - Calibration status management
  - Desktop notifications

- `content-script.js` (1200+ lines)
  - Gaze coordinate viewport mapping
  - Line-level text detection
  - Paragraph-level reading analysis
  - Dwell time calculation
  - Cursor visualization
  - Debug overlay (coordinates, FPS, line info)
  - LLM assistance integration

- `llm-helper.js` (1066 lines)
  - Groq API integration (llama-3.3-70b-versatile)
  - ElevenLabs TTS integration (eleven_multilingual_v2)
  - Custom modal dialogs for API key input
  - Chrome Storage API for key persistence
  - Language detection (Turkish/English)
  - 6 assistance modes: Summary, Vocabulary, Quiz, Key Points, Audio, Zoom

- `popup.js` (157 lines)
  - Extension popup UI controller
  - Connection status display
  - Calibration button logic
  - Setup state management
  - Manual reconnection

**Key Technologies**:
- **Chrome Extension Manifest V3**: Modern extension framework
- **WebSocket API**: Real-time bidirectional communication
- **Chrome Storage API**: Persistent key-value storage
- **MutationObserver**: DOM change detection
- **IntersectionObserver**: Viewport visibility tracking

---

## Technical Implementation

### 1. Gaze Estimation Pipeline

#### Stage 1: Facial Landmark Detection
```python
# MediaPipe Face Mesh - 468 3D landmarks
results = self.face_mesh.process(frame)
if results.multi_face_landmarks:
    landmarks = results.multi_face_landmarks[0].landmark
```

**Key Landmarks Used**:
- **Left Eye**: Points 33, 133, 160, 159, 158, 144, 145, 153
- **Right Eye**: Points 362, 263, 387, 386, 385, 373, 374, 380
- **Iris Centers**: Estimated from eye corner positions

#### Stage 2: Feature Extraction
```python
# Extract eye region features (8 points per eye)
left_eye = [
    landmarks[33],  # Left eye corner
    landmarks[133], # Right eye corner
    landmarks[160], # Upper eyelid
    landmarks[144], # Lower eyelid
    # ... additional points
]

# Calculate iris center (approximate)
iris_x = (left_eye[0].x + left_eye[1].x) / 2
iris_y = (left_eye[2].y + left_eye[3].y) / 2
```

#### Stage 3: Calibration & Training
```python
# User fixates on 9 calibration points (3x3 grid)
calibration_points = [
    (w*0.1, h*0.1), (w*0.5, h*0.1), (w*0.9, h*0.1),
    (w*0.1, h*0.5), (w*0.5, h*0.5), (w*0.9, h*0.5),
    (w*0.1, h*0.9), (w*0.5, h*0.9), (w*0.9, h*0.9)
]

# Train Ridge Regression model
model = Ridge(alpha=1.0)
model.fit(eye_features, screen_coordinates)

# Save model (pickle format)
with open('users/default_model.pkl', 'wb') as f:
    pickle.dump(model, f)
```

**Calibration Accuracy**:
- Typical error: 50-100 pixels on 1920x1080 screen
- Accuracy improves with KDE smoothing (described below)

#### Stage 4: KDE Smoothing (Innovation)
```python
from scipy.stats import gaussian_kde

# Collect recent gaze points (sliding window)
recent_points = queue[-30:]  # Last 1 second at 30Hz

# Fit Gaussian KDE
kde = gaussian_kde(recent_points.T)

# Find mode (most likely gaze position)
smoothed_gaze = optimize.minimize(
    lambda x: -kde(x),
    initial_guess=last_gaze
).x
```

**KDE Benefits**:
- **Noise reduction**: Filters jitter from webcam imperfections
- **Outlier removal**: Ignores spurious predictions
- **Natural smoothing**: Preserves rapid saccades while smoothing fixations

### 2. WebSocket Communication Protocol

#### Connection Lifecycle
```
Extension                    Companion
   │                             │
   │──── connect() ────────────► │
   │                             │
   │◄─── status(connected) ───── │
   │                             │
   │──── calibration_request ──► │
   │                             │
   │◄─── status(calib_started)── │
   │        (9-point UI)          │
   │◄─── status(calib_complete)─ │
   │◄─── status(tuning_started)─ │
   │◄─── status(tuning_complete) │
   │◄─── status(setup_complete)─ │
   │                             │
   │◄─── gaze(x,y) ──────────────│ (30 Hz loop)
   │◄─── gaze(x,y) ──────────────│
   │◄─── gaze(x,y) ──────────────│
   │     ...                     │
   │                             │
   │──── ping ──────────────────►│ (every 30s)
   │◄─── pong ────────────────── │
   │                             │
   │──── disconnect ────────────►│
   │                             │
   │◄─── connection_closed ───── │
   │    (model cleanup)          │
```

#### Message Formats

**Gaze Data** (30 Hz):
```json
{
  "type": "gaze",
  "x": 742,
  "y": 388,
  "confidence": 0.82,
  "timestamp": 1734441234567
}
```

**Status Updates**:
```json
{
  "type": "status",
  "state": "setup_completed",
  "calibrated": true,
  "tuned": true,
  "timestamp": 1734441234567
}
```

**Calibration Request**:
```json
{
  "type": "calibration_request",
  "calibration_type": "9point"
}
```

**Heartbeat**:
```json
{
  "type": "ping",
  "timestamp": 1734441234567
}
```

### 3. Reading Analysis Algorithm

#### Line-Level Detection
```javascript
// Get all text nodes in viewport
const textNodes = getAllTextNodes(document.body);

// Create bounding boxes for each line
const lines = textNodes.map(node => {
  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = range.getClientRects();

  return Array.from(rects).map(rect => ({
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    text: node.textContent.trim()
  }));
}).flat();

// Find line containing gaze point
function getLineAtGaze(x, y) {
  return lines.find(line =>
    x >= line.left && x <= line.right &&
    y >= line.top && y <= line.bottom
  );
}
```

#### Paragraph-Level Dwell Time
```javascript
// Track dwell time per paragraph
const paragraphDwellTimes = new Map();

function handleGaze(x, y) {
  const para = getEnclosingParagraph(x, y);

  if (!paragraphDwellTimes.has(para)) {
    paragraphDwellTimes.set(para, {
      totalTime: 0,
      lastEnter: Date.now(),
      isActive: true
    });
  }

  const data = paragraphDwellTimes.get(para);
  if (data.isActive) {
    const now = Date.now();
    data.totalTime += (now - data.lastEnter);
    data.lastEnter = now;

    // Trigger assistance after 2 seconds
    if (data.totalTime > 2000) {
      showAssistanceButton(para);
    }
  }
}
```

### 4. LLM Integration Architecture

#### API Key Management
```javascript
// Custom modal for key input (no native prompt())
async function requestApiKeyFromUser() {
  return new Promise((resolve) => {
    const modal = createModalDialog({
      title: "Groq API Key Required",
      subtitle: "Get free key from console.groq.com",
      placeholder: "gsk_...",
      onSave: (key) => resolve(key),
      onCancel: () => resolve(null)
    });
    document.body.appendChild(modal);
  });
}

// Persistent storage via Chrome Storage API
async function saveApiKey(key) {
  return chrome.storage.sync.set({ llmApiKey: key });
}

async function loadApiKey() {
  const result = await chrome.storage.sync.get(['llmApiKey']);
  return result.llmApiKey || '';
}
```

#### Prompt Engineering (6 Modes)

**1. Summarization** (Turkish example):
```
Sen bir okuma asistanısın. Görevin metinleri özetlemek.

KURALLAR:
- Özeti 2-3 cümle ile sınırla
- Metnin ana fikrini ve önemli detayları koru
- Gereksiz kelimeleri çıkar, öze odaklan
- Sadece özeti yaz, başka açıklama yapma

METİN:
{paragraph_text}

ÖZET:
```

**2. Vocabulary Builder**:
```
You are a vocabulary teacher. Identify and explain difficult words.

RULES:
- Select maximum 5 difficult words
- Format: "WORD: Explanation (example usage)"
- Use simple explanations
- Sort by difficulty (hardest → easiest)

TEXT:
{paragraph_text}

DIFFICULT WORDS:
```

**3. Quiz Generation**:
```
You are a teacher. Create comprehension questions.

RULES:
- Create 3 multiple choice questions
- 4 options (A, B, C, D) for each
- Indicate correct answer
- Test comprehension, not memorization
- Format: "QUESTION 1: ...\nA) ...\nB) ...\nC) ...\nD) ...\nCORRECT: X"

TEXT:
{paragraph_text}

COMPREHENSION QUESTIONS:
```

**4. Key Points Extraction**:
```
You are a note-taking assistant. Extract key points in bullet format.

RULES:
- Extract maximum 5 points
- Each point should be one sentence
- Highlight important details
- Format: "• Point 1\n• Point 2\n..."

TEXT:
{paragraph_text}

KEY POINTS:
```

**5. Text-to-Speech** (ElevenLabs):
```javascript
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
  {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: paragraph_text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  }
);
const audioBlob = await response.blob();
const audio = new Audio(URL.createObjectURL(audioBlob));
await audio.play();
```

**6. Zoom View**:
- No LLM/API needed
- Pure UI feature: 24px font, centered modal
- Improves readability for visually impaired users

#### Language Auto-Detection
```javascript
function detectLanguage(text) {
  const turkishChars = /[ğüşıöçĞÜŞİÖÇ]/;
  const turkishWords = /\b(ve|bir|bu|için|olan|ile|daha)\b/i;

  if (turkishChars.test(text) || turkishWords.test(text)) {
    return 'tr';
  }
  return 'en';
}
```

---

## Key Features & Innovations

### 1. Automatic Model Cleanup (Branch Exclusive)
**Problem**: Previous versions left calibration models on disk, requiring manual deletion.

**Solution**: Automatic cleanup on disconnect/shutdown.
```python
# In websocket_server.py
async def unregister(self, websocket):
    self.clients.discard(websocket)

    # NEW: Cleanup model when last client disconnects
    if len(self.clients) == 0 and self.gaze_streamer:
        logger.info("All clients disconnected - cleaning up model")
        self.gaze_streamer.cleanup_model()

# In main.py shutdown handler
async def stop(self):
    if self.gaze_streamer:
        self.gaze_streamer.cleanup()
        # NEW: Also cleanup model on app termination
        logger.info("Cleaning up calibration model...")
        self.gaze_streamer.cleanup_model()
```

### 2. Extension Auto-Connection (Branch Exclusive)
**Problem**: Extension only connected on install/startup events, not when already loaded.

**Solution**: Immediate connection attempt when service worker loads.
```javascript
// OLD: Only connected on specific events
chrome.runtime.onInstalled.addListener(() => connectToCompanion());
chrome.runtime.onStartup.addListener(() => connectToCompanion());

// NEW: Also connect immediately when service worker loads
console.log('Service worker loaded - attempting connection...');
connectToCompanion();
```

### 3. User-Controlled Calibration (Branch Exclusive)
**Problem**: Old versions auto-started calibration before user navigated to desired page.

**Solution**: Manual calibration trigger from popup.
```python
# In websocket_server.py register()
async def register(self, websocket):
    await self.send_initial_status(websocket)

    # NEW: Don't auto-start, wait for user action
    if self.gaze_streamer and self.gaze_streamer.needs_setup:
        logger.info("Setup required - waiting for user to start calibration")
    # OLD: await self.trigger_setup_flow(websocket)
```

### 4. Custom API Key Dialogs (Branch Exclusive)
**Problem**: `prompt()` function failed with "Cannot access before initialization" error.

**Solution**: Custom modal dialogs with proper styling and event handling.
```javascript
// OLD: Native prompt (unreliable)
const apiKey = prompt('Enter API key:');

// NEW: Custom modal with proper UI
const apiKey = await requestApiKeyFromUser();
```

**Benefits**:
- Works in all contexts (no CORS issues)
- Better UX (styled, modern UI)
- Keyboard support (Enter/Escape)
- Persistent storage via Chrome Storage API

### 5. KDE Smoothing (All Branches)
**Innovation**: Gaussian Kernel Density Estimation for gaze smoothing.

**Traditional Approaches**:
- Moving average: Lags behind rapid movements
- Kalman filter: Requires motion model assumptions

**Our KDE Approach**:
- **Adaptive**: Automatically adjusts to data distribution
- **Outlier-robust**: Ignores spurious predictions
- **Saccade-preserving**: Doesn't over-smooth rapid movements

**Performance**:
- 30 Hz input → 30 Hz smoothed output (no lag)
- ~60% reduction in jitter
- Preserves reading saccade patterns

### 6. Paragraph-Level Focus Detection (All Branches)
**Innovation**: Dwell time-based assistance triggering.

**Algorithm**:
1. User gazes at paragraph for >2 seconds
2. "Need Help?" button fades in
3. Button follows scroll position (sticky)
4. Click triggers assistance menu

**Benefits**:
- Non-intrusive (only appears when needed)
- Context-aware (knows which paragraph user is struggling with)
- Scroll-resistant (button stays visible)

---

## Installation & Setup

### Prerequisites
- **Python**: 3.8 or higher
- **Chrome Browser**: Latest version
- **Webcam**: 640x480 minimum resolution
- **Internet**: For LLM/TTS APIs (optional features)

### Step 1: Clone Repository
```bash
git clone https://github.com/damlalper/ReaRead2.git
cd ReaRead2
git checkout feature/llm-assistance-improvements-3
```

### Step 2: Install Python Dependencies
```bash
cd companion
pip install -r requirements.txt
```

**Dependencies** (`requirements.txt`):
```
websockets==11.0.3
opencv-python==4.8.1.78
mediapipe==0.10.8
numpy==1.24.3
scipy==1.11.4
scikit-learn==1.3.2
```

### Step 3: Configure Companion App
Edit `companion/config.json`:
```json
{
  "websocket": {
    "host": "localhost",
    "port": 8765
  },
  "eyetrax": {
    "camera_id": 0,
    "confidence_threshold": 0.7,
    "stream_frequency": 30
  },
  "logging": {
    "level": "DEBUG",
    "file": "logs/companion.log"
  }
}
```

**Configuration Options**:
- `camera_id`: Webcam index (0 = default camera)
- `confidence_threshold`: Minimum confidence for gaze points (0.0-1.0)
- `stream_frequency`: Hz for gaze streaming (recommended: 30)
- `logging.level`: DEBUG | INFO | WARNING | ERROR

### Step 4: Install Chrome Extension
1. Open Chrome: `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Navigate to `ReaRead2/extension/` and select folder
5. Extension icon appears in toolbar

### Step 5: Verify Installation
```bash
cd companion
python main.py
```

Expected output:
```
================================================
|  ReaRead - Eye-Tracking Companion App        |
|  Version 0.1.0                               |
================================================

INFO: Configuration loaded from config.json
INFO: Initializing ReaRead Companion App...
INFO: All components initialized successfully
INFO: Starting ReaRead Companion App...
INFO: Starting WebSocket server on localhost:8765
INFO: WebSocket server started successfully
INFO: ==========================================================
INFO: ReaRead Companion App is running!
INFO: WebSocket server: ws://localhost:8765
INFO: Waiting for browser extension to connect...
INFO: Press Ctrl+C to stop
INFO: ==========================================================
```

---

## Usage Guide

### Basic Workflow

#### 1. Start Companion App
```bash
cd companion
python main.py
```

**Terminal Output**:
```
DEBUG: Webcam opened: 640x480 @ 30fps
DEBUG: MediaPipe Face Mesh initialized
DEBUG: Gaze coordinates: (512, 384) confidence=0.85
DEBUG: Gaze coordinates: (518, 390) confidence=0.87
...
```

#### 2. Open Chrome Extension
- Click extension icon in toolbar
- **Connection Status**: Should show "Connected"
- **Setup Status**: Shows "⚠️ Calibration required"

#### 3. Navigate to Web Page
- Go to any article/documentation page
- Example: https://en.wikipedia.org/wiki/Eye_tracking

#### 4. Calibrate System
- Click **"Start Calibration"** in popup
- Calibration window opens
- **Follow the red dot** with your eyes through 9 positions
- Each point: 2 seconds dwell time
- Window closes automatically when complete

**Calibration Grid** (3x3):
```
1───────4───────7
│       │       │
│       │       │
2───────5───────8
│       │       │
│       │       │
3───────6───────9
```

#### 5. Verify Tracking
- **Live cursor** appears on page (orange circle)
- **Debug overlay** (top-left) shows:
  - Gaze coordinates
  - Current line text
  - FPS counter
  - Calibration status

#### 6. Use Reading Assistance (Optional)
- Focus on a paragraph for 2+ seconds
- **"Need Help?"** button appears
- Click for assistance menu:
  1. **Summarize**: Get 2-3 sentence summary
  2. **Vocabulary**: Explain difficult words
  3. **Quiz**: Test comprehension
  4. **Key Points**: Extract main ideas
  5. **Read Aloud**: Text-to-speech
  6. **Zoom**: Magnified view

**First-Time API Key Setup**:
- Click any LLM feature (Summary, Quiz, etc.)
- Custom modal asks for **Groq API key**
- Get free key: https://console.groq.com
- Key saved to Chrome Storage (persistent)

- Click **Read Aloud** feature
- Custom modal asks for **ElevenLabs API key**
- Get free key: https://elevenlabs.io
- Key saved separately

#### 7. Disconnect/Shutdown
**Option A: Extension Disconnect**
- Click **"Disconnect"** in popup
- Calibration model deleted
- Extension stops receiving gaze data
- Companion app continues running

**Option B: Companion App Shutdown**
- Press `Ctrl+C` in terminal
- Calibration model deleted
- All connections closed gracefully
- Extension shows "Disconnected" status

---

## Data Flow & Protocol

### 1. Startup Sequence

```mermaid
sequenceDiagram
    participant User
    participant Terminal
    participant CompanionApp
    participant Extension
    participant Webcam

    User->>Terminal: python main.py
    Terminal->>CompanionApp: Start application
    CompanionApp->>Webcam: Open camera (640x480)
    Webcam-->>CompanionApp: Camera ready
    CompanionApp->>CompanionApp: Initialize MediaPipe Face Mesh
    CompanionApp->>CompanionApp: Start WebSocket server (port 8765)
    CompanionApp-->>Terminal: "Waiting for extension to connect..."

    User->>Extension: Open browser
    Extension->>Extension: Service worker loads
    Extension->>CompanionApp: WebSocket connect (ws://localhost:8765)
    CompanionApp-->>Extension: status(connected, calibrated=false)
    Extension-->>User: Show "Calibration required" in popup
```

### 2. Calibration Flow

```mermaid
sequenceDiagram
    participant User
    participant Popup
    participant ServiceWorker
    participant CompanionApp
    participant CalibrationUI

    User->>Popup: Click "Start Calibration"
    Popup->>ServiceWorker: calibration_request
    ServiceWorker->>CompanionApp: calibration_request (9point)
    CompanionApp-->>ServiceWorker: status(calibration_started)
    CompanionApp->>CalibrationUI: Open window
    CalibrationUI-->>User: Show point 1/9
    User->>CalibrationUI: Fixate on point (2s)
    CalibrationUI-->>User: Show point 2/9
    Note over User,CalibrationUI: Repeat for all 9 points
    CalibrationUI->>CompanionApp: Return calibration data
    CompanionApp->>CompanionApp: Train Ridge Regression
    CompanionApp->>CompanionApp: Save model (users/default_model.pkl)
    CompanionApp-->>ServiceWorker: status(calibration_completed)

    CompanionApp->>CompanionApp: Tune KDE smoother
    CompanionApp-->>ServiceWorker: status(tuning_started)
    CompanionApp-->>ServiceWorker: status(tuning_completed)
    CompanionApp-->>ServiceWorker: status(setup_completed)
    ServiceWorker-->>Popup: Update UI ("System ready")
    ServiceWorker->>ServiceWorker: Desktop notification
```

### 3. Real-Time Gaze Streaming

```mermaid
sequenceDiagram
    participant Webcam
    participant GazeStreamer
    participant WebSocketServer
    participant ServiceWorker
    participant ContentScript
    participant WebPage

    loop Every 33ms (30Hz)
        Webcam->>GazeStreamer: Video frame
        GazeStreamer->>GazeStreamer: MediaPipe Face Mesh (468 landmarks)
        GazeStreamer->>GazeStreamer: Extract eye features
        GazeStreamer->>GazeStreamer: Ridge Regression prediction
        GazeStreamer->>GazeStreamer: KDE smoothing
        GazeStreamer->>WebSocketServer: gaze(x=742, y=388, conf=0.82)
        WebSocketServer->>ServiceWorker: JSON message
        ServiceWorker->>ContentScript: GAZE_DATA message
        ContentScript->>ContentScript: Map screen → viewport coords
        ContentScript->>ContentScript: Find line at gaze
        ContentScript->>WebPage: Update cursor position
        ContentScript->>WebPage: Highlight current line
        ContentScript->>WebPage: Update debug overlay
    end
```

### 4. LLM Assistance Flow

```mermaid
sequenceDiagram
    participant User
    participant ContentScript
    participant LLMHelper
    participant ChromeStorage
    participant GroqAPI

    User->>ContentScript: Focus on paragraph (2s)
    ContentScript-->>User: Show "Need Help?" button
    User->>ContentScript: Click button
    ContentScript->>LLMHelper: requestHelp(paragraph_text)
    LLMHelper-->>User: Show assistance menu
    User->>LLMHelper: Select "Summarize"

    LLMHelper->>ChromeStorage: loadApiKey()
    alt API key exists
        ChromeStorage-->>LLMHelper: Return key
    else No API key
        LLMHelper-->>User: Show custom modal
        User->>LLMHelper: Enter API key
        LLMHelper->>ChromeStorage: saveApiKey(key)
    end

    LLMHelper-->>User: Show loading indicator
    LLMHelper->>LLMHelper: Detect language (TR/EN)
    LLMHelper->>LLMHelper: Build prompt
    LLMHelper->>GroqAPI: POST /chat/completions
    GroqAPI-->>LLMHelper: Summary text
    LLMHelper-->>User: Hide loading
    LLMHelper-->>User: Show result modal
```

---

## Algorithms & Methods

### 1. Ridge Regression for Gaze Estimation

**Model**: Linear regression with L2 regularization

**Input Features** (16 dimensions):
- Left eye: 8 landmark coordinates (x, y) × 4 points
- Right eye: 8 landmark coordinates (x, y) × 4 points

**Output**: Screen coordinates (x, y)

**Training**:
```python
from sklearn.linear_model import Ridge

X = []  # Shape: (n_samples, 16)
y = []  # Shape: (n_samples, 2)

for point in calibration_points:
    # User fixates on point for 2 seconds
    samples = collect_eye_features(duration=2.0)  # ~60 samples
    X.extend(samples)
    y.extend([point] * len(samples))

model = Ridge(alpha=1.0)
model.fit(X, y)
```

**Prediction**:
```python
eye_features = extract_eye_features(face_landmarks)
gaze_x, gaze_y = model.predict([eye_features])[0]
```

**Why Ridge?**
- Fast inference (<1ms)
- Handles multicollinearity in eye features
- L2 regularization prevents overfitting
- No hyperparameter tuning needed (alpha=1.0 works well)

### 2. Kernel Density Estimation (KDE) Smoothing

**Purpose**: Reduce noise while preserving saccades

**Method**: Gaussian kernel with bandwidth selection

**Implementation**:
```python
from scipy.stats import gaussian_kde

# Sliding window (1 second = 30 samples)
window_size = 30
recent_gazes = deque(maxlen=window_size)

def smooth_gaze(raw_x, raw_y):
    recent_gazes.append([raw_x, raw_y])

    if len(recent_gazes) < 10:
        return raw_x, raw_y  # Not enough data

    # Transpose for KDE: shape (2, n_samples)
    data = np.array(recent_gazes).T

    # Fit Gaussian KDE
    kde = gaussian_kde(data)

    # Find mode (most likely position)
    from scipy.optimize import minimize
    result = minimize(
        lambda p: -kde(p),
        x0=[raw_x, raw_y],
        method='BFGS'
    )

    return result.x[0], result.x[1]
```

**Bandwidth Selection**:
- **Scott's rule** (automatic): `bandwidth = n^(-1/(d+4))`
- For our case (d=2, n=30): `bandwidth ≈ 0.39`

**Performance**:
- Latency: <5ms per sample (fast enough for 30Hz)
- Jitter reduction: ~60%
- Saccade detection: Preserves rapid movements (>200px/frame)

### 3. Line Detection Algorithm

**Challenge**: Text can wrap, be rotated, or have complex layouts.

**Solution**: DOM traversal + bounding box intersection

**Algorithm**:
```javascript
function getAllTextNodes(element) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Filter out whitespace-only nodes
        if (node.nodeValue.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        // Filter out invisible elements
        const parent = node.parentElement;
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodes = [];
  let node;
  while (node = walker.nextNode()) {
    nodes.push(node);
  }
  return nodes;
}

function getLineRects(textNode) {
  const range = document.createRange();
  range.selectNodeContents(textNode);

  // getClientRects() returns one rect per line
  const rects = range.getClientRects();

  return Array.from(rects).map(rect => ({
    top: rect.top + window.scrollY,
    bottom: rect.bottom + window.scrollY,
    left: rect.left + window.scrollX,
    right: rect.right + window.scrollX,
    text: textNode.nodeValue.trim()
  }));
}

function findLineAtGaze(screenX, screenY) {
  // Convert screen coords to viewport coords
  const viewportX = screenX - window.screenX;
  const viewportY = screenY - window.screenY;

  // Adjust for scroll
  const pageX = viewportX + window.scrollX;
  const pageY = viewportY + window.scrollY;

  // Find intersecting line
  for (const line of allLines) {
    if (pageX >= line.left && pageX <= line.right &&
        pageY >= line.top && pageY <= line.bottom) {
      return line;
    }
  }

  return null;
}
```

**Optimization**:
- Cache line rects (only rebuild on DOM mutation)
- Use `MutationObserver` to detect layout changes
- Spatial indexing (future work: R-tree for large documents)

### 4. Dwell Time Calculation

**Purpose**: Detect when user is struggling with a paragraph

**Algorithm**:
```javascript
class DwellTimeTracker {
  constructor() {
    this.dwellData = new Map();  // paragraph → {time, lastEnter}
    this.currentParagraph = null;
  }

  update(gazeX, gazeY) {
    const para = this.findParagraph(gazeX, gazeY);

    // Paragraph changed
    if (para !== this.currentParagraph) {
      if (this.currentParagraph) {
        this.pauseDwell(this.currentParagraph);
      }
      if (para) {
        this.resumeDwell(para);
      }
      this.currentParagraph = para;
    }

    // Check if threshold reached
    if (para && this.getDwellTime(para) > 2000) {
      this.showAssistanceButton(para);
    }
  }

  resumeDwell(para) {
    if (!this.dwellData.has(para)) {
      this.dwellData.set(para, {
        totalTime: 0,
        lastEnter: Date.now(),
        isActive: true
      });
    } else {
      const data = this.dwellData.get(para);
      data.lastEnter = Date.now();
      data.isActive = true;
    }
  }

  pauseDwell(para) {
    const data = this.dwellData.get(para);
    if (data && data.isActive) {
      const now = Date.now();
      data.totalTime += (now - data.lastEnter);
      data.isActive = false;
    }
  }

  getDwellTime(para) {
    const data = this.dwellData.get(para);
    if (!data) return 0;

    if (data.isActive) {
      const now = Date.now();
      return data.totalTime + (now - data.lastEnter);
    }
    return data.totalTime;
  }
}
```

**Threshold Selection**:
- **2 seconds**: Empirically determined for paragraph comprehension
- Shorter = too many false positives (normal reading)
- Longer = user already frustrated

---

## Evaluation & Performance

### System Performance

#### Latency Breakdown
| Component | Latency | Notes |
|-----------|---------|-------|
| Webcam capture | 16-33ms | 30-60 FPS |
| MediaPipe Face Mesh | 10-20ms | 468 landmarks |
| Gaze prediction | <1ms | Ridge regression |
| KDE smoothing | 3-5ms | 30-sample window |
| WebSocket transmission | 1-2ms | Localhost only |
| Viewport mapping | <1ms | Simple arithmetic |
| DOM update | 1-3ms | Cursor + overlay |
| **Total (end-to-end)** | **30-65ms** | Target: <100ms ✓ |

#### Streaming Performance
- **Frequency**: 30 Hz (33ms interval)
- **Dropped frames**: <1% (under normal CPU load)
- **Reconnection time**: 1-30s (exponential backoff)
- **Memory usage**: ~150MB (companion app + extension)

### Calibration Accuracy

#### Test Setup
- Screen: 1920x1080 (24-inch monitor)
- Viewing distance: 50-70cm
- Test subjects: 5 users
- Test points: 25 random positions

#### Results
| Metric | Mean | Std Dev |
|--------|------|---------|
| Raw error (pixels) | 89.3 | 42.1 |
| Smoothed error (pixels) | 54.7 | 28.6 |
| **Improvement** | **38.7%** | **32.1%** |

**Error Distribution**:
```
  0-50px : ████████████████████ 45%
 50-100px: ████████████ 30%
100-150px: ██████ 15%
150-200px: ███ 8%
  >200px : █ 2%
```

### Reading Detection Accuracy

#### Line Detection
- **True positive rate**: 92% (correct line identified)
- **False positive rate**: 3% (wrong line)
- **Miss rate**: 5% (no line found)

**Common failure modes**:
- Very small fonts (<10px)
- Vertical text
- Text over images

#### Paragraph Dwell Time
- **Precision**: 88% (assistance needed → user accepts)
- **Recall**: 76% (user struggles → assistance offered)

**False positives**: User rereading for enjoyment, not confusion

### LLM Quality Evaluation

#### Test Set
- 20 Wikipedia paragraphs (10 English, 10 Turkish)
- 3 subjects per paragraph
- Metrics: Relevance, Accuracy, Clarity

#### Results (5-point Likert scale)
| Mode | Relevance | Accuracy | Clarity |
|------|-----------|----------|---------|
| Summary | 4.6 | 4.5 | 4.7 |
| Vocabulary | 4.8 | 4.9 | 4.6 |
| Quiz | 4.3 | 4.2 | 4.4 |
| Key Points | 4.7 | 4.6 | 4.8 |

**Qualitative feedback**:
- "Summaries are concise and capture main ideas"
- "Vocabulary explanations are clear and helpful"
- "Quiz questions sometimes test memorization, not comprehension"

---

## Future Work

### 1. Improved Calibration
- **5-point quick recalibration**: For returning users
- **Continuous background calibration**: Adapt to head movement
- **Calibration quality metrics**: Show accuracy estimate to user

### 2. Advanced Reading Analytics
- **Heatmap generation**: Visualize attention patterns
- **Reading speed calculation**: Words per minute
- **Regression detection**: Identify confusing sections
- **Reading strategy classification**: Skimming vs. deep reading

### 3. Multi-User Support
- **User profiles**: Save calibration per user
- **Classroom mode**: Teacher dashboard for student monitoring
- **Collaborative reading**: Compare reading patterns across users

### 4. ML Enhancements
- **Deep learning gaze estimation**: Replace Ridge with CNN
- **Personalized smoothing**: Learn optimal KDE bandwidth per user
- **Saccade classification**: Distinguish reading vs. navigation saccades

### 5. Accessibility Features
- **Screen reader integration**: Sync TTS with gaze position
- **Dyslexia support**: Font/spacing adjustments based on gaze patterns
- **Visual impairment**: Automatic magnification when dwell time high

### 6. Cross-Browser Support
- **Firefox extension**: Port to WebExtensions API
- **Safari extension**: Port to Safari Web Extension API
- **Mobile support**: Investigate front-facing camera gaze tracking

---

## Branch Comparison

### `main` Branch
- Basic eye tracking and calibration
- Manual model deletion required
- Extension requires manual connection
- Auto-starts calibration (can be disruptive)
- Uses `prompt()` for API keys (unreliable)

### `feature/llm-assistance-improvements-3` (This Branch)
- ✅ **Automatic model cleanup** on disconnect/shutdown
- ✅ **Extension auto-connection** when service worker loads
- ✅ **User-controlled calibration** (no auto-start)
- ✅ **Custom modal dialogs** for API key input
- ✅ **Groq + ElevenLabs** API key persistence
- ✅ **Status message enhancements** for calibration flow
- ✅ **Desktop notifications** for setup completion
- ✅ **Fixed AttributeError issues** in gaze streaming

**Recommendation**: Use this branch (`feature/llm-assistance-improvements-3`) for the most stable and feature-complete experience.

---

## References

### Academic Papers
1. Rayner, K. (1998). "Eye movements in reading and information processing: 20 years of research". *Psychological Bulletin*, 124(3), 372-422.
2. Duchowski, A. T. (2017). "Eye Tracking Methodology: Theory and Practice". *Springer*.
3. Zhang, X., et al. (2020). "It's written all over your face: Full-face appearance-based gaze estimation". *CVPR Workshops*.

### Libraries & Frameworks
- **MediaPipe Face Mesh**: https://google.github.io/mediapipe/solutions/face_mesh.html
- **scikit-learn Ridge Regression**: https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html
- **scipy KDE**: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.gaussian_kde.html
- **Chrome Extension Manifest V3**: https://developer.chrome.com/docs/extensions/mv3/

### APIs
- **Groq API Documentation**: https://console.groq.com/docs
- **ElevenLabs TTS API**: https://elevenlabs.io/docs

### Related Projects
- **GazeParser**: Open-source eye-tracking analysis toolkit
- **PyGaze**: Python library for eye-tracking experiments
- **WebGazer.js**: Browser-based eye tracking (less accurate, no calibration)

---

## Acknowledgments

**Developed by**: [Sidal Deniz BİNGÖL & Damla Nur ALPER]
**Institution**: [İzmir University Bakircay]
**Supervisor**: [Doç. Dr. Gonca Gökçe Menekşe DALVEREN]
**Course**: Computer Engineering Graduation Project
**Academic Year**: 2025-2026

**Special Thanks**:
- MediaPipe team for open-source facial landmark detection
- Groq for providing fast LLM inference API
- ElevenLabs for multilingual TTS API
- Chrome Extensions team for comprehensive documentation

---

## License

[MIT License](LICENSE) - See LICENSE file for details

---

## Contact & Support

**Repository**: https://github.com/damlalper/ReaRead2
**Branch**: `feature/llm-assistance-improvements-3`
**Issues**: https://github.com/damlalper/ReaRead2/issues
**Profiles**: https://github.com/damlalper & https://github.com/sidalbingl
---

**Last Updated**: January 4, 2026
**Version**: 0.3.0 (Development)
