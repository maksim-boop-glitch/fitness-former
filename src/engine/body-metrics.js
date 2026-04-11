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
