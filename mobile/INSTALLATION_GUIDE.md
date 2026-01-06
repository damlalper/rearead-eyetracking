# 📱 ReaRead Mobile - Installation Guide

## Firefox Mobile Installation (Android)

### Prerequisites
- Android device (5.0 or higher)
- Firefox Mobile browser (79.0 or higher)
- Front-facing camera

---

## Step 1: Install Firefox Mobile

If you don't have Firefox Mobile installed:

1. Open **Google Play Store**
2. Search for "**Firefox Browser**"
3. Install and open Firefox

---

## Step 2: Enable Custom Extensions

Firefox Mobile allows custom extension installation:

1. Open **Firefox Mobile**
2. Tap the **3-dot menu** (⋮) in the top-right
3. Tap **Settings**
4. Scroll down to **Advanced**
5. Tap **About Firefox**
6. Tap the **Firefox logo 5 times** (this enables debug mode)
7. Go back to Settings
8. You should now see **"Custom Add-on Collection"**

---

## Step 3: Add ReaRead Extension

### Option A: From Custom Collection (Recommended)

1. In **Settings > Custom Add-on Collection**:
   - User ID: `rearead-mobile`
   - Collection Name: `rearead`
   - Tap **OK**

2. Go to **Add-ons** from the menu
3. Find **ReaRead Mobile**
4. Tap **+ Add to Firefox**

### Option B: Temporary Installation (For Development)

1. Connect your Android device to your computer via USB
2. Enable **USB Debugging** on your Android device:
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable "USB Debugging"

3. On your computer:
   - Open Firefox Desktop
   - Type `about:debugging` in the address bar
   - Click **"Enable USB Debugging"**
   - Select your device from the list

4. On your device (Firefox Mobile):
   - A prompt will appear → Tap **"Allow"**

5. On your computer:
   - Click **"Load Temporary Add-on"**
   - Navigate to `mobile/extension/manifest.json`
   - Click **Open**

6. The extension is now installed on your mobile Firefox!

---

## Step 4: First Launch

1. Open **any webpage** in Firefox Mobile (e.g., Wikipedia)

2. You'll see a **floating prompt**:
   ```
   📖 ReaRead Focus Mode
   Tap to start eye tracking
   ```

3. Tap the prompt

4. **Grant camera permission** when asked

5. **Calibration is not needed!** The system will start tracking immediately.

6. You'll see:
   - Camera preview (small video in corner)
   - Gaze cursor (red dot following your eyes)
   - Get Help button (when you struggle with a paragraph)

---

## Usage

### Reading a Page

1. Open any article or webpage
2. Start Focus Mode (tap the prompt or extension icon)
3. Read normally
4. The system will:
   - Track which paragraphs you're reading
   - Highlight difficult sections
   - Offer "Get Help" when you dwell too long

### Get Help Button

When you struggle with a paragraph:
- **Double blink** to trigger Get Help (hands-free)
- **OR tap** the Get Help button

Choose from:
- **Explain**: Simple explanation
- **Summarize**: Key points
- **Translate**: Convert to another language
- **Read Aloud**: Listen via TTS

### Gesture Controls

- **Double blink**: Open Get Help menu
- **Head tilt left/right**: Navigate menu options
- **Head tilt up**: Close menu

---

## Troubleshooting

### Camera Permission Denied

If you denied camera permission:

1. Tap the **lock icon** in the address bar
2. Find **ReaRead Mobile**
3. Change **Camera** to **Allow**
4. Refresh the page

OR use **Scroll Tracking** fallback (automatic)

### Extension Not Showing

1. Make sure you're using **Firefox Mobile** (not Chrome)
2. Check Firefox version: Settings → About Firefox (must be 79+)
3. Restart Firefox Mobile
4. Re-install the extension

### Poor Tracking Accuracy

- **Lighting**: Ensure good lighting on your face
- **Distance**: Hold phone 30-50cm from your face
- **Angle**: Keep phone upright (portrait mode)
- **Battery**: Low battery reduces FPS (charge your device)

### Performance Issues

The system adapts FPS based on battery:
- **High battery (>50%)**: 20 FPS
- **Medium (20-50%)**: 15 FPS
- **Low (<20%)**: 10 FPS
- **Charging**: 20 FPS

---

## Privacy

- **All processing happens locally** on your device
- **No data is sent to servers**
- **Camera feed is not recorded**
- **Analytics are stored locally** (chrome.storage.local)

---

## Uninstallation

1. Firefox Mobile → **Menu** (⋮)
2. **Add-ons**
3. Find **ReaRead Mobile**
4. Tap **Remove**

All local data will be deleted automatically.

---

## Support

- GitHub Issues: https://github.com/damlalper/rearead-eyetracking/issues
- Documentation: mobile/README.md

---

**Enjoy reading with ReaRead Mobile!** 📖👁️
