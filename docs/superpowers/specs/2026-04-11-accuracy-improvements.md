# Accuracy Improvements — Design Spec

**Goal:** Increase form analysis accuracy through four targeted engine changes: faster frame sampling, full 3D angle calculations, body-size-normalized thresholds, and rep-phase gating.

---

## Overview of Changes

| # | Change | Files |
|---|--------|-------|
| 8 | Frame stride 10 → 5 | `src/engine/detector.js` |
| 6 | Z-depth always used in angles; bench press bar-path z-check | `src/engine/rules.js`, `src/engine/bench-press.js` |
| 4 | Height-normalized distance thresholds via shin length | `src/engine/body-metrics.js` (new), all exercise files, `src/engine/analysis-runner.js` |
| 1 | Rep-phase gating for squat, push-up, bench press | `src/engine/rep-phases.js` (new), `src/engine/rules.js`, squat/push-up/bench-press files, `src/engine/analysis-runner.js` |

---

## #8 — Frame Stride 10 → 5

`src/engine/detector.js` currently skips 9 out of every 10 frames (effective ~3 FPS from 30 FPS source). Change the stride constant from `10` to `5`, doubling the sample rate to ~6 FPS.

**Trade-off:** Processing time roughly doubles. For a 30-second video this is acceptable; the improvement in rep-bottom detection and angle accuracy outweighs the cost.

**Change:** One constant in `detector.js`. No API surface changes.

---

## #6 — Z-Depth Usage

### Ensure z is never stripped

`angleDeg(a, b, c)` in `src/engine/rules.js` already computes a full 3D dot-product angle when z is present and falls back to 2D when z is `undefined`. MediaPipe world landmarks always include z. No code should be stripping z when passing landmarks to rule functions. Audit all rule files to confirm landmarks are passed through directly from the world array (no `{ x, y }` destructuring that drops z).

If any destructuring strips z, fix it to include z.

### Bench press: bar-path depth check

The existing `bar_to_lower_chest` rule in `src/engine/bench-press.js` checks only vertical alignment (`wrist.y - shoulder.y`). Add a z-axis component: the bar should not drift forward (away from chest) by more than `0.80 × shinLength`.

New condition added to `bar_to_lower_chest` (both sides must pass):

```
Math.abs(wrist.z - shoulder.z) < 0.80 * shinLength
```

This catches the common fault of pressing the bar away from the body rather than straight up.

---

## #4 — Height-Normalized Thresholds

### New file: `src/engine/body-metrics.js`

Exports one function:

```js
export function computeBodyMetrics(worldFrames)
// worldFrames: array of landmark arrays (one per frame)
// Returns: { shinLength: number }
// shinLength = median of (knee.y - ankle.y) across all frames,
//              averaged over left and right sides.
// Falls back to 0.5 if fewer than 3 valid frames.
```

`shinLength` is computed once per analysis as follows: for each frame, compute `((L_knee.y - L_ankle.y) + (R_knee.y - R_ankle.y)) / 2` (average of left and right shin). Then take the median of these per-frame values across all frames. Median is used instead of mean to resist outliers from occluded frames. Falls back to `0.5` (average adult shin length in metres) if fewer than 3 valid frames are available.

### Modified thresholds

All distance thresholds in the four exercise files are replaced with multiples of `shinLength`. At the average shin length of 0.5m, every threshold produces the same numeric value as the current hardcoded constant.

| File | Rule | Current threshold | Normalized threshold |
|------|------|-------------------|----------------------|
| `squat.js` | `knees_over_toes` | < 0.15m | < 0.30 × shin |
| `squat.js` | `squat_depth` | hip−knee < 0.05m | < 0.10 × shin |
| `deadlift.js` | `hips_not_too_high` | hip−knee < 0.5m | < 1.00 × shin |
| `deadlift.js` | `bar_over_feet` | < 0.15m | < 0.30 × shin |

Push-up and bench press rules that use distance thresholds (if any) follow the same pattern. The new bench press z-depth check uses `0.80 × shin` as defined in #6.

### Wiring

