# Angle-Invariant Form Analysis — Design Spec

**Goal:** Replace all 2D image-coordinate geometry with MediaPipe 3D world coordinates so form rules and exercise detection produce correct results from any camera angle.

**Problem:** Every rule currently uses normalized image coordinates (x, y ∈ [0,1], y increases downward). These are 2D projections — angles and distances change dramatically depending on where the camera is placed. A side-view camera gives accurate elbow angles; a front-view camera makes the same motion look completely different. MediaPipe already computes true 3D world landmarks (`poseWorldLandmarks`) alongside the image landmarks, but the app ignores them.

---

## Coordinate Systems

### Image coordinates (current — keep only for overlay)
- x: 0 = left edge, 1 = right edge of frame
- y: 0 = top, 1 = bottom (increases downward)
- z: raw depth from camera, not used
- Units: normalized (0–1), camera-dependent

### World coordinates (new — use for all geometry)
- Origin: midpoint of the two hip landmarks
- Y: up (gravity direction, estimated by MediaPipe)
- X: approximately to the person's left
- Z: approximately toward the camera
- Units: metres
- Key property: 3D angles computed from these coordinates are invariant to camera rotation

---

## Architecture

### Frame format change

`processVideo` in `src/pose/detector.js` currently returns:
```js
Array<Array<{x, y, z, visibility}>>   // image landmarks per frame
```

New return type:
```js
Array<{ image: LandmarkArray, world: LandmarkArray }>
```

Every consumer that previously indexed `frame[LM.L_KNEE]` now indexes `frame.image[LM.L_KNEE]` (overlay) or `frame.world[LM.L_KNEE]` (rules).

MediaPipe result already provides both:
```js
result.landmarks[0]        // image landmarks — used by overlay
result.worldLandmarks[0]   // world landmarks — used by rules + detector
```

### Files changed

| File | Change |
|---|---|
| `src/pose/detector.js` | Return `{ image, world }` per frame |
| `src/engine/rules.js` | 3D `angleDeg`, add `horizDist`; `evaluateRules` passes `frame.world` to checks |
| `src/engine/exercises/squat.js` | Rewrite all checks with world coords |
| `src/engine/exercises/deadlift.js` | Rewrite all checks with world coords |
| `src/engine/exercises/push-up.js` | Rewrite all checks with world coords |
| `src/engine/exercises/bench-press.js` | Rewrite all checks with world coords |
| `src/engine/exercise-detector.js` | Use `frame.world` for orientation; note sign convention flip |
| `src/pose/overlay.js` | Read `frame.image` instead of bare `frame`; skeleton already implemented |
| `src/tabs/results.js` | Pass `frame.image` to `drawOverlay` |
| `src/engine/analysis-runner.js` | No logic change; `frames` now carry `{ image, world }` |
| `tests/engine/exercise-detector.test.js` | Update frame shape to `{ image, world }` |
| `tests/engine/analysis-runner.test.js` | Update mock frame shape |

---

## Math helpers (src/engine/rules.js)

### angleDeg — extended to 3D

Existing function uses `(a.x - b.x, a.y - b.y)` vectors. Add `z`:

```js
export function angleDeg(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) };
  const dot = ab.x*cb.x + ab.y*cb.y + ab.z*cb.z;
  const mag = Math.sqrt((ab.x**2 + ab.y**2 + ab.z**2) * (cb.x**2 + cb.y**2 + cb.z**2));
  if (mag === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
}
```

With world landmarks, `z` is non-zero, so the angle is the true 3D angle at joint B. With image landmarks (z≈0), the function behaves identically to before — backward compatible.

### horizDist — horizontal distance in world space

```js
export function horizDist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}
```

Returns the distance between two points projected onto the horizontal (XZ) plane. Camera-invariant because X and Z are in the world frame, not the image frame. Used for knee alignment and bar-path checks.

### evaluateRules — pass world landmarks

```js
export function evaluateRules(rules, frames) {
  // ...
  const passCount = frames.filter(f => rule.check(f.world ?? f)).length;
  // ...
}
```

The `f.world ?? f` fallback preserves backward compatibility with any test that passes bare landmark arrays.

---

## Exercise detector (src/engine/exercise-detector.js)

**Sign convention:** World Y is up. Standing person: `shoulder.y > hip.y > knee.y > ankle.y` (all positive, decreasing). This is the **opposite** of image Y where larger Y means lower in frame.

**Orientation check (Stage 1):**
```js
// World Y: shoulder above hip when upright, equal when horizontal
const shoulderHipYDiff = Math.abs(world[LM.L_SHOULDER].y - world[LM.L_HIP].y +
                                   world[LM.R_SHOULDER].y - world[LM.R_HIP].y) / 2;
const isHorizontal = shoulderHipYDiff < 0.15; // metres
```

