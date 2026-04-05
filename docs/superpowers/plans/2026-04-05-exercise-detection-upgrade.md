# Exercise Detection Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual exercise selector (Option A) and a Claude vision backend that auto-detects exercise from any camera angle (Option B), with the selector pre-filled by the vision API and overridable by the user.

**Architecture:** An Express server replaces the static Render deployment — it serves the built Vite `dist/` folder as static files and exposes `POST /api/detect-exercise`, which sends a video frame to Claude's vision API and returns an exercise name. The frontend adds a `<select>` dropdown pre-filled by the vision API result; the user can override it before clicking Analyze. The `runAnalysis` function accepts an optional `exerciseOverride` that bypasses the landmark heuristic.

**Tech Stack:** Express, @anthropic-ai/sdk, cors, Vite proxy (dev), Vitest (tests), Render web service

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/engine/analysis-runner.js` | Modify | Accept `exerciseOverride` param |
| `src/tabs/analyze.js` | Modify | Add exercise `<select>`, call vision API on video load |
| `src/engine/vision-detect.js` | Create | Extract frame + call `/api/detect-exercise` |
| `server/index.js` | Create | Express server — static files + API mount |
| `server/routes/detect-exercise.js` | Create | POST /api/detect-exercise → Claude vision |
| `vite.config.js` | Modify | Add `/api` proxy to port 3001 for dev |
| `package.json` | Modify | Add express, cors, @anthropic-ai/sdk; add `start` script |
| `render.yaml` | Modify | Switch from static to web service |
| `tests/engine/analysis-runner.test.js` | Modify | Add override test |
| `tests/engine/vision-detect.test.js` | Create | Mock fetch, test null fallback |

---

### Task 1: Analysis runner — exercise override param

**Files:**
- Modify: `src/engine/analysis-runner.js`
- Modify: `tests/engine/analysis-runner.test.js`

- [ ] **Step 1: Write the failing test**

Open `tests/engine/analysis-runner.test.js`. The file currently doesn't exist — create it:

```js
// tests/engine/analysis-runner.test.js
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock all heavy dependencies so the test doesn't actually load MediaPipe
vi.mock('../../src/pose/detector.js', () => ({
  processVideo: vi.fn().mockResolvedValue([
    // minimal single frame — 33 landmarks all at (0.5, 0.5)
    Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })),
  ]),
}));
vi.mock('../../src/storage.js', () => ({ saveSession: vi.fn() }));

import { runAnalysis } from '../../src/engine/analysis-runner.js';

