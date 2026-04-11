# History Tab + Exercise Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a history tab showing saved analysis sessions as tappable score cards, and replace the exercise detail placeholder box with a looping skeleton animation.

**Architecture:** Two new files (`src/tabs/history.js`, `src/ui/exercise-animation.js`) plus edits to `src/tabs/exercises.js` and `src/app.js`. History reads from existing `localStorage` via `loadSessions()`. Animation runs a Canvas 2D + `requestAnimationFrame` loop with keyframe interpolation. `stopAnimation()` is called on every tab switch to cancel the RAF loop before the canvas is destroyed.

**Tech Stack:** Vanilla JS, Canvas 2D API, `requestAnimationFrame`, `localStorage` (via existing `src/storage.js`).

---

## File Map

| File | Change |
|---|---|
| `src/tabs/history.js` | **New** — `renderHistory()` + `attachHistoryListeners()` |
| `src/app.js` | Import `renderHistory`; replace placeholder tab render fn; add `attachHistoryListeners` in `switchTab`; import `stopAnimation`; call `stopAnimation()` at top of `switchTab` |
| `src/ui/exercise-animation.js` | **New** — keyframe data + `startAnimation(canvas, exerciseId)` + `stopAnimation()` |
| `src/tabs/exercises.js` | Import `startAnimation`/`stopAnimation`; replace placeholder `<div>` with `<canvas>`; start animation after detail renders; stop on back button |

No test files — UI rendering is not unit-tested in this project.

---

## Task 1: Create `src/tabs/history.js`

**Files:**
- Create: `src/tabs/history.js`

- [ ] **Step 1: Create the file with all helpers and exports**

Create `src/tabs/history.js` with this exact content:

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
    const col  = r.pass ? '#00cc44' : (r.severity === 'error' ? '#cc2200' : '#cc8800');
    const bg   = r.pass ? '#001a08' : (r.severity === 'error' ? '#1a0000' : '#1a0c00');
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

- [ ] **Step 2: Verify the file parses without errors**

Run:
```bash
node --input-type=module < src/tabs/history.js 2>&1 | head -5
```

