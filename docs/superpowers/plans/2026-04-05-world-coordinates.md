# World Coordinates — Angle-Invariant Form Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 2D image-coordinate geometry with MediaPipe 3D world coordinates so form rules and exercise detection produce correct results from any camera angle.

**Architecture:** `processVideo` in `detector.js` is changed to return `{ image, world }` objects per frame instead of bare landmark arrays. `rules.js` gets a 3D-aware `angleDeg`, a new `horizDist` helper, and `evaluateRules` passes `frame.world` to each rule check. All exercise rule files are rewritten with world-coordinate thresholds (metres, Y up). The overlay reads `frame.image` for drawing.

**Tech Stack:** MediaPipe Tasks Vision (`poseWorldLandmarks`), Vitest

---

## File Map

| File | Change |
|---|---|
| `src/pose/detector.js` | Return `{ image, world }` per frame |
| `src/engine/rules.js` | 3D `angleDeg`, new `horizDist` export, `evaluateRules` passes `frame.world` |
| `src/engine/exercise-detector.js` | Use `frame.world`, fix Y sign convention |
| `src/engine/exercises/squat.js` | Rewrite with world coords + `horizDist` |
| `src/engine/exercises/deadlift.js` | Rewrite with world coords + `horizDist` |
| `src/engine/exercises/push-up.js` | Rewrite with world coords |
| `src/engine/exercises/bench-press.js` | Rewrite with world coords |
| `src/pose/overlay.js` | Read `frame.image` instead of bare `frame` |
| `src/tabs/results.js` | Pass `frame.image` to `drawOverlay` |
| `tests/engine/rules.test.js` | Test 3D `angleDeg` with z; `evaluateRules` with `{ image, world }` frames |
| `tests/engine/exercise-detector.test.js` | Wrap frames in `{ image, world }` using world Y-up values |
| `tests/engine/analysis-runner.test.js` | Mock returns `[{ image: lm, world: lm }]` |

---

### Task 1: Extend `angleDeg` to 3D and add `horizDist` in `rules.js`

**Files:**
- Modify: `src/engine/rules.js`
- Modify: `tests/engine/rules.test.js`

- [ ] **Step 1: Write failing tests for 3D `angleDeg` and `horizDist`**

Add to `tests/engine/rules.test.js` (keep existing tests, add below):

```js
describe('angleDeg — 3D', () => {
  it('returns 90 for a right angle in the XZ plane (y=0)', () => {
    // a is in +x, c is in +z, b is at origin — right angle at b
    const a = { x: 1, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 0, y: 0, z: 1 };
    expect(angleDeg(a, b, c)).toBeCloseTo(90, 0);
  });

  it('returns correct 3D angle that would be wrong in 2D', () => {
    // Same y-coords (y=0.5 for all) but z differs — purely z-axis angle
    // 2D would see this as 0° (all same x,y); 3D gives 90°
    const a = { x: 0.5, y: 0.5, z: 1 };
    const b = { x: 0.5, y: 0.5, z: 0 };
    const c = { x: 0.5, y: 0.5, z: -1 };
    // a-b vector: z=+1; c-b vector: z=-1 → 180°
    expect(angleDeg(a, b, c)).toBeCloseTo(180, 0);
  });
});
```

Add import for `horizDist`:
```js
import { angleDeg, horizDist, LM, evaluateRules } from '../../src/engine/rules.js';
```

Add `horizDist` test:
```js
describe('horizDist', () => {
  it('returns distance in XZ plane ignoring Y', () => {
    const a = { x: 0, y: 100, z: 0 };  // y=100 should not matter
    const b = { x: 3, y: 200, z: 4 };
    expect(horizDist(a, b)).toBeCloseTo(5, 5);  // 3-4-5 right triangle
  });

  it('returns 0 for same XZ coords', () => {
    const a = { x: 1, y: 5, z: 2 };
    const b = { x: 1, y: 99, z: 2 };
    expect(horizDist(a, b)).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run tests/engine/rules.test.js
```

Expected: FAIL — `horizDist is not a function` (or similar import error)

- [ ] **Step 3: Implement 3D `angleDeg` and `horizDist` in `rules.js`**

Replace `src/engine/rules.js` with:

```js
export const LM = {
  NOSE: 0,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13,    R_ELBOW: 14,
  L_WRIST: 15,    R_WRIST: 16,
  L_HIP: 23,      R_HIP: 24,
  L_KNEE: 25,     R_KNEE: 26,
  L_ANKLE: 27,    R_ANKLE: 28,
};

/**
 * Returns the angle in degrees at joint B using 3D vectors.
 * Falls back to 2D when z is absent (backward compatible).
 */
export function angleDeg(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const mag = Math.sqrt((ab.x ** 2 + ab.y ** 2 + ab.z ** 2) * (cb.x ** 2 + cb.y ** 2 + cb.z ** 2));
  if (mag === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
}

/**
 * Horizontal distance between two points in the world XZ plane.
 * Camera-invariant — Y (height) is ignored.
 */
export function horizDist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Evaluates a set of rules against an array of pose frames.
 * Frames may be bare landmark arrays OR { image, world } objects.
 * Rules receive world landmarks when available.
 */
export function evaluateRules(rules, frames) {
  if (frames.length === 0) return rules.map(rule => ({
    id: rule.id, label: rule.label, severity: rule.severity, cue: rule.cue, pass: true,
  }));
  return rules.map(rule => {
    const passCount = frames.filter(f => rule.check(f.world ?? f)).length;
    const pass = passCount / frames.length >= 0.5;
    return { id: rule.id, label: rule.label, severity: rule.severity, cue: rule.cue, pass };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run tests/engine/rules.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && git add src/engine/rules.js tests/engine/rules.test.js && git commit -m "feat: extend angleDeg to 3D, add horizDist, pass world coords in evaluateRules"
```

---

### Task 2: Rewrite squat rules with world coordinates

**Files:**
- Modify: `src/engine/exercises/squat.js`

No new test file — exercise rule checks are pure functions; they'll be covered by analysis-runner integration. (No `tests/engine/exercises/` directory exists in this project.)

- [ ] **Step 1: Rewrite `squat.js`**

Replace `src/engine/exercises/squat.js` with:

```js
import { LM, angleDeg, horizDist } from '../rules.js';

export const SQUAT_RULES = [
  {
    id: 'knees_over_toes',
    label: 'Knees track over toes',
    severity: 'error',
    cue: 'Push your knees outward in line with your toes throughout the movement.',
    check(lm) {
      // Horizontal distance between knee and ankle in world XZ plane — camera-invariant
      return horizDist(lm[LM.L_KNEE], lm[LM.L_ANKLE]) < 0.15
          && horizDist(lm[LM.R_KNEE], lm[LM.R_ANKLE]) < 0.15;
    },
  },
  {
    id: 'back_neutral',
    label: 'Torso stays upright',
    severity: 'error',
    cue: 'Keep your chest up — avoid collapsing your torso forward.',
    check(lm) {
      // True 3D angle at hip — correct from any camera angle
      return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_KNEE]) > 90;
    },
  },
  {
    id: 'squat_depth',
    label: 'Hip reaches parallel or below',
    severity: 'warning',
    cue: 'Try to lower your hips to at least knee height for full range of motion.',
    check(lm) {
      // World Y is up: hip.y > knee.y when standing; at parallel they are nearly equal
      const lDepth = lm[LM.L_HIP].y - lm[LM.L_KNEE].y < 0.05;
      const rDepth = lm[LM.R_HIP].y - lm[LM.R_KNEE].y < 0.05;
      return lDepth && rDepth;
    },
  },
];
```

- [ ] **Step 2: Verify no import errors**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run tests/engine/rules.test.js
```

Expected: All tests still PASS (squat rules import from rules.js, not tested directly)

- [ ] **Step 3: Commit**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && git add src/engine/exercises/squat.js && git commit -m "feat: rewrite squat rules with world coordinates"
```

---

### Task 3: Rewrite deadlift rules with world coordinates

**Files:**
- Modify: `src/engine/exercises/deadlift.js`

- [ ] **Step 1: Rewrite `deadlift.js`**

Replace `src/engine/exercises/deadlift.js` with:

```js
import { LM, angleDeg, horizDist } from '../rules.js';

export const DEADLIFT_RULES = [
  {
    id: 'back_flat',
    label: 'Back stays flat',
    severity: 'error',
    cue: 'Keep your chest up and back flat — do not let your shoulders drop below your hips.',
    check(lm) {
      // 3D angle at hip: shoulder–hip–knee; flat back = torso at angle > 40° from vertical
      return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_KNEE]) > 40;
    },
  },
  {
    id: 'hips_not_too_high',
    label: 'Hips at proper starting height',
    severity: 'warning',
    cue: 'Sit into the lift — hips should not be so high that it becomes a stiff-leg deadlift.',
    check(lm) {
      // World Y up: hip should not be more than 0.5m above knee
      return lm[LM.L_HIP].y - lm[LM.L_KNEE].y < 0.5;
    },
  },
  {
    id: 'bar_over_feet',
    label: 'Bar stays close to body',
    severity: 'error',
    cue: 'Keep the bar (wrists) close to your legs — drifting forward adds dangerous spinal load.',
    check(lm) {
      // Horizontal distance between wrist and ankle — camera-invariant
      return horizDist(lm[LM.L_WRIST], lm[LM.L_ANKLE]) < 0.15;
    },
  },
];
```