`src/engine/analysis-runner.js` calls `computeBodyMetrics(worldFrames)` after frame extraction and before rule evaluation. The resulting `{ shinLength }` is passed into each exercise's rule evaluation function.

Each exercise file's exported function signature gains a `shinLength` parameter:

```js
// Before
export function evaluateSquat(frames) { ... }

// After
export function evaluateSquat(frames, shinLength) { ... }
```

---

## #1 — Rep-Phase Gating

### New file: `src/engine/rep-phases.js`

Exports one function:

```js
export function getBottomPhaseFrames(worldFrames, exerciseId)
// worldFrames: array of landmark arrays (one per frame)
// exerciseId: 'squat' | 'push-up' | 'bench-press' | 'deadlift'
// Returns: Set<number> of frame indices considered "bottom phase"
//
// For 'deadlift': returns a Set containing all frame indices (no gating).
// For others: computes phase signal, smooths it, returns frames
//             in the bottom 30% of the signal's range.
```

**Phase signals:**

| Exercise | Signal | Landmark |
|----------|--------|----------|
| squat | hip Y (average L+R hip) | LM.L_HIP, LM.R_HIP |
| push-up | wrist Y (average L+R wrist) | LM.L_WRIST, LM.R_WRIST |
| bench-press | wrist Y (average L+R wrist) | LM.L_WRIST, LM.R_WRIST |
| deadlift | — (all frames) | — |

**Algorithm:**

1. Extract the phase signal value for each frame (skip frames where both relevant landmarks have visibility < 0.4; treat as NaN).
2. Apply a 3-frame centred rolling average to smooth noise. Edge frames (first and last) use only their available neighbours (e.g. frame 0 averages frames 0 and 1; the last frame averages the last two frames).
3. Compute `signalMin` and `signalMax` from valid (non-NaN) values.
4. If `signalMax - signalMin < 0.05m` (person barely moved — standing still or static hold), return all frame indices (no gating applied).
5. Mark frame `i` as bottom-phase if `smoothedSignal[i] <= signalMin + 0.30 × (signalMax - signalMin)`.
6. Return a `Set<number>` of all bottom-phase frame indices.

**Edge case — no valid frames:** If fewer than 3 frames have valid landmarks, return all frame indices.

### Modified: `src/engine/rules.js` — `evaluateRules`

`evaluateRules(frames, rules, phaseFrames)` gains an optional third parameter:

```js
export function evaluateRules(frames, rules, phaseFrames = null)
```

When `phaseFrames` is a `Set`, frame indices not in the set are skipped during rule evaluation. The majority-vote calculation runs only over phase frames. When `phaseFrames` is `null`, all frames are evaluated (existing behaviour, used by deadlift).

### Wiring

`src/engine/analysis-runner.js` calls `getBottomPhaseFrames(worldFrames, exerciseId)` after exercise detection and before rule evaluation. The resulting `Set` is passed into each exercise's evaluator, which forwards it to `evaluateRules`.

Each exercise file's exported function signature gains a `phaseFrames` parameter:

```js
// Before
export function evaluateSquat(frames, shinLength) { ... }

// After
export function evaluateSquat(frames, shinLength, phaseFrames) { ... }
```

Deadlift calls `evaluateRules(frames, rules, null)` (or omits the parameter) — no change to existing deadlift evaluation logic.

---

## What Does NOT Change

- Scoring algorithm (`src/engine/score.js`) — untouched
- Exercise auto-detection (`src/engine/exercise-detector.js`) — untouched
- Overlay and visualization (`src/pose/overlay.js`) — untouched
- UI files — untouched
- `evaluateRules` majority-vote logic — same, just applied to a subset of frames
- Existing test structure — tests updated to pass `shinLength` and `phaseFrames` where needed

---

## Testing

- `computeBodyMetrics`: unit test with known landmark positions → expected shinLength
- `getBottomPhaseFrames`: unit test with synthetic signal (sine wave) → verify correct bottom-phase frames returned; test static-hold edge case; test deadlift returns all frames
- Exercise rule files: existing tests updated to pass `shinLength = 0.5` (preserves current threshold values) and `phaseFrames = null` (all frames, same as before)
- No new integration tests required