describe('runAnalysis', () => {
  let fakeVideo;
  beforeEach(() => {
    fakeVideo = { duration: 5 };
    document.body.innerHTML = '<button id="analyze-btn">Analyze</button>';
  });

  it('uses exerciseOverride when provided, skipping auto-detection', async () => {
    const result = await runAnalysis(fakeVideo, 135, 'lbs', 'push-up');
    expect(result.exercise).toBe('push-up');
  });

  it('falls back to heuristic when no override given', async () => {
    const result = await runAnalysis(fakeVideo, 135, 'lbs');
    // heuristic on identical landmarks returns null → defaults to 'squat'
    expect(result.exercise).toBe('squat');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former
npx vitest run tests/engine/analysis-runner.test.js
```

Expected: FAIL — `runAnalysis` only takes 3 arguments; the override is ignored.

- [ ] **Step 3: Update `src/engine/analysis-runner.js`**

Replace the file content with:

```js
import { processVideo } from '../pose/detector.js';
import { detectExercise } from './exercise-detector.js';
import { evaluateRules } from './rules.js';
import { calculateScore } from './score.js';
import { EXERCISE_RULES } from './exercises/index.js';
import { saveSession } from '../storage.js';

/**
 * Runs the full analysis pipeline on a video element.
 *
 * @param {HTMLVideoElement} videoEl
 * @param {number} weight
 * @param {'lbs'|'kg'} unit
 * @param {string|null} [exerciseOverride] - skip auto-detection and use this exercise
 * @returns {Promise<{exercise, weight, unit, score, ruleResults, frames}>}
 */
export async function runAnalysis(videoEl, weight, unit, exerciseOverride = null) {
  const updateProgress = p => {
    const btn = document.getElementById('analyze-btn');
    if (btn) btn.textContent = `Analyzing… ${Math.round(p * 100)}%`;
  };

  const frames = await processVideo(videoEl, 10, updateProgress);

  if (frames.length === 0) {
    const btn = document.getElementById('analyze-btn');
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = 'Analyze My Form';
    }
    const errorEl = document.createElement('p');
    errorEl.style.cssText = 'color:var(--score-red);font-size:0.7rem;text-align:center;margin-top:0.5rem';
    errorEl.textContent = 'No pose detected — make sure your full body is visible in the video.';
    document.getElementById('analyze-btn')?.after(errorEl);
    throw new Error('No pose frames detected');
  }

  const exercise = exerciseOverride ?? detectExercise(frames) ?? 'squat';
  const rules = EXERCISE_RULES[exercise] ?? [];
  const ruleResults = evaluateRules(rules, frames);
  const score = calculateScore(ruleResults);

  saveSession({ exercise, weight, unit, score, ruleResults });

  return { exercise, weight, unit, score, ruleResults, frames };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/engine/analysis-runner.test.js
```

Expected: 2 tests PASS.

- [ ] **Step 5: Run the full suite to check for regressions**

```bash
npx vitest run
```

Expected: all 39 (now 41) tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/analysis-runner.js tests/engine/analysis-runner.test.js
git commit -m "feat: analysis runner accepts exerciseOverride param"
```

---

### Task 2: Exercise selector UI (Option A)

**Files:**
- Modify: `src/tabs/analyze.js`

No unit test needed — this is pure DOM wiring. Manual verification after Task 5 covers it.

- [ ] **Step 1: Add the exercise `<select>` to `renderAnalyze`**

In `src/tabs/analyze.js`, replace the `renderAnalyze` function body with:

```js
export function renderAnalyze() {
  return `
    <div class="section-label" style="margin-top:0.5rem">Fitness Former</div>
    <p style="color:var(--text-muted);font-size:0.75rem;margin-bottom:1rem">AI Form Coach</p>

    <label id="video-drop-zone" class="card" style="
      border: 2px dashed var(--border);
      text-align:center;
      cursor:pointer;
      display:block;
    ">
      <div style="font-size:2.5rem;margin-bottom:0.5rem">📹</div>
      <div style="color:var(--text-dim);font-size:0.8rem">Tap to record or upload a video</div>
      <div style="color:var(--text-muted);font-size:0.65rem;margin-top:4px">MP4 · MOV · max 60 seconds</div>
      <input id="video-input" type="file" accept="video/*" capture="environment" style="display:none" />
    </label>

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

- [ ] **Step 2: Update `attachAnalyzeListeners` to read the selector and call vision detection**

Replace `attachAnalyzeListeners` in `src/tabs/analyze.js` with:

```js
export function attachAnalyzeListeners() {
  let weight = 135;
  let unit = 'lbs';
  let videoFile = null;

  const weightDisplay    = document.getElementById('weight-display');
  const analyzeBtn       = document.getElementById('analyze-btn');
  const videoInput       = document.getElementById('video-input');
  const previewWrap      = document.getElementById('video-preview-wrap');
  const previewEl        = document.getElementById('video-preview');
  const exerciseSelect   = document.getElementById('exercise-select');
  const exerciseDetecting = document.getElementById('exercise-detecting');

  if (!weightDisplay) return;

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

  videoInput.addEventListener('change', async e => {
    videoFile = e.target.files[0];
    if (!videoFile) return;
    const src = URL.createObjectURL(videoFile);
    previewEl.src = src;
    sessionStorage.setItem('ff_video_src', src);
    previewWrap.style.display = 'block';
    analyzeBtn.disabled = false;
    analyzeBtn.style.opacity = '1';

    // Attempt vision-based exercise detection in the background
    exerciseDetecting.style.display = 'inline';
    exerciseSelect.value = 'auto';
    try {
      const { detectExerciseViaVision } = await import('../engine/vision-detect.js');
      // Wait for the video metadata so duration is known
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
  });

  analyzeBtn.addEventListener('click', async () => {
    if (!videoFile) return;
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
      errorEl.textContent = 'Analysis failed — try a shorter video or check your connection.';
      analyzeBtn.after(errorEl);
    }
  });
}
```

- [ ] **Step 3: Run all tests to verify nothing broke**

```bash
npx vitest run
```

Expected: all tests PASS (no tests cover the UI directly).

- [ ] **Step 4: Commit**

```bash
git add src/tabs/analyze.js
git commit -m "feat: exercise selector dropdown with auto-detect option"
```

---

### Task 3: Vision detect helper (frontend, Option B)

**Files:**
- Create: `src/engine/vision-detect.js`
- Create: `tests/engine/vision-detect.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/vision-detect.test.js`:

```js
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { detectExerciseViaVision } from '../../src/engine/vision-detect.js';

describe('detectExerciseViaVision', () => {
  let fakeVideo;

  beforeEach(() => {
    fakeVideo = {
      duration: 10,
      readyState: 4,
      currentTime: 0,
      width: 320,
      height: 240,
      addEventListener: vi.fn((event, cb, opts) => {
        if (event === 'seeked') cb(); // immediately fire seeked
      }),
      removeEventListener: vi.fn(),
    };

    // Mock canvas
    const mockCtx = { drawImage: vi.fn() };
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => mockCtx,
          toDataURL: () => 'data:image/jpeg;base64,FAKEFRAME',
        };
      }
      return document.createElement.wrappedMethod?.(tag) ?? {};
    });
  });

  it('returns the exercise name from a successful API response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ exercise: 'push-up' }),
    });

    const result = await detectExerciseViaVision(fakeVideo);
    expect(result).toBe('push-up');
    expect(fetch).toHaveBeenCalledWith('/api/detect-exercise', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('returns null when the API responds with a non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await detectExerciseViaVision(fakeVideo);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const result = await detectExerciseViaVision(fakeVideo);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/engine/vision-detect.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/engine/vision-detect.js`**

```js
/**
 * Extracts a frame from the video at 25% of duration,
 * sends it to the backend vision API, and returns the detected exercise name.
 * Returns null on any failure — vision detection is always optional.
 *
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<string|null>}
 */
export async function detectExerciseViaVision(videoEl) {
  try {
    const imageBase64 = await extractFrame(videoEl);
    const res = await fetch('/api/detect-exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });
    if (!res.ok) return null;
    const { exercise } = await res.json();
    return exercise ?? null;
  } catch {
    return null;
  }
}

function extractFrame(videoEl) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    videoEl.currentTime = videoEl.duration * 0.25;

    videoEl.addEventListener('seeked', function onSeeked() {
      videoEl.removeEventListener('seeked', onSeeked);
      try {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl.split(',')[1]); // strip data URL prefix
      } catch (err) {
        reject(err);
      }
    }, { once: true });
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/engine/vision-detect.test.js
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run the full suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/vision-detect.js tests/engine/vision-detect.test.js
git commit -m "feat: vision-detect helper — frame extraction + /api/detect-exercise call"
```

---

### Task 4: Express server (Option B infrastructure)

**Files:**
- Create: `server/index.js`
- Modify: `package.json`
- Modify: `vite.config.js`
- Modify: `render.yaml`

- [ ] **Step 1: Install server dependencies**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former
npm install express cors @anthropic-ai/sdk
```

Expected: packages added to `dependencies` in package.json.

- [ ] **Step 2: Add `start` script to `package.json`**

Open `package.json`. Change the `"scripts"` section to:

```json
"scripts": {
  "dev": "vite",
  "dev:server": "node server/index.js",
  "build": "vite build",
  "preview": "vite preview",
  "start": "node server/index.js",
  "test": "vitest run",
  "test:ui": "vitest --ui"
},
```

- [ ] **Step 3: Create `server/index.js`**

```js
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { detectExerciseRoute } from './routes/detect-exercise.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.post('/api/detect-exercise', detectExerciseRoute);

// Serve Vite build output
app.use(express.static(join(__dirname, '../dist')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => console.log(`Fitness Former server on port ${PORT}`));
```

- [ ] **Step 4: Update `vite.config.js` to proxy `/api` in dev**

Replace `vite.config.js` with:

```js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 5: Update `render.yaml` to web service**

Replace `render.yaml` with:

```yaml
services:
  - type: web
    name: fitness-former
    env: node
    buildCommand: npm install && npm run build
    startCommand: node server/index.js
    branch: main
    envVars:
      - key: ANTHROPIC_API_KEY
        sync: false
```

- [ ] **Step 6: Run all tests to verify nothing broke**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/index.js vite.config.js render.yaml package.json package-lock.json
git commit -m "feat: Express server — static file serving + API mount, Render web service config"
```

---

### Task 5: Claude vision API route (Option B AI)

**Files:**
- Create: `server/routes/detect-exercise.js`

No automated tests for this route — it requires a live Anthropic API key. Manual verification in Task 6.

- [ ] **Step 1: Create `server/routes/detect-exercise.js`**

```js
import Anthropic from '@anthropic-ai/sdk';

const VALID_EXERCISES = ['squat', 'deadlift', 'push-up', 'bench-press'];

export async function detectExerciseRoute(req, res) {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // API key not configured — return null so frontend falls back to heuristic
    return res.json({ exercise: null });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'What exercise is this person performing? Reply with exactly one of: squat, deadlift, push-up, bench-press. Reply with just the exercise name, nothing else.',
            },
          ],
        },
      ],
    });

    const raw = message.content[0].text.trim().toLowerCase();
    const exercise = VALID_EXERCISES.find(e => raw.includes(e)) ?? null;
    res.json({ exercise });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: 'Detection failed', exercise: null });
  }
}
```

- [ ] **Step 2: Verify the server starts cleanly (no API key needed for startup)**

In one terminal, run the build first (server serves from dist/):
```bash
npm run build
```

In a second terminal, start the server without an API key:
```bash
node server/index.js
```

Expected output:
```
Fitness Former server on port 3001
```

Then test the route returns gracefully without a key:
```bash
curl -s -X POST http://localhost:3001/api/detect-exercise \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"test"}' | cat
```

Expected: `{"exercise":null}` (no API key configured → null fallback)

Kill the server with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add server/routes/detect-exercise.js
git commit -m "feat: Claude vision API route — detect exercise from base64 frame"
```