- [ ] **Step 2: Verify no import errors**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run tests/engine/rules.test.js
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && git add src/engine/exercises/deadlift.js && git commit -m "feat: rewrite deadlift rules with world coordinates"
```

---

### Task 4: Rewrite push-up rules with world coordinates

**Files:**
- Modify: `src/engine/exercises/push-up.js`

- [ ] **Step 1: Rewrite `push-up.js`**

Replace `src/engine/exercises/push-up.js` with:

```js
import { LM, angleDeg } from '../rules.js';

export const PUSHUP_RULES = [
  {
    id: 'body_straight',
    label: 'Body stays in a straight line',
    severity: 'error',
    cue: 'Keep your hips level — do not let them sag toward the floor or pike up.',
    check(lm) {
      // 3D angle at hip: shoulder–hip–ankle; straight body = ~180°
      return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_ANKLE]) > 165;
    },
  },
  {
    id: 'elbows_not_flared',
    label: 'Elbows at ~45-75° from torso',
    severity: 'warning',
    cue: 'Tuck your elbows slightly — avoid flaring them out to 90° which strains the shoulder.',
    check(lm) {
      // 3D elbow angle: shoulder–elbow–wrist; not flared = < 110°
      return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]) < 110;
    },
  },
  {
    id: 'full_depth',
    label: 'Chest reaches near the floor',
    severity: 'warning',
    cue: 'Lower until your chest nearly touches the floor for full range of motion.',
    check(lm) {
      // At full depth the elbow angle is sharper
      return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]) < 100;
    },
  },
];
```

- [ ] **Step 2: Verify no import errors**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run tests/engine/rules.test.js
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && git add src/engine/exercises/push-up.js && git commit -m "feat: rewrite push-up rules with world coordinates"
```

---

### Task 5: Rewrite bench press rules with world coordinates

**Files:**
- Modify: `src/engine/exercises/bench-press.js`

- [ ] **Step 1: Rewrite `bench-press.js`**

Replace `src/engine/exercises/bench-press.js` with:

```js
import { LM, angleDeg } from '../rules.js';

export const BENCH_RULES = [
  {
    id: 'elbows_at_75',
    label: 'Elbows at ~75° from torso',
    severity: 'error',
    cue: 'Do not flare elbows to 90°. Tuck them to ~75° to protect your shoulders.',
    check(lm) {
      // 3D angle at shoulder: hip–shoulder–elbow; good form = 30–85°
      const angle = angleDeg(lm[LM.L_HIP], lm[LM.L_SHOULDER], lm[LM.L_ELBOW]);
      return angle > 30 && angle < 85;
    },
  },
  {
    id: 'bar_to_lower_chest',
    label: 'Bar lowers to lower chest',
    severity: 'warning',
    cue: 'Lower the bar to your lower chest / nipple line, not your upper chest or neck.',
    check(lm) {
      // World Y (lying horizontal): bar at chest → wrist.y ≈ shoulder.y
      const wristY   = (lm[LM.L_WRIST].y   + lm[LM.R_WRIST].y)   / 2;
      const shoulderY = (lm[LM.L_SHOULDER].y + lm[LM.R_SHOULDER].y) / 2;
      return Math.abs(wristY - shoulderY) < 0.12;
    },
  },
  {
    id: 'scapular_retraction',
    label: 'Shoulders level on bench',
    severity: 'warning',
    cue: 'Keep both shoulders in contact with the bench — avoid one side rising higher than the other.',
    check(lm) {
      // World Y: both shoulders at same height → small Y difference
      return Math.abs(lm[LM.L_SHOULDER].y - lm[LM.R_SHOULDER].y) < 0.06;
    },
  },
];
```

