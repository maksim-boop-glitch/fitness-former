# Accuracy Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve form analysis accuracy via four engine changes: doubled frame sample rate, full 3D z-depth usage, body-size-normalized thresholds, and rep-phase gating.

**Architecture:** Two new utility modules (`body-metrics.js`, `rep-phases.js`) feed into a rewritten `analysis-runner.js`. Exercise files convert from static rule arrays to factory functions that accept `shinLength`. `evaluateRules` gains an optional `phaseFrames` filter.

**Tech Stack:** Vanilla JS, Vitest (tests), MediaPipe world landmarks (3D, Y-up, metres)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/engine/body-metrics.js` | `computeBodyMetrics(worldFrames)` → `{ shinLength }` |
| Create | `src/engine/rep-phases.js` | `getBottomPhaseFrames(worldFrames, exerciseId)` → `Set<number>` |
| Modify | `src/pose/detector.js` | Default `sampleRate` 10 → 5 |
| Modify | `src/engine/rules.js` | `evaluateRules(rules, frames, phaseFrames?)` |
| Modify | `src/engine/exercises/squat.js` | `getSquatRules(shinLength)` factory, normalized thresholds |
| Modify | `src/engine/exercises/deadlift.js` | `getDeadliftRules(shinLength)` factory, normalized thresholds |
| Modify | `src/engine/exercises/push-up.js` | `getPushUpRules(shinLength)` factory (angles unchanged) |
| Modify | `src/engine/exercises/bench-press.js` | `getBenchRules(shinLength)` factory, normalized thresholds, z-depth check |
| Modify | `src/engine/exercises/index.js` | `getExerciseRules(exercise, shinLength)` dispatcher |
| Modify | `src/engine/analysis-runner.js` | Wire shinLength + phaseFrames; stride 5 |
| Create | `tests/engine/body-metrics.test.js` | Unit tests for `computeBodyMetrics` |
| Create | `tests/engine/rep-phases.test.js` | Unit tests for `getBottomPhaseFrames` |
| Modify | `tests/engine/rules.test.js` | Add phaseFrames tests to `evaluateRules` suite |

---

## Task 1: `src/engine/body-metrics.js`

**Files:**
- Create: `src/engine/body-metrics.js`
- Create: `tests/engine/body-metrics.test.js`

Uses `LM` constants from `src/engine/rules.js`: `L_KNEE=25, R_KNEE=26, L_ANKLE=27, R_ANKLE=28`.

MediaPipe world landmarks: Y is UP. Standing: ankle.y ≈ 0, knee.y ≈ 0.5. Shin length = `knee.y - ankle.y`.

- [ ] **Step 1: Write the failing test**

```js
// tests/engine/body-metrics.test.js
import { computeBodyMetrics } from '../../src/engine/body-metrics.js';

function makeLm(kneeY, ankleY) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  lm[25] = { ...lm[25], y: kneeY };  // L_KNEE
  lm[26] = { ...lm[26], y: kneeY };  // R_KNEE
  lm[27] = { ...lm[27], y: ankleY }; // L_ANKLE
  lm[28] = { ...lm[28], y: ankleY }; // R_ANKLE
  return lm;
}