---

### Task 6: End-to-end verification and deployment

**Files:**
- No new files — verification and deployment only

- [ ] **Step 1: Full local test**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 2: Build the frontend**

```bash
npm run build
```

Expected: `dist/` folder created with no errors.

- [ ] **Step 3: Set `ANTHROPIC_API_KEY` in your environment and start the server**

```bash
ANTHROPIC_API_KEY=sk-ant-... node server/index.js
```

Expected: `Fitness Former server on port 3001`

- [ ] **Step 4: Open the app in a browser at http://localhost:3001**

Upload a video. Observe:
- "Detecting…" label appears next to Exercise dropdown
- After a few seconds the dropdown auto-fills with the detected exercise (e.g. "Push-up")
- You can change the dropdown to any other exercise before clicking Analyze
- Clicking Analyze runs with whatever the dropdown shows

- [ ] **Step 5: Push to feat/mvp and open a PR**

```bash
git push origin feat/mvp
gh pr create \
  --title "feat: exercise selector + Claude vision detection" \
  --body "Adds manual exercise dropdown (Option A) and Claude vision backend that auto-detects exercise from any camera angle (Option B). Falls back to landmark heuristic if API is unavailable."
```

- [ ] **Step 6: Set `ANTHROPIC_API_KEY` in Render dashboard**

In Render → your service → Environment → add:
- Key: `ANTHROPIC_API_KEY`
- Value: your Anthropic API key (from console.anthropic.com)

- [ ] **Step 7: Trigger redeploy on Render**

After merge + env var set, trigger a manual deploy. Build command runs `npm install && npm run build`, then `node server/index.js` starts the server.

Verify at your `.onrender.com` URL:
- Upload a video → exercise auto-detects via Claude vision
- Selector shows correct exercise
- Analyze runs correctly