- [ ] **Step 2: Verify no import errors**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run tests/engine/rules.test.js
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && git add src/engine/exercises/bench-press.js && git commit -m "feat: rewrite bench-press rules with world coordinates"
```

---

### Task 6: Change `processVideo` to return `{ image, world }` per frame

**Files:**
- Modify: `src/pose/detector.js`

- [ ] **Step 1: Modify `detector.js` to return both landmark sets**

In `src/pose/detector.js`, change the frame-push block from:

```js
if (result.landmarks?.[0]) {
  frames.push(result.landmarks[0]);
}
```

To:

```js
if (result.landmarks?.[0] && result.worldLandmarks?.[0]) {
  frames.push({ image: result.landmarks[0], world: result.worldLandmarks[0] });
}
```

Also update the JSDoc return type comment from:
```
 * @returns {Promise<Array<Array<{x,y,z,visibility}>>>}
```
To:
```
 * @returns {Promise<Array<{image: Array<{x,y,z,visibility}>, world: Array<{x,y,z,visibility}>}>>}
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && node --input-type=module --eval "import('/Users/maksimkovshilovsky/code/fitness-former/src/pose/detector.js').catch(e => console.log('SKIPPING (browser-only):', e.message))"
```

Expected: "SKIPPING (browser-only):" or "Cannot find package '@mediapipe'" — either means the file parses without syntax errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && git add src/pose/detector.js && git commit -m "feat: processVideo returns { image, world } per frame"
```

---

### Task 7: Update `exercise-detector.js` to use world coordinates

**Files:**
- Modify: `src/engine/exercise-detector.js`
- Modify: `tests/engine/exercise-detector.test.js`

- [ ] **Step 1: Update the exercise-detector test to use `{ image, world }` frame shape with world Y-up values**

Replace `tests/engine/exercise-detector.test.js` with:

```js
import { detectExercise } from '../../src/engine/exercise-detector.js';
import { LM } from '../../src/engine/rules.js';

// World coordinates: Y is UP (positive = above origin).
// Standing: shoulder ~1.4m, hip ~1.0m, knee ~0.5m, ankle ~0.0m above origin.
function worldLm(overrides = {}) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  Object.entries(overrides).forEach(([i, v]) => { pts[i] = { ...pts[i], ...v }; });
  return pts;
}

function frame(worldOverrides = {}) {
  const world = worldLm(worldOverrides);
  return { image: world, world };
}

describe('detectExercise', () => {
  it('detects squat when hips are near knee level (world Y)', () => {
    // At the bottom of a squat hip.y ≈ knee.y (both low, within 0.15m)
    const f = frame({
      [LM.L_SHOULDER]: { y: 0.9 },
      [LM.R_SHOULDER]: { y: 0.9 },
      [LM.L_HIP]:      { y: 0.3 },
      [LM.R_HIP]:      { y: 0.3 },
      [LM.L_KNEE]:     { y: 0.2 },
      [LM.R_KNEE]:     { y: 0.2 },
      [LM.L_ANKLE]:    { y: 0.0 },
      [LM.R_ANKLE]:    { y: 0.0 },
    });
    expect(detectExercise([f])).toBe('squat');
  });

  it('detects push-up when person is horizontal', () => {
    // Push-up: shoulder and hip at same world-Y height (lying flat)
    const f = frame({
      [LM.L_SHOULDER]: { x: -0.3, y: 0.5 },
      [LM.R_SHOULDER]: { x:  0.3, y: 0.5 },
      [LM.L_HIP]:      { x: -0.3, y: 0.5 },
      [LM.R_HIP]:      { x:  0.3, y: 0.5 },
      [LM.L_ANKLE]:    { x: -0.3, y: 0.5 },
      [LM.R_ANKLE]:    { x:  0.3, y: 0.5 },
    });
    expect(detectExercise([f])).toBe('push-up');
  });

  it('returns null when no exercise is confidently detected', () => {
    // All landmarks at origin — yVariation < 0.1 → skipped
    expect(detectExercise([frame()])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to see them fail**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run tests/engine/exercise-detector.test.js
```

Expected: FAIL — `detectExercise` still reads bare `lm` arrays, not `frame.world`

- [ ] **Step 3: Rewrite `exercise-detector.js` to use `frame.world`**

Replace `src/engine/exercise-detector.js` with:

