import { LM } from './rules.js';

/**
 * Stage 1 — Body orientation.
 *
 * The y-axis in MediaPipe normalized image coordinates increases downward
 * (0 = top of frame, 1 = bottom). When a person stands upright the shoulder
 * landmark is well above the hip (lower y value), producing a large
 * |shoulderY − hipY| difference. When the body is horizontal (lying down)
 * the shoulder and hip are at nearly the same y position.
 *
 *  |shoulderY − hipY| < HORIZONTAL_THRESHOLD  →  horizontal body
 *  |shoulderY − hipY| ≥ HORIZONTAL_THRESHOLD  →  vertical body
 */
const HORIZONTAL_THRESHOLD = 0.15;

/**
 * Stage 2 — Exercise classification within each orientation group.
 *
 * Horizontal exercises  →  push-up | bench-press
 *   Distinguisher: ankle y-position relative to hip.
 *   Push-up: whole body on the floor, ankles at the same height as hips.
 *   Bench press: torso elevated on bench, ankles lower (feet on floor).
 *
 * Vertical exercises  →  squat | deadlift
 *   Distinguisher: hip y-position relative to knee.
 *   Squat: hips drop to or below knee level (hip y ≥ knee y).
 *   Deadlift: hips stay above knees with a forward torso lean.
 */

export function detectExercise(frames) {
  const scores = { squat: 0, deadlift: 0, 'push-up': 0, 'bench-press': 0 };
  let scoredFrames = 0;

  for (const lm of frames) {
    // Average left+right landmarks for robustness across all camera angles
    const shoulderY = (lm[LM.L_SHOULDER].y + lm[LM.R_SHOULDER].y) / 2;
    const hipY      = (lm[LM.L_HIP].y + lm[LM.R_HIP].y) / 2;
    const kneeY     = (lm[LM.L_KNEE].y + lm[LM.R_KNEE].y) / 2;
    const ankleY    = (lm[LM.L_ANKLE].y + lm[LM.R_ANKLE].y) / 2;

    // ── Stage 1: Body orientation ──────────────────────────────────────────
    const shoulderHipYDiff = Math.abs(shoulderY - hipY);
    const isHorizontal = shoulderHipYDiff < HORIZONTAL_THRESHOLD;

    if (isHorizontal) {
      // ── Stage 2a: Horizontal exercises ───────────────────────────────────
      // Guard: require the body to actually span the frame horizontally.
      // Collapsed/low-confidence landmark clusters have near-zero x-spread.
      const shoulderX = (lm[LM.L_SHOULDER].x + lm[LM.R_SHOULDER].x) / 2;
      const ankleX    = (lm[LM.L_ANKLE].x + lm[LM.R_ANKLE].x) / 2;
      if (Math.abs(shoulderX - ankleX) < 0.15) continue;

      // Push-up: entire body (ankles included) lies flat at the same height.
      // Bench press: ankles are lower than the torso (feet on the floor below the bench).
      const ankleAlignedWithBody = Math.abs(ankleY - hipY) < 0.2;
      scores[ankleAlignedWithBody ? 'push-up' : 'bench-press'] += 1;
      scoredFrames++;
    } else {
      // ── Stage 2b: Vertical exercises ─────────────────────────────────────
      // Skip frames where landmarks have collapsed to a single point.
      const yVariation = shoulderHipYDiff + Math.abs(hipY - kneeY) + Math.abs(kneeY - ankleY);
      if (yVariation < 0.1) continue;
      scoredFrames++;

      // Squat: hips descend to or below knee level.
      if (hipY >= kneeY - 0.05) {
        scores.squat += 1;
      } else if (shoulderHipYDiff < 0.25) {
        // Deadlift: hips above knees with a forward torso lean (compressed shoulder–hip gap).
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
