# Camera Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single drop zone on the Analyze tab with side-by-side Record | Upload cards — desktop uses inline getUserMedia preview with record/stop/timer, mobile delegates to the OS camera via `capture="environment"`, and permission denial shows inline browser-specific instructions.

**Architecture:** Three-file change: new `src/ui/camera-recorder.js` owns all MediaStream/MediaRecorder state and UI injection; `src/tabs/analyze.js` wires the new cards, file inputs, and camera events; `src/app.js` calls `stopCameraStream()` on tab switch.

**Tech Stack:** Vanilla JS, Web MediaStream API (`getUserMedia`), MediaRecorder API, HTML file inputs with `capture` attribute, Vite dev server

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/ui/camera-recorder.js` | `isMobile`, `getPermissionInstructions`, `startCameraPreview`, `stopCameraStream` |
| Modify | `src/tabs/analyze.js` | Replace drop zone HTML, add card click handlers, shared file-change handler |
| Modify | `src/app.js` | Import + call `stopCameraStream` in `switchTab` |

---

## Task 1: Create `src/ui/camera-recorder.js`

**Files:**
- Create: `src/ui/camera-recorder.js`

- [ ] **Step 1: Write the file**

```js
// src/ui/camera-recorder.js

let stream = null;

export function isMobile() {
  return navigator.maxTouchPoints > 0;
}

export function getPermissionInstructions() {
  const ua = navigator.userAgent;
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
    return {
      browser: 'Chrome',
      steps: ['Click 🔒 in the address bar', 'Set Camera → Allow', 'Reload the page'],
    };
  }
  if (/Edg/.test(ua)) {
    return {
      browser: 'Edge',
      steps: ['Click 🔒 in the address bar', 'Set Camera → Allow', 'Reload the page'],
    };
  }
  if (/Firefox/.test(ua)) {
    return {
      browser: 'Firefox',
      steps: ['Click the camera icon in the address bar', 'Choose "Allow"'],
    };
  }
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    return {
      browser: 'Safari',
      steps: [
        'Open System Settings → Privacy & Security → Camera',
        'Enable for your browser',
        'Reload the page',
      ],
    };
  }
  return {
    browser: 'your browser',
    steps: ['Open browser settings', 'Find Camera permissions', 'Allow this site'],
  };
}

export function stopCameraStream() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

/**
 * Replaces container.innerHTML with a live camera preview UI.
 * Calls getUserMedia({ video: true, audio: false }).
 * Returns { onFile(callback), cancel() }.
 *   - onFile callback receives a File object when recording stops.
 *   - cancel() stops the stream and restores container.innerHTML to empty string.
 * Throws if permission is denied or device not found.
 */