```js
import { LM } from './rules.js';

/**
 * Stage 1 — Body orientation using world coordinates.
 *
 * World Y is UP (metres). Standing: shoulder.y >> hip.y.
 * Horizontal (lying): shoulder.y ≈ hip.y.
 *
 * HORIZONTAL_THRESHOLD is in metres — ~15 cm difference is the boundary.
 */
const HORIZONTAL_THRESHOLD = 0.15;

/**
 * Stage 2 — Exercise classification within each orientation group.
 *
 * Horizontal:  push-up | bench-press
 *   Push-up:   ankles at same world-Y as hips (whole body on floor at same height).
 *   Bench press: ankles below hips (feet on floor, torso elevated on bench).
 *
 * Vertical:    squat | deadlift
 *   Squat:     hip.y has dropped to within 0.15m of knee.y (parallel or below).
 *   Deadlift:  hips stay > 0.15m above knees with compressed shoulder–hip gap.
 */

export function detectExercise(frames) {
  const scores = { squat: 0, deadlift: 0, 'push-up': 0, 'bench-press': 0 };
  let scoredFrames = 0;

  for (const frame of frames) {
    // Accept both { image, world } objects and bare landmark arrays (backward compat)
    const world = frame.world ?? frame;

    const shoulderY = (world[LM.L_SHOULDER].y + world[LM.R_SHOULDER].y) / 2;
    const hipY      = (world[LM.L_HIP].y      + world[LM.R_HIP].y)      / 2;
    const kneeY     = (world[LM.L_KNEE].y     + world[LM.R_KNEE].y)     / 2;
    const ankleY    = (world[LM.L_ANKLE].y    + world[LM.R_ANKLE].y)    / 2;

    // ── Stage 1: Body orientation ──────────────────────────────────────────
    const shoulderHipYDiff = Math.abs(shoulderY - hipY);
    const isHorizontal = shoulderHipYDiff < HORIZONTAL_THRESHOLD;

    if (isHorizontal) {
      // ── Stage 2a: Horizontal exercises ───────────────────────────────────
      // Guard: require the body to actually span space in XZ.
      const shoulderX = (world[LM.L_SHOULDER].x + world[LM.R_SHOULDER].x) / 2;
      const ankleX    = (world[LM.L_ANKLE].x    + world[LM.R_ANKLE].x)    / 2;
      if (Math.abs(shoulderX - ankleX) < 0.15) continue;

      // Push-up: whole body on floor → ankles at same height as hips.
      // Bench press: ankles below hips (feet on floor, torso elevated).
      const ankleAlignedWithBody = Math.abs(ankleY - hipY) < 0.2;
      scores[ankleAlignedWithBody ? 'push-up' : 'bench-press'] += 1;
      scoredFrames++;
    } else {
      // ── Stage 2b: Vertical exercises ─────────────────────────────────────
      // Skip frames where landmarks have collapsed to a single point.
      const yVariation = shoulderHipYDiff + Math.abs(hipY - kneeY) + Math.abs(kneeY - ankleY);
      if (yVariation < 0.1) continue;
      scoredFrames++;

      // World Y up: at squat parallel, knee has risen close to hip level.
      // hipY - kneeY < 0.15m means they are nearly at the same height.
      if (hipY - kneeY < 0.15) {
        scores.squat += 1;
      } else if (shoulderHipYDiff < 0.25) {
        // Deadlift: hips above knees with compressed shoulder–hip gap.
        scores.deadlift += 1;
      }
    }
  }

  if (scoredFrames === 0) return null;
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best[1] === 0) return null;
  const confidence = best[1] / scoredFrames;
  if (confidence < 0.3) return null;
  return best[0];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run tests/engine/exercise-detector.test.js
```

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && git add src/engine/exercise-detector.js tests/engine/exercise-detector.test.js && git commit -m "feat: exercise-detector uses world coordinates with Y-up sign convention"
```

---

### Task 8: Update overlay and results to read `frame.image`

**Files:**
- Modify: `src/pose/overlay.js`
- Modify: `src/tabs/results.js`

The overlay already draws skeleton bones (BONES array with gradient lines) and the surface plane (drawSurface). No logic changes are needed — only the call sites need updating.

- [ ] **Step 1: Fix `drawSurface` in `overlay.js` — it uses image-coord y for pixel positions**

The `drawSurface` function currently receives a `landmarks` argument and uses `p.y * height` for pixel positions. This is correct — it must continue to receive image landmarks (not world), because image landmarks have x,y in [0,1] matching pixel coordinates. No change needed to `overlay.js` itself.

- [ ] **Step 2: Fix `drawOverlay` call in `results.js`**

In `src/tabs/results.js`, find the line inside the `timeupdate` listener:

```js
drawOverlay(ctx, canvas.width, canvas.height, frames[frameIdx], ruleResults, result.exercise);
```

Change it to:

```js
drawOverlay(ctx, canvas.width, canvas.height, frames[frameIdx].image ?? frames[frameIdx], ruleResults, result.exercise);
```

The `?? frames[frameIdx]` fallback handles any edge case where a frame lacks the `.image` property.

- [ ] **Step 3: Run the full test suite to check nothing is broken**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && git add src/tabs/results.js && git commit -m "fix: pass frame.image to drawOverlay after frame format change"
```

