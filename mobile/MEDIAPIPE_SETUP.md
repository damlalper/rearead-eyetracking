# 📦 MediaPipe.js Setup Guide

## Why MediaPipe?

MediaPipe Face Mesh provides:
- **468 facial landmarks** + **iris tracking**
- **Runs in browser** (no companion app needed)
- **Cross-platform** (works on Android, iOS, desktop)
- **Lightweight** (~2MB WASM files)

---

## Setup Options

### Option 1: CDN (Recommended for Development)

Add to `manifest.json`:

```json
{
  "content_security_policy": "script-src 'self' https://cdn.jsdelivr.net; object-src 'self'"
}
```

Then in `mobile-content-script.js`, dynamically load:

```javascript
// Load MediaPipe scripts
function loadMediaPipe() {
  return new Promise((resolve, reject) => {
    // Load Face Mesh
    const faceMeshScript = document.createElement('script');
    faceMeshScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
    faceMeshScript.onload = () => {
      console.log('[MEDIAPIPE] Face Mesh loaded');

      // Load Camera Utils
      const cameraScript = document.createElement('script');
      cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
      cameraScript.onload = () => {
        console.log('[MEDIAPIPE] Camera Utils loaded');
        resolve();
      };
      cameraScript.onerror = reject;
      document.head.appendChild(cameraScript);
    };
    faceMeshScript.onerror = reject;
    document.head.appendChild(faceMeshScript);
  });
}

// Use it
await loadMediaPipe();
const tracker = new MobileGazeTracker();
await tracker.init();
```

**Pros:**
- Easy setup
- Always up-to-date
- No local files needed

**Cons:**
- Requires internet connection
- Slower first load
- Privacy concern (external CDN)

---

### Option 2: Self-Hosted (Recommended for Production)

Download MediaPipe files and include locally:

#### Step 1: Download Files

```bash
cd mobile/extension/libs/mediapipe

# Download Face Mesh
curl -o face_mesh.js https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js
curl -o face_mesh_solution_packed_assets_loader.js https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js
curl -o face_mesh_solution_simd_wasm_bin.js https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js

# Download WASM files
curl -o face_mesh_solution_packed_assets.data https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_packed_assets.data
curl -o face_mesh_solution_simd_wasm_bin.wasm https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm

# Download Camera Utils
curl -o camera_utils.js https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js
```

#### Step 2: Update manifest.json

```json
{
  "web_accessible_resources": [
    "libs/mediapipe/*.js",
    "libs/mediapipe/*.wasm",
    "libs/mediapipe/*.data"
  ]
}
```

#### Step 3: Load from Extension

In `mobile-gaze-tracker.js`:

```javascript
this.faceMesh = new FaceMesh({
  locateFile: (file) => {
    // Point to local files
    return chrome.runtime.getURL(`libs/mediapipe/${file}`);
  }
});
```

**Pros:**
- Works offline
- Faster load (cached)
- Privacy-friendly

**Cons:**
- Larger extension size (~5MB)
- Manual updates needed

---

## Lite vs Full Model

### Lite Model (Recommended for Mobile)

Use fewer landmarks for better performance:

```javascript
this.faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,  // Enable iris tracking
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  selfieMode: true        // Mirror camera
});
```

**Performance:**
- 20+ FPS on mid-range phones
- ~2MB model size
- Battery-friendly

### Full Model

For maximum accuracy (desktop/high-end phones):

```javascript
this.faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});
```

**Performance:**
- 15+ FPS on mid-range phones
- ~5MB model size
- Higher accuracy

---

## Testing MediaPipe Installation

Create a test page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>MediaPipe Test</title>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
</head>
<body>
  <video id="video" width="640" height="480" autoplay></video>
  <canvas id="canvas" width="640" height="480"></canvas>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults((results) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
          // Draw landmarks
          for (const landmark of landmarks) {
            ctx.beginPath();
            ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 2, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
          }

          // Draw iris centers (468 and 473)
          const leftIris = landmarks[468];
          const rightIris = landmarks[473];

          ctx.beginPath();
          ctx.arc(leftIris.x * canvas.width, leftIris.y * canvas.height, 5, 0, 2 * Math.PI);
          ctx.fillStyle = 'blue';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(rightIris.x * canvas.width, rightIris.y * canvas.height, 5, 0, 2 * Math.PI);
          ctx.fillStyle = 'blue';
          ctx.fill();
        }
      }

      console.log('FPS:', 1000 / (Date.now() - lastTime));
      lastTime = Date.now();
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
      },
      width: 640,
      height: 480
    });

    let lastTime = Date.now();
    camera.start();
  </script>
</body>
</html>
```

Open in Firefox Mobile and check:
- ✅ Camera starts
- ✅ Face detected (red dots on face)
- ✅ Iris tracked (blue dots on eyes)
- ✅ FPS > 15

---

## Performance Optimization

### 1. Reduce Resolution

```javascript
const camera = new Camera(video, {
  width: 480,  // Lower than 640
  height: 360,
  // ...
});
```

### 2. Skip Frames

```javascript
let frameCount = 0;

onFrame: async () => {
  frameCount++;
  if (frameCount % 2 === 0) {  // Process every 2nd frame
    await faceMesh.send({ image: video });
  }
}
```

### 3. Use WebWorker

Move MediaPipe processing to Web Worker to avoid blocking UI:

```javascript
// worker.js
importScripts('libs/mediapipe/face_mesh.js');

const faceMesh = new FaceMesh({ /* ... */ });

self.onmessage = async (e) => {
  const { image } = e.data;
  await faceMesh.send({ image });
};

faceMesh.onResults((results) => {
  self.postMessage({ results });
});
```

---

## Troubleshooting

### "FaceMesh is not defined"

MediaPipe scripts not loaded. Check:
1. CDN URL is correct
2. Content Security Policy allows external scripts
3. Scripts loaded before MobileGazeTracker

### WASM Loading Error

```
Error: Could not load wasm file
```

**Solution:**
- Ensure `web_accessible_resources` includes `*.wasm`
- Check file paths in `locateFile()`
- Verify CORS headers (for self-hosted)

### Low FPS (<10)

- Reduce camera resolution
- Skip frames
- Use Lite model
- Check battery level
- Close other apps

---

## File Size Comparison

| Setup | Extension Size | Load Time (4G) |
|-------|---------------|----------------|
| CDN | ~500KB | 2-3s |
| Self-Hosted Lite | ~2.5MB | <1s |
| Self-Hosted Full | ~5MB | <1s |

**Recommendation:** Use **Self-Hosted Lite** for production.

---

## Next Steps

1. Follow setup instructions above
2. Test with test page
3. Integrate into `mobile-gaze-tracker.js`
4. Deploy extension

---

**MediaPipe Documentation:**
- https://google.github.io/mediapipe/solutions/face_mesh.html
- https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh
