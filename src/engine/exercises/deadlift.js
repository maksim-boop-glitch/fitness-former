import { LM, angleDeg } from '../rules.js';

export const DEADLIFT_RULES = [
  {
    id: 'back_flat',
    label: 'Back stays flat',
    severity: 'error',
    cue: 'Keep your chest up and back flat — do not let your shoulders drop below your hips.',
    check(lm) {
      const angle = angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_KNEE]);
      return angle > 40;
    },
  },
  {
    id: 'hips_not_too_high',
    label: 'Hips at proper starting height',
    severity: 'warning',
    cue: 'Sit into the lift — hips should not be so high that it becomes a stiff-leg deadlift.',
    check(lm) {
      const delta = lm[LM.L_KNEE].y - lm[LM.L_HIP].y;
      return delta < 0.35;
    },
  },
  {
    id: 'bar_over_feet',
    label: 'Bar stays close to body',
    severity: 'error',
    cue: 'Keep the bar (wrists) close to your legs — drifting forward adds dangerous spinal load.',
    check(lm) {
      return Math.abs(lm[LM.L_WRIST].x - lm[LM.L_ANKLE].x) < 0.12;
    },
  },
];
