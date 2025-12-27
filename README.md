# ReaRead

Eye-tracking for better reading.

Understand how you read with webcam-based eye tracking and AI-powered analysis. No special hardware required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)

---

## Features

- **Real-time tracking** — Track your gaze at 30 FPS using your webcam. Powered by MediaPipe FaceMesh with 468 facial landmarks.
- **AI assistance** — Get instant text summaries and simplifications using Llama 3.3 70B language model.
- **Reading analytics** — Comprehensive metrics including WPM, fixation patterns, and regression analysis.
- **Fixation detection** — I-DT algorithm identifies exactly which words and paragraphs you focus on.
- **Difficulty heatmaps** — Visual overlay showing which parts of text were challenging based on your fixations.
- **Signal processing** — KDE smoothing and auto-tuned Kalman filters for accurate, jitter-free tracking.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User Device                         │
│                                                         │
│  ┌──────────────────┐         ┌──────────────────────┐ │
│  │  Companion App   │◄───────►│  Chrome Extension    │ │
│  │  (Python)        │  WS     │  (JavaScript)        │ │
│  │                  │  8765   │                      │ │
│  │  • EyeTrax      │         │  • Reading Analysis  │ │
│  │  • Calibration  │         │  • Heatmaps          │ │
│  │  • WebSocket    │         │  • LLM Integration   │ │
│  └─────────┬────────┘         └──────────┬───────────┘ │
│            │                             │             │
│        ┌───▼────┐                  ┌─────▼──────┐      │
│        │ Webcam │                  │ Web Pages  │      │
│        └────────┘                  └────────────┘      │
└─────────────────────────────────────────────────────────┘
```

**Technology Stack:**
- MediaPipe FaceMesh (468-point facial landmarks)
- Ridge Regression (ML-based gaze estimation)
- KDE Smoothing (jitter-free tracking)
- Llama 3.3 70B (AI text assistance)
- WebSocket (real-time streaming)
- I-DT Algorithm (fixation detection)

---

## Quick Start

### Prerequisites

- Python 3.11+
- Chrome browser
- Webcam

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/damlalper/rearead-eyetracking.git
cd rearead-eyetracking
```

**2. Install companion app dependencies**

```bash
cd companion
pip install -r requirements.txt
```

**3. Install Chrome extension**

- Open Chrome and go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `extension/` folder

**4. Run the companion app**

```bash
python main.py
```

**5. Start using ReaRead**

- Click the ReaRead extension icon in Chrome
- Follow the calibration wizard (9 points, 20 seconds)
- Start reading any webpage

---

## Usage

### Calibration

On first run, ReaRead will automatically guide you through calibration:

1. Look at 9 points on your screen
2. Hold your gaze for 2 seconds at each point
3. System builds your personalized gaze model
4. Auto-tunes Kalman filters for optimal accuracy

### Reading Analysis

While reading:

- Gaze cursor shows where you're looking in real-time
- Fixation points are automatically detected
- Difficulty heatmap builds up as you read
- Click on any paragraph to get AI summary/simplification

### Keyboard Shortcuts

- `Ctrl+Shift+G` — Toggle gaze cursor
- `Ctrl+Shift+H` — Toggle heatmap
- `Ctrl+Shift+R` — Reset analytics

---

## Configuration

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
  "calibration": {
    "points": 9,
    "duration_per_point": 2
  },
  "kalman": {
    "enabled": true,
    "auto_tune_after_calibration": false
  }
}
```

---

## Project Structure

```
ReaRead2/
├── companion/              # Python companion app
│   ├── main.py            # Entry point
│   ├── websocket_server.py # WebSocket server
│   ├── gaze_streamer.py   # Eye tracking logic
│   ├── config.json        # Configuration
│   └── users/             # User calibration models
│
├── extension/             # Chrome extension
│   ├── manifest.json      # Extension manifest
│   ├── popup/             # Extension popup UI
│   ├── content/           # Content scripts
│   ├── background/        # Service worker
│   └── icons/             # Extension icons
│
└── docs/                  # GitHub Pages website
    └── index.html