**Squat vs deadlift (Stage 2b):**
```js
// World Y up: hips at parallel → knee.y rises toward hip.y (≈ 0)
const hipY  = (world[LM.L_HIP].y  + world[LM.R_HIP].y)  / 2;
const kneeY = (world[LM.L_KNEE].y + world[LM.R_KNEE].y) / 2;
// Squat: knee has risen to near hip level
if (hipY - kneeY < 0.15) scores.squat += 1;
else scores.deadlift += 1;
```

**Push-up vs bench press (Stage 2a):** Unchanged logic but world coordinates. Ankle Y vs hip Y in world space — push-up has ankles at same height as hips (both on floor); bench press has ankles below (feet on floor, torso elevated).

---

## Rule rewrites

All `check(lm)` functions receive world landmarks. Thresholds are in metres.

### Squat

**knees_over_toes**
```js
check(lm) {
  // Horizontal distance between knee and ankle — camera-invariant
  return horizDist(lm[LM.L_KNEE], lm[LM.L_ANKLE]) < 0.15
      && horizDist(lm[LM.R_KNEE], lm[LM.R_ANKLE]) < 0.15;
}
```

**back_neutral** (torso upright)
```js
check(lm) {
  // True 3D angle at hip — correct from any camera angle
  return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_KNEE]) > 90;
}
```

**squat_depth**
```js
check(lm) {
  // World Y up: at parallel, knee.y rises to within 0.05m of hip.y (≈ 0)
  const lDepth = lm[LM.L_HIP].y - lm[LM.L_KNEE].y < 0.05;
  const rDepth = lm[LM.R_HIP].y - lm[LM.R_KNEE].y < 0.05;
  return lDepth && rDepth;
}
```

### Deadlift

**back_flat**
```js
check(lm) {
  return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_KNEE]) > 40;
}
```

**hips_not_too_high**
```js
check(lm) {
  // Hip should not be more than 0.5m above knee (would indicate stiff-leg position)
  return lm[LM.L_HIP].y - lm[LM.L_KNEE].y < 0.5;
}
```

**bar_over_feet**
```js
check(lm) {
  // Wrist should be horizontally close to ankle (bar over mid-foot)
  return horizDist(lm[LM.L_WRIST], lm[LM.L_ANKLE]) < 0.15;
}
```

### Push-up

**body_straight**
```js
check(lm) {
  // Hip should lie on the straight line from shoulder to ankle — 3D angle at hip
  return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_ANKLE]) > 165;
}
```

**elbows_not_flared**
```js
check(lm) {
  return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]) < 110;
}
```

**full_depth**
```js
check(lm) {
  return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]) < 100;
}
```

### Bench press

**elbows_at_75**
```js
check(lm) {
  const angle = angleDeg(lm[LM.L_HIP], lm[LM.L_SHOULDER], lm[LM.L_ELBOW]);
  return angle > 30 && angle < 85;
}
```

**bar_to_lower_chest**
```js
check(lm) {
  // In world coords, lying horizontal: bar at chest → wrist.y ≈ shoulder.y
  const wristY  = (lm[LM.L_WRIST].y  + lm[LM.R_WRIST].y)  / 2;
  const shoulderY = (lm[LM.L_SHOULDER].y + lm[LM.R_SHOULDER].y) / 2;
  return Math.abs(wristY - shoulderY) < 0.12;
}
```

**scapular_retraction** (shoulders level)
```js
check(lm) {
  return Math.abs(lm[LM.L_SHOULDER].y - lm[LM.R_SHOULDER].y) < 0.06;
}
```

---

## Overlay (src/pose/overlay.js)

No logic change. `drawOverlay` already draws skeleton bones and joint dots. The only change is the call site in `results.js` passes `frame.image` instead of bare `frame`.

Skeleton bones and surface plane are already implemented in the current codebase.

---

## Test updates

- `tests/engine/exercise-detector.test.js`: wrap all landmark arrays in `{ image: lm(), world: lm(...) }` shape
- `tests/engine/analysis-runner.test.js`: mock `processVideo` returns `[{ image: landmarks, world: landmarks }]`
- `tests/engine/rules.test.js`: `evaluateRules` called with `{ image, world }` frames; verify `angleDeg` handles z component correctly
- `tests/engine/exercises/`: exercise rule tests pass world landmark arrays directly to `check(lm)`

---

## What this does NOT change

- `src/storage.js` — no change
- `src/tabs/analyze.js` — no change
- `src/engine/vision-detect.js` — no change
- `server/` — no change
- UI, scoring, session saving — no change
