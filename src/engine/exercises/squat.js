import { LM, angleDeg } from '../rules.js';

export const SQUAT_RULES = [
  {
    id: 'knees_over_toes',
    label: 'Knees track over toes',
    severity: 'error',
    cue: 'Push your knees outward in line with your toes throughout the movement.',
    check(lm) {
      const lKneeAligned = Math.abs(lm[LM.L_KNEE].x - lm[LM.L_ANKLE].x) < 0.08;
      const rKneeAligned = Math.abs(lm[LM.R_KNEE].x - lm[LM.R_ANKLE].x) < 0.08;
      return lKneeAligned && rKneeAligned;
    },
  },
  {
    id: 'back_neutral',
    label: 'Torso stays upright',
    severity: 'error',
    cue: 'Keep your chest up — avoid collapsing your torso forward.',
    check(lm) {
      const angle = angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_KNEE]);
      return angle > 90;
    },
  },
  {
    id: 'squat_depth',
    label: 'Hip reaches parallel or below',
    severity: 'warning',
    cue: 'Try to lower your hips to at least knee height for full range of motion.',
    check(lm) {
      const lDepth = lm[LM.L_HIP].y >= lm[LM.L_KNEE].y - 0.03;
      const rDepth = lm[LM.R_HIP].y >= lm[LM.R_KNEE].y - 0.03;
      return lDepth && rDepth;
    },
  },
];