Expected: output about missing `localStorage` (Node doesn't have it) — something like `ReferenceError: localStorage is not defined`. That's fine — it means the module parsed and the import was resolved. What you must NOT see: `SyntaxError`.

- [ ] **Step 3: Commit**

```bash
git add src/tabs/history.js
git commit -m "feat: add history tab with score cards and expandable rule breakdown"
```

---

## Task 2: Wire history tab in `src/app.js`

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: Read the current file**

Read `src/app.js` to confirm current content before editing.

- [ ] **Step 2: Add `renderHistory` import**

Change:
```js
import { renderNav } from './ui/nav.js';
import { renderAnalyze } from './tabs/analyze.js';
import { renderExercises } from './tabs/exercises.js';
```

To:
```js
import { renderNav } from './ui/nav.js';
import { renderAnalyze } from './tabs/analyze.js';
import { renderExercises } from './tabs/exercises.js';
import { renderHistory } from './tabs/history.js';
```

- [ ] **Step 3: Replace the history tab placeholder**

Change:
```js
  { id: 'history',   label: 'History',   icon: '📋', render: () => '<p style="color:var(--text-muted);padding:2rem;text-align:center">Sign in to view history</p>' },
```

To:
```js
  { id: 'history',   label: 'History',   icon: '📋', render: renderHistory },
```

- [ ] **Step 4: Add `attachHistoryListeners` call in `switchTab`**

Change the `switchTab` function:
```js
function switchTab(id) {
  const tab = TABS.find(t => t.id === id);
  if (!tab) return;
  activeTab = id;
  document.getElementById('tab-content').innerHTML = tab.render();
  document.querySelectorAll('#bottom-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === id);
  });
  if (id === 'analyze') {
    import('./tabs/analyze.js').then(m => m.attachAnalyzeListeners());
  }
  if (id === 'exercises') {
    import('./tabs/exercises.js').then(m => m.attachExercisesListeners());
  }
}
```

To:
```js
function switchTab(id) {
  const tab = TABS.find(t => t.id === id);
  if (!tab) return;
  activeTab = id;
  document.getElementById('tab-content').innerHTML = tab.render();
  document.querySelectorAll('#bottom-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === id);
  });
  if (id === 'analyze') {
    import('./tabs/analyze.js').then(m => m.attachAnalyzeListeners());
  }
  if (id === 'exercises') {
    import('./tabs/exercises.js').then(m => m.attachExercisesListeners());
  }
  if (id === 'history') {
    import('./tabs/history.js').then(m => m.attachHistoryListeners());
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app.js
git commit -m "feat: wire history tab into app — render and attach listeners"
```

---

## Task 3: Create `src/ui/exercise-animation.js`

**Files:**
- Create: `src/ui/exercise-animation.js`

- [ ] **Step 1: Create the file**

Create `src/ui/exercise-animation.js` with this exact content:

```js
const BONE_PAIRS = [
  ['shoulder', 'elbow'], ['elbow', 'wrist'],
  ['shoulder', 'hip'],
  ['hip', 'knee'], ['knee', 'ankle'],
];

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
      { t: 0,    joints: { head:[.44,.20], shoulder:[.40,.28], elbow:[.46,.44], wrist:[.49,.58], hip:[.52,.38], knee:[.50,.60], ankle:[.49,.87] } },
      { t: 0.5,  joints: { head:[.50,.07], shoulder:[.50,.22], elbow:[.44,.36], wrist:[.46,.50], hip:[.50,.46], knee:[.49,.66], ankle:[.49,.87] } },
      { t: 0.55, joints: { head:[.50,.07], shoulder:[.50,.22], elbow:[.44,.36], wrist:[.46,.50], hip:[.50,.46], knee:[.49,.66], ankle:[.49,.87] } },
      { t: 1,    joints: { head:[.44,.20], shoulder:[.40,.28], elbow:[.46,.44], wrist:[.49,.58], hip:[.52,.38], knee:[.50,.60], ankle:[.49,.87] } },
    ],
  },

  'push-up': {
    duration: 2200,
    keyframes: [
      { t: 0,    joints: { head:[.18,.42], shoulder:[.28,.46], elbow:[.50,.46], wrist:[.68,.46], hip:[.50,.50], knee:[.70,.50], ankle:[.88,.50] } },
      { t: 0.45, joints: { head:[.18,.50], shoulder:[.28,.52], elbow:[.42,.52], wrist:[.56,.56], hip:[.50,.54], knee:[.70,.54], ankle:[.88,.54] } },
      { t: 0.55, joints: { head:[.18,.50], shoulder:[.28,.52], elbow:[.42,.52], wrist:[.56,.56], hip:[.50,.54], knee:[.70,.54], ankle:[.88,.54] } },
      { t: 1,    joints: { head:[.18,.42], shoulder:[.28,.46], elbow:[.50,.46], wrist:[.68,.46], hip:[.50,.50], knee:[.70,.50], ankle:[.88,.50] } },
    ],
  },

  'bench-press': {
    duration: 2200,
    keyframes: [
      { t: 0,    joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.50,.50], wrist:[.66,.32], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
      { t: 0.45, joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.44,.50], wrist:[.44,.54], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
      { t: 0.55, joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.44,.50], wrist:[.44,.54], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
      { t: 1,    joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.50,.50], wrist:[.66,.32], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
    ],
  },
};

const STATIC_POSE = { head:[.50,.07], shoulder:[.50,.22], elbow:[.38,.33], wrist:[.36,.44], hip:[.50,.46], knee:[.48,.66], ankle:[.47,.87] };

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

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

function drawFrame(ctx, w, h, joints) {
  ctx.clearRect(0, 0, w, h);

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

  const [hx, hy] = joints.head;
  const headR = Math.max(6, w * 0.065);
  ctx.beginPath();
  ctx.arc(hx * w, hy * h, headR, 0, Math.PI * 2);
  ctx.fillStyle = 'none';
  ctx.strokeStyle = '#00cc44';
  ctx.lineWidth = Math.max(2, w * 0.022);
  ctx.stroke();

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

let rafId = null;

export function startAnimation(canvas, exerciseId) {
  stopAnimation();
  const ctx = canvas.getContext('2d');
  const anim = ANIMATIONS[exerciseId];

  if (!anim) {
    drawFrame(ctx, canvas.width, canvas.height, STATIC_POSE);
    return;
  }

  const { duration, keyframes } = anim;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = (now - startTime) % duration;
    const t = elapsed / duration;

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

- [ ] **Step 2: Verify the file parses**

Run:
```bash
node --input-type=module < src/ui/exercise-animation.js 2>&1 | head -5
```

Expected: output about `requestAnimationFrame` or `performance` not defined (Node globals). What you must NOT see: `SyntaxError`.

- [ ] **Step 3: Commit**

```bash
git add src/ui/exercise-animation.js
git commit -m "feat: exercise skeleton animation — keyframes for squat/deadlift/push-up/bench-press"
```

---

## Task 4: Update `src/tabs/exercises.js` and finalize `src/app.js`

**Files:**
- Modify: `src/tabs/exercises.js`
- Modify: `src/app.js`

- [ ] **Step 1: Read both files**

Read `src/tabs/exercises.js` and `src/app.js` to confirm current state before editing.

- [ ] **Step 2: Add import to `src/tabs/exercises.js`**

At the top of `src/tabs/exercises.js`, after the existing import:
```js
import { MUSCLE_GROUPS, exercisesByMuscle, EXERCISES } from '../data/exercise-library.js';
```

Add:
```js
import { startAnimation, stopAnimation } from '../ui/exercise-animation.js';
```

- [ ] **Step 3: Replace the placeholder div with a canvas in `renderExerciseDetail`**

In `src/tabs/exercises.js`, inside `renderExerciseDetail`, change:
```js
      <div style="background:#000;border-radius:6px;height:140px;display:flex;align-items:center;justify-content:center;margin-bottom:0.75rem">
        <span style="color:#333;font-size:0.7rem">[ Form guide video ]</span>
      </div>
```

To:
```js
      <canvas id="exercise-anim-canvas" width="300" height="180"
        style="width:100%;border-radius:6px;background:#000;display:block;margin-bottom:0.75rem"></canvas>
```

- [ ] **Step 4: Start animation after detail renders, stop on back button**

In `src/tabs/exercises.js`, inside `attachCardListeners`, the section that renders exercise detail currently looks like:

```js
    detail.style.display = 'block';
    detail.innerHTML = renderExerciseDetail(ex);

    document.getElementById('back-to-list').addEventListener('click', () => {
      detail.style.display = 'none';
      document.getElementById('exercise-list').style.display = 'block';
    });
```

Change it to:

```js
    detail.style.display = 'block';
    detail.innerHTML = renderExerciseDetail(ex);
    const canvas = document.getElementById('exercise-anim-canvas');
    if (canvas) startAnimation(canvas, ex.id);

    document.getElementById('back-to-list').addEventListener('click', () => {
      stopAnimation();
      detail.style.display = 'none';
      document.getElementById('exercise-list').style.display = 'block';
    });
```

- [ ] **Step 5: Add `stopAnimation` call at the top of `switchTab` in `src/app.js`**

Add the import for `stopAnimation` at the top of `src/app.js` (after existing imports):
```js
import { stopAnimation } from './ui/exercise-animation.js';
```

Then change `switchTab` to call `stopAnimation()` at its very start:

```js
function switchTab(id) {
  stopAnimation();
  const tab = TABS.find(t => t.id === id);
  if (!tab) return;
  activeTab = id;
  document.getElementById('tab-content').innerHTML = tab.render();
  document.querySelectorAll('#bottom-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === id);
  });
  if (id === 'analyze') {
    import('./tabs/analyze.js').then(m => m.attachAnalyzeListeners());
  }
  if (id === 'exercises') {
    import('./tabs/exercises.js').then(m => m.attachExercisesListeners());
  }
  if (id === 'history') {
    import('./tabs/history.js').then(m => m.attachHistoryListeners());
  }
}
```

- [ ] **Step 6: Verify no `[ Form guide video ]` text remains**

Run:
```bash
grep -n "Form guide video" src/tabs/exercises.js
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/tabs/exercises.js src/app.js
git commit -m "feat: exercise detail shows skeleton animation; stop animation on tab switch"
```
