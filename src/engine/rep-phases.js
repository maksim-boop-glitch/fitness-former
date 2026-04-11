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
