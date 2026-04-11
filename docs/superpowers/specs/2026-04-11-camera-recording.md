d# Camera Recording — Design Spec

**Goal:** Replace the single drop zone on the Analyze tab with two side-by-side cards (Record | Upload). On mobile, Record delegates to the OS camera. On desktop, Record opens an inline live preview with a record/stop button. A permission-denied state shows browser-specific unblock instructions inline.

---

## Layout — Analyze Tab Entry

The current `label#video-drop-zone` + `input#video-input` is replaced by two side-by-side cards:

```
┌──────────────────┬──────────────────┐
│  📷              │  📁              │
│  Record          │  Upload          │
│  Use camera      │  From library    │
│  (orange border) │  (neutral border)│
└──────────────────┴──────────────────┘
```

- **Record card:** `id="record-card"`, orange border (`var(--accent)`), icon 📷
- **Upload card:** `id="upload-card"`, neutral border, icon 📁 — clicking it triggers a hidden `<input id="video-input" type="file" accept="video/*">` (no `capture` attribute — desktop file picker only)
- Below the cards: the existing video preview wrap, exercise select, weight controls, and Analyze button — all unchanged

---

## Device Detection

```js
// src/ui/camera-recorder.js
export function isMobile() {
  return navigator.maxTouchPoints > 0;
}
```

Used in `analyze.js` to branch when the user taps Record.

---

## Mobile Path — Record card tap

On mobile (`isMobile() === true`), tapping Record triggers a separate hidden file input with `capture`:

```html
<input id="video-input-capture" type="file" accept="video/*" capture="environment" style="display:none">
```

This opens the OS camera app. The returned file is handled identically to the Upload path (preview, exercise detection, enable Analyze button).

Immediately after triggering the file input, show a dismissible hint below the two cards:

```
📱 If the camera didn't open, check
   Settings → Privacy → Camera and
   allow access for your browser.    ×
```

The hint auto-hides after 6 seconds OR when the `change` event fires on the input (meaning the camera opened successfully). The `×` button dismisses it immediately. It is rendered as a small muted card — not a red error state.

---

## Desktop Path — Inline camera preview

On desktop, tapping Record calls `startCameraPreview()`. The two-card area (`#input-mode-wrap`) is replaced with:

```
┌─────────────────────────────────────┐
│                                     │
│   [live <video> element — muted]    │  ← camera feed
│                                     │
│              ●  (red circle)        │  ← record button
│         0:00 timer (top-right)      │
└─────────────────────────────────────┘
  [× Cancel]
```

States:
1. **Previewing** — camera feed visible, red ● button, timer hidden, Cancel link
2. **Recording** — ● turns to ■ Stop, timer counting up, red dot blinking in corner
3. **Stopped** — stream closed, recorded Blob passed to the same handler as Upload; preview wrap appears, Analyze button enables

Time limit: 60 seconds. At 60s, recording stops automatically (same as manual stop).

---

## Permission Denied State

If `getUserMedia` throws (any error), an inline card appears **below the two choice cards** (the cards remain visible):

```
┌──────────────────────────────────────┐
│ 🚫 Camera blocked in Chrome          │
│                                      │
│ 1. Click 🔒 in the address bar       │
│ 2. Set Camera → Allow                │
│ 3. Reload the page                   │
│                                      │
│ [Try again]   [Upload instead]       │
└──────────────────────────────────────┘
```

- **"Try again"** — removes the error card, then re-calls `startCameraPreview(inputModeWrap)`
- **"Upload instead"** — removes the error card, then programmatically clicks `#video-input`

Browser detection via `navigator.userAgent`. Instructions per browser:

| Browser | Detection | Step 1 | Step 2 | Step 3 |
|---|---|---|---|---|
| Chrome | `/Chrome/.test(ua) && !/Edg/.test(ua)` | Click 🔒 in the address bar | Set Camera → Allow | Reload the page |
| Edge | `/Edg/.test(ua)` | Click 🔒 in the address bar | Set Camera → Allow | Reload the page |
| Firefox | `/Firefox/.test(ua)` | Click the camera icon in the address bar | Choose "Allow" | — |
| Safari (desktop) | `/Safari/.test(ua) && !/Chrome/.test(ua)` | Open System Settings → Privacy & Security → Camera | Enable for your browser | Reload the page |
| Generic fallback | (none matched) | Open browser settings | Find Camera permissions | Allow this site |

---

## Architecture

### New file: `src/ui/camera-recorder.js`

Exports:

```js
export function isMobile()
// Returns true if navigator.maxTouchPoints > 0

export function getPermissionInstructions()
// Returns { browser: string, steps: string[] }
// browser = display name e.g. 'Chrome'
// steps = array of instruction strings (1–3 items)

export async function startCameraPreview(container)
// Replaces container.innerHTML with the live preview UI.
// Calls getUserMedia({ video: true, audio: false }).
// Returns a recorder object { start(), stop() → Promise<Blob> }
// Throws if permission denied — caller catches and shows error card.

export function stopCameraStream()
// Stops all tracks on the active stream and clears it.
// Safe to call if no stream is active.
```

Internal state: one module-level `let stream = null` tracks the active `MediaStream` so `stopCameraStream()` can close it from outside (e.g., when the user switches tabs).

`MediaRecorder` is used with `video/webm` (Chrome/Firefox) or `video/mp4` (Safari). The recorded chunks are collected in an array and assembled into a `Blob` on stop.

### Modified file: `src/tabs/analyze.js`

`renderAnalyze()` changes:
- Replace `label#video-drop-zone` + `input#video-input` with:
  - `div#input-mode-wrap` containing the two cards
  - `input#video-input` (no capture) for Upload
  - `input#video-input-capture` (with capture) for mobile Record

`attachAnalyzeListeners()` changes:
- Import `{ isMobile, startCameraPreview, stopCameraStream, getPermissionInstructions }` from `../ui/camera-recorder.js`
- Record card click handler:
  - If mobile: click `#video-input-capture`
  - If desktop: call `startCameraPreview(inputModeWrap)`, catch errors → render permission error card
- Upload card click handler: click `#video-input`
- Both file inputs share the same `change` handler (existing logic — preview, exercise detection, enable Analyze)
- `stopCameraStream()` called when Analyze button is clicked (before analysis starts)

### Modified file: `src/app.js`

Import `stopCameraStream` and call it at the top of `switchTab` (alongside the existing `stopAnimation()` call), so switching away from Analyze while the camera is active closes the stream.

---

## What Does NOT Change

- Exercise select, weight controls, Analyze button — untouched
- `analysis-runner.js`, `detector.js`, all engine files — untouched
- The video preview element (`#video-preview`, `#video-preview-wrap`) — same IDs, same behavior
- `attachResultsListeners` — untouched
- Test files — no changes (camera/UI not unit-tested)

---

## Edge Cases

- **Permission prompt dismissed (not denied):** `getUserMedia` throws `NotAllowedError` — same handling as denied.
- **No camera hardware:** throws `NotFoundError` — show generic "No camera found. Use Upload instead." message (no browser instructions).
- **Tab switch while recording:** `switchTab` calls `stopCameraStream()` which stops the MediaRecorder and releases the stream. The recording is discarded (no partial file passed to analyze).
- **Safari MIME type:** `MediaRecorder.isTypeSupported('video/webm')` → false on Safari. Fall back to `video/mp4;codecs=avc1` or empty string (browser picks). The resulting Blob MIME type is passed to `new File([blob], 'recording.mp4', { type: mimeType })` so the analysis pipeline receives a proper File object.
- **60-second limit:** `setTimeout` fires `recorder.stop()` at 60000ms. The timer UI counts up and the stop button becomes available immediately (user can stop early).
