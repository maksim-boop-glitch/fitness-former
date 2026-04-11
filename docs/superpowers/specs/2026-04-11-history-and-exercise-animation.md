# History Tab + Exercise Animation — Design Spec

**Goal:** (1) Build the history tab to show saved analysis sessions as tappable score cards with expandable rule breakdowns. (2) Replace the black video placeholder in the exercise detail view with a looping skeleton animation for the four analysable exercises.

---

## Feature 1 — History Tab

### What it does

Reads saved sessions from `localStorage` via `loadSessions()` and renders a scrollable list of cards. Each card shows the score ring, exercise name, weight, date, and three pass/fail dots. Tapping a card toggles an inline rule breakdown panel below it. Only one card can be expanded at a time.

**Empty state:** "No analyses yet. Record a video to get started." centred in muted text.

### Files

| File | Change |
|---|---|
| `src/tabs/history.js` | **New file** — `renderHistory()` + `attachHistoryListeners()` |
| `src/app.js` | Import and wire up the history tab |

### `src/tabs/history.js` — full spec

```js
import { loadSessions } from '../storage.js';

const EXERCISE_LABELS = {
  squat:         'Barbell Squat',
  deadlift:      'Deadlift',
  'bench-press': 'Bench Press',
  'push-up':     'Push-up',
};

function scoreColor(score) {
  if (score >= 75) return '#00cc44';
  if (score >= 51) return '#cc8800';
  return '#cc2200';
}

function formatWeight(weight, unit) {
  return weight === 0 ? 'Bodyweight' : `${weight} ${unit}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderDots(ruleResults) {
  return ruleResults.slice(0, 3).map(r => {
    const col = r.pass ? '#00cc44' : (r.severity === 'error' ? '#cc2200' : '#cc8800');
    return `<span style="width:7px;height:7px;border-radius:50%;background:${col};display:inline-block"></span>`;
  }).join('');
}

function renderRuleRows(ruleResults) {
  return ruleResults.map(r => {
    const col = r.pass ? '#00cc44' : (r.severity === 'error' ? '#cc2200' : '#cc8800');
    const bg  = r.pass ? '#001a08' : (r.severity === 'error' ? '#1a0000' : '#1a0c00');
    const icon = r.pass ? '✓' : (r.severity === 'error' ? '✗' : '~');
    return `
      <div style="background:${bg};border-left:3px solid ${col};padding:5px 8px;border-radius:0 4px 4px 0;margin-bottom:3px">
        <div style="color:${col};font-size:0.65rem;font-weight:700">${icon} ${r.label}</div>
        ${!r.pass ? `<div style="color:var(--text-muted);font-size:0.6rem;margin-top:1px">${r.cue}</div>` : ''}
      </div>`;
  }).join('');
}

function renderSessionCard(s, i) {
  const col   = scoreColor(s.score);
  const label = EXERCISE_LABELS[s.exercise] ?? s.exercise;
  return `
    <div style="background:var(--bg-card);border-radius:var(--radius);overflow:hidden">
      <div class="ff-history-card" data-idx="${i}"
           style="padding:10px;display:flex;align-items:center;gap:10px;cursor:pointer">
        <div style="width:38px;height:38px;border-radius:50%;background:#111;
                    border:2.5px solid ${col};display:flex;align-items:center;
                    justify-content:center;flex-shrink:0">
          <span style="font-size:0.65rem;font-weight:800;color:${col}">${s.score}</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text)">${label}</div>
          <div style="font-size:0.6rem;color:var(--text-muted)">
            ${formatWeight(s.weight, s.unit)} · ${formatDate(s.date)}
          </div>
        </div>
        <div style="display:flex;gap:3px;align-items:center">${renderDots(s.ruleResults ?? [])}</div>
        <span class="ff-chevron" style="color:#444;font-size:0.8rem;transition:transform .2s">›</span>
      </div>
      <div class="ff-history-detail" id="ff-detail-${i}"
           style="display:none;padding:0 10px 10px">
        ${renderRuleRows(s.ruleResults ?? [])}
      </div>
    </div>`;
}