```

---

## How It Works

### Eye Tracking Pipeline

1. **Face Detection** — MediaPipe detects 468 facial landmarks from webcam feed
2. **Gaze Estimation** — Ridge regression model predicts gaze coordinates from landmarks
3. **Signal Processing** — KDE smoothing + Kalman filtering removes jitter
4. **Coordinate Mapping** — Maps camera coordinates to screen coordinates
5. **WebSocket Streaming** — Sends gaze data to browser extension at 30 FPS

### Reading Behavior Analysis

1. **Fixation Detection** — I-DT algorithm identifies stable gaze points (dispersion < threshold)
2. **Word Mapping** — Maps fixations to DOM elements using `caretRangeFromPoint()`
3. **Metrics Calculation** — Computes WPM, fixation duration, saccade length, regressions
4. **Heatmap Generation** — Visualizes reading difficulty based on fixation patterns

### AI Text Assistance

1. **Paragraph Selection** — User clicks or system detects difficult paragraph
2. **Context Extraction** — Extracts paragraph text from DOM
3. **LLM Processing** — Sends to Llama 3.3 70B via Groq API
4. **Response Display** — Shows summary/simplification in overlay

---

## Research & Methodology

### Gaze Estimation

- **Method:** Ridge Regression with L2 regularization
- **Features:** 468 facial landmarks (x, y coordinates)
- **Accuracy:** ~2-3 degrees visual angle (after calibration)
- **Calibration:** 9-point on-screen calibration

### Fixation Detection

- **Algorithm:** I-DT (Dispersion-Threshold Identification)
- **Dispersion threshold:** 1.5 degrees visual angle
- **Minimum duration:** 100ms
- **Reference:** Salvucci & Goldberg (2000)

### Signal Processing

- **Smoothing:** Kernel Density Estimation with Gaussian kernel
- **Filtering:** Auto-tuned Kalman filter (process noise: 0.01, measurement noise: adaptive)
- **Sampling rate:** 30 Hz

---

## Development

### Running Tests

```bash
cd companion
pytest tests/
```

### Building for Production

```bash
# Package extension
cd extension
zip -r ../rearead-extension.zip .

# Create standalone companion app
cd companion
pyinstaller --onefile main.py
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Troubleshooting

### Extension can't connect to companion app

- Ensure companion app is running: `python companion/main.py`
- Check WebSocket port: default is `8765`
- Verify firewall isn't blocking localhost connections

### Poor tracking accuracy

- Recalibrate: Click "Start Calibration" in popup
- Improve lighting conditions (avoid backlighting)
- Position face 50-70cm from webcam
- Ensure webcam is at eye level

### Calibration fails

- Check webcam permissions in Chrome
- Verify webcam works in other apps
- Check `companion/logs/companion.log` for errors

---

## Performance

- **Gaze latency:** <50ms end-to-end
- **CPU usage:** ~5-10% (companion app)
- **Memory usage:** ~200MB (companion app)
- **Network:** ~30 KB/s (WebSocket traffic)

---

## Privacy

- All processing happens **locally on your device**
- No data is sent to external servers (except AI requests to Groq)
- Webcam feed is **never recorded or stored**
- Calibration models are stored locally in `companion/users/`
- Reading data is ephemeral (cleared on page reload)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [EyeTrax](https://github.com/paul-ruban/eyetrax) for the gaze estimation foundation
- [MediaPipe](https://mediapipe.dev/) for facial landmark detection
- [Groq](https://groq.com/) for fast LLM inference

---

## Citation

If you use ReaRead in your research, please cite:

```bibtex
@misc{rearead2025,
  title={ReaRead: Webcam-Based Eye Tracking for Reading Behavior Analysis},
  author={Your Name},
  year={2025},
  publisher={GitHub},
  url={https://github.com/damlalper/rearead-eyetracking}
}
```

---

## Contact

- **Website:** https://damlalper.github.io/rearead-eyetracking/
- **GitHub:** https://github.com/damlalper/rearead-eyetracking
- **Issues:** https://github.com/damlalper/rearead-eyetracking/issues

---

**Developed as a Computer Engineering Graduation Project**