---

### Task 9: Update `analysis-runner.test.js` mock to use `{ image, world }` frames

**Files:**
- Modify: `tests/engine/analysis-runner.test.js`

- [ ] **Step 1: Update the mock in `analysis-runner.test.js`**

The mock currently returns a bare landmark array. After the `detector.js` change, it must return `{ image, world }` objects. Also, `detectExercise` now reads `frame.world` — the squat test relies on world-Y values matching squat heuristics.

Replace `tests/engine/analysis-runner.test.js` with:

```js
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Build a landmark array where the body looks like a squat in world coordinates:
// hip.y (0.3) - knee.y (0.2) = 0.1 < 0.15 → squat
// shoulderY (0.9) - hipY (0.3) = 0.6 > HORIZONTAL_THRESHOLD (0.15) → vertical
function squatWorldLm() {
  const pts = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  // LM indices: L_SHOULDER=11, R_SHOULDER=12, L_HIP=23, R_HIP=24, L_KNEE=25, R_KNEE=26, L_ANKLE=27, R_ANKLE=28
  pts[11] = { x: 0, y: 0.9, z: 0, visibility: 1 }; // L_SHOULDER
  pts[12] = { x: 0, y: 0.9, z: 0, visibility: 1 }; // R_SHOULDER
  pts[23] = { x: 0, y: 0.3, z: 0, visibility: 1 }; // L_HIP
  pts[24] = { x: 0, y: 0.3, z: 0, visibility: 1 }; // R_HIP
  pts[25] = { x: 0, y: 0.2, z: 0, visibility: 1 }; // L_KNEE
  pts[26] = { x: 0, y: 0.2, z: 0, visibility: 1 }; // R_KNEE
  pts[27] = { x: 0, y: 0.0, z: 0, visibility: 1 }; // L_ANKLE
  pts[28] = { x: 0, y: 0.0, z: 0, visibility: 1 }; // R_ANKLE
  return pts;
}

vi.mock('../../src/pose/detector.js', () => ({
  processVideo: vi.fn().mockResolvedValue([
    { image: squatWorldLm(), world: squatWorldLm() },
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
    expect(result.exercise).toBe('squat');
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run tests/engine/analysis-runner.test.js
```

Expected: Both tests PASS

- [ ] **Step 3: Run the full test suite**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && git add tests/engine/analysis-runner.test.js && git commit -m "test: update analysis-runner mock to { image, world } frame shape"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `processVideo` returns `{ image, world }` | Task 6 |
| `angleDeg` extended to 3D using z | Task 1 |
| New `horizDist` export | Task 1 |
| `evaluateRules` passes `frame.world` to checks | Task 1 |
| Squat rules rewritten with world coords | Task 2 |
| Deadlift rules rewritten with world coords | Task 3 |
| Push-up rules rewritten with world coords | Task 4 |
| Bench-press rules rewritten with world coords | Task 5 |
| `exercise-detector` uses `frame.world` | Task 7 |
| `exercise-detector` Y sign convention flip | Task 7 |
| `overlay.js` reads `frame.image` (call site) | Task 8 |
| `results.js` passes `frame.image` to `drawOverlay` | Task 8 |
| `exercise-detector.test.js` updated | Task 7 |
| `analysis-runner.test.js` updated | Task 9 |
| `rules.test.js` updated | Task 1 |

**Placeholder scan:** None found. All code is complete with actual implementations.

**Type consistency:** `horizDist` is exported from `rules.js` in Task 1 and imported in Tasks 2 and 3. `frame.world ?? frame` fallback is consistent across `exercise-detector.js` (Task 7) and `evaluateRules` (Task 1). `frame.image ?? frame` fallback is consistent in `results.js` (Task 8).

**Backward compatibility:** `angleDeg` uses `?? 0` for z so it works with points that have no z. `evaluateRules` uses `f.world ?? f` so bare landmark arrays still work. `exercise-detector` uses `frame.world ?? frame` for same reason. `results.js` uses `frames[frameIdx].image ?? frames[frameIdx]`.