export function renderHistory() {
  const sessions = loadSessions();
  if (sessions.length === 0) {
    return `<p style="color:var(--text-muted);padding:2rem;text-align:center;font-size:0.8rem">
      No analyses yet.<br>Record a video to get started.
    </p>`;
  }
  return `
    <div style="padding:0.75rem;display:flex;flex-direction:column;gap:0.5rem">
      ${sessions.map((s, i) => renderSessionCard(s, i)).join('')}
    </div>`;
}

export function attachHistoryListeners() {
  document.querySelectorAll('.ff-history-card').forEach(card => {
    card.addEventListener('click', () => {
      const i      = card.dataset.idx;
      const detail = document.getElementById(`ff-detail-${i}`);
      const isOpen = detail.style.display !== 'none';

      // Collapse all
      document.querySelectorAll('.ff-history-detail').forEach(d => { d.style.display = 'none'; });
      document.querySelectorAll('.ff-chevron').forEach(c => { c.textContent = '›'; c.style.transform = ''; });

      if (!isOpen) {
        detail.style.display = 'block';
        card.querySelector('.ff-chevron').textContent = '›';
        card.querySelector('.ff-chevron').style.transform = 'rotate(90deg)';
      }
    });
  });
}
```

### `src/app.js` changes

Add import at top:
```js
import { renderHistory } from './tabs/history.js';
```

Replace the history tab definition:
```js
// Before:
{ id: 'history', label: 'History', icon: '📋', render: () => '<p ...>Sign in to view history</p>' },

// After:
{ id: 'history', label: 'History', icon: '📋', render: renderHistory },
```

Add history listener in `switchTab`:
```js
if (id === 'history') {
  import('./tabs/history.js').then(m => m.attachHistoryListeners());
}
```

---

## Feature 2 — Exercise Skeleton Animation

### What it does

Replaces the `[ Form guide video ]` black box in `renderExerciseDetail` with a `<canvas>` element. When the detail view is shown, a looping skeleton animation plays showing correct movement for that exercise. The four analysable exercises (squat, deadlift, push-up, bench-press) get full animations. All other exercises show a static good-form standing pose.

### Files

| File | Change |
|---|---|
| `src/ui/exercise-animation.js` | **New file** — keyframe data + animation loop |
| `src/tabs/exercises.js` | Replace placeholder box with `<canvas>`; start/stop animation |

### `src/ui/exercise-animation.js` — full spec

Joints are defined as `[x, y]` in normalised canvas coordinates (0–1). The skeleton is drawn as a side-profile stick figure using left-side joints only: `head`, `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle`. Bones connect them in order.

```js
// Bone connections drawn in sequence
const BONE_PAIRS = [
  ['shoulder', 'elbow'], ['elbow', 'wrist'],
  ['shoulder', 'hip'],
  ['hip', 'knee'], ['knee', 'ankle'],
];

