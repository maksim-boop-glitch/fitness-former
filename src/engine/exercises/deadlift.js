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
      const lDiff = lm[LM.L_HIP].y - lm[LM.L_KNEE].y;
      const rDiff = lm[LM.R_HIP].y - lm[LM.R_KNEE].y;
      return (lDiff + rDiff) / 2 < 0.5;
    },
  },
  {
    id: 'bar_over_feet',
    label: 'Bar stays close to body',
    severity: 'error',
    cue: 'Keep the bar (wrists) close to your legs — drifting forward adds dangerous spinal load.',
    check(lm) {
      // Horizontal distance between wrist and ankle — camera-invariant
      return horizDist(lm[LM.L_WRIST], lm[LM.L_ANKLE]) < 0.15
          && horizDist(lm[LM.R_WRIST], lm[LM.R_ANKLE]) < 0.15;
    },
  },
];
