import { LM } from './rules.js';

export function detectExercise(frames) {
  const scores = { squat: 0, deadlift: 0, 'push-up': 0, 'bench-press': 0 };
  let scoredFrames = 0;

  for (const lm of frames) {
    // Average left+right for robustness regardless of which side faces the camera
    const shoulderY = (lm[LM.L_SHOULDER].y + lm[LM.R_SHOULDER].y) / 2;
    const hipY      = (lm[LM.L_HIP].y + lm[LM.R_HIP].y) / 2;
    const kneeY     = (lm[LM.L_KNEE].y + lm[LM.R_KNEE].y) / 2;
    const ankleY    = (lm[LM.L_ANKLE].y + lm[LM.R_ANKLE].y) / 2;

    // Horizontal body = push-up or bench press. Check this BEFORE the yVariation
    // filter — a flat body has near-zero vertical spread by design, not because
    // the frame is uninformative.
    const isHorizontal = Math.abs(shoulderY - hipY) < 0.15;
    if (isHorizontal) {
      // Require the body to actually span horizontally — guards against frames
      // where all landmarks collapse to the same point (low-confidence detections).
      const shoulderX = (lm[LM.L_SHOULDER].x + lm[LM.R_SHOULDER].x) / 2;
      const ankleX    = (lm[LM.L_ANKLE].x + lm[LM.R_ANKLE].x) / 2;
      if (Math.abs(shoulderX - ankleX) < 0.15) continue;

      // Push-up: entire body (including ankles) is flat on the floor at the same height.
      // Bench press: torso is on an elevated bench; ankles hang lower (feet on floor).
      const ankleAlignedWithBody = Math.abs(ankleY - hipY) < 0.2;
      scores[ankleAlignedWithBody ? 'push-up' : 'bench-press'] += 1;
      scoredFrames++;
      continue;
    }

    // For upright exercises skip frames with no meaningful vertical spread
    const yVariation = Math.abs(shoulderY - hipY) + Math.abs(hipY - kneeY) + Math.abs(kneeY - ankleY);
    if (yVariation < 0.1) continue;
    scoredFrames++;

    if (hipY >= kneeY - 0.05) {
      scores.squat += 1;
      continue;
    }

    const torsoLean = Math.abs(shoulderY - hipY);
    if (torsoLean < 0.25 && hipY < kneeY) {
      scores.deadlift += 1;
    }
  }

  if (scoredFrames === 0) return null;
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best[1] === 0) return null;
  const confidence = best[1] / scoredFrames;
  if (confidence < 0.3) return null;
  return best[0];
}