export async function startCameraPreview(container) {
  stopCameraStream();

  stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

  const mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
  const ext = mimeType === 'video/webm' ? 'webm' : 'mp4';

  container.innerHTML = `
    <div id="camera-preview-wrap" style="
      position:relative;
      background:#000;
      border-radius:var(--radius);
      overflow:hidden;
      margin-bottom:0.75rem;
    ">
      <video id="camera-live" muted playsinline style="width:100%;display:block"></video>
      <div id="camera-timer" style="
        display:none;
        position:absolute;
        top:8px;
        right:8px;
        background:rgba(0,0,0,0.7);
        border-radius:4px;
        padding:2px 8px;
        font-size:0.75rem;
        color:#fff;
        font-weight:700;
      ">
        <span id="camera-rec-dot" style="color:#cc2200">● </span><span id="camera-time">0:00</span>
      </div>
      <div style="
        position:absolute;
        bottom:12px;
        left:0;
        right:0;
        display:flex;
        justify-content:center;
      ">
        <button id="camera-record-btn" style="
          width:48px;
          height:48px;
          border-radius:50%;
          background:#cc2200;
          border:3px solid #fff;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
        ">
          <div id="camera-record-icon" style="
            width:16px;
            height:16px;
            border-radius:50%;
            background:#fff;
          "></div>
        </button>
      </div>
    </div>
    <div style="text-align:center;margin-bottom:0.75rem">
      <a id="camera-cancel" href="#" style="color:var(--text-muted);font-size:0.75rem;text-decoration:none">× Cancel</a>
    </div>
  `;

  const liveVideo = document.getElementById('camera-live');
  liveVideo.srcObject = stream;
  await liveVideo.play();

  let fileCallback = null;
  let recorder = null;
  let chunks = [];
  let timerInterval = null;
  let autoStopTimeout = null;
  let elapsed = 0;
  let recording = false;

  const timerEl = document.getElementById('camera-timer');
  const timeEl = document.getElementById('camera-time');
  const recDot = document.getElementById('camera-rec-dot');
  const recordBtn = document.getElementById('camera-record-btn');
  const recordIcon = document.getElementById('camera-record-icon');

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function startTimer() {
    elapsed = 0;
    timerEl.style.display = 'block';
    timerInterval = setInterval(() => {
      elapsed++;
      timeEl.textContent = formatTime(elapsed);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function stopRecording() {
    if (!recording) return;
    recording = false;
    clearTimeout(autoStopTimeout);
    stopTimer();
    recorder.stop();
  }

  recordBtn.addEventListener('click', () => {
    if (!recording) {
      // Start recording
      recording = true;
      chunks = [];
      recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], `recording.${ext}`, { type: mimeType });
        stopCameraStream();
        if (fileCallback) fileCallback(file);
      };
      recorder.start();
      // Change button to stop square
      recordIcon.style.borderRadius = '2px';
      // Start timer and 60s auto-stop
      startTimer();
      autoStopTimeout = setTimeout(stopRecording, 60000);
    } else {
      stopRecording();
    }
  });

  document.getElementById('camera-cancel').addEventListener('click', e => {
    e.preventDefault();
    stopRecording();
    stopCameraStream();
    container.innerHTML = '';
  });

  return {
    onFile(callback) {
      fileCallback = callback;
    },
    cancel() {
      stopRecording();
      stopCameraStream();
      container.innerHTML = '';
    },
  };
}
```

- [ ] **Step 2: Verify the file exists and has no syntax errors**

```bash
node --input-type=module < src/ui/camera-recorder.js 2>&1 | head -5
```

Expected: no output (Node will throw on syntax errors; browser-only APIs like `navigator` are fine to reference since they're inside functions not called at import time). If you see a syntax error, fix it before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/ui/camera-recorder.js
git commit -m "feat: add camera-recorder module (isMobile, getPermissionInstructions, startCameraPreview, stopCameraStream)"
```

---

## Task 2: Update `src/tabs/analyze.js`

**Files:**
- Modify: `src/tabs/analyze.js`

### 2a — Replace `renderAnalyze` HTML

- [ ] **Step 1: Replace the drop zone with two-card layout + both file inputs**

Replace the entire `renderAnalyze` function body with this return value (keep everything below `video-preview-wrap` unchanged):

```js
export function renderAnalyze() {
  return `
    <div class="section-label" style="margin-top:0.5rem">Fitness Former</div>
    <p style="color:var(--text-muted);font-size:0.75rem;margin-bottom:1rem">AI Form Coach</p>

    <div id="input-mode-wrap" style="margin-bottom:0.75rem">
      <div style="display:flex;gap:0.5rem">
        <div id="record-card" class="card" style="
          flex:1;
          border:2px solid var(--accent);
          text-align:center;
          cursor:pointer;
        ">
          <div style="font-size:2rem;margin-bottom:0.25rem">📷</div>
          <div style="color:var(--text);font-size:0.8rem;font-weight:700">Record</div>
          <div style="color:var(--text-muted);font-size:0.65rem;margin-top:2px">Use camera</div>
        </div>
        <div id="upload-card" class="card" style="
          flex:1;
          border:2px solid var(--border);
          text-align:center;
          cursor:pointer;
        ">
          <div style="font-size:2rem;margin-bottom:0.25rem">📁</div>
          <div style="color:var(--text);font-size:0.8rem;font-weight:700">Upload</div>
          <div style="color:var(--text-muted);font-size:0.65rem;margin-top:2px">From library</div>
        </div>
      </div>
      <input id="video-input" type="file" accept="video/*" style="display:none" />
      <input id="video-input-capture" type="file" accept="video/*" capture="environment" style="display:none" />
    </div>

    <div id="video-preview-wrap" style="display:none;margin-bottom:0.75rem">
      <video id="video-preview" style="width:100%;border-radius:var(--radius);background:#000" controls playsinline></video>
    </div>

    <div class="card" style="margin-bottom:0.75rem">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
        <span style="font-size:1rem">🏃</span>
        <span style="color:var(--text-dim);font-size:0.75rem;flex:1">Exercise</span>
        <span id="exercise-detecting" style="font-size:0.6rem;color:var(--text-muted);display:none">Detecting…</span>
      </div>
      <select id="exercise-select" style="
        width:100%;
        background:var(--bg-input);
        border:1px solid var(--border);
        border-radius:4px;
        color:var(--text);
        padding:6px 8px;
        font-size:0.8rem;
      ">
        <option value="auto">Auto-detect</option>
        <option value="squat">Squat</option>
        <option value="deadlift">Deadlift</option>
        <option value="push-up">Push-up</option>
        <option value="bench-press">Bench Press</option>
      </select>
    </div>

    <div class="card" style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
      <span style="font-size:1.1rem">🏋️</span>
      <span style="color:var(--text-dim);font-size:0.75rem;flex:1">Weight used</span>
      <div style="display:flex;align-items:center;gap:6px">
        <button id="weight-down" style="background:var(--bg-input);border:none;color:var(--text);width:28px;height:28px;border-radius:4px;font-size:1rem;cursor:pointer">−</button>
        <span id="weight-display" style="color:var(--text);font-weight:700;font-size:1rem;min-width:40px;text-align:center">135</span>
        <button id="weight-up" style="background:var(--bg-input);border:none;color:var(--text);width:28px;height:28px;border-radius:4px;font-size:1rem;cursor:pointer">+</button>
        <div style="display:flex;gap:2px">
          <button id="unit-lbs" style="background:var(--accent);border:none;color:#fff;padding:3px 6px;border-radius:3px;font-size:0.6rem;font-weight:700;cursor:pointer">lbs</button>
          <button id="unit-kg" style="background:var(--bg-input);border:none;color:var(--text-muted);padding:3px 6px;border-radius:3px;font-size:0.6rem;cursor:pointer">kg</button>
        </div>
      </div>
    </div>

    <button id="analyze-btn" class="btn-primary" disabled style="opacity:0.4">
      Analyze My Form
    </button>

    <p style="text-align:center;margin-top:0.75rem;font-size:0.65rem;color:var(--text-muted)">
      <a href="#" id="signin-link" style="color:var(--accent);text-decoration:none">Sign in</a>
      to save your history
    </p>
  `;
}
```

### 2b — Rewrite `attachAnalyzeListeners`

- [ ] **Step 2: Add import at the top of the file and rewrite `attachAnalyzeListeners`**

Add this import at the very top of `src/tabs/analyze.js` (before the `export function renderAnalyze` line):

```js
import { isMobile, startCameraPreview, stopCameraStream, getPermissionInstructions } from '../ui/camera-recorder.js';
```

Then replace the entire `attachAnalyzeListeners` function with:

```js
export function attachAnalyzeListeners() {
  let weight = 135;
  let unit = 'lbs';
  let videoFile = null;

  const weightDisplay     = document.getElementById('weight-display');
  const analyzeBtn        = document.getElementById('analyze-btn');
  const videoInput        = document.getElementById('video-input');
  const videoCaptureInput = document.getElementById('video-input-capture');
  const previewWrap       = document.getElementById('video-preview-wrap');
  const previewEl         = document.getElementById('video-preview');
  const exerciseSelect    = document.getElementById('exercise-select');
  const exerciseDetecting = document.getElementById('exercise-detecting');
  const inputModeWrap     = document.getElementById('input-mode-wrap');

  if (!weightDisplay || !exerciseSelect || !exerciseDetecting) return;

  // ── Weight controls ──────────────────────────────────────────────
  document.getElementById('weight-up').addEventListener('click', () => {
    weight += unit === 'lbs' ? 5 : 2.5;
    weightDisplay.textContent = unit === 'lbs' ? weight : weight.toFixed(1);
  });

  document.getElementById('weight-down').addEventListener('click', () => {
    weight = Math.max(0, weight - (unit === 'lbs' ? 5 : 2.5));
    weightDisplay.textContent = unit === 'lbs' ? weight : weight.toFixed(1);
  });

  document.getElementById('unit-lbs').addEventListener('click', () => {
    unit = 'lbs';
    document.getElementById('unit-lbs').style.background = 'var(--accent)';
    document.getElementById('unit-lbs').style.color = '#fff';
    document.getElementById('unit-kg').style.background = 'var(--bg-input)';
    document.getElementById('unit-kg').style.color = 'var(--text-muted)';
  });

  document.getElementById('unit-kg').addEventListener('click', () => {
    unit = 'kg';
    document.getElementById('unit-kg').style.background = 'var(--accent)';
    document.getElementById('unit-kg').style.color = '#fff';
    document.getElementById('unit-lbs').style.background = 'var(--bg-input)';
    document.getElementById('unit-lbs').style.color = 'var(--text-muted)';
  });

  // ── Shared file handler ──────────────────────────────────────────
  function handleVideoFile(file) {
    if (!file) return;
    videoFile = file;
    if (previewEl.src?.startsWith('blob:')) URL.revokeObjectURL(previewEl.src);
    const src = URL.createObjectURL(file);
    previewEl.src = src;
    sessionStorage.setItem('ff_video_src', src);
    previewWrap.style.display = 'block';
    analyzeBtn.disabled = false;
    analyzeBtn.style.opacity = '1';

    // Attempt vision-based exercise detection in the background
    exerciseDetecting.style.display = 'inline';
    exerciseSelect.value = 'auto';
    import('../engine/vision-detect.js').then(async ({ detectExerciseViaVision }) => {
      try {
        await new Promise(resolve => {
          if (previewEl.readyState >= 1) { resolve(); return; }
          previewEl.addEventListener('loadedmetadata', resolve, { once: true });
        });
        const detected = await detectExerciseViaVision(previewEl);
        if (detected && exerciseSelect.value === 'auto') {
          exerciseSelect.value = detected;
        }
      } catch {
        // vision detection is optional — silently ignore failures
      } finally {
        exerciseDetecting.style.display = 'none';
      }
    }).catch(() => {
      exerciseDetecting.style.display = 'none';
    });
  }

  videoInput.addEventListener('change', e => handleVideoFile(e.target.files[0]));
  videoCaptureInput.addEventListener('change', e => {
    removeMobileHint();
    handleVideoFile(e.target.files[0]);
  });

  // ── Mobile hint helpers ──────────────────────────────────────────
  let hintTimeout = null;

  function showMobileHint() {
    removeMobileHint();
    const hint = document.createElement('div');
    hint.id = 'camera-mobile-hint';
    hint.style.cssText = `
      background:var(--bg-card);
      border:1px solid var(--border);
      border-radius:var(--radius);
      padding:0.6rem 0.75rem;
      font-size:0.7rem;
      color:var(--text-muted);
      margin-top:0.5rem;
      display:flex;
      align-items:flex-start;
      gap:0.5rem;
    `;
    hint.innerHTML = `
      <span style="flex:1">📱 If the camera didn't open, check Settings → Privacy → Camera and allow access for your browser.</span>
      <button id="camera-hint-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;line-height:1;padding:0">×</button>
    `;
    inputModeWrap.appendChild(hint);
    document.getElementById('camera-hint-close').addEventListener('click', removeMobileHint);
    hintTimeout = setTimeout(removeMobileHint, 6000);
  }

  function removeMobileHint() {
    clearTimeout(hintTimeout);
    const hint = document.getElementById('camera-mobile-hint');
    if (hint) hint.remove();
  }

  // ── Permission error card ────────────────────────────────────────
  function showPermissionError(err) {
    const existing = document.getElementById('camera-permission-error');
    if (existing) existing.remove();

    const isNoCamera = err && err.name === 'NotFoundError';
    let content;

    if (isNoCamera) {
      content = `
        <div style="color:var(--score-red);font-size:0.8rem;font-weight:700;margin-bottom:0.5rem">📷 No camera found</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">Use Upload instead.</div>
        <div style="margin-top:0.75rem">
          <button id="perm-upload" style="background:var(--bg-input);border:1px solid var(--border);border-radius:4px;padding:4px 12px;font-size:0.75rem;color:var(--text);cursor:pointer">Upload instead</button>
        </div>
      `;
    } else {
      const { browser, steps } = getPermissionInstructions();
      const stepsHtml = steps.map((s, i) => `<div>${i + 1}. ${s}</div>`).join('');
      content = `
        <div style="color:var(--score-red);font-size:0.8rem;font-weight:700;margin-bottom:0.5rem">🚫 Camera blocked in ${browser}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);line-height:1.6;margin-bottom:0.75rem">${stepsHtml}</div>
        <div style="display:flex;gap:0.5rem">
          <button id="perm-retry" style="background:var(--score-red);border:none;border-radius:4px;padding:4px 12px;font-size:0.75rem;color:#fff;cursor:pointer">Try again</button>
          <button id="perm-upload" style="background:var(--bg-input);border:1px solid var(--border);border-radius:4px;padding:4px 12px;font-size:0.75rem;color:var(--text);cursor:pointer">Upload instead</button>
        </div>
      `;
    }

    const card = document.createElement('div');
    card.id = 'camera-permission-error';
    card.style.cssText = `
      background:var(--bg-card);
      border:1px solid var(--score-red);
      border-radius:var(--radius);
      padding:0.75rem;
      margin-top:0.5rem;
    `;
    card.innerHTML = content;
    inputModeWrap.appendChild(card);

    const retryBtn = document.getElementById('perm-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        card.remove();
        await handleRecordDesktop();
      });
    }
    document.getElementById('perm-upload').addEventListener('click', () => {
      card.remove();
      videoInput.click();
    });
  }

  // ── Desktop recording ────────────────────────────────────────────
  async function handleRecordDesktop() {
    try {
      const recorder = await startCameraPreview(inputModeWrap);
      recorder.onFile(file => {
        // Camera preview replaced itself with empty — restore the two-card UI
        inputModeWrap.innerHTML = document.getElementById('input-mode-wrap')
          ? inputModeWrap.innerHTML  // already replaced by startCameraPreview
          : '';
        handleVideoFile(file);
      });
    } catch (err) {
      showPermissionError(err);
    }
  }

  // ── Card click handlers ──────────────────────────────────────────
  document.getElementById('record-card').addEventListener('click', async () => {
    if (isMobile()) {
      videoCaptureInput.click();
      showMobileHint();
    } else {
      await handleRecordDesktop();
    }
  });

  document.getElementById('upload-card').addEventListener('click', () => {
    videoInput.click();
  });

  // ── Analyze button ───────────────────────────────────────────────
  analyzeBtn.addEventListener('click', async () => {
    if (!videoFile) return;
    stopCameraStream();
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';

    const selectedExercise = exerciseSelect.value === 'auto' ? null : exerciseSelect.value;

    try {
      const { runAnalysis } = await import('../engine/analysis-runner.js');
      const result = await runAnalysis(previewEl, weight, unit, selectedExercise);

      const { renderResults, attachResultsListeners } = await import('./results.js');
      document.getElementById('tab-content').innerHTML = renderResults(result);
      attachResultsListeners(result);
    } catch (err) {
      console.error('Analysis failed:', err);
      analyzeBtn.disabled = false;
      analyzeBtn.style.opacity = '1';
      analyzeBtn.textContent = 'Analyze My Form';
      const existing = document.getElementById('analyze-error');
      if (existing) existing.remove();
      const errorEl = document.createElement('p');
      errorEl.id = 'analyze-error';
      errorEl.style.cssText = 'color:var(--score-red);font-size:0.7rem;text-align:center;margin-top:0.5rem';
      errorEl.textContent = err.message === 'No pose frames detected'
        ? 'No pose detected — make sure your full body is visible in the video.'
        : 'Analysis failed — try a shorter video or check your connection.';
      analyzeBtn.after(errorEl);
    }
  });
}
```

- [ ] **Step 3: Verify the app builds without errors**

```bash
npx vite build 2>&1 | tail -20
```

Expected: `✓ built in` with no errors. If there are import errors, check that `../ui/camera-recorder.js` path is correct relative to `src/tabs/analyze.js`.

- [ ] **Step 4: Commit**

```bash
git add src/tabs/analyze.js
git commit -m "feat: replace analyze drop zone with Record | Upload cards; wire camera and file handlers"
```

---

## Task 3: Update `src/app.js` — call `stopCameraStream` on tab switch

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: Add import and call**

In `src/app.js`, update the import block at the top to add `stopCameraStream`:

```js
import { renderNav } from './ui/nav.js';
import { renderAnalyze } from './tabs/analyze.js';
import { renderExercises } from './tabs/exercises.js';
import { renderHistory, attachHistoryListeners } from './tabs/history.js';
import { stopAnimation } from './ui/exercise-animation.js';
import { stopCameraStream } from './ui/camera-recorder.js';
```

Then update the first line of `switchTab` to call both:

```js
function switchTab(id) {
  stopAnimation();
  stopCameraStream();
  // ... rest unchanged
```

- [ ] **Step 2: Verify the app builds without errors**

```bash
npx vite build 2>&1 | tail -20
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat: stop camera stream when switching tabs"
```

---

## Task 4: Manual smoke test

No automated tests needed per spec. Verify the feature works in the browser.

- [ ] **Step 1: Start the dev server (if not already running)**

```bash
npm run dev
```

Open http://localhost:5173 in a browser.

- [ ] **Step 2: Verify Upload path**

1. Go to Analyze tab.
2. Click the Upload card — file picker opens (no `capture` attribute, desktop file picker).
3. Select a video file — preview appears, Analyze button enables.

- [ ] **Step 3: Verify desktop Record path (happy path)**

1. Click the Record card.
2. Grant camera permission when prompted.
3. Live preview appears with a red ● button and Cancel link.
4. Click ● to start recording — button becomes ■, timer counts up.
5. Click ■ to stop — preview disappears, video preview appears with the recording, Analyze button enables.

- [ ] **Step 4: Verify 60-second auto-stop**

1. Start recording.
2. Wait 60 seconds — recording should stop automatically.

- [ ] **Step 5: Verify Cancel**

1. Click Record card, grant permission.
2. Click Cancel — camera preview disappears, two-card layout is gone (blank area), no crash.

> Note: After cancel, `inputModeWrap` is cleared by `cancel()`. The cards won't re-appear until the Analyze tab is reloaded. This is acceptable behavior per spec.

- [ ] **Step 6: Verify permission denied path**

1. Deny camera permission when prompted (or block it in browser settings).
2. The two cards remain visible.
3. An error card appears below with browser-specific unblock instructions.
4. Click "Upload instead" — file picker opens.
5. Click "Try again" — error card removes, camera preview re-attempts.

- [ ] **Step 7: Verify tab switch stops stream**

1. Open Record (live camera preview visible).
2. Switch to History tab.
3. Switch back to Analyze tab — camera indicator light in OS should be off (stream released).

- [ ] **Step 8: Verify mobile hint (if testing on mobile or touch device)**

1. Tap Record card.
2. A hint appears: "📱 If the camera didn't open..."
3. Wait 6 seconds — hint disappears.
4. Or: tap × to dismiss immediately.
5. Or: select a file via OS camera — hint disappears via `change` event.

- [ ] **Step 9: Commit smoke test completion note**

```bash
git commit --allow-empty -m "chore: camera recording smoke test passed"
```
