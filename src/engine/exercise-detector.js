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
      // Guard: require the body to actually span space in X.
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