describe('computeBodyMetrics', () => {
  it('returns shinLength as median knee-ankle distance', () => {
    const frames = [makeLm(0.5, 0.0), makeLm(0.5, 0.0), makeLm(0.5, 0.0)];
    const { shinLength } = computeBodyMetrics(frames);
    expect(shinLength).toBeCloseTo(0.5, 2);
  });

  it('falls back to 0.5 when fewer than 3 valid frames', () => {
    expect(computeBodyMetrics([]).shinLength).toBe(0.5);
    expect(computeBodyMetrics([makeLm(0.3, 0.0), makeLm(0.3, 0.0)]).shinLength).toBe(0.5);
  });

  it('uses median to resist outliers', () => {
    // 5 frames: 4 with shin=0.5, 1 outlier with shin=2.0
    const frames = [
      makeLm(0.5, 0.0), makeLm(0.5, 0.0), makeLm(0.5, 0.0),
      makeLm(0.5, 0.0), makeLm(2.0, 0.0),
    ];
    const { shinLength } = computeBodyMetrics(frames);
    expect(shinLength).toBeCloseTo(0.5, 2);
  });

  it('averages left and right shin per frame', () => {
    // L shin = 0.4, R shin = 0.6 → avg = 0.5 per frame
    const frames = Array.from({ length: 3 }, () => {
      const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
      lm[25] = { ...lm[25], y: 0.4 }; // L_KNEE
      lm[26] = { ...lm[26], y: 0.6 }; // R_KNEE
      lm[27] = { ...lm[27], y: 0.0 }; // L_ANKLE
      lm[28] = { ...lm[28], y: 0.0 }; // R_ANKLE
      return lm;
    });
    const { shinLength } = computeBodyMetrics(frames);
    expect(shinLength).toBeCloseTo(0.5, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/maksimkovshilovsky/code/fitness-former && npx vitest run tests/engine/body-metrics.test.js 2>&1 | tail -15
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `body-metrics.js`**

```js
// src/engine/body-metrics.js
import { LM } from './rules.js';

/**
 * Computes body size metrics from an array of world landmark arrays.
 * For each frame: averages left and right shin length (knee.y - ankle.y).
 * Returns the median across all frames (resistant to outlier frames).
 * Falls back to 0.5m (average adult) when fewer than 3 valid frames exist.
 *
 * @param {Array<Array<{x,y,z,visibility}>>} worldFrames
 * @returns {{ shinLength: number }}
 */
export function computeBodyMetrics(worldFrames) {
  const shins = [];
  for (const lm of worldFrames) {
    const lShin = lm[LM.L_KNEE].y - lm[LM.L_ANKLE].y;
    const rShin = lm[LM.R_KNEE].y - lm[LM.R_ANKLE].y;
    const avg = (lShin + rShin) / 2;
    if (avg > 0) shins.push(avg);
  }
  if (shins.length < 3) return { shinLength: 0.5 };
  shins.sort((a, b) => a - b);
  const mid = Math.floor(shins.length / 2);
  const shinLength = shins.length % 2 === 0
    ? (shins[mid - 1] + shins[mid]) / 2
    : shins[mid];
  return { shinLength };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/engine/body-metrics.test.js 2>&1 | tail -10
```

Expected: 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/engine/body-metrics.js tests/engine/body-metrics.test.js
git commit -m "feat: add body-metrics module for shin-length computation"
```

---

## Task 2: `src/engine/rep-phases.js`

**Files:**
- Create: `src/engine/rep-phases.js`
- Create: `tests/engine/rep-phases.test.js`

MediaPipe world coords: Y is UP. At the bottom of a squat, hip Y is LOW (person crouches, hips descend). "Bottom phase" = frames where the phase signal is in the lowest 30% of the observed range.

LM constants used: `L_HIP=23, R_HIP=24, L_WRIST=15, R_WRIST=16`.

- [ ] **Step 1: Write the failing test**

```js
// tests/engine/rep-phases.test.js
import { getBottomPhaseFrames } from '../../src/engine/rep-phases.js';

function makeLmWithHip(hipY) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  lm[23] = { ...lm[23], y: hipY }; // L_HIP
  lm[24] = { ...lm[24], y: hipY }; // R_HIP
  return lm;
}

function makeLmWithWrist(wristY) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  lm[15] = { ...lm[15], y: wristY }; // L_WRIST
  lm[16] = { ...lm[16], y: wristY }; // R_WRIST
  return lm;
}

describe('getBottomPhaseFrames', () => {
  it('returns all frame indices for deadlift', () => {
    const frames = [makeLmWithHip(1.0), makeLmWithHip(0.8), makeLmWithHip(0.6)];
    const result = getBottomPhaseFrames(frames, 'deadlift');
    expect([...result].sort((a,b)=>a-b)).toEqual([0, 1, 2]);
  });

  it('returns bottom 30% frames for squat by hip Y', () => {
    // Hip Y descends from 1.0 (standing) to 0.3 (bottom) across 10 frames
    // range = 0.7, threshold = 0.3 + 0.3*0.7 = 0.51
    // Frames with hip.y <= 0.51 are bottom phase
    const frames = Array.from({ length: 10 }, (_, i) => {
      const hipY = 1.0 - (i * 0.07); // 1.0, 0.93, ..., 0.37, 0.30
      return makeLmWithHip(hipY);
    });
    const result = getBottomPhaseFrames(frames, 'squat');
    // frames 8 (hipY=0.44) and 9 (hipY=0.37) are <= 0.51
    // Also frame index 7 (hipY=0.51) is on boundary
    expect(result.has(9)).toBe(true);  // definitely in bottom
    expect(result.has(0)).toBe(false); // standing, not in bottom
  });

  it('returns all frames when signal range < 0.05m (static hold)', () => {
    // Hips barely move — signal range is tiny
    const frames = [makeLmWithHip(0.50), makeLmWithHip(0.51), makeLmWithHip(0.50),
                    makeLmWithHip(0.51), makeLmWithHip(0.50)];
    const result = getBottomPhaseFrames(frames, 'squat');
    expect([...result].sort((a,b)=>a-b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns all frames when fewer than 3 valid landmark frames', () => {
    const frames = [makeLmWithHip(1.0), makeLmWithHip(0.5)];
    const result = getBottomPhaseFrames(frames, 'squat');
    expect([...result].sort((a,b)=>a-b)).toEqual([0, 1]);
  });

  it('uses wrist Y for push-up bottom phase', () => {
    // Wrists descend during push-up
    const frames = Array.from({ length: 6 }, (_, i) => {
      const wristY = 0.6 - (i * 0.1); // 0.6, 0.5, 0.4, 0.3, 0.2, 0.1
      return makeLmWithWrist(wristY);
    });
    const result = getBottomPhaseFrames(frames, 'push-up');
    // range=0.5, threshold = 0.1 + 0.3*0.5 = 0.25
    // frames with wristY <= 0.25: indices 4 (0.2) and 5 (0.1)
    expect(result.has(5)).toBe(true);
    expect(result.has(0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/rep-phases.test.js 2>&1 | tail -15
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `rep-phases.js`**

```js
// src/engine/rep-phases.js
import { LM } from './rules.js';

const PHASE_CONFIG = {
  squat: {
    signal: lm => (lm[LM.L_HIP].y + lm[LM.R_HIP].y) / 2,
    visA: LM.L_HIP,
    visB: LM.R_HIP,
  },
  'push-up': {
    signal: lm => (lm[LM.L_WRIST].y + lm[LM.R_WRIST].y) / 2,
    visA: LM.L_WRIST,
    visB: LM.R_WRIST,
  },
  'bench-press': {
    signal: lm => (lm[LM.L_WRIST].y + lm[LM.R_WRIST].y) / 2,
    visA: LM.L_WRIST,
    visB: LM.R_WRIST,
  },
};

function smooth(values) {
  return values.map((v, i, arr) => {
    const prev = arr[i - 1] ?? v;
    const next = arr[i + 1] ?? v;
    return (prev + v + next) / 3;
  });
}

/**
 * Returns the set of frame indices that fall within the "bottom phase" of the
 * exercise movement. For deadlift, returns all indices (full range).
 *
 * Bottom phase = frames where the phase signal is in the lowest 30% of its
 * observed range across the video, after 3-frame smoothing.
 *
 * Falls back to all indices when: exercise is deadlift/unknown, fewer than 3
 * valid frames, or the signal barely changes (static hold, range < 0.05m).
 *
 * @param {Array<Array<{x,y,z,visibility}>>} worldFrames
 * @param {string} exerciseId
 * @returns {Set<number>}
 */
export function getBottomPhaseFrames(worldFrames, exerciseId) {
  const allIndices = new Set(worldFrames.map((_, i) => i));
  const config = PHASE_CONFIG[exerciseId];
  if (!config) return allIndices; // deadlift and unknown → all frames

  // Extract raw signal; null when landmarks are not visible enough
  const raw = worldFrames.map(lm => {
    const visA = lm[config.visA]?.visibility ?? 0;
    const visB = lm[config.visB]?.visibility ?? 0;
    return (visA >= 0.4 && visB >= 0.4) ? config.signal(lm) : null;
  });

  const valid = raw.filter(v => v !== null);
  if (valid.length < 3) return allIndices;

  const signalMin = Math.min(...valid);
  const signalMax = Math.max(...valid);
  if (signalMax - signalMin < 0.05) return allIndices; // static hold

  // Fill null slots with nearest valid neighbour before smoothing
  const filled = raw.map((v, i) => {
    if (v !== null) return v;
    for (let d = 1; d < raw.length; d++) {
      if (i - d >= 0 && raw[i - d] !== null) return raw[i - d];
      if (i + d < raw.length && raw[i + d] !== null) return raw[i + d];
    }
    return signalMin;
  });

  const smoothed = smooth(filled);
  const threshold = signalMin + 0.30 * (signalMax - signalMin);

  return new Set(worldFrames.map((_, i) => i).filter(i => smoothed[i] <= threshold));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/engine/rep-phases.test.js 2>&1 | tail -10
```

Expected: 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/engine/rep-phases.js tests/engine/rep-phases.test.js
git commit -m "feat: add rep-phases module for bottom-phase frame detection"
```

---

## Task 3: Frame stride 10 → 5 in `src/pose/detector.js`

**Files:**
- Modify: `src/pose/detector.js`

- [ ] **Step 1: Change the default parameter**

In `src/pose/detector.js`, change line 32:

```js
// Before
export async function processVideo(videoEl, sampleRate = 10, onProgress) {
```

```js
// After
export async function processVideo(videoEl, sampleRate = 5, onProgress) {
```

- [ ] **Step 2: Verify the full test suite still passes**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests pass (analysis-runner mock ignores the sampleRate argument)

- [ ] **Step 3: Commit**

```bash
git add src/pose/detector.js
git commit -m "perf: double frame sample rate (stride 10 → 5) for better motion coverage"
```

---

## Task 4: `evaluateRules` — optional `phaseFrames` filter

**Files:**
- Modify: `src/engine/rules.js`
- Modify: `tests/engine/rules.test.js`

- [ ] **Step 1: Add new tests to `tests/engine/rules.test.js`**

Append to the existing `describe('evaluateRules', ...)` block:

```js
  it('only evaluates frames in phaseFrames when provided', () => {
    const rule = {
      id: 'phase_test',
      label: 'Phase test',
      severity: 'error',
      cue: 'Fix it',
      check: (lm) => lm[0].x > 0.5,
    };
    const passing = fakeLandmarks({ 0: { x: 0.9 } });
    const failing = fakeLandmarks({ 0: { x: 0.1 } });
    // frames: [failing(0), passing(1), failing(2)]
    // phaseFrames = {1} → only frame 1 (passing) is evaluated → rule passes
    const phaseFrames = new Set([1]);
    const results = evaluateRules([rule], [failing, passing, failing], phaseFrames);
    expect(results[0].pass).toBe(true);
  });

  it('passes all frames when phaseFrames is null', () => {
    const rule = {
      id: 'null_phase',
      label: 'Null phase',
      severity: 'error',
      cue: 'Fix it',
      check: () => false,
    };
    const frames = [fakeLandmarks(), fakeLandmarks()];
    const results = evaluateRules([rule], frames, null);
    expect(results[0].pass).toBe(false);
  });

  it('returns pass:true for all rules when phaseFrames is empty set', () => {
    const rule = {
      id: 'empty_phase',
      label: 'Empty phase',
      severity: 'error',
      cue: 'Fix it',
      check: () => false,
    };
    const results = evaluateRules([rule], [fakeLandmarks()], new Set());
    expect(results[0].pass).toBe(true);
  });
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
npx vitest run tests/engine/rules.test.js 2>&1 | tail -15
```

Expected: 3 new tests FAIL (existing tests still pass)

- [ ] **Step 3: Update `evaluateRules` in `src/engine/rules.js`**

Replace the `evaluateRules` function (lines 37–46):

```js
/**
 * Evaluates a set of rules against an array of pose frames.
 * Frames may be bare landmark arrays OR { image, world } objects.
 * Rules receive world landmarks when available.
 *
 * @param {Array} rules
 * @param {Array} frames
 * @param {Set<number>|null} [phaseFrames] - when provided, only these frame
 *   indices are evaluated. null = evaluate all frames.
 */
export function evaluateRules(rules, frames, phaseFrames = null) {
  const active = phaseFrames
    ? frames.filter((_, i) => phaseFrames.has(i))
    : frames;
  if (active.length === 0) return rules.map(rule => ({
    id: rule.id, label: rule.label, severity: rule.severity, cue: rule.cue, pass: true,
  }));
  return rules.map(rule => {
    const passCount = active.filter(f => rule.check(f.world ?? f)).length;
    const pass = passCount / active.length >= 0.5;
    return { id: rule.id, label: rule.label, severity: rule.severity, cue: rule.cue, pass };
  });
}
```

- [ ] **Step 4: Run all tests to verify everything passes**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules.js tests/engine/rules.test.js
git commit -m "feat: add optional phaseFrames filter to evaluateRules"
```

---

## Task 5: Exercise files — factory functions, normalized thresholds, bench z-depth

**Files:**
- Modify: `src/engine/exercises/squat.js`
- Modify: `src/engine/exercises/deadlift.js`
- Modify: `src/engine/exercises/push-up.js`
- Modify: `src/engine/exercises/bench-press.js`
- Modify: `src/engine/exercises/index.js`

All four exercise files convert from exporting a static array to exporting a factory function. Thresholds using metres are expressed as multiples of `shinLength`. At the average shin length of 0.5m, every threshold evaluates to the same numeric value as before.

- [ ] **Step 1: Replace `src/engine/exercises/squat.js`**

```js
import { LM, angleDeg, horizDist } from '../rules.js';

export function getSquatRules(shinLength) {
  return [
    {
      id: 'knees_over_toes',
      label: 'Knees track over toes',
      severity: 'error',
      cue: 'Push your knees outward in line with your toes throughout the movement.',
      check(lm) {
        return horizDist(lm[LM.L_KNEE], lm[LM.L_ANKLE]) < 0.30 * shinLength
            && horizDist(lm[LM.R_KNEE], lm[LM.R_ANKLE]) < 0.30 * shinLength;
      },
    },
    {
      id: 'back_neutral',
      label: 'Torso stays upright',
      severity: 'error',
      cue: 'Keep your chest up — avoid collapsing your torso forward.',
      check(lm) {
        return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_KNEE]) > 90;
      },
    },
    {
      id: 'squat_depth',
      label: 'Hip reaches parallel or below',
      severity: 'warning',
      cue: 'Try to lower your hips to at least knee height for full range of motion.',
      check(lm) {
        const lDepth = lm[LM.L_HIP].y - lm[LM.L_KNEE].y < 0.10 * shinLength;
        const rDepth = lm[LM.R_HIP].y - lm[LM.R_KNEE].y < 0.10 * shinLength;
        return lDepth && rDepth;
      },
    },
  ];
}
```

- [ ] **Step 2: Replace `src/engine/exercises/deadlift.js`**

```js
import { LM, angleDeg, horizDist } from '../rules.js';

export function getDeadliftRules(shinLength) {
  return [
    {
      id: 'back_flat',
      label: 'Back stays flat',
      severity: 'error',
      cue: 'Keep your chest up and back flat — do not let your shoulders drop below your hips.',
      check(lm) {
        return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_KNEE]) > 40;
      },
    },
    {
      id: 'hips_not_too_high',
      label: 'Hips at proper starting height',
      severity: 'warning',
      cue: 'Sit into the lift — hips should not be so high that it becomes a stiff-leg deadlift.',
      check(lm) {
        const lDiff = lm[LM.L_HIP].y - lm[LM.L_KNEE].y;
        const rDiff = lm[LM.R_HIP].y - lm[LM.R_KNEE].y;
        return (lDiff + rDiff) / 2 < 1.00 * shinLength;
      },
    },
    {
      id: 'bar_over_feet',
      label: 'Bar stays close to body',
      severity: 'error',
      cue: 'Keep the bar (wrists) close to your legs — drifting forward adds dangerous spinal load.',
      check(lm) {
        return horizDist(lm[LM.L_WRIST], lm[LM.L_ANKLE]) < 0.30 * shinLength
            && horizDist(lm[LM.R_WRIST], lm[LM.R_ANKLE]) < 0.30 * shinLength;
      },
    },
  ];
}
```

- [ ] **Step 3: Replace `src/engine/exercises/push-up.js`**

```js
import { LM, angleDeg } from '../rules.js';

export function getPushUpRules(_shinLength) {
  return [
    {
      id: 'body_straight',
      label: 'Body stays in a straight line',
      severity: 'error',
      cue: 'Keep your hips level — do not let them sag toward the floor or pike up.',
      check(lm) {
        return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_ANKLE]) > 165
            && angleDeg(lm[LM.R_SHOULDER], lm[LM.R_HIP], lm[LM.R_ANKLE]) > 165;
      },
    },
    {
      id: 'elbows_not_flared',
      label: 'Elbows at ~45-75° from torso',
      severity: 'warning',
      cue: 'Tuck your elbows slightly — avoid flaring them out to 90° which strains the shoulder.',
      check(lm) {
        return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]) < 110
            && angleDeg(lm[LM.R_SHOULDER], lm[LM.R_ELBOW], lm[LM.R_WRIST]) < 110;
      },
    },
    {
      id: 'full_depth',
      label: 'Chest reaches near the floor',
      severity: 'warning',
      cue: 'Lower until your chest nearly touches the floor for full range of motion.',
      check(lm) {
        return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]) < 100
            && angleDeg(lm[LM.R_SHOULDER], lm[LM.R_ELBOW], lm[LM.R_WRIST]) < 100;
      },
    },
  ];
}
```

- [ ] **Step 4: Replace `src/engine/exercises/bench-press.js`**

`bar_to_lower_chest` gains a z-axis depth check (bar should not drift forward from the chest more than `0.80 × shinLength`). At `shinLength = 0.5`: Y threshold = 0.12m (unchanged), Z threshold = 0.40m.

```js
import { LM, angleDeg } from '../rules.js';

export function getBenchRules(shinLength) {
  return [
    {
      id: 'elbows_at_75',
      label: 'Elbows at ~75° from torso',
      severity: 'error',
      cue: 'Do not flare elbows to 90°. Tuck them to ~75° to protect your shoulders.',
      check(lm) {
        const lAngle = angleDeg(lm[LM.L_HIP], lm[LM.L_SHOULDER], lm[LM.L_ELBOW]);
        const rAngle = angleDeg(lm[LM.R_HIP], lm[LM.R_SHOULDER], lm[LM.R_ELBOW]);
        return lAngle > 30 && lAngle < 85 && rAngle > 30 && rAngle < 85;
      },
    },
    {
      id: 'bar_to_lower_chest',
      label: 'Bar lowers to lower chest',
      severity: 'warning',
      cue: 'Lower the bar to your lower chest / nipple line, not your upper chest or neck.',
      check(lm) {
        const wristY   = (lm[LM.L_WRIST].y + lm[LM.R_WRIST].y) / 2;
        const shoulderY = (lm[LM.L_SHOULDER].y + lm[LM.R_SHOULDER].y) / 2;
        const wristZ   = (lm[LM.L_WRIST].z + lm[LM.R_WRIST].z) / 2;
        const shoulderZ = (lm[LM.L_SHOULDER].z + lm[LM.R_SHOULDER].z) / 2;
        return Math.abs(wristY - shoulderY) < 0.24 * shinLength
            && Math.abs(wristZ - shoulderZ) < 0.80 * shinLength;
      },
    },
    {
      id: 'scapular_retraction',
      label: 'Shoulders level on bench',
      severity: 'warning',
      cue: 'Keep both shoulders in contact with the bench — avoid one side rising higher than the other.',
      check(lm) {
        return Math.abs(lm[LM.L_SHOULDER].y - lm[LM.R_SHOULDER].y) < 0.12 * shinLength;
      },
    },
  ];
}
```

- [ ] **Step 5: Replace `src/engine/exercises/index.js`**

```js
import { getSquatRules }    from './squat.js';
import { getDeadliftRules } from './deadlift.js';
import { getBenchRules }    from './bench-press.js';
import { getPushUpRules }   from './push-up.js';

export function getExerciseRules(exercise, shinLength) {
  const factories = {
    squat:         getSquatRules,
    deadlift:      getDeadliftRules,
    'bench-press': getBenchRules,
    'push-up':     getPushUpRules,
  };
  return factories[exercise]?.(shinLength) ?? [];
}

export const SUPPORTED_EXERCISES = ['squat', 'deadlift', 'bench-press', 'push-up'];
```

- [ ] **Step 6: Run the full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests pass (analysis-runner test still works because it only checks `result.exercise`, not rule evaluation internals)

- [ ] **Step 7: Commit**

```bash
git add src/engine/exercises/squat.js src/engine/exercises/deadlift.js \
        src/engine/exercises/push-up.js src/engine/exercises/bench-press.js \
        src/engine/exercises/index.js
git commit -m "feat: normalize exercise thresholds to shin length; add bench press z-depth check"
```

---

## Task 6: Wire everything in `src/engine/analysis-runner.js`

**Files:**
- Modify: `src/engine/analysis-runner.js`

- [ ] **Step 1: Replace `analysis-runner.js`**

```js
import { processVideo } from '../pose/detector.js';
import { detectExercise } from './exercise-detector.js';
import { evaluateRules } from './rules.js';
import { calculateScore } from './score.js';
import { getExerciseRules } from './exercises/index.js';
import { computeBodyMetrics } from './body-metrics.js';
import { getBottomPhaseFrames } from './rep-phases.js';
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

  const frames = await processVideo(videoEl, 5, updateProgress);

  if (frames.length === 0) {
    const btn = document.getElementById('analyze-btn');
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = 'Analyze My Form';
    }
    throw new Error('No pose frames detected');
  }

  const exercise = exerciseOverride ?? detectExercise(frames) ?? 'squat';
  const worldFrames = frames.map(f => f.world ?? f);
  const { shinLength } = computeBodyMetrics(worldFrames);
  const phaseFrames = getBottomPhaseFrames(worldFrames, exercise);
  const rules = getExerciseRules(exercise, shinLength);
  const ruleResults = evaluateRules(rules, frames, phaseFrames);
  const score = calculateScore(ruleResults);

  saveSession({ exercise, weight, unit, score, ruleResults });

  return { exercise, weight, unit, score, ruleResults, frames };
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: all tests pass. The analysis-runner test mocks `processVideo` returning 1 frame; `computeBodyMetrics` will fall back to `shinLength = 0.5` (< 3 valid frames), and `getBottomPhaseFrames` will return all indices (< 3 valid frames), so existing assertions still hold.

- [ ] **Step 3: Commit**

```bash
git add src/engine/analysis-runner.js
git commit -m "feat: wire body metrics, rep-phase gating, and stride-5 into analysis pipeline"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] #8 Frame stride: Task 3 (`sampleRate = 5`)
- [x] #6 Z-depth in angles: `angleDeg` already 3D; bench press z-check in Task 5 Step 4
- [x] #4 Height-normalized thresholds: Tasks 5 (all exercise files)
- [x] #1 Rep-phase gating: Tasks 2 + 4 + 6 (rep-phases.js, evaluateRules phaseFrames, analysis-runner)
- [x] Deadlift full range: `getBottomPhaseFrames` returns all indices for deadlift
- [x] Static hold edge case: `if (signalMax - signalMin < 0.05) return allIndices`
- [x] < 3 valid frames fallback: both body-metrics and rep-phases handle this
- [x] Bench press scapular threshold normalized: `0.12 * shinLength`

**Signature consistency:**
- `computeBodyMetrics(worldFrames)` → `{ shinLength }` ✓ (Tasks 1 and 6)
- `getBottomPhaseFrames(worldFrames, exerciseId)` → `Set<number>` ✓ (Tasks 2 and 6)
- `getExerciseRules(exercise, shinLength)` → rule array ✓ (Tasks 5 and 6)
- `evaluateRules(rules, frames, phaseFrames?)` ✓ (Task 4 and 6)