// Each animation: array of keyframes { t: 0–1, joints: {...} }
// t=0 and t=1 are the same pose (seamless loop).
const ANIMATIONS = {
  squat: {
    duration: 2400,
    keyframes: [
      { t: 0,    joints: { head:[.50,.07], shoulder:[.50,.22], elbow:[.38,.33], wrist:[.36,.44], hip:[.50,.46], knee:[.48,.66], ankle:[.47,.87] } },
      { t: 0.45, joints: { head:[.50,.20], shoulder:[.46,.35], elbow:[.33,.44], wrist:[.30,.54], hip:[.47,.59], knee:[.47,.60], ankle:[.46,.87] } },
      { t: 0.55, joints: { head:[.50,.20], shoulder:[.46,.35], elbow:[.33,.44], wrist:[.30,.54], hip:[.47,.59], knee:[.47,.60], ankle:[.46,.87] } },
      { t: 1,    joints: { head:[.50,.07], shoulder:[.50,.22], elbow:[.38,.33], wrist:[.36,.44], hip:[.50,.46], knee:[.48,.66], ankle:[.47,.87] } },
    ],
  },

  deadlift: {
    duration: 2800,
    keyframes: [
      // Hinge position (bar at shin)
      { t: 0,    joints: { head:[.44,.20], shoulder:[.40,.28], elbow:[.46,.44], wrist:[.49,.58], hip:[.52,.38], knee:[.50,.60], ankle:[.49,.87] } },
      // Lockout (standing)
      { t: 0.5,  joints: { head:[.50,.07], shoulder:[.50,.22], elbow:[.44,.36], wrist:[.46,.50], hip:[.50,.46], knee:[.49,.66], ankle:[.49,.87] } },
      { t: 0.55, joints: { head:[.50,.07], shoulder:[.50,.22], elbow:[.44,.36], wrist:[.46,.50], hip:[.50,.46], knee:[.49,.66], ankle:[.49,.87] } },
      { t: 1,    joints: { head:[.44,.20], shoulder:[.40,.28], elbow:[.46,.44], wrist:[.49,.58], hip:[.52,.38], knee:[.50,.60], ankle:[.49,.87] } },
    ],
  },

  'push-up': {
    duration: 2200,
    keyframes: [
      // Top (arms extended)
      { t: 0,    joints: { head:[.18,.42], shoulder:[.28,.46], elbow:[.50,.46], wrist:[.68,.46], hip:[.50,.50], knee:[.70,.50], ankle:[.88,.50] } },
      // Bottom (chest near floor)
      { t: 0.45, joints: { head:[.18,.50], shoulder:[.28,.52], elbow:[.42,.52], wrist:[.56,.56], hip:[.50,.54], knee:[.70,.54], ankle:[.88,.54] } },
      { t: 0.55, joints: { head:[.18,.50], shoulder:[.28,.52], elbow:[.42,.52], wrist:[.56,.56], hip:[.50,.54], knee:[.70,.54], ankle:[.88,.54] } },
      { t: 1,    joints: { head:[.18,.42], shoulder:[.28,.46], elbow:[.50,.46], wrist:[.68,.46], hip:[.50,.50], knee:[.70,.50], ankle:[.88,.50] } },
    ],
  },

  'bench-press': {
    duration: 2200,
    keyframes: [
      // Top (arms extended upward — person lying)
      { t: 0,    joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.50,.50], wrist:[.66,.32], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
      // Bottom (bar to chest)
      { t: 0.45, joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.44,.50], wrist:[.44,.54], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
      { t: 0.55, joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.44,.50], wrist:[.44,.54], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
      { t: 1,    joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.50,.50], wrist:[.66,.32], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
    ],
  },
};

// Static standing pose used for exercises with no defined animation
const STATIC_POSE = { head:[.50,.07], shoulder:[.50,.22], elbow:[.38,.33], wrist:[.36,.44], hip:[.50,.46], knee:[.48,.66], ankle:[.47,.87] };

// ── Easing ──────────────────────────────────────────────────────────────────
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── Interpolate between two keyframes ───────────────────────────────────────
function interpolateJoints(kfA, kfB, rawT) {
  const span = kfB.t - kfA.t;
  const local = span === 0 ? 0 : easeInOut((rawT - kfA.t) / span);
  const result = {};
  for (const key of Object.keys(kfA.joints)) {
    const [ax, ay] = kfA.joints[key];
    const [bx, by] = kfB.joints[key];
    result[key] = [ax + (bx - ax) * local, ay + (by - ay) * local];
  }
  return result;
}

// ── Draw one frame ───────────────────────────────────────────────────────────
function drawFrame(ctx, w, h, joints) {
  ctx.clearRect(0, 0, w, h);

  // Bones
  ctx.strokeStyle = '#00cc44';
  ctx.lineWidth = Math.max(2, w * 0.025);
  ctx.lineCap = 'round';
  ctx.shadowColor = '#00cc44';
  ctx.shadowBlur = 8;

  for (const [a, b] of BONE_PAIRS) {
    if (!joints[a] || !joints[b]) continue;
    ctx.beginPath();
    ctx.moveTo(joints[a][0] * w, joints[a][1] * h);
    ctx.lineTo(joints[b][0] * w, joints[b][1] * h);
    ctx.stroke();
  }

  // Head circle
  const [hx, hy] = joints.head;
  const headR = Math.max(6, w * 0.065);
  ctx.beginPath();
  ctx.arc(hx * w, hy * h, headR, 0, Math.PI * 2);
  ctx.fillStyle = 'none';
  ctx.strokeStyle = '#00cc44';
  ctx.lineWidth = Math.max(2, w * 0.022);
  ctx.stroke();

  // Joint dots
  ctx.shadowBlur = 10;
  for (const key of Object.keys(joints)) {
    if (key === 'head') continue;
    const [x, y] = joints[key];
    ctx.beginPath();
    ctx.arc(x * w, y * h, Math.max(3, w * 0.04), 0, Math.PI * 2);
    ctx.fillStyle = '#00cc44';
    ctx.fill();
  }

  ctx.shadowBlur = 0;
}

