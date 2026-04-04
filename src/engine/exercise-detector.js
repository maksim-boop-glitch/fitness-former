import { LM } from './rules.js';

export function detectExercise(frames) {
  const scores = { squat: 0, deadlift: 0, 'push-up': 0, 'bench-press': 0 };

  for (const lm of frames) {
    const lShoulder = lm[LM.L_SHOULDER];
    const lHip      = lm[LM.L_HIP];
    const lKnee     = lm[LM.L_KNEE];
    const lAnkle    = lm[LM.L_ANKLE];

    // Check if frame has meaningful variation in y-coordinates
    const yVariation = Math.abs(lShoulder.y - lHip.y) + Math.abs(lHip.y - lKnee.y) + Math.abs(lKnee.y - lAnkle.y);
    if (yVariation < 0.05) continue; // Skip frames with no meaningful vertical variation

    const isHorizontal = Math.abs(lShoulder.y - lHip.y) < 0.1;

    if (isHorizontal) {
      const ankleHorizontal = Math.abs(lAnkle.y - lHip.y) < 0.15;
      if (ankleHorizontal) {
        scores['push-up'] += 1;
      } else {
        scores['bench-press'] += 1;
      }
      continue;
    }

    if (lHip.y >= lKnee.y - 0.05) {
      scores.squat += 1;
      continue;
    }

    const torsoAngle = Math.abs(lShoulder.y - lHip.y);
    if (torsoAngle < 0.25 && lHip.y < lKnee.y) {
      scores.deadlift += 1;
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best[1] === 0) return null;
  const confidence = best[1] / frames.length;
  if (confidence < 0.5) return null;
  return best[0];
}