// ── Public API ───────────────────────────────────────────────────────────────
let rafId = null;

export function startAnimation(canvas, exerciseId) {
  stopAnimation();
  const ctx = canvas.getContext('2d');
  const anim = ANIMATIONS[exerciseId];

  if (!anim) {
    // Static pose for exercises without a defined animation
    drawFrame(ctx, canvas.width, canvas.height, STATIC_POSE);
    return;
  }

  const { duration, keyframes } = anim;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = (now - startTime) % duration;
    const t = elapsed / duration; // 0–1

    // Find surrounding keyframes
    let kfA = keyframes[0];
    let kfB = keyframes[keyframes.length - 1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i].t && t < keyframes[i + 1].t) {
        kfA = keyframes[i];
        kfB = keyframes[i + 1];
        break;
      }
    }

    const joints = interpolateJoints(kfA, kfB, t);
    drawFrame(ctx, canvas.width, canvas.height, joints);
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
}

export function stopAnimation() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
```

### `src/tabs/exercises.js` changes

**In `renderExerciseDetail`:** replace the black placeholder div:

```js
// Before:
<div style="background:#000;border-radius:6px;height:140px;display:flex;align-items:center;justify-content:center;margin-bottom:0.75rem">
  <span style="color:#333;font-size:0.7rem">[ Form guide video ]</span>
</div>

// After:
<canvas id="exercise-anim-canvas" width="300" height="180"
  style="width:100%;border-radius:6px;background:#000;display:block;margin-bottom:0.75rem"></canvas>
```

**In `attachExercisesListeners`:** after rendering the exercise detail, start the animation. The existing code handles navigation from the exercise list to the detail view via a click handler. After `renderExerciseDetail` is inserted into the DOM, add:

```js
// Top-level import (at top of exercises.js):
import { startAnimation, stopAnimation } from '../ui/exercise-animation.js';

// When showing exercise detail:
document.getElementById('tab-content').innerHTML = renderExerciseDetail(ex);
const canvas = document.getElementById('exercise-anim-canvas');
if (canvas) startAnimation(canvas, ex.id);

// When navigating back (back button listener):
document.getElementById('back-to-list').addEventListener('click', () => {
  stopAnimation();
  // ... existing back navigation code
});
```

`stopAnimation()` must also be called when the user switches tabs (currently tabs re-render via `switchTab` which replaces `innerHTML`, so the canvas is destroyed automatically — but `stopAnimation()` should be called to cancel the `requestAnimationFrame` loop before that happens). Add `stopAnimation()` at the top of `switchTab` in `app.js`:

```js
import { stopAnimation } from './ui/exercise-animation.js';

function switchTab(id) {
  stopAnimation(); // cancel any running animation before re-rendering
  // ... rest of existing switchTab code
}
```

---

## What does NOT change

- `src/storage.js` — no changes (history reads from existing localStorage data)
- `src/data/exercise-library.js` — no changes (exercise ID is used as animation key directly)
- `src/engine/`, `src/pose/`, `src/tabs/analyze.js`, `src/tabs/results.js` — no changes
- Test files — no changes

---

## Edge cases

- **No sessions:** `loadSessions()` returns `[]` — empty state message shown.
- **Session with missing `ruleResults`:** Older sessions saved before rule results were added. Guard with `(s.ruleResults ?? [])` in `renderDots` and `renderRuleRows`.
- **Canvas sizing:** The canvas `width`/`height` attributes are fixed at 300×180. The CSS `width:100%` scales it visually. `drawFrame` reads `canvas.width`/`canvas.height` (the attribute values, not CSS size) so coordinate maths stays consistent regardless of display size.
- **`stopAnimation` on tab switch:** If the user switches away from exercises mid-animation, `switchTab` calls `stopAnimation()` before replacing innerHTML. The canvas element is then garbage-collected.
- **History card `ruleResults` dot count:** Only the first 3 rule results are shown as dots (`.slice(0, 3)`). All exercises have 3 rules, so no truncation occurs in practice.
